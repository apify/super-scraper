import { Actor, ProxyConfigurationOptions, RequestQueue, log } from 'apify';
import { PlaywrightCrawler, sleep } from 'crawlee';
import type { PlaywrightCrawlingContext, RequestOptions, AutoscaledPoolOptions } from 'crawlee';
import { CheerioAPI, load } from 'cheerio';
import { MemoryStorage } from '@crawlee/memory-storage';
import { ServerResponse } from 'http';
import { Page } from 'playwright';
import { IndividualInstructionReport, Instruction, InstructionsReport, TimeMeasure, UserData, VerboseResult } from './types.js';
import { addResponse, sendErrorResponseById, sendSuccResponseById } from './responses.js';
import { scrapeBasedOnExtractRules } from './extract_rules_utils.js';
import { transformTimeMeasuresToRelative } from './utils.js';

const crawlers = new Map<string, PlaywrightCrawler>();

const pushLogData = async (timeMeasures: TimeMeasure[], data: Record<string, unknown>, failed = false) => {
    timeMeasures.push({
        event: failed ? 'failed request' : 'handler end',
        time: Date.now(),
    });
    const relativeMeasures = transformTimeMeasuresToRelative(timeMeasures);
    log.info(`Measures for ${data.inputtedUrl}`, { ...relativeMeasures });
    await Actor.pushData({
        ...data,
        measures: relativeMeasures,
    });
};

const performInstruction = async (instruction: Instruction, page: Page) => {
    try {
        switch (instruction.action) {
            case 'wait': {
                await sleep(instruction.param as number);
                return 'success';
            }
            case 'click': {
                await page.click(instruction.param as string);
                return 'success';
            }
            case 'wait_for': {
                await page.waitForSelector(instruction.param as string);
                return 'success';
            }
            case 'fill': {
                const params = instruction.param as string[];
                await page.fill(params[0], params[1]);
                return 'success';
            }
            case 'scroll_x': {
                const paramX = instruction.param as number;
                await page.mouse.wheel(paramX, 0);
                return 'success';
            }
            case 'scroll_y': {
                const paramY = instruction.param as number;
                await page.mouse.wheel(0, paramY);
                return 'success';
            }
            default: {
                return 'unknown instruction';
            }
        }
    } catch (e) {
        return (e as Error).message;
    }
};

export const createAndStartCrawler = async (proxyOptions: ProxyConfigurationOptions) => {
    log.info('Creating a new crawler', { proxyOptions });

    const client = new MemoryStorage();
    const queue = await RequestQueue.open(undefined, { storageClient: client });

    const proxyConfig = await Actor.createProxyConfiguration(proxyOptions);

    const crawler = new PlaywrightCrawler({
        keepAlive: true,
        proxyConfiguration: proxyConfig,
        maxRequestRetries: 4,
        requestQueue: queue,
        statisticsOptions: {
            persistenceOptions: {
                enable: false,
            },
        },
        sessionPoolOptions: {
            persistenceOptions: {
                enable: false,
            },
        },
        autoscaledPoolOptions: {
            // We want lowest possible latency, by default the autoscaled pool is sleepy for 100-200ms
            // But this number must not be crazily low because we would spin in a hot loop wasting CPU
            maybeRunIntervalSecs: 0.01,
        },
        errorHandler: async ({ request }, err) => {
            const { requestDetails, timeMeasures } = request.userData as UserData;
            timeMeasures.push({
                event: 'error',
                time: Date.now(),
            });

            requestDetails.requestErrors.push({
                attempt: request.retryCount + 1,
                errorMessage: err.message,
            });
        },
        failedRequestHandler: async ({ request }, err) => {
            const { requestDetails, verbose, inputtedUrl, parsedInputtedParams, timeMeasures } = request.userData as UserData;
            const errorResponse = {
                errorMessage: err.message,
            };

            if (verbose) {
                const verboseResponse: VerboseResult = {
                    ...requestDetails,
                    screenshot: null,
                    requestHeaders: request.headers || {},
                    resolvedUrl: null,
                    instructionsReport: {},
                    resultType: 'error',
                    result: errorResponse,
                };
                await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: verboseResponse }, true);
                sendErrorResponseById(request.uniqueKey, JSON.stringify(verboseResponse));
            } else {
                await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: errorResponse }, true);
                sendErrorResponseById(request.uniqueKey, JSON.stringify(errorResponse));
            }
        },
        preNavigationHooks: [
            async ({ request }) => {
                const { timeMeasures } = request.userData as UserData;
                timeMeasures.push({
                    event: 'pre-navigation hook',
                    time: Date.now(),
                });
            },
        ],
        async requestHandler({ request, response, parseWithCheerio, sendRequest, page }) {
            const {
                requestDetails,
                verbose,
                extractRules,
                takeScreenshot,
                inputtedUrl,
                parsedInputtedParams,
                timeMeasures,
                instructions,
            } = request.userData as UserData;

            // See comment in crawler.autoscaledPoolOptions.runTaskFunction override
            timeMeasures.push((global as unknown as { latestRequestTaskTimeMeasure: TimeMeasure }).latestRequestTaskTimeMeasure);

            let instructionsReport: InstructionsReport = {};
            if (!request.skipNavigation && instructions.length) {
                let executed: number = 0;
                let success: number = 0;
                let failed: number = 0;
                const reports: IndividualInstructionReport[] = [];
                const start = Date.now();

                for (const instruction of instructions) {
                    const instructionStart = Date.now();
                    const result = await performInstruction(instruction, page);
                    const instructionDuration = Date.now() - instructionStart;

                    executed += 1;
                    const succeeded = result === 'success';
                    if (succeeded) {
                        success += 1;
                    } else {
                        failed += 1;
                    }

                    reports.push({
                        ...instruction,
                        duration: instructionDuration,
                        result,
                    });
                }
                const totalDuration = Date.now() - start;
                instructionsReport = {
                    executed,
                    success,
                    failed,
                    totalDuration,
                    instructions: reports,
                };
            }

            let $: CheerioAPI;
            if (request.skipNavigation) {
                const resp = await sendRequest({
                    url: request.url,
                    throwHttpErrors: true,
                    headers: request.headers,
                });
                timeMeasures.push({
                    event: 'page loaded',
                    time: Date.now(),
                });
                requestDetails.resolvedUrl = resp.url;
                requestDetails.responseHeaders = resp.headers as Record<string, string | string[]>;
                $ = load(resp.body);
            } else {
                timeMeasures.push({
                    event: 'page loaded',
                    time: Date.now(),
                });
                requestDetails.resolvedUrl = response?.url() || '';
                requestDetails.responseHeaders = response?.headers() || {};
                $ = await parseWithCheerio() as CheerioAPI;
            }

            const responseId = request.uniqueKey;

            let screenshot = null;
            if (!request.skipNavigation && verbose && takeScreenshot) {
                const screenshotBuffer = await page.screenshot({ fullPage: true });
                screenshot = screenshotBuffer.toString('base64');
            }

            if (!extractRules) {
                if (verbose) {
                    const verboseResponse: VerboseResult = {
                        ...requestDetails,
                        screenshot,
                        requestHeaders: request.headers || {},
                        instructionsReport,
                        resultType: 'html',
                        result: $.html(),
                    };
                    await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: verboseResponse });
                    sendSuccResponseById(responseId, JSON.stringify(verboseResponse), 'application/json');
                    return;
                }
                await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: $.html() });
                sendSuccResponseById(responseId, $.html(), 'text/html');
                return;
            }

            const resultFromExtractRules = scrapeBasedOnExtractRules($ as CheerioAPI, extractRules);
            if (verbose) {
                const verboseResponse: VerboseResult = {
                    ...requestDetails,
                    screenshot,
                    requestHeaders: request.headers || {},
                    instructionsReport,
                    resultType: 'json',
                    result: resultFromExtractRules,
                };
                await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: verboseResponse });
                sendSuccResponseById(responseId, JSON.stringify(verboseResponse), 'application/json');
            } else {
                await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: resultFromExtractRules });
                sendSuccResponseById(responseId, JSON.stringify(resultFromExtractRules), 'application/json');
            }
        },
    });

    // TODO: This is just for Crawlee perf measurement, remove it once we properly understand the bottlenecks
    // @ts-expect-error Overriding internal method
    const origRunTaskFunction = crawler.autoscaledPoolOptions.runTaskFunction.bind(crawler);
    // @ts-expect-error Overriding internal method
    crawler.autoscaledPoolOptions.runTaskFunction = async function () {
        // This code runs before we pull request from queue so we have to approximate that by having mutable global
        // It will ofc be wrong if someone bombs requests with interval shorter than 1 sec
        (global as unknown as { latestRequestTaskTimeMeasure: TimeMeasure }).latestRequestTaskTimeMeasure = {
            event: 'crawlee internal run task',
            time: Date.now(),
        };
        await (origRunTaskFunction as AutoscaledPoolOptions['runTaskFunction'])!();
    };

    // @ts-expect-error Overriding internal method
    const origRunRequestHandler = crawler._runRequestHandler.bind(crawler);
    // @ts-expect-error Overriding internal method
    crawler._runRequestHandler = async function (context: PlaywrightCrawlingContext<UserData>) {
        context.request.userData.timeMeasures.push({
            event: 'crawlee internal request handler',
            time: Date.now(),
        });
        await origRunRequestHandler(context);
    };

    await crawler.stats.stopCapturing();
    crawler.run().then(() => log.warning(`Crawler ended`, { proxyOptions }), () => { });
    crawlers.set(JSON.stringify(proxyOptions), crawler);
    log.info('Crawler ready 🫡', { proxyOptions });
    return crawler;
};

export const adddRequest = async (request: RequestOptions<UserData>, proxyOptions: ProxyConfigurationOptions, res: ServerResponse) => {
    const key = JSON.stringify(proxyOptions);
    const crawler = crawlers.has(key) ? crawlers.get(key)! : await createAndStartCrawler(proxyOptions);

    addResponse(request.uniqueKey!, res);

    request.userData?.timeMeasures.push({
        event: 'before queue add',
        time: Date.now(),
    });
    await crawler.addRequests([request]);
};

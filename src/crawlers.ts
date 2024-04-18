/* eslint-disable max-len */
import { Actor, RequestQueue, log } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import type { PlaywrightCrawlingContext, RequestOptions, AutoscaledPoolOptions } from 'crawlee';
import { CheerioAPI, load } from 'cheerio';
import { MemoryStorage } from '@crawlee/memory-storage';
import { ServerResponse } from 'http';
import { TimeMeasure, UserData, VerboseResult, CrawlerOptions, IFrameData, XHRRequestData, FullJsScenarioReport } from './types.js';
import { addResponse, sendErrorResponseById, sendSuccResponseById } from './responses.js';
import { scrapeBasedOnExtractRules } from './extract_rules_utils.js';
import { transformTimeMeasuresToRelative } from './utils.js';
import { performInstructionsAndGenerateReport } from './instructions_utils.js';

const crawlers = new Map<string, PlaywrightCrawler>();

export const DEFAULT_CRAWLER_OPTIONS: CrawlerOptions = {
    proxyConfigurationOptions: {},
};

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

export const createAndStartCrawler = async (crawlerOptions: CrawlerOptions = DEFAULT_CRAWLER_OPTIONS) => {
    log.info('Creating a new crawler', crawlerOptions);

    const client = new MemoryStorage();
    const queue = await RequestQueue.open(undefined, { storageClient: client });

    const proxyConfig = await Actor.createProxyConfiguration(crawlerOptions.proxyConfigurationOptions);

    const crawler = new PlaywrightCrawler({
        keepAlive: true,
        proxyConfiguration: proxyConfig,
        maxRequestRetries: 3,
        requestQueue: queue,
        launchContext: {
            browserPerProxy: false,
        },
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
        errorHandler: async ({ request }, err) => {
            const { requestDetails, timeMeasures, transparentStatusCode } = request.userData as UserData;
            timeMeasures.push({
                event: 'error',
                time: Date.now(),
            });

            requestDetails.requestErrors.push({
                attempt: request.retryCount + 1,
                errorMessage: err.message,
            });

            if (transparentStatusCode) {
                request.noRetry = true;
            }
        },
        failedRequestHandler: async ({ request, response, page }, err) => {
            const { requestDetails, jsonResponse, inputtedUrl, parsedInputtedParams, timeMeasures, transparentStatusCode, nonbrowserRequestStatus } = request.userData as UserData;
            const errorResponse = {
                errorMessage: err.message,
            };

            const responseStatusCode = request.skipNavigation ? nonbrowserRequestStatus! : (response?.status() || null);
            let statusCode = 500;
            if (transparentStatusCode && responseStatusCode) {
                statusCode = responseStatusCode;
            }
            if (jsonResponse) {
                const verboseResponse: VerboseResult = {
                    body: errorResponse,
                    cookies: await page.context().cookies(request.url) || [],
                    evaluateResults: [],
                    jsScenarioReport: {},
                    headers: requestDetails.responseHeaders || {},
                    type: 'json',
                    iframes: [],
                    xhr: [],
                    initialStatusCode: responseStatusCode,
                    resolvedUrl: '',
                    screenshot: null,
                };
                await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: verboseResponse }, true);
                sendErrorResponseById(request.uniqueKey, JSON.stringify(verboseResponse), statusCode);
            } else {
                await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: errorResponse }, true);
                sendErrorResponseById(request.uniqueKey, JSON.stringify(errorResponse), statusCode);
            }
        },
        preNavigationHooks: [
            async ({ request, page, blockRequests }) => {
                const { timeMeasures, blockResources, width, height } = request.userData as UserData;
                timeMeasures.push({
                    event: 'pre-navigation hook',
                    time: Date.now(),
                });

                await page.setViewportSize({ width, height });

                if (!request.skipNavigation && blockResources) {
                    await blockRequests({
                        extraUrlPatterns: ['*.svg'],
                    });
                }
            },
        ],
        async requestHandler({ request, response, parseWithCheerio, sendRequest, page }) {
            const {
                requestDetails,
                jsonResponse,
                extractRules,
                screenshotSettings,
                inputtedUrl,
                parsedInputtedParams,
                timeMeasures,
                jsScenario,
                returnPageSource,
                blockResourceTypes,
            } = request.userData as UserData;

            // See comment in crawler.autoscaledPoolOptions.runTaskFunction override
            timeMeasures.push((global as unknown as { latestRequestTaskTimeMeasure: TimeMeasure }).latestRequestTaskTimeMeasure);

            const renderJs = !request.skipNavigation;

            if (renderJs && blockResourceTypes.length) {
                await page.route('**', async (route) => {
                    if (blockResourceTypes.includes(route.request().resourceType())) {
                        await route.abort();
                    }
                });
            }

            const xhr: XHRRequestData[] = [];
            if (renderJs && jsonResponse) {
                page.on('response', async (resp) => {
                    const req = resp.request();
                    if (req.resourceType() !== 'xhr') {
                        return;
                    }

                    xhr.push({
                        url: req.url(),
                        statusCode: resp.status(),
                        method: req.method(),
                        requestHeaders: req.headers(),
                        headers: resp.headers(),
                        body: (await resp.body()).toString(),
                    });
                });
            }

            const jsScenarioReportFull: FullJsScenarioReport = {};
            if (renderJs && jsScenario.instructions.length) {
                const { jsScenarioReport, evaluateResults } = await performInstructionsAndGenerateReport(jsScenario, page);
                jsScenarioReportFull.jsScenarioReport = jsScenarioReport;
                jsScenarioReportFull.evaluateResults = evaluateResults;
            }

            let statusCode: number | null;
            let $: CheerioAPI;
            if (!renderJs) {
                const resp = await sendRequest({
                    url: request.url,
                    throwHttpErrors: false,
                    headers: request.headers,
                });
                timeMeasures.push({
                    event: 'page loaded',
                    time: Date.now(),
                });
                statusCode = resp.statusCode;
                if (resp.statusCode >= 300 && resp.statusCode !== 404) {
                    (request.userData as UserData).nonbrowserRequestStatus = resp.statusCode;
                    throw new Error(`HTTPError: Response code ${resp.statusCode}`);
                }
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
                statusCode = response?.status() || null;
            }

            const responseId = request.uniqueKey;

            const cookies = await page.context().cookies(request.url) || [];

            const iframes: IFrameData[] = [];
            if (renderJs && jsonResponse) {
                const frames = page.frames();
                for (const frame of frames) {
                    let frameEl;
                    try {
                        frameEl = await frame.frameElement();
                    } catch (e) {
                        continue;
                    }

                    const src = await frameEl.getAttribute('src') || '';
                    const content = await frame.content();

                    iframes.push({
                        src,
                        content,
                    });
                }
            }

            let screenshot = null;
            if (renderJs && screenshotSettings.screenshotType !== 'none') {
                const { screenshotType, selector } = screenshotSettings;
                let screenshotBuffer: Buffer;
                if (screenshotType === 'full') {
                    screenshotBuffer = await page.screenshot({ fullPage: true });
                } else if (screenshotType === 'window') {
                    screenshotBuffer = await page.screenshot();
                } else {
                    screenshotBuffer = await page.locator(selector as string).screenshot();
                }
                screenshot = screenshotBuffer.toString('base64');

                if (!jsonResponse) {
                    await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: screenshot });
                    sendSuccResponseById(responseId, screenshotBuffer, 'image/png');
                    return;
                }
            }

            if (!extractRules) {
                // response.body() contains HTML of the page before js rendering
                const htmlResult = returnPageSource && renderJs
                    ? (await response?.body())?.toString() as string
                    : $.html();

                if (jsonResponse) {
                    const verboseResponse: VerboseResult = {
                        body: htmlResult,
                        cookies,
                        evaluateResults: jsScenarioReportFull.evaluateResults || [],
                        jsScenarioReport: jsScenarioReportFull.jsScenarioReport || {},
                        headers: requestDetails.responseHeaders,
                        type: 'html',
                        iframes,
                        xhr,
                        initialStatusCode: statusCode,
                        resolvedUrl: requestDetails.resolvedUrl,
                        screenshot,
                    };
                    await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: verboseResponse });
                    sendSuccResponseById(responseId, JSON.stringify(verboseResponse), 'application/json');
                    return;
                }
                await pushLogData(timeMeasures, { inputtedUrl, parsedInputtedParams, result: htmlResult });
                sendSuccResponseById(responseId, htmlResult, 'text/html');
                return;
            }

            const resultFromExtractRules = scrapeBasedOnExtractRules($ as CheerioAPI, extractRules);
            if (jsonResponse) {
                const verboseResponse: VerboseResult = {
                    body: resultFromExtractRules,
                    cookies,
                    evaluateResults: jsScenarioReportFull.evaluateResults || [],
                    jsScenarioReport: jsScenarioReportFull.jsScenarioReport || {},
                    headers: requestDetails.responseHeaders,
                    type: 'json',
                    iframes,
                    xhr,
                    initialStatusCode: statusCode,
                    resolvedUrl: requestDetails.resolvedUrl,
                    screenshot,
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
    crawler.run().then(() => log.warning(`Crawler ended`, crawlerOptions), () => { });
    crawlers.set(JSON.stringify(crawlerOptions), crawler);
    log.info('Crawler ready 🫡', crawlerOptions);
    return crawler;
};

export const adddRequest = async (request: RequestOptions<UserData>, res: ServerResponse, crawlerOptions: CrawlerOptions) => {
    const key = JSON.stringify(crawlerOptions);
    const crawler = crawlers.has(key) ? crawlers.get(key)! : await createAndStartCrawler(crawlerOptions);

    addResponse(request.uniqueKey!, res);

    request.userData?.timeMeasures.push({
        event: 'before queue add',
        time: Date.now(),
    });
    await crawler.requestQueue!.addRequest(request);
};

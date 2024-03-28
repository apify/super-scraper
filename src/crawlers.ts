import { Actor, ProxyConfigurationOptions, RequestQueue, log } from 'apify';
import { PlaywrightCrawler, RequestOptions } from 'crawlee';
import { CheerioAPI, load } from 'cheerio';
import { MemoryStorage } from '@crawlee/memory-storage';
import { ServerResponse } from 'http';
import { TimeMeasure, UserData, VerboseResult } from './types.js';
import { addResponse, sendErrorResponseById, sendSuccResponseById } from './responses.js';
import { scrapeBasedOnExtractRules } from './extract_rules_utils.js';
import { transformTimeMeasuresToRelative } from './utils.js';

const crawlers = new Map<string, PlaywrightCrawler>();

const pushLogData = async (timeMeasures: TimeMeasure[], data: Record<string, unknown>, failed = false) => {
    timeMeasures.push({
        event: failed ? 'failed request' : 'handler end',
        time: Date.now(),
    });
    await Actor.pushData({
        ...data,
        measures: transformTimeMeasuresToRelative(timeMeasures),
    });
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
            const { requestDetails, verbose, extractRules, takeScreenshot, inputtedUrl, parsedInputtedParams, timeMeasures } = request.userData as UserData;

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

    crawler.run().then(() => log.warning(`Crawler ended`, { proxyOptions }), () => {});
    crawlers.set(JSON.stringify(proxyOptions), crawler);
    log.info('Crawler ready 🫡', { proxyOptions });
    return crawler;
};

export const adddRequest = async (request: RequestOptions, proxyOptions: ProxyConfigurationOptions, res: ServerResponse) => {
    const key = JSON.stringify(proxyOptions);
    const crawler = crawlers.has(key) ? crawlers.get(key)! : await createAndStartCrawler(proxyOptions);
    addResponse(request.uniqueKey!, res);
    await crawler.addRequests([request]);
};

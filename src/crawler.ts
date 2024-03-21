import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { CheerioAPI, load } from 'cheerio';
import { UserData, VerboseResult } from './types.js';
import { sendErrorResponseById, sendSuccResponseById } from './responses.js';
import { scrapeBasedOnExtractRules } from './extract_rules_utils.js';

export const crawler = new PlaywrightCrawler({
    keepAlive: true,
    proxyConfiguration: await Actor.createProxyConfiguration(),
    maxRequestRetries: 4,
    errorHandler: async ({ request }, err) => {
        const { requestDetails } = request.userData as UserData;
        requestDetails.requestErrors.push({
            attempt: request.retryCount + 1,
            errorMessage: err.message,
        });
    },
    failedRequestHandler: async ({ request }, err) => {
        const { requestDetails, verbose, inputtedUrl, parsedInputtedParams } = request.userData as UserData;
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
            await Actor.pushData({ inputtedUrl, parsedInputtedParams, result: verboseResponse });
            sendErrorResponseById(request.uniqueKey, JSON.stringify(verboseResponse));
        } else {
            await Actor.pushData({ inputtedUrl, parsedInputtedParams, result: errorResponse });
            sendErrorResponseById(request.uniqueKey, JSON.stringify(errorResponse));
        }
    },
    async requestHandler({ request, response, parseWithCheerio, sendRequest, page }) {
        const { requestDetails, verbose, extractRules, takeScreenshot, inputtedUrl, parsedInputtedParams } = request.userData as UserData;

        let $: CheerioAPI;
        if (request.skipNavigation) {
            const resp = await sendRequest({
                url: request.url,
                throwHttpErrors: true,
                headers: request.headers,
            });
            requestDetails.resolvedUrl = resp.url;
            requestDetails.responseHeaders = resp.headers as Record<string, string | string[]>;
            $ = load(resp.body);
        } else {
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
                await Actor.pushData({ inputtedUrl, parsedInputtedParams, result: verboseResponse });
                sendSuccResponseById(responseId, JSON.stringify(verboseResponse), 'application/json');
                return;
            }
            await Actor.pushData({ inputtedUrl, parsedInputtedParams, result: $.html() });
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
            await Actor.pushData({ inputtedUrl, parsedInputtedParams, result: verboseResponse });
            sendSuccResponseById(responseId, JSON.stringify(verboseResponse), 'application/json');
        } else {
            await Actor.pushData({ inputtedUrl, parsedInputtedParams, result: resultFromExtractRules });
            sendSuccResponseById(responseId, JSON.stringify(resultFromExtractRules), 'application/json');
        }
    },
});

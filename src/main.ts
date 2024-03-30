import { Actor, ProxyConfigurationOptions, log } from 'apify';
import { RequestOptions } from 'crawlee';
import { createServer } from 'http';
import { parse } from 'querystring';
import { v4 as uuidv4 } from 'uuid';
import type { ParsedUrlQuery } from 'querystring';
import { RequestDetails, ScreenshotSettings, UserData } from './types.js';
import { adddRequest, createAndStartCrawler } from './crawlers.js';
import { validateAndTransformExtractRules } from './extract_rules_utils.js';
import { parseAndValidateInstructions } from './instructions_utils.js';
import { sendErrorResponseById } from './responses.js';

await Actor.init();

const createProxyOptions = (params: ParsedUrlQuery) => {
    const proxyOptions: ProxyConfigurationOptions = {};
    if (params.own_proxy) {
        proxyOptions.proxyUrls = [params.own_proxy as string];
        return proxyOptions;
    }

    const usePremium = params.premium_proxy === 'true';
    if (usePremium) {
        proxyOptions.groups = ['RESIDENTIAL'];
    }

    if (params.country_code) {
        const countryCode = (params.country_code as string).toUpperCase();
        if (countryCode.length !== 2) {
            throw new Error('Parameter country_code must be a string of length 2');
        }
        if (!usePremium && countryCode !== 'US') {
            throw new Error('Parameter country_code must be used with premium_proxy set to true when using non-US country');
        }
        proxyOptions.countryCode = countryCode;
    }
    return proxyOptions;
};

const server = createServer(async (req, res) => {
    const requestRecieved = Date.now();
    log.info(`URL: ${req.method} ${req.url}`);
    try {
        const params = parse(req.url!.slice(2));

        if (!params.url || !params.url.length) {
            throw new Error('Parameter url is either missing or empty');
        }
        const urlToScrape = params.url as string;

        const proxyOptions = createProxyOptions(params);

        const useExtractRules = !!params.extract_rules; // using !! casts non-bool to bool
        let inputtedExtractRules;
        if (useExtractRules) {
            inputtedExtractRules = JSON.parse(params.extract_rules as string);
        }

        const doInstructions = !!params.js_instructions;
        const instructions = doInstructions ? parseAndValidateInstructions(params.js_instructions as string) : [];

        const useBrowser = params.use_browser === 'true';
        if (useBrowser && params.wait) {
            const parsedWait = Number.parseInt(params.wait as string, 10);
            if (Number.isNaN(parsedWait)) {
                throw new Error('Number value expected for wait parameter');
            } else {
                instructions.unshift({
                    action: 'wait',
                    param: Math.min(parsedWait, 35000),
                });
            }
        }

        if (useBrowser && params.wait_for) {
            const waitForSelector = params.wait_for;
            if (typeof waitForSelector !== 'string' || !waitForSelector.length) {
                throw new Error('Non-empty selector expected for wait_for parameter');
            } else {
                instructions.unshift({
                    action: 'wait_for',
                    param: waitForSelector,
                });
            }
        }

        if (useBrowser && params.wait_browser) {
            const waitForBrowserState = params.wait_browser as string;
            if (!['load', 'domcontentloaded', 'networkidle'].includes(waitForBrowserState)) {
                throw new Error('Unsupported value for wait_browser parameter');
            } else {
                instructions.unshift({
                    action: 'wait_browser',
                    param: waitForBrowserState,
                });
            }
        }

        const requestDetails: RequestDetails = {
            usedApifyProxies: true,
            requestErrors: [],
            resolvedUrl: null,
            responseHeaders: null,
        };

        const screenshotSettings: ScreenshotSettings = {
            screenshotType: 'none',
        };
        if (params.screenshot === 'true') {
            screenshotSettings.screenshotType = 'window';
        }
        if (params.screenshot_full_page === 'true') {
            screenshotSettings.screenshotType = 'full';
        }
        if (params.screenshot_selector) {
            if (typeof params.screenshot_selector !== 'string') {
                throw new Error('Parameter screenshot_selector must be a string');
            }
            screenshotSettings.screenshotType = 'selector';
            screenshotSettings.selector = params.screenshot_selector;
        }

        const finalRequest: RequestOptions<UserData> = {
            url: urlToScrape,
            uniqueKey: uuidv4(),
            headers: {},
            skipNavigation: !useBrowser,
            userData: {
                verbose: params.verbose === 'true',
                screenshotSettings,
                requestDetails,
                extractRules: useExtractRules ? validateAndTransformExtractRules(inputtedExtractRules) : null,
                inputtedUrl: req.url as string,
                parsedInputtedParams: params,
                timeMeasures: [{
                    event: 'request received',
                    time: requestRecieved,
                }],
                instructions,
                blockResources: !(params.block_resources === 'false'),
                width: Number.parseInt(params.window_width as string, 10) || 1920,
                height: Number.parseInt(params.window_height as string, 10) || 1080,
                returnPageSource: params.return_page_source === 'true',
                transparentStatusCode: params.transparent_status_code === 'true',
            },
        };

        if (params.headers) {
            const headers = JSON.parse(params.headers as string);
            finalRequest.headers = {
                ...headers,
            };
        }

        if (params.cookies) {
            finalRequest.headers!.Cookie = params.cookies as string;
        }

        // TODO -> do we want some default timeout for requests? Scrapingbee has 140 000 ms
        // also, do we want to limit the timeout? Scrapingbee's timeout must be between 1000 and 140000
        if (params.timeout) {
            const timeoutNumber = Number.parseInt(params.timeout as string, 10);
            if (Number.isNaN(timeoutNumber)) {
                throw new Error('Parameter timeout must be a number');
            }
            setTimeout(() => {
                const timeoutErrorMessage = {
                    errorMessage: `Response timed out.`,
                };
                sendErrorResponseById(finalRequest.uniqueKey!, JSON.stringify(timeoutErrorMessage));
            }, timeoutNumber);
        }
        await adddRequest(finalRequest, proxyOptions, res);
    } catch (e) {
        const errorMessage = {
            errorMessage: (e as Error).message,
        };
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(errorMessage));
    }
});

const port = Actor.isAtHome() ? process.env.ACTOR_STANDBY_PORT : 8080;
server.listen(port, async () => {
    log.info('Stand-by Actor is listening 🫡');
    // have crawler with default proxy config ready
    await createAndStartCrawler({});
});

import { Actor, ProxyConfigurationOptions, log } from 'apify';
import { RequestOptions } from 'crawlee';
import { createServer } from 'http';
import { parse } from 'querystring';
import { v4 as uuidv4 } from 'uuid';
import type { ParsedUrlQuery } from 'querystring';
import { HeaderGenerator } from 'header-generator';
import { CrawlerOptions, JsScenario, RequestDetails, ScreenshotSettings, UserData } from './types.js';
import { adddRequest, createAndStartCrawler, DEFAULT_CRAWLER_OPTIONS } from './crawlers.js';
import { validateAndTransformExtractRules } from './extract_rules_utils.js';
import { parseAndValidateInstructions } from './instructions_utils.js';
import { addTimeoutToAllResponses, sendErrorResponseById } from './responses.js';
import { ScrapingAnt, ScrapingBee } from './params.js';
import { isValidResourceType } from './utils.js';

await Actor.init();

if (Actor.isAtHome() && Actor.getEnv().metaOrigin !== 'STANDBY') {
    await Actor.fail('The Actor must start by being called using its Standby endpoint.');
}

Actor.on('migrating', () => {
    addTimeoutToAllResponses(60);
});

const createProxyOptions = (params: ParsedUrlQuery) => {
    const proxyOptions: ProxyConfigurationOptions = {};

    const proxyType = params[ScrapingAnt.proxyType] as string || 'datacenter';
    if (proxyType !== 'datacenter' && proxyType !== 'residential') {
        throw new Error('Parameter proxy_type can be either residential or datacenter');
    }

    const useGoogleProxy = params[ScrapingBee.customGoogle] === 'true';
    const url = new URL(params[ScrapingBee.url] as string);
    if (url.host.includes('google') && !useGoogleProxy) {
        throw new Error('Set param custom_google to true to scrape Google urls');
    }
    if (useGoogleProxy) {
        proxyOptions.groups = ['GOOGLE_SERP'];
        return proxyOptions;
    }

    if (params[ScrapingBee.ownProxy]) {
        proxyOptions.proxyUrls = [params[ScrapingBee.ownProxy] as string];
        return proxyOptions;
    }

    const usePremium = params[ScrapingBee.premiumProxy] === 'true' || params[ScrapingBee.stealthProxy] === 'true' || proxyType === 'residential';
    if (usePremium) {
        proxyOptions.groups = ['RESIDENTIAL'];
    }

    if (params[ScrapingBee.countryCode]) {
        const countryCode = (params[ScrapingBee.countryCode] as string).toUpperCase();
        if (countryCode.length !== 2) {
            throw new Error('Parameter country_code must be a string of length 2');
        }
        if (!usePremium && countryCode !== 'US') {
            throw new Error('Parameter country_code must be used with premium_proxy or stealth_proxy set to true when using non-US country');
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

        if (!params[ScrapingBee.url] || !params[ScrapingBee.url].length) {
            throw new Error('Parameter url is either missing or empty');
        }
        const urlToScrape = params[ScrapingBee.url] as string;

        const useExtractRules = !!params[ScrapingBee.extractRules]; // using !! casts non-bool to bool
        let inputtedExtractRules;
        if (useExtractRules) {
            inputtedExtractRules = JSON.parse(params[ScrapingBee.extractRules] as string);
        }

        let selectedDevice: 'desktop' | 'mobile' = 'desktop';
        if (params[ScrapingBee.device]) {
            const device = params[ScrapingBee.device] as string;
            if (device === 'mobile') {
                selectedDevice = 'mobile';
            }

            if (device !== 'desktop' && device !== 'mobile') {
                throw new Error('Param device can be either desktop or mobile');
            }
        }

        const headerGenerator = new HeaderGenerator({
            devices: [selectedDevice],
        });
        const generatedHeaders = headerGenerator.getHeaders();

        const doScenario = !!params[ScrapingBee.jsScenario];
        const jsScenario: JsScenario = doScenario
            ? parseAndValidateInstructions(params[ScrapingBee.jsScenario] as string)
            : { instructions: [], strict: false };

        const renderJs = !(params[ScrapingBee.renderJs] === 'false' || params[ScrapingAnt.browser] === 'false');

        if (renderJs && params[ScrapingBee.wait]) {
            const parsedWait = Number.parseInt(params[ScrapingBee.wait] as string, 10);
            if (Number.isNaN(parsedWait)) {
                throw new Error('Number value expected for wait parameter');
            } else {
                jsScenario.instructions.unshift({
                    action: 'wait',
                    param: Math.min(parsedWait, 35000),
                });
            }
        }

        if (renderJs && (params[ScrapingBee.waitFor] || params[ScrapingAnt.waitForSelector])) {
            const waitForSelector = params[ScrapingBee.waitFor] || params[ScrapingAnt.waitForSelector];
            if (typeof waitForSelector !== 'string' || !waitForSelector.length) {
                throw new Error('Non-empty selector expected for wait_for and wait_for_selector parameters');
            } else {
                jsScenario.instructions.unshift({
                    action: 'wait_for',
                    param: waitForSelector,
                });
            }
        }

        if (renderJs && params[ScrapingBee.waitBrowser]) {
            const waitForBrowserState = params[ScrapingBee.waitBrowser] as string;
            if (!['load', 'domcontentloaded', 'networkidle'].includes(waitForBrowserState)) {
                throw new Error('Unsupported value for wait_browser parameter');
            } else {
                jsScenario.instructions.unshift({
                    action: 'wait_browser',
                    param: waitForBrowserState,
                });
            }
        }

        if (renderJs && params[ScrapingAnt.jsSnippet]) {
            const jsSnippetBase64 = params[ScrapingAnt.jsSnippet] as string;
            if (!jsSnippetBase64.length) {
                throw new Error('Parameter js_snippet must be a non empty string');
            }
            const jsSnippet = Buffer.from(jsSnippetBase64, 'base64').toString();
            if (!jsSnippet.length) {
                throw new Error('Decoding of js_snippet was not successful');
            }
            jsScenario.instructions.unshift({
                action: 'evaluate',
                param: jsSnippet,
            });
        }

        const requestDetails: RequestDetails = {
            requestErrors: [],
            resolvedUrl: null,
            responseHeaders: null,
        };

        const screenshotSettings: ScreenshotSettings = {
            screenshotType: 'none',
        };
        if (params[ScrapingBee.screenshot] === 'true') {
            screenshotSettings.screenshotType = 'window';
        }
        if (params[ScrapingBee.screenshotFullPage] === 'true') {
            screenshotSettings.screenshotType = 'full';
        }
        if (params[ScrapingBee.screenshotSelector]) {
            if (typeof params[ScrapingBee.screenshotSelector] !== 'string') {
                throw new Error('Parameter screenshot_selector must be a string');
            }
            screenshotSettings.screenshotType = 'selector';
            screenshotSettings.selector = params[ScrapingBee.screenshotSelector];
        }

        let blockResourceTypes: string[] = [];
        if (params[ScrapingAnt.blockResource]) {
            const paramValue = params[ScrapingAnt.blockResource];
            const resources = Array.isArray(paramValue) ? paramValue : [paramValue];
            const resourcesToBlock = new Set<string>();
            for (const resource of resources) {
                if (isValidResourceType(resource)) {
                    resourcesToBlock.add(resource);
                } else {
                    throw new Error(`Unsupported value in block_resource: ${resource}`);
                }
            }
            blockResourceTypes = Array.from(resourcesToBlock.values());
        }

        const finalRequest: RequestOptions<UserData> = {
            url: urlToScrape,
            uniqueKey: uuidv4(),
            headers: {
                ...generatedHeaders,
            },
            skipNavigation: !renderJs,
            userData: {
                jsonResponse: params[ScrapingBee.jsonResponse] === 'true',
                screenshotSettings,
                requestDetails,
                extractRules: useExtractRules ? validateAndTransformExtractRules(inputtedExtractRules) : null,
                inputtedUrl: req.url as string,
                parsedInputtedParams: params,
                timeMeasures: [{
                    event: 'request received',
                    time: requestRecieved,
                }],
                jsScenario,
                blockResources: !(params[ScrapingBee.blockResources] === 'false'),
                width: Number.parseInt(params[ScrapingBee.windowWidth] as string, 10) || 1920,
                height: Number.parseInt(params[ScrapingBee.windowHeight] as string, 10) || 1080,
                returnPageSource: params[ScrapingBee.returnPageSource] === 'true',
                transparentStatusCode: params[ScrapingBee.transparentStatusCode] === 'true',
                blockResourceTypes,
            },
        };

        if (params[ScrapingBee.forwardHeaders] === 'true' || params[ScrapingBee.forwardHeadersPure] === 'true') {
            const reqHeaders = req.headers;
            const headersToForward: Record<string, string> = {};
            for (const headerKey of Object.keys(reqHeaders)) {
                if (headerKey.startsWith('spb-') || headerKey.startsWith('ant-')) {
                    const withoutPrefixKey = headerKey.slice(4);

                    // scraping bee ingores these
                    const skippedHeaders = ['cookie', 'set-cookie', 'host'];
                    if (skippedHeaders.includes(withoutPrefixKey)) {
                        continue;
                    }

                    // header values other than 'set-cookie' should be string (not string[]), but there's a check just in case
                    const headerValue = reqHeaders[headerKey];
                    if (Array.isArray(headerValue)) {
                        continue;
                    }
                    headersToForward[withoutPrefixKey] = headerValue as string;
                }
            }

            if (params[ScrapingBee.forwardHeaders] === 'true') {
                const currentHeaders = finalRequest.headers;
                finalRequest.headers = {
                    ...currentHeaders,
                    ...headersToForward,
                };
            } else {
                finalRequest.headers = {
                    ...headersToForward,
                };
            }
        }

        if (params[ScrapingBee.cookies]) {
            finalRequest.headers!.Cookie = params[ScrapingBee.cookies] as string;
        }

        // TODO -> do we want some default timeout for requests? Scrapingbee has 140 000 ms
        // also, do we want to limit the timeout? Scrapingbee's timeout must be between 1000 and 140000
        if (params[ScrapingBee.timeout]) {
            const timeoutNumber = Number.parseInt(params[ScrapingBee.timeout] as string, 10);
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

        const crawlerOptions: CrawlerOptions = {
            proxyConfigurationOptions: createProxyOptions(params),
        };
        await adddRequest(finalRequest, res, crawlerOptions);
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
    log.info('Stand-by Actor is listening');

    // Pre-create common crawlers because crawler init can take about 1 sec
    await Promise.all([
        createAndStartCrawler(DEFAULT_CRAWLER_OPTIONS),
        createAndStartCrawler({ ...DEFAULT_CRAWLER_OPTIONS, proxyConfigurationOptions: { groups: ['RESIDENTIAL'] } }),
    ]);
});

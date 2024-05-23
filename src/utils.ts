import type { ParsedUrlQuery } from 'querystring';
import { parse } from 'querystring';
import type { IncomingMessage } from 'http';
import { RequestOptions } from 'crawlee';
import { v4 as uuidv4 } from 'uuid';
import { HeaderGenerator } from 'header-generator';
import { ProxyConfigurationOptions } from 'apify';
import { TimeMeasure, JsScenario, RequestDetails, ScreenshotSettings, UserData } from './types.js';
import { EquivalentParameters, ScrapingBee, ScraperApi, ScrapingAnt } from './params.js';
import { UserInputError } from './errors.js';
import { validateAndTransformExtractRules } from './extract_rules_utils.js';
import { parseAndValidateInstructions } from './instructions_utils.js';

export const transformTimeMeasuresToRelative = (timeMeasures: TimeMeasure[]): TimeMeasure[] => {
    const firstMeasure = timeMeasures[0].time;
    return timeMeasures.map((measure) => {
        return {
            event: measure.event,
            time: measure.time - firstMeasure,
        };
    }).sort((a, b) => a.time - b.time);
};

// eslint-disable-next-line max-len
const validResources = ['document', 'stylesheet', 'image', 'media', 'font', 'script', 'texttrack', 'xhr', 'fetch', 'eventsource', 'websocket', 'manifest', 'other'];
export const isValidResourceType = (resource: string) => {
    return validResources.includes(resource);
};

function mapEquivalentParams(params: ParsedUrlQuery) {
    for (const [ScrapingBeeParam, EquivalentParams] of Object.entries(EquivalentParameters)) {
        if (params[ScrapingBeeParam]) {
            continue;
        }
        for (const eqParam of EquivalentParams) {
            if (params[eqParam]) {
                params[ScrapingBeeParam] = params[eqParam];
                continue;
            }
        }
    }
    return params;
}

export function parseParameters(url: string) {
    const params = parse(url.slice(2));
    return mapEquivalentParams(params);
}

export function createRequestForCrawler(params: ParsedUrlQuery, req: IncomingMessage): RequestOptions<UserData> {
    if (!params[ScrapingBee.url] || !params[ScrapingBee.url].length) {
        throw new UserInputError('Parameter url is either missing or empty');
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
            throw new UserInputError('Param device can be either desktop or mobile');
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

    const renderJs = !(params[ScrapingBee.renderJs] === 'false'
        || params[ScrapingAnt.browser] === 'false'
        || params[ScraperApi.render] === 'false');

    if (renderJs && params[ScrapingBee.wait]) {
        const parsedWait = Number.parseInt(params[ScrapingBee.wait] as string, 10);
        if (Number.isNaN(parsedWait)) {
            throw new UserInputError('Number value expected for wait parameter');
        } else {
            jsScenario.instructions.unshift({
                action: 'wait',
                param: Math.min(parsedWait, 35000),
            });
        }
    }

    if (renderJs && (params[ScrapingBee.waitFor])) {
        const waitForSelector = params[ScrapingBee.waitFor];
        if (typeof waitForSelector !== 'string' || !waitForSelector.length) {
            throw new UserInputError('Non-empty selector expected for wait_for and wait_for_selector parameters');
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
            throw new UserInputError('Unsupported value for wait_browser parameter');
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
            throw new UserInputError('Parameter js_snippet must be a non empty string');
        }
        const jsSnippet = Buffer.from(jsSnippetBase64, 'base64').toString();
        if (!jsSnippet.length) {
            throw new UserInputError('Decoding of js_snippet was not successful');
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
            throw new UserInputError('Parameter screenshot_selector must be a string');
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
                throw new UserInputError(`Unsupported value in block_resource: ${resource}`);
            }
        }
        blockResourceTypes = Array.from(resourcesToBlock.values());
    }

    let binaryTarget = false;
    if (params[ScraperApi.binaryTarget]) {
        const binaryTargetIsTrue = params[ScraperApi.binaryTarget] === 'true';
        if (binaryTargetIsTrue && renderJs) {
            throw new UserInputError('Param binary_target can be used only when JS rendering is set to false (render_js, browser, render)');
        }
        binaryTarget = binaryTargetIsTrue;
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
            timeMeasures: [],
            jsScenario,
            blockResources: !(params[ScrapingBee.blockResources] === 'false'),
            width: Number.parseInt(params[ScrapingBee.windowWidth] as string, 10) || 1920,
            height: Number.parseInt(params[ScrapingBee.windowHeight] as string, 10) || 1080,
            returnPageSource: params[ScrapingBee.returnPageSource] === 'true',
            transparentStatusCode: params[ScrapingBee.transparentStatusCode] === 'true',
            blockResourceTypes,
            binaryTarget,
        },
    };

    // headers with ant/spb prefixes
    if (params[ScrapingBee.forwardHeaders] === 'true' || params[ScrapingBee.forwardHeadersPure] === 'true') {
        const reqHeaders = req.headers;
        const headersToForward: Record<string, string> = {};
        for (const headerKey of Object.keys(reqHeaders)) {
            if (headerKey.startsWith('spb-') || headerKey.startsWith('ant-')) {
                const withoutPrefixKey = headerKey.slice(4);

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
            // forward headers pure
            finalRequest.headers = {
                ...headersToForward,
            };
        }
    }

    // all headers
    if (params[ScraperApi.keepHeaders] === 'true') {
        const reqHeaders = req.headers;
        const headersToForward: Record<string, string> = {};
        for (const [key, val] of Object.entries(reqHeaders)) {
            if (Array.isArray(val)) {
                continue;
            }
            headersToForward[key] = val as string;
        }
        finalRequest.headers = headersToForward;
    }

    if (params[ScrapingBee.cookies]) {
        finalRequest.headers!.Cookie = params[ScrapingBee.cookies] as string;
    }

    return finalRequest;
}

export function createProxyOptions(params: ParsedUrlQuery) {
    const proxyOptions: ProxyConfigurationOptions = {};

    const proxyType = params[ScrapingAnt.proxyType] as string || 'datacenter';
    if (proxyType !== 'datacenter' && proxyType !== 'residential') {
        throw new UserInputError('Parameter proxy_type can be either residential or datacenter');
    }

    const useGoogleProxy = params[ScrapingBee.customGoogle] === 'true';
    const url = new URL(params[ScrapingBee.url] as string);
    if (url.host.includes('google') && !useGoogleProxy) {
        throw new UserInputError('Set param custom_google to true to scrape Google urls');
    }
    if (useGoogleProxy) {
        proxyOptions.groups = ['GOOGLE_SERP'];
        return proxyOptions;
    }

    if (params[ScrapingBee.ownProxy]) {
        proxyOptions.proxyUrls = [params[ScrapingBee.ownProxy] as string];
        return proxyOptions;
    }

    const usePremium = params[ScrapingBee.premiumProxy] === 'true' || proxyType === 'residential';
    if (usePremium) {
        proxyOptions.groups = ['RESIDENTIAL'];
    }

    if (params[ScrapingBee.countryCode]) {
        const countryCode = (params[ScrapingBee.countryCode] as string).toUpperCase();
        if (countryCode.length !== 2) {
            throw new UserInputError('Parameter for country code must be a string of length 2');
        }
        if (!usePremium && countryCode !== 'US') {
            throw new UserInputError('Parameter for country code must be used with premium proxies when using non-US country');
        }
        proxyOptions.countryCode = countryCode;
    }
    return proxyOptions;
}

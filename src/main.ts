import { Actor, log } from 'apify';
import { RequestOptions } from 'crawlee';
import { createServer } from 'http';
import { parse } from 'querystring';
import { v4 as uuidv4 } from 'uuid';
import { RequestDetails, UserData } from './types.js';
import { addResponse } from './responses.js';
import { crawler } from './crawler.js';
import { validateAndTransformExtractRules } from './extract_rules_utils.js';

await Actor.init();

const server = createServer(async (req, res) => {
    log.info(`URL: ${req.method} ${req.url}`);
    try {
        const params = parse(req.url!.slice(2));

        if (!params.url || !params.url.length) {
            throw new Error('Parameter url is either missing or empty');
        }
        const urlToScrape = params.url as string;

        // const proxyOptions: ProxyConfigurationOptions = {};
        // if (params.proxy_country) {
        //     proxyOptions.countryCode = params.proxy_country as string;
        // }
        // if (params.proxy_group) {
        //     proxyOptions.groups = [params.proxy_group as string];
        // }

        // const proxyConfiguration = await Actor.createProxyConfiguration(proxyOptions);

        const useExtractRules = !!params.extract_rules; // using !! casts non-bool to bool
        let inputtedExtractRules;
        if (useExtractRules) {
            inputtedExtractRules = JSON.parse(params.extract_rules as string);
        }

        const requestDetails: RequestDetails = {
            usedApifyProxies: true,
            // proxyOptions,
            requestErrors: [],
            resolvedUrl: null,
            responseHeaders: null,
        };

        const useBrowser = params.use_browser === 'true';
        const finalRequest: RequestOptions<UserData> = {
            url: urlToScrape,
            uniqueKey: uuidv4(),
            headers: {},
            skipNavigation: !useBrowser,
            userData: {
                verbose: params.verbose === 'true',
                takeScreenshot: params.screenshot === 'true',
                requestDetails,
                extractRules: useExtractRules ? validateAndTransformExtractRules(inputtedExtractRules) : null,
                inputtedUrl: req.url as string,
                parsedInputtedParams: params,
            },
        };

        if (params.use_headers) {
            const reqHeaders = req.headers;
            for (const headerKey of Object.keys(reqHeaders)) {
                if (headerKey.toLowerCase().startsWith('apf-')) {
                    const withoutPrefixKey = headerKey.slice(4);

                    const headerValue = reqHeaders[headerKey];
                    if (Array.isArray(headerValue)) {
                        if (headerValue.length) {
                            finalRequest.headers![withoutPrefixKey] = headerValue.at(-1) as string;
                        }
                        continue;
                    }
                    finalRequest.headers![withoutPrefixKey] = headerValue as string;
                }
            }
        }

        addResponse(finalRequest.uniqueKey!, res);
        await crawler.addRequests([finalRequest]);
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    crawler.run();
    log.info('Stand-by Actor is listening 🫡');
});

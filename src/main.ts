import { Actor, log } from 'apify';
import { createServer } from 'http';
import { CrawlerOptions } from './types.js';
import { addRequest, createAndStartCrawler, DEFAULT_CRAWLER_OPTIONS } from './crawlers.js';
import { addTimeoutToAllResponses, sendErrorResponseById } from './responses.js';
import { ScrapingBee } from './params.js';
import { createProxyOptions, createRequestForCrawler, parseParameters } from './utils.js';
import { UserInputError } from './errors.js';

await Actor.init();

if (Actor.isAtHome() && Actor.getEnv().metaOrigin !== 'STANDBY') {
    await Actor.fail('The Actor must start by being called using its Standby endpoint.');
}

Actor.on('migrating', () => {
    addTimeoutToAllResponses(60);
});

const server = createServer(async (req, res) => {
    const requestReceivedTime = Date.now();
    if (req.method !== 'HEAD') {
        log.info(`Request received: ${req.method} ${req.url}`);
    }
    try {
        const params = parseParameters(req.url!);
        const crawlerRequest = createRequestForCrawler(params, req);
        crawlerRequest.userData?.timeMeasures.push({
            event: 'request received',
            time: requestReceivedTime,
        });

        let timeout = 140000;
        if (params[ScrapingBee.timeout]) {
            const timeoutNumber = Number.parseInt(params[ScrapingBee.timeout] as string, 10);
            if (Number.isNaN(timeoutNumber)) {
                throw new UserInputError('Parameter timeout must be a number');
            }
            if (timeoutNumber < 1000 || timeoutNumber > 3600000) {
                throw new UserInputError('Parameter timeout must be between 1000 and 3600000 ms (1 hour)');
            }
            timeout = timeoutNumber;
        }

        setTimeout(() => {
            const timeoutErrorMessage = {
                errorMessage: `Response timed out.`,
            };
            sendErrorResponseById(crawlerRequest.uniqueKey!, JSON.stringify(timeoutErrorMessage));
        }, timeout);

        const crawlerOptions: CrawlerOptions = {
            proxyConfigurationOptions: createProxyOptions(params),
        };
        await addRequest(crawlerRequest, res, crawlerOptions);
    } catch (e) {
        const error = e as Error;
        const errorMessage = {
            errorMessage: error.message,
        };
        const statusCode = error instanceof UserInputError ? 400 : 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(errorMessage));
    }
});

const port = Actor.isAtHome() ? process.env.ACTOR_STANDBY_PORT : 8080;
server.listen(port, async () => {
    log.info('SuperScraper is listening for user requests');

    // Pre-create common crawlers because crawler init can take about 1 sec
    await Promise.all([
        createAndStartCrawler(DEFAULT_CRAWLER_OPTIONS),
        createAndStartCrawler({ ...DEFAULT_CRAWLER_OPTIONS, proxyConfigurationOptions: { groups: ['RESIDENTIAL'] } }),
    ]);
});

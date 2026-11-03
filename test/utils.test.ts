import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage } from 'http';
import { createRequestForCrawler, parseParameters } from '../src/utils.js';

const createIncomingMessage = (url: string, headers: IncomingMessage['headers']) => {
    return { url, headers } as IncomingMessage;
};

await test('keep_headers forwards headers except host and credentials', () => {
    const url = '/?url=https://example.com/&keep_headers=true';
    const req = createIncomingMessage(url, {
        host: 'super-scraper-api.apify.actor',
        authorization: 'Bearer apify_api_token',
        'x-custom': 'abc',
    });

    const request = createRequestForCrawler(parseParameters(url), req);

    assert.deepEqual(request.headers, { 'x-custom': 'abc' });
});

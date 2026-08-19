export enum Label {
    BROWSER = 'browser',
    HTTP = 'http',
    BINARY_TARGET = 'binary-target',
}

export const VALID_RESOURCES = [
    'document',
    'stylesheet',
    'image',
    'media',
    'font',
    'script',
    'texttrack',
    'xhr',
    'fetch',
    'eventsource',
    'websocket',
    'manifest',
    'other',
];

// Headers that authenticate the caller to this Actor. Forwarding them to the scraped
// website would hand the caller's Apify API token to that website's operator.
export const CREDENTIAL_HEADERS = [
    'authorization',
    'proxy-authorization',
];

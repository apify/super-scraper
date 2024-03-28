export interface RequestDetails {
    usedApifyProxies: boolean,
    requestErrors: { attempt: number, errorMessage: string }[],
    resolvedUrl: string | null,
    responseHeaders: Record<string, string | string[]> | null,
}

export type VerboseResult = RequestDetails & {
    screenshot: string | null,
    requestHeaders: Record<string, string>,
    resultType: 'html' | 'json' | 'error',
    result: string | Record<string, unknown>,
}

export interface ExtractRule {
    selector: string,
    type: 'list' | 'item',
    result: string | Record<string, ExtractRule>, // string can be either 'text' or start with '@' to indicate we want to get some attribute of the element(s)
}

export type ExtractRules = Record<string, ExtractRule>;

export interface TimeMeasure {
    event: 'request received' | 'pre-navigation hook' | 'page loaded' | 'handler end' | 'error' | 'failed request' | 'before queue add',
    time: number,
}

export interface UserData {
    verbose: boolean,
    takeScreenshot: boolean,
    requestDetails: RequestDetails,
    extractRules: ExtractRules | null,
    inputtedUrl: string,
    parsedInputtedParams: Record<string, string | string[] | undefined>,
    timeMeasures: TimeMeasure[],
}

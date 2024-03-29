export interface RequestDetails {
    usedApifyProxies: boolean,
    requestErrors: { attempt: number, errorMessage: string }[],
    resolvedUrl: string | null,
    responseHeaders: Record<string, string | string[]> | null,
}

export type VerboseResult = RequestDetails & {
    screenshot: string | null,
    requestHeaders: Record<string, string>,
    instructionsReport: InstructionsReport,
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
    event: 'request received' | 'before queue add' | 'crawlee internal run task' | 'crawlee internal request handler' | 'pre-navigation hook' |
    'page loaded' | 'handler end' | 'error' | 'failed request',
    time: number,
}

export type Action = 'wait' | 'wait_for' | 'click' | 'scroll_x' | 'scroll_y' | 'fill' | 'wait_browser';
type ActionParam = number | string | string[];

export interface Instruction {
    action: Action,
    param: ActionParam,
}

export interface JSInstructions {
    instructions: Instruction[],
    // config - maybe
}

export interface IndividualInstructionReport {
    action: Action,
    param: ActionParam,
    result: string,
    duration: number,
}

export interface InstructionsReport {
    instructions?: IndividualInstructionReport[],
    executed?: number,
    success?: number,
    failed?: number,
    totalDuration?: number,
}

export interface UserData {
    verbose: boolean,
    takeScreenshot: boolean,
    requestDetails: RequestDetails,
    extractRules: ExtractRules | null,
    inputtedUrl: string,
    parsedInputtedParams: Record<string, string | string[] | undefined>,
    timeMeasures: TimeMeasure[],
    instructions: Instruction[],
    blockResources: boolean,
    height: number,
    width: number,
}

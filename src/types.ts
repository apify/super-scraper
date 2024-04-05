import type { ProxyConfigurationOptions } from 'apify';
import { Cookie } from 'crawlee';

export interface RequestDetails {
    requestErrors: { attempt: number, errorMessage: string }[],
    resolvedUrl: string | null,
    responseHeaders: Record<string, string | string[]> | null,
}

export interface XHRRequestData {
    url: string,
    statusCode: number,
    method: string,
    requestHeaders: Record<string, string>,
    headers: Record<string, string>,
    body: string,
}

export interface IFrameData {
    src: string,
    content: string,
}

export type VerboseResult = RequestDetails & {
    screenshot: string | null,
    requestHeaders: Record<string, string>,
    instructionsReport: InstructionsReport,
    resultType: 'html' | 'json' | 'error',
    result: string | Record<string, unknown>,
    cookies: Cookie[],
    xhr: XHRRequestData[],
    iframes: IFrameData[],
}

export interface ExtractRule {
    selector: string,
    type: 'list' | 'item',
    output: string | Record<string, ExtractRule>
    clean: boolean,
}

export type ExtractRules = Record<string, ExtractRule>;

export interface TimeMeasure {
    event: 'request received' | 'before queue add' | 'crawlee internal run task' | 'crawlee internal request handler' | 'pre-navigation hook' |
    'page loaded' | 'handler end' | 'error' | 'failed request',
    time: number,
}

export type Action = 'wait' | 'wait_for' | 'click' | 'scroll_x' | 'scroll_y' | 'fill' | 'wait_browser' | 'evaluate';
type ActionParam = number | string | string[];

export interface Instruction {
    action: Action,
    param: ActionParam,
}

export interface JsScenario {
    instructions: Instruction[],
    strict: boolean,
}

export interface IndividualInstructionReport {
    action: Action,
    param: ActionParam,
    success: boolean,
    result?: string,
    duration: number,
}

export interface InstructionsReport {
    instructions?: IndividualInstructionReport[],
    executed?: number,
    success?: number,
    failed?: number,
    totalDuration?: number,
    evaluateResults?: string[],
}

export interface ScreenshotSettings {
    screenshotType: 'none' | 'window' | 'full' | 'selector',
    selector?: string,
}

export interface UserData {
    jsonResponse: boolean,
    screenshotSettings: ScreenshotSettings,
    requestDetails: RequestDetails,
    extractRules: ExtractRules | null,
    inputtedUrl: string,
    parsedInputtedParams: Record<string, string | string[] | undefined>,
    timeMeasures: TimeMeasure[],
    jsScenario: JsScenario,
    blockResources: boolean,
    height: number,
    width: number,
    returnPageSource: boolean,
    transparentStatusCode: boolean,
    nonbrowserRequestStatus?: number,
}

export interface CrawlerOptions {
    proxyConfigurationOptions: ProxyConfigurationOptions;
    maybeRunIntervalSecs: number;
}

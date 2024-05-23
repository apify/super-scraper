import type { ParsedUrlQuery } from 'querystring';
import { parse } from 'querystring';
import { TimeMeasure } from './types.js';
import { EquivalentParameters } from './params.js';

export const transformTimeMeasuresToRelative = (timeMeasures: TimeMeasure[]): TimeMeasure[] => {
    const firstMeasure = timeMeasures[0].time;
    return timeMeasures.map((measure) => {
        return {
            event: measure.event,
            time: measure.time - firstMeasure,
        };
    }).sort((a, b) => a.time - b.time);
};

const resources = ['document', 'stylesheet', 'image', 'media', 'font', 'script', 'texttrack', 'xhr', 'fetch', 'eventsource', 'websocket', 'manifest', 'other'];
export const isValidResourceType = (resource: string) => {
    return resources.includes(resource);
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

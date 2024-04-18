import { TimeMeasure } from './types.js';

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

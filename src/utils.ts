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

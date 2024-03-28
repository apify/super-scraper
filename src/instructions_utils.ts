import { Action, Instruction } from './types.js';

export const parseAndValidateInstructions = (rawInput: string): Instruction[] => {
    const input = JSON.parse(rawInput);
    if (!input.instructions || !Array.isArray(input.instructions)) {
        return [];
    }

    const instructions = input.instructions as Record<string | number | symbol, unknown>[];
    const parsedInstructions: Instruction[] = [];
    for (const instruction of instructions) {
        if (typeof instruction !== 'object') {
            throw new Error('Instruction must be an object');
        }
        if (Object.keys(instruction).length !== 1) {
            throw new Error('Instruction must include only one action with params');
        }
        const action = Object.keys(instruction)[0];
        const param = instruction[action];

        const possibleActions = ['wait', 'wait_for', 'click', 'scroll_x', 'scroll_y', 'fill']; // todo
        if (typeof action !== 'string' || !possibleActions.includes(action.toLowerCase())) {
            throw new Error(`Unsupported instruction: ${action}`);
        }

        if (typeof param !== 'string' && typeof param !== 'number' && !Array.isArray(param)) {
            throw new Error(`Unsupported params: ${action}, can be number, string, or an array of strings`);
        }

        parsedInstructions.push({ action: action as Action, param });
    }

    return parsedInstructions;
};

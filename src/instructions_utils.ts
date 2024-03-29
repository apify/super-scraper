import { Page } from 'playwright';
import { sleep } from 'crawlee';
import { Action, IndividualInstructionReport, Instruction, InstructionsReport } from './types.js';

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

const performInstruction = async (instruction: Instruction, page: Page): Promise<{ success: boolean, errorMessage?: string | undefined; result?: string; }> => {
    try {
        let result;
        switch (instruction.action) {
            case 'wait': {
                await sleep(instruction.param as number);
                break;
            }
            case 'click': {
                await page.click(instruction.param as string);
                break;
            }
            case 'wait_for': {
                await page.waitForSelector(instruction.param as string);
                break;
            }
            case 'fill': {
                const params = instruction.param as string[];
                await page.fill(params[0], params[1]);
                break;
            }
            case 'scroll_x': {
                const paramX = instruction.param as number;
                await page.mouse.wheel(paramX, 0);
                break;
            }
            case 'scroll_y': {
                const paramY = instruction.param as number;
                await page.mouse.wheel(0, paramY);
                break;
            }
            case 'wait_browser': {
                await page.waitForLoadState(instruction.param as 'load' | 'domcontentloaded' | 'networkidle');
                break;
            }
            default: {
                return { success: false, errorMessage: 'unknown instruction' };
            }
        }
        return { success: true, result };
    } catch (e) {
        return { success: false, errorMessage: (e as Error).message };
    }
};

export const performInstructionsAndGenerateReport = async (instructions: Instruction[], page: Page): Promise<InstructionsReport> => {
    let executed: number = 0;
    let success: number = 0;
    let failed: number = 0;
    const reports: IndividualInstructionReport[] = [];
    const start = Date.now();

    for (const instruction of instructions) {
        const instructionStart = Date.now();
        const instructionResult = await performInstruction(instruction, page);
        const instructionDuration = Date.now() - instructionStart;

        executed += 1;
        if (instructionResult.success) {
            success += 1;
        } else {
            failed += 1;
        }

        reports.push({
            ...instruction,
            duration: instructionDuration,
            success: instructionResult.success,
            result: instructionResult.success ? instructionResult.result : instructionResult.errorMessage,
        });
    }
    const totalDuration = Date.now() - start;
    return {
        executed,
        success,
        failed,
        totalDuration,
        instructions: reports,
    };
};

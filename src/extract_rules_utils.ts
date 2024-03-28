import { AnyNode, Cheerio, CheerioAPI, load } from 'cheerio';
import { ExtractRule, ExtractRules } from './types.js';

// validation and transformation to full Extract Rules (i.e. including all parameters, not the shortened version, for easier scraping process)

function validateAndTransformFullOptionsRule(key: string, inputtedExtractRule: Record<string, unknown>): ExtractRule {
    const { selector, result = 'text', type = 'item' } = inputtedExtractRule;

    if (!selector || typeof selector !== 'string' || !selector.length) {
        throw new Error(`Selector must be a non-empty string, rule for key: ${key}`);
    }

    if (typeof type !== 'string' || (type !== 'item' && type !== 'list')) {
        throw new Error(`Type can be either 'item' or 'list', rule for a key: ${key}`);
    }

    if (typeof result === 'string') {
        const trimmed = (result as string).trim();
        if (trimmed === 'text' || trimmed.startsWith('@')) {
            return {
                selector,
                type,
                result,
            };
        }

        throw new Error(`Result in the extract rule for ${key} has invalid value, expected 'text' or an attribute name starting with '@'`);
    }

    if (typeof result === 'object') {
        const nestedRules = validateAndTransformExtractRules(result as Record<string, unknown>);
        return {
            selector,
            type,
            result: nestedRules,
        };
    }

    throw new Error(`Result in the extract rule for ${key} in a wrong format, expected object or a string`);
}

function validateAndTransformShortenedRule(key: string, inputtedRule: string): ExtractRule {
    const trimmedRule = inputtedRule.trim();

    if (trimmedRule.includes('@')) {
        const selector = trimmedRule.split('@').shift() as string;
        if (!selector.length) {
            throw new Error(`Selector cannot be an empty string, rule: ${trimmedRule} for key ${key}`);
        }

        const attributeName = trimmedRule.slice(selector.length);
        if (!attributeName.length) {
            throw new Error(`Attribute name cannot be an empty string, rule: ${trimmedRule} for key ${key}`);
        }

        return {
            selector,
            type: 'item',
            result: attributeName,
        };
    }

    return {
        selector: trimmedRule,
        type: 'item',
        result: 'text',
    };
}

export function validateAndTransformExtractRules(inputtedExtractRules: Record<string, unknown>): ExtractRules {
    const extractRules: ExtractRules = {};

    for (const entry of Object.entries(inputtedExtractRules)) {
        const key = entry[0];
        const keyValue = entry[1];
        if (typeof keyValue === 'object') {
            extractRules[key] = validateAndTransformFullOptionsRule(key, keyValue as Record<string, unknown>);
        } else if (typeof keyValue === 'string') {
            extractRules[key] = validateAndTransformShortenedRule(key, keyValue);
        } else {
            throw new Error(`Extract rule for ${key} in a wrong format, expected object or a string`);
        }
    }

    return extractRules;
}

// scraping based on full Extract Rules

function scrapeItems(item: Cheerio<AnyNode>, result: string | ExtractRules) {
    if (result === 'text') {
        return item.text().trim() || null;
    }
    if (typeof result === 'string' && result.startsWith('@')) {
        return item.attr(result.slice(1)) || null;
    }
    if (typeof result === 'object') {
        /*
        This is here to have an option to work with already selected element(s). Scraping bee
        does it like this, we could replace it with something like '.' to refer the element itself.
        Example why this is needed:
            {
                allLinks: {
                    type: 'list',
                    selector: 'a',    <--- selects all 'a' elements
                    result: {
                        linkTitle: 'a', <--- refers to each 'a' element that were selected before (in the level above)
                        link: 'a@href'  <--- refers to each 'a' element that were selected before (in the level above)
                    }
                }
            }
        */
        const $ = load('<html></html>');
        const newHtmlWithItem = $('html').append(item);
        return scrapeExtractRules(newHtmlWithItem, result);
    }
    throw new Error('Invalid result value');
}

function scrapeExtractRules($: Cheerio<AnyNode>, extractRules: ExtractRules) {
    const scrapedData: Record<string, unknown> = {};

    for (const entries of Object.entries(extractRules)) {
        const key = entries[0];
        const rule = entries[1];

        const { selector, type, result } = rule;

        const itemsFoundBySelector = $.find(selector);
        if (type === 'item') {
            scrapedData[key] = scrapeItems(itemsFoundBySelector.eq(0), result);
        } else {
            const resultList: unknown[] = [];
            itemsFoundBySelector.each((i) => {
                resultList.push(scrapeItems(itemsFoundBySelector.eq(i), result));
            }).get();
            scrapedData[key] = resultList;
        }
    }
    return scrapedData;
}

export function scrapeBasedOnExtractRules($: CheerioAPI, extractRules: ExtractRules) {
    const html = $('html');
    return scrapeExtractRules(html, extractRules);
}

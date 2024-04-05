import { AnyNode, Cheerio, CheerioAPI, load } from 'cheerio';
import { ExtractRule, ExtractRules } from './types.js';

// validation and transformation to full Extract Rules (i.e. including all parameters, not the shortened version, for easier scraping process)

function validateAndTransformFullOptionsRule(key: string, inputtedExtractRule: Record<string, unknown>): ExtractRule {
    const { selector, output = 'text', type = 'item', clean = true } = inputtedExtractRule;

    if (!selector || typeof selector !== 'string' || !selector.length) {
        throw new Error(`Selector must be a non-empty string, rule for key: ${key}`);
    }

    if (typeof type !== 'string' || (type !== 'item' && type !== 'list')) {
        throw new Error(`Type can be either 'item' or 'list', rule for a key: ${key}`);
    }

    if (typeof clean !== 'boolean') {
        throw new Error('Clean can be set either to true or false');
    }

    if (typeof output === 'string') {
        const availableTypes = ['text', 'html', 'table_json', 'table_array'];
        const trimmed = (output as string).trim();
        if (availableTypes.includes(trimmed) || trimmed.startsWith('@')) {
            return {
                selector,
                type,
                output: trimmed,
                clean,
            };
        }

        throw new Error(
            `Result in the extract rule for ${key} has invalid value, expected one of ${JSON.stringify(availableTypes)} or an attribute name starting with '@'`,
        );
    }

    if (typeof output === 'object') {
        const nestedRules = validateAndTransformExtractRules(output as Record<string, unknown>);
        return {
            selector,
            type,
            output: nestedRules,
            clean,
        };
    }

    throw new Error(`Output in the extract rule for ${key} in a wrong format, expected object or a string`);
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
            output: attributeName,
            clean: true,
        };
    }

    return {
        selector: trimmedRule,
        type: 'item',
        output: 'text',
        clean: true,
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

function scrapeTable(item: Cheerio<AnyNode>) {
    const $ = load(item.html() || '');
    const headings: string[] = [];
    item.find('tr').has('th').eq(0).find('th')
        .each((_, el) => {
            headings.push($(el).text().trim());
        });
    if (!headings.length) {
        return [];
    }

    const data: Record<string, string>[] = [];
    item.find('tr').has('td').each((_, el) => {
        const rowData: Record<string, string> = {};
        const tdElements = $(el).find('td');
        for (let i = 0; i < headings.length; i++) {
            const val = tdElements.eq(i).text().trim();
            rowData[headings[i]] = val;
        }
        data.push(rowData);
    });
    return data;
}

function scrapeItems(item: Cheerio<AnyNode>, output: string | ExtractRules, clean: boolean) {
    if (output === 'text') {
        if (clean) {
            return item.text().trim() || null;
        }
        return item.text() || '';
    }

    if (output === 'html') {
        // we do this so the HTML od the whole element returns, not just its inner HTML
        const $ = load('');
        const newHtmlWithItem = $('body').append(item);
        return newHtmlWithItem.html() || '';
    }

    if (output === 'table_json' || output === 'table_array') {
        const data = scrapeTable(item);
        if (output === 'table_json') {
            return data;
        }
        return data.map((row) => Object.values(row));
    }

    if (typeof output === 'string' && output.startsWith('@')) {
        return item.attr(output.slice(1)) || '';
    }

    if (typeof output === 'object') {
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
        const $ = load('');
        const newHtmlWithItem = $('body').append(item);
        return scrapeExtractRules(newHtmlWithItem, output);
    }
    throw new Error('Invalid output value');
}

function scrapeExtractRules($: Cheerio<AnyNode>, extractRules: ExtractRules) {
    const scrapedData: Record<string, unknown> = {};

    for (const entries of Object.entries(extractRules)) {
        const key = entries[0];
        const rule = entries[1];

        const { selector, type, output, clean } = rule;

        const itemsFoundBySelector = $.find(selector);
        if (type === 'item') {
            scrapedData[key] = scrapeItems(itemsFoundBySelector.eq(0), output, clean);
        } else {
            const resultList: unknown[] = [];
            itemsFoundBySelector.each((i) => {
                resultList.push(scrapeItems(itemsFoundBySelector.eq(i), output, clean));
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

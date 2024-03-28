# Standby Crawler

## Supported params

| parameter | description | dev notes |
| -------- | ------- | ----- |
| `url` | URL to be scraped, required parameter |
| `verbose` | Will return verbose JSON response. Can be `true` or `false` |
| `headers` | Headers to be used in the request |
| `extract_rules` | Stringified JSON with custom rules how to extract data from the website. More [here](#extract-rules). |
| `use_browser` | Specify, if you want to scrape the webpage with or without loading it in a headless browser, can be `true` or `false`, default: `false` | probably should be `true` by default
| `screenshot` | Get screenshot of the full page in base64 in the verbose response, can be `true` or `false`, default: `false` (`use_browser` and `verbose` must be set to `true`) | maybe doesn't have to be returned only in the `verbose` response (body of the response would be only the image)
| `proxy_options` | [ProxyConfigurationOptions](https://docs.apify.com/sdk/js/reference/interface/ProxyConfigurationOptions) to be used for the request. | could be broken up to individual parameters (such as `proxy_urls`, `proxy_country` and `proxy-group`) |
| `js_instructions` | Instructions/actions that will be performed when opening the page. More [here](#js-instructions). | |

### Extract rules

- mainly copied from here https://www.scrapingbee.com/documentation/data-extraction/
- there are two types how to create an extract rule: with shortened options or with full options

#### shortened options:
- value for the given key serves as a `selector`
- using `@`, we can access an attribute of the element

```json
{ 
    "title": "h1",
    "link": "a@href"
}
```

#### full options (+ nesting):

- `selector` is required (`@` intended as attribute accessing will be ignored),
- `type` can be either `item` (default) or `list` (maybe could include `length` in the future),
- `result` - how the output for these element(s) will look like, can be:
    - `text` (default)
    - attribute name (starts with `@`, for example `@href`)
    - object with other extract rules for the given item (key + shortened or full options)
```json
{
    "custom key": {
        "selector": "a",
        "type": "list",
        "result": {
            "linkName" : "a",
            "href": {
                "selector": "a",
                "result": "@href"
            }
        }

    }
}
```

#### example:
- this scrapes all links from [Apify Blog](https://blog.apify.com/) along with their titles
- axios:
```ts
const extractRules = {
    title: 'h1',
    allLinks: {
        selector: 'a',
        type: 'list',
        result: {
            title: 'a',
            link: 'a@href',
        },
    },
};

const resp = await axios.get('https://yh8jx5mCjfv69espW.apify.actor/', {
    params: {
        url: 'https://blog.apify.com/',
        extract_rules: JSON.stringify(extractRules),
        // verbose: true,
    },
    headers: {
        Authorization: 'Bearer YOUR_TOKEN',
    },
});

console.log(resp.data);
```

- part of the result: 
```json
{
  "title": "Apify Blog",
  "allLinks": [
    {
      "title": "Data for generative AI & LLM",
      "link": "https://apify.com/data-for-generative-ai"
    },
    {
      "title": "Product matching AI",
      "link": "https://apify.com/product-matching-ai"
    },
    {
      "title": "Universal web scrapers",
      "link": "https://apify.com/store/scrapers/universal-web-scrapers"
    },
    ... more links
  ]
}
```

- full url: `https://yh8jx5mCjfv69espW.apify.actor/?url=https:%2F%2Fblog.apify.com%2F&&extract_rules=%7B%22title%22:%22h1%22,%22allLinks%22:%7B%22selector%22:%22a%22,%22type%22:%22list%22,%22result%22:%7B%22title%22:%22a%22,%22link%22:%22a%40link%22%7D%7D%7D`

### JS Instructions

- https://www.scrapingbee.com/documentation/#js_scenario
- supported: wait, click, wait_for, scroll x/y, fill
- todo

## todo/ideas

- reamining parameters
    - cookies
    - device
    - block_resources
    - wait_browser

- new instructions ideas 
    - scroll into view (selector)

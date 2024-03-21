# Standby Crawler

## Supported params

| parameter | description | dev notes |
| -------- | ------- | ----- |
| `url` | URL to be scraped, required parameter |
| `proxy_country` | Country locations of proxies | not working temporarily, some things need to be figured out |
| `proxy_group` | Proxy groups, for example `RESIDENTIAL`. Only 1 group supported now | not working temporarily, some things need to be figured out |
| `verbose` | Will return verbose JSON response. Can be `true` or `false` |
| `use_headers` | Can be either `true` or `false`. If set to `true`, headers in the request to this Actor prefixed with `apf-` will be forwarded to the target website (prefix will be trimmed) |
| `extract_rules` | Stringified JSON with custom rules how to extract data from the website. More [here](#extract-rules) |
| `use_browser` | Specify, if you want to scrape the webpage with or without loading it in a headless browser, can be `true` or `false`, default: `false` | maybe this can be `true` by default
| `screenshot` | Get screenshot of the full page in base64 in the verbose response, can be `true` or `false`, default: `false` (`use_browser` and `verbose` must be set to `true`) | maybe doesn't have to be returned only in the `verbose` response (body of the response would be only the image)

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

## todo/ideas

- custom js instructions as a parameter (https://www.scrapingbee.com/documentation/#js_scenario)
- ability to wait for some timeout/selector (specified using a parameter)
- figure out proxies
- refactor saving to the dataset dataset + add more data (such as request/response ID, request headers...)
- add boolean parameter to block resources (images, css...)
- extra handling of cookies (could be passed in a separate `cookie` parameter, could be returned in a separate field in the `verbose` response)

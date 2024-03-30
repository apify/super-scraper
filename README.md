# Standby Crawler

Actor url: https://yh8jx5mCjfv69espW.apify.actor/

Example usage using axios:

```ts
const resp = await axios.get('https://yh8jx5mCjfv69espW.apify.actor/', {
    params: {
        url: 'https://apify.com/store',
        wait_for: 'ActorStoreItem-title',
        verbose: true,
        screenshot: true,
    },
    headers: {
        Authorization: 'Bearer YOUR_TOKEN',
    },
});

console.log(resp.data);
```

Example using curl:

```
curl  -X GET \
  'https://yh8jx5mCjfv69espW.apify.actor/?url=https://apify.com/store&wait_for=ActorStoreItem-title&screenshot=true&verbose=true' \
  --header 'Authorization: Bearer YOUR_TOKEN'
```

## Supported params

| parameter | description | dev notes |
| -------- | ------- | ----- |
| `url` | URL to be scraped, required parameter |
| `verbose` | Will return verbose JSON response. Can be `true` or `false` |
| `headers` | Headers to be used in the request |
| `extract_rules` | Stringified JSON with custom rules how to extract data from the website. More [here](#extract-rules). |
| `use_browser` | Specify, if you want to scrape the webpage with or without loading it in a headless browser, can be `true` or `false`, default: `false` | probably should be `true` by default |
| `screenshot` | Get screenshot of the browser's current viewport in base64 in the verbose response, can be `true` or `false`, default: `false` (`use_browser` and `verbose` must be set to `true`) |
| `screenshot_full_page` | Get screenshot of the full page in base64 in the verbose response, can be `true` or `false`, default: `false` (`use_browser` and `verbose` must be set to `true`) |
| `screenshot_selector` | Get screenshot of the element specified by the selector in base64 in the verbose response, can be `true` or `false`, default: `false` (`use_browser` and `verbose` must be set to `true`) |
| `js_instructions` | Instructions/actions that will be performed when opening the page. More [here](#js-instructions). | |
| `wait` | Spcify a duration in ms that browsers will wait after navigation.
| `wait_for` | Specify a selector of an element for which the browser will wait after navigation.
| `wait_browser` | Browser will wait until a certain network condition is met, possible values: `load`, `domcontentloaded`, `networkidle` |
| `block_resources` | Blocks all images and CSS, can be `true` or `false`. Default: `true`. |
| `window_width` | Change the dimension of the browser's viewport. |
| `window_height` | Change the dimension of the browser's viewport. |
| `cookies` | Pass custom cookies for the website in a string format: `cookie_name_1=cookie_value1;cookie_name_2=cookie_value_2` |
| `own_proxy` | Use your own proxies for scraping in a format: `<protocol><username>:<password>@<host>:<port>`. |
| `premium_proxy` | Use premium proxies that are rarely blocked. |
| `country_code` | Use IP addresses that are geolocated to the specified country by specifying a 2-letter country [code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements).  If using code other than `US`, `premium_proxy` must be set to `true`. | 
| `return_page_source` | Return HTML of the website before JS rendering, can be `true` or `false`. Default: `false`. |
| `transparent_status_code` | If requested URL returns something other than a 200-299 or a 404, status code 500 will be returned. Set `false` to disable this and return the same status code as the requested URL. |
| `timeout` | Set maximum number of ms to get response from this actor. |  

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

### JS Instructions

- mainly copied from here: https://www.scrapingbee.com/documentation/#js_scenario
- instructions to be evalueated after navigation in order one by one
- set `verbose` to `true` to get a full report for the instructions, the results of any `evaluate` instructions will be added to the `evaluate_results` field
- example for clicking a button:
```ts
const instructions = {
    instructions: [
        { click: '#button' },
    ],
};


const resp = await axios.get('https://yh8jx5mCjfv69espW.apify.actor/', {
    params: {
        url: 'some url',
        js_instructions: JSON.stringify(instructions),
    },
    headers: {
        Authorization: 'Bearer YOUR_TOKEN',
    },
});

console.log(resp.data);
```

Supported instructions:

#### wait

- wait for time specified in ms
- example: `{"wait": 10000}`

#### wait_for

- wait for selector
- example `{"wait_for": "#element"}`

#### click

- wait for an element then click on it
- example `{"click": "#button"}`

#### scroll x/y

- scroll specified number of pixels horizontally or vertically on a page
- example `{"scroll_y": 1000}` or `{"scroll_x": 1000}`

#### fill

- specify selector of the input you want to fill and the value you want to fill it with
- example `{"fill": ["input_1", "value_1"]}`

#### evaluate

- use when you need to run custom JavaScript
- text/number/object results will be saved in `evaluate_results` field
- example `{"evaluate":"document.querySelector('h1').textContent"}`

## todo remaining features

- device parameter
- google proxies
- their [verbonse](https://www.scrapingbee.com/documentation/#json_response) response also contains
    - content and source of iframes in the page
    - XHR / Ajax requests sent by the browser
    - nicely formatted cookies sent back by the server
    - Metada / Schema data but not sure what it is
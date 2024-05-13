# Super-Scraper

The Super-Scraper Actor provides an REST API for scraping websites,
in which you pass a URL of a web page and get back the fully-rendered HTML content.
The Super-Scraper API is compatible with [ScrapingBee](https://www.scrapingbee.com/),
[ScrapingAnt](https://scrapingant.com/),
and [ScraperAPI](https://scraperapi.com/),
and thus Actor can be used as a potentially cheaper drop-in replacement for these services.

Main features:
- Extract HTML from arbitrary URL with a headless browser for dynamic content rendering.
- Circumvent blocking using datacenter or residential proxies, and browser fingerprinting.
- Seamlessly scale to a large number of web pages as needed.
- Capture screenshots of the web pages.

Note that Super-Scraper uses the new experimental Actor Standby mode, so it's not started the traditional way from Apify Console,
but it's invoked via HTTP REST API provided directly by the Actor. See the examples below.

## Usage examples

To run these examples, you need an Apify API token,
which you can find under [Settings > Integrations](https://console.apify.com/account/integrations) in Apify Console.
Creating an Apify account free of charge.

### Node.js

```ts
import axios from 'axios';

const resp = await axios.get('https://apify--super-scraper-api.apify.actor/', {
    params: {
        url: 'https://apify.com/store',
        wait_for: '.ActorStoreItem-title',
        json_response: true,
        screenshot: true,
    },
    headers: {
        Authorization: 'Bearer <YOUR_APIFY_API_TOKEN>',
    },
});

console.log(resp.data);
```

### curl

```shell
curl -X GET \
  'https://apify--super-scraper-api.apify.actor/?url=https://apify.com/store&wait_for=.ActorStoreItem-title&screenshot=true&json_response=true' \
  --header 'Authorization: Bearer <YOUR_APIFY_API_TOKEN>'
```

## Authentication

The best way to authenticate is to pass your Apify API token using the `Authorization` HTTP header.
Alternatively, you can pass the API token via the `token` query parameter to authenticate the requests, which is more convenient for testing in a web browser.

### Node.js

```ts
const resp = await axios.get('https://apify--super-scraper-api.apify.actor/', {
    params: {
        url: 'https://apify.com/store',
        token: '<YOUR_APIFY_API_TOKEN>'
    },
});
```

### curl

```shell
curl -X GET 'https://apify--super-scraper-api.apify.actor/?url=https://apify.com/store&wait_for=.ActorStoreItem-title&json_response=true&token=<YOUR_APIFY_API_TOKEN>'
```

## Pricing

When using the Super-Scraper Actor, you're charged based on your actual usage of Apify platform's computing, storage, and networking resources, which depends
on the targets sites, your settings and API parameters, the load of your requests, and random network and target site conditions.
From our testing, Super-Scraper is cheaper in many configurations than ScrapingBee, ScrapingAnt, and ScraperAPI, while in some other ones it's more expensive.
The best way to see your price is to conduct a real-world test.

TODO: can we add more details?

## API parameters

### ScrapingBee API parameters

The Super-Scraper Actor supports most of the API parameters of [ScrapingBee](https://www.scrapingbee.com/documentation/):

| parameter | description                                                                                                                                                                                                                                                                                                                   |
| -------- |-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `url` | URL of the webpage to be scraped. **This parameter is required.**                                                                                                                                                                                                                                                             |
| `json_response` | Return a verbose JSON response with additional details about the webpage. Can be either `true` or `false`, default is `false`.                                                                                                                                                                                                |
| `extract_rules` | A stringified JSON containing custom rules how to extract data from the webpage.                                                                                                                                                                                                                                              |
| `render_js` | Indicates that the webpage should be scraped using a headless browser, with dynamic content rendered. Can be `true` or `false`, default is `true`. This is equivalent to ScrapingAnt's `browser`.                                                                                                                             |
| `screenshot` | Get screenshot of the browser's current viewport. If `json_response` is set to `true`, screenshot will be returned in the Base64 encoding. Can be `true` or `false`, default is `false`.                                                                                                                                      |
| `screenshot_full_page` | Get screenshot of the full page. If `json_response` is set to `true`, screenshot will be returned in the Base64 encoding. Can be `true` or `false`, default is `false`.                                                                                                                                                       |
| `screenshot_selector` | Get screenshot of the element specified by the selector. If `json_response` is set to `true`, screenshot will be returned in Base64. Must be a non-empty string.                                                                                                                                                              |
| `js_scenario` | JavaScript instructions that will be executed after loading the webpage.                                                                                                                                                                                                                                                      |
| `wait` | Specify a duration that the browser will wait after loading the page, in milliseconds.                                                                                                                                                                                                                                        |
| `wait_for` | Specify a CSS selector of an element for which the browser will wait after loading the page.                                                                                                                                                                                                                                  |
| `wait_browser` | Specify a browser event to wait for. Can be either `load`, `domcontentloaded`, or `networkidle`.                                                                                                                                                                                                                              |
| `block_resources` | Specify that you want to block images and CSS. Can be `true` or `false`, default is `true`.                                                                                                                                                                                                                                   |
| `window_width` | Specify the width of the browser's viewport, in pixels.                                                                                                                                                                                                                                                                       |
| `window_height` | Specify the height of the browser's viewport, in pixels.                                                                                                                                                                                                                                                                      |
| `cookies` | Custom cookies to use to fetch the web pages. This is useful for fetching webpage behing login. The cookies must be specified in a string format: `cookie_name_1=cookie_value1;cookie_name_2=cookie_value_2`.                                                                                                                 |
| `own_proxy` | A custom proxy to be used for scraping, in the format `<protocol><username>:<password>@<host>:<port>`.                                                                                                                                                                                                                        |
| `premium_proxy` | Use residential proxies to fetch the web content, in order to reduce the probability of being blocked. Can be either `true` or `false`, default is `false`.                                                                                                                                                                   |
| `stealth_proxy` | Works same as `premium_proxy`.                                                                                                                                                                                                                                                                                                |
| `country_code` | Use IP addresses that are geolocated in the specified country by specifying its [2-letter ISO code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements). When using code other than `US`, `premium_proxy` must be set to `true`. This is equivalent to setting ScrapingAnt's `proxy_country`. |
| `custom_google` | Use this option if you want to scrape Google-related websites (such as Google Searach or Google Shopping). Can be `true` or `false`, default is `false`.                                                                                                                                                                      |
| `return_page_source` | Return HTML of the webpage from the response before any dynamic JavaSript rendering. Can be `true` or `false`, default is `false`.                                                                                                                                                                                            |
| `transparent_status_code` | By default, if target webpage responds with HTTP status code other than a 200-299 or a 404, the API will return a HTTP status code 500. Set this paremeter to `true` to disable this behavior and return the status code of the actual response.                                                                              |
| `timeout` | Set maximum timeout for the response from this Actor, in milliseconds. The default is 140 000 ms.                                                                                                                                                                                                                             |
| `forward_headers` | If set to `true`, HTTP headers starting with prefix `Spb-` or `Ant-` will be forwarded to the target webpage alongside headers generated by us (the prefix will be trimmed).                                                                                                                                                  |
| `forward_headers_pure` | If set to `true`, only headers starting with prefix `Spb-` or `Ant-` will be forwarded to the target webpage (prefix will be trimmed), without any other HTTP headers from our side.                                                                                                                                          |
| `device` | Can be either `desktop` (default) or `mobile`.                                                                                                                                                                                                                                                                                |

ScrapingBee's API parameters `block_ads` and `session_id` are currently not supported.

### ScrapingAnt API parameters

The Super-Scraper Actor supports most of the API parameters of [ScrapingAnt](https://docs.scrapingant.com/request-response-format#available-parameters):

| parameter | description                                                                                                                                                                                                                                                                                                                                  |
| -------- |----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `url` | URL of the webpage to be scraped. **This parameter is required.**                                                                                                                                                                                                                                                                            |
| `browser` | Indicates that the webpage should be scraped using a headless browser, with dynamic content rendered. Can be `true` or `false`, default is `true`. This is equivalent as ScrapingBee's `render_js`.                                                                                                                                          | (Same as `render_js`.)                                                                                                                                                    |
| `cookies` | Use custom cookies, must be in a string format: `cookie_name_1=cookie_value1;cookie_name_2=cookie_value_2`.                                                                                                                                                                                                                                  |
| `js_snippet` | A Base64-encoded JavaScript code to be executed on the webpage. Will be treated as the [evaluate](#evaluate) instruction.                                                                                                                                                                                                                    |
| `proxy_type` | Specify the type of proxies, which can be either `datacenter` (default) or `residential`. This is equivalent to setting ScrapingBee's `premium_proxy` or `steath_proxy` to `true`.                                                                                                                                                           |
| `wait_for_selector` | Specify a CSS selector of an element for which the browser will wait after loading the page. This is equivalent to setting ScrapingBee's `wait_for`.                                                                                                                                                                                         |
| `block_resource` | Specify one or more resources types you want to block from being downloaded. The parameter can be repeated in the URL (e.g. `block_resource=image&block_resource=media`). Available options are: `document`, `stylesheet`, `image`, `media`, `font`, `script`, `texttrack`, `xhr`, `fetch`, `eventsource`, `websocket`, `manifest`, `other`. |
| `return_page_source` | Return HTML of the webpage from the response before any dynamic JavaSript rendering. Can be `true` or `false`, default is `false`.                                                                                                                                                                                                           |
| `proxy_country` | Use IP addresses that are geolocated in the specified country by specifying its [2-letter ISO code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements). When using code other than `US`, `premium_proxy` must be set to `true`. This is equivalent to setting ScrapingBee's `country_code`.                 |

ScrapingAnt's API parameter `x-api-key` is not supported.

Note that HTTP headers in a request to this Actor beginning with prefix `Ant-` will be forwarded (without the prefix) to the target webpage alongside headers generated by the Actor.
This behavior can be changed using ScrapingBee's `forward_headers` or `forward_headers_pure` parameters.


### ScraperAPI API parameters

The Super-Scraper Actor supports most of the API parameters of [ScraperAPI](https://docs.scraperapi.com/making-requests/customizing-requests):

| parameter | description                                                                                                                                                                                                                                                                                                                   |
| -------- |-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `url` | URL of the webpage to be scraped. **This parameter is required.**                                                                                                                                                                                                                                                             |
| `render` | Specify, if you want to scrape the webpage with or without using a headless browser, can be `true` or `false`, default `true`. (Same as `render_js`.)                                                                                                                                                                         |
| `wait_for_selector` | Specify a CSS selector of an element for which the browser will wait after loading the page. This is equivalent to setting ScrapingBee's `wait_for`.                                                                                                                                                                          |
| `premium` | Use residential proxies to fetch the web content, in order to reduce the probability of being blocked. Can be either `true` or `false`, default is `false`. This is equivalent to setting ScrapingBee's `premium_proxy`.                                                                                                      |
| `ultra_premium` | Same as `premium`.                                                                                                                                                                                                                                                                                                            |
| `country_code` | Use IP addresses that are geolocated in the specified country by specifying its [2-letter ISO code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements). When using code other than `US`, `premium_proxy` must be set to `true`. This is equivalent to setting ScrapingAnt's `proxy_country`. |
| `keep_headers` | If `true`, then all headers sent to this Actor will be forwarded to the target website. The `Authorization` header will be removed.                                                                                                                                                                                           |
| `device_type` | Can be either `desktop` (default) or `mobile`. This is equivalent to setting ScrapingBees's `device`.                                                                                                                                                                                                                         |
| `binary_target` | Specify whether the target is a file. Can be `true` or `false`, default is `false`. Currently only supported when JS rendering is set to `false` via the `render_js`, `browser`, or `render` parameters.                                                                                                                      |

ScraperAPI's API parameters `session_number` and `autoparse` are currently not supported, and they are ignored.


### Custom extraction rules

Using ScrapingBee's `extract_rules` parameter, you can specify a set of rules to extract specific data from the target webpages. There are two ways how to create an extraction rule: with shortened options or with full options.

#### Shortened options

- value for the given key serves as a `selector`
- using `@`, we can access attribute of the selected element

##### Example:

```json
{
    "title": "h1",
    "link": "a@href"
}
```

#### Full options

- `selector` is required
- `type` can be either `item` (default) or `list`
- `output` indicates how the result for these element(s) will look like. It can be:
    - `text` (default option when `output` is omitted) - text of the element
    - `html` - HTML of the element
    - attribute name (starts with `@`, for example `@href`)
    - object with other extract rules for the given item (key + shortened or full options)
    - `table_json` or `table_array` to scrape a table in a json or array format
- `clean` - relevant when having `text` as `output`, specifies whether the text of the element should be trimmed of whitespaces (can be `true` or `false`, default `true`)

##### Example:

```json
{
    "custom key for links": {
        "selector": "a",
        "type": "list",
        "output": {
            "linkName" : {
                "selector": "a",
                "clean": "false"
            },
            "href": {
                "selector": "a",
                "output": "@href"
            }
        }

    }
}
```

#### Example

This example extracts all links from [Apify Blog](https://blog.apify.com/) along with their titles.

```ts
const extractRules = {
    title: 'h1',
    allLinks: {
        selector: 'a',
        type: 'list',
        output: {
            title: 'a',
            link: 'a@href',
        },
    },
};

const resp = await axios.get('https://apify--super-scraper-api.apify.actor/', {
    params: {
        url: 'https://blog.apify.com/',
        extract_rules: JSON.stringify(extractRules),
        // verbose: true,
    },
    headers: {
        Authorization: 'Bearer <YOUR_APIFY_API_TOKEN>',
    },
});

console.log(resp.data);
```

The results look like this:

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
    }
  ]
}
```

### Custom JavaScript code

Specify instructions in order to be executed one by one after opening the page.
Set `json_response` to `true` to get a full report of the executed instructions, the results of `evaluate` instructions will be added to the `evaluate_results` field.

Example of clicking a button:

```ts
const instructions = {
    instructions: [
        { click: '#button' },
    ],
};

const resp = await axios.get('https://apify--super-scraper-api.apify.actor/', {
    params: {
        url: 'https://www.example.com',
        js_scenario: JSON.stringify(instructions),
    },
    headers: {
        Authorization: 'Bearer <YOUR_APIFY_API_TOKEN>',
    },
});

console.log(resp.data);
```

#### Strict mode

If one instructions fails, then the subsequent instructions will not be executed. To disable this behavior, you can optionally set `strict` to `false` (by default it's `true`):

```json
{
    "instructions": [
        { "click": "#button1" },
        { "click": "#button2" }
    ],
    "strict": false
}
```

#### Supported instructions

##### `wait`

- wait for some time specified in ms
- example: `{"wait": 10000}`

##### `wait_for`

- wait for an element specified by selector
- example `{"wait_for": "#element"}`

##### `click`

- click on an element specified by the selector
- example `{"click": "#button"}`

##### `wait_for_and_click`
- combination of previous two
- example `{"wait_for_and_click": "#button"}`

##### `scroll_x` and `scroll_y`

- scroll specified number of pixels horizontally or vertically
- example `{"scroll_y": 1000}` or `{"scroll_x": 1000}`

##### `fill`

- specify selector of the input element and the value you want to fill
- example `{"fill": ["input_1", "value_1"]}`

##### `evaluate`

- evaluate custom javascript on the webpage
- text/number/object results will be saved in `evaluate_results` field
- example `{"evaluate":"document.querySelectorAll('a').length"}`

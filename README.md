# Super-Scraper

The Super-Scraper Actor provides an REST API for scraping websites,
in which you pass a URL of a web page and get back the fully-rendered HTML content.
The Super-Scraper API is compatible with [ScrapingBee](https://www.scrapingbee.com/),
[ScrapingAnt](https://scrapingant.com/),
and [ScraperAPI](https://scraperapi.com/),
and thus Actor can be used as a potentially cheaper drop-in replacement for these services.

Main features:
- Extract HTML from arbitrary URL using headless browser or raw HTTP requests
- Circumvent blocking using datacenter or residential proxies, and browser fingerprinting
- Seemlessly scale to a large number of web pages as needed

Note that Super-Scraper uses the new experimental Actor Standby mode, so it's not started the traditional way from Apify Console,
but it's invoked via HTTP REST API provided directly by the Actor. See the examples below.

## Usage examples

To run these examples, you need an Apify API token,
which you can find under [Settings > Integrations](https://console.apify.com/account/integrations) in Apify Console.
You can create an Apify account free of charge.

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
  --header 'Authorization: Bearer YOUR_APIFY_API_TOKEN'
```

## Authentication

The best way to authenticate is to pass your Apify API token using the `Authorization` HTTP header.
Note that you can also pass the API token via the `token` query parameter to authenticate the requests:

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

## API parameters

The Actor supports most of the API parameters of [ScrapingBee](https://www.scrapingbee.com/documentation/),
[ScrapingAnt](https://docs.scrapingant.com/request-response-format#available-parameters),
and [ScraperAPI](https://docs.scraperapi.com/making-requests/customizing-requests).

### ScrapingBee API parameters

| parameter | description |
| -------- | ------- |
| `url` | URL of the webpage to be scraped, required parameter. |
| `json_response` | Will return a verbose JSON response with additional details about the webpage. Can be either `true` or `false`, default `false`. |
| `extract_rules` | Stringified JSON with custom rules how to extract data from the webpage. More [here](#extract-rules). |
| `render_js` | Specify, if you want to scrape the webpage with or without using a headless browser, can be `true` or `false`, default `true`. |
| `screenshot` | Get screenshot of the browser's current viewport. If `json_response` is set to `true`, screenshot will be returned in base64. Can be `true` or `false`, default `false`. |
| `screenshot_full_page` | Get screenshot of the full page. If `json_response` is set to `true`, screenshot will be returned in base64. Can be `true` or `false`, default `false`. |
| `screenshot_selector` | Get screenshot of the element specified by the selector. If `json_response` is set to `true`, screenshot will be returned in base64. Must be a non-empty `string`. |
| `js_scenario` | Instructions that will be executed after loading the webpage. More [here](#js-scenario). |
| `wait` | Specify a duration in ms that the browsers will wait after loading the page. |
| `wait_for` | Specify a selector of an element for which the browser will wait after loading the page. |
| `wait_browser` | Can be one of: `load`, `domcontentloaded`, `networkidle`. |
| `block_resources` | Specify, if you want to block images and CSS. Can be `true` or `false`, default `true`. |
| `window_width` | Specify width of the browser's viewport. |
| `window_height` | Specify height of the browser's viewport. |
| `cookies` | Use custom cookies, must be in a string format: `cookie_name_1=cookie_value1;cookie_name_2=cookie_value_2`. |
| `own_proxy` | Use your own proxies in a format: `<protocol><username>:<password>@<host>:<port>`. |
| `premium_proxy` | Use IP addresses assigned to homes and offices of actual users. Reduced probability of being blocked. |
| `stealth_proxy` | Same as `premium_proxy`. |
| `country_code` | Use IP addresses that are geolocated to the specified country by specifying a 2-letter country [code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements).  If using code other than `US`, `premium_proxy` must be set to `true`. |
| `custom_google` | Use this option, if you want to scrape Google related websites (such as Google Shopping). Can be `true` or `false`, default `false`. |
| `return_page_source` | Return HTML of the website that gets returned in the response (before any Javascript rendering), can be `true` or `false`, default: `false`. |
| `transparent_status_code` | If response returns something other than a 200-299 or a 404, status code 500 will be returned. Set `true` to disable this behaviour and return the status code of the actual response. |
| `timeout` | Set maximum number of ms to get response from this Actor. |
| `forward_headers` | If set to `true`, headers in a request to this Actor begining with prefix `Spb-` or `Ant-` will be forwarded to the target webpage alongside headers generated by us (prefix will be trimmed). |
| `forward_headers_pure` | If set to `true`, only headers in a request to this Actor begining with prefix `Spb-` or `Ant-` will be forwarded to the target webpage (prefix will be trimmed). |
| `device` | Can be either `desktop` (default) or `mobile`. |

Currently, there are two ScrapingBee parameters that are not supported: `block_ads` and `session_id`.

### ScrapingAnt API parameters

| parameter | description |
| -------- | ------- |
| `url` | URL of the webpage to be scraped, required parameter. |
| `browser` | Specify, if you want to scrape the webpage with or without using a headless browser, can be `true` or `false`, default `true`. (Same as `render_js`.) |
| `cookies` | Use custom cookies, must be in a string format: `cookie_name_1=cookie_value1;cookie_name_2=cookie_value_2`. |
| `js_snippet` | Base64 encoded JS code to be executed on the webpage. Will be treated as [evaluate](#evaluate) instruction. |
| `proxy_type` | Specify the type of proxies, can be either `datacenter` (default) or `residential` (is equivalent to setting `premium_proxy` or `steath_proxy` to `true`). |
| `wait_for_selector` | Specify a selector of an element for which the browser will wait after loading the page. (Same as `wait_for`.) |
| `block_resource` | Specify one or more resources types you want to block. Can be repeated in the URL (e.g. `block_resource=image&block_resource=media`). Available options: `document`, `stylesheet`, `image`, `media`, `font`, `script`, `texttrack`, `xhr`, `fetch`, `eventsource`, `websocket`, `manifest`, `other`. |
| `return_page_source` | Return HTML of the website that gets returned in the response (before any Javascript rendering), can be `true` or `false`, default: `false`. |
| `proxy_country` | Use IP addresses that are geolocated to the specified country by specifying a 2-letter country [code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements).  If using code other than `US`, `proxy_type` must be set to `residential` (or `premium_proxy` set to `true`). |

Note about headers: Headers in a request to this Actor begining with prefix `Ant-` will be forwarded to the target webpage alongside headers generated by us (prefix will be trimmed). This can be changed using ScrapingBee's `forward_headers` and `forward_headers_pure` params that are described [here](#scrapingbee-params).


### ScraperAPI API parameters

| parameter | description |
| -------- | ------- |
| `url` | URL of the webpage to be scraped, required parameter. |
| `render` | Specify, if you want to scrape the webpage with or without using a headless browser, can be `true` or `false`, default `true`. (Same as `render_js`.) |
| `wait_for_selector` | Specify a selector of an element for which the browser will wait after loading the page. (Same as `wait_for`.) |
| `premium` | Use IP addresses assigned to homes and offices of actual users. Reduced probability of being blocked. (Same as `premium_proxy`.) |
| `ultra_premium` | Same as `premium` |
| `country_code` | Use IP addresses that are geolocated to the specified country by specifying a 2-letter country [code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements).  If using code other than `US`, `premium` must be set to `true`. |
| `keep_headers` | All headers sent to this Actor will be forwarded to the target website (this will override already set headers). The `Authorization` header will be removed. |
| `device_type` | Can be either `desktop` (default) or `mobile`. (Same as `device`.) |
| `binary_target` | Specify, whether the target is a file. Can be `true` or `false`, default: `false`. Currently only supported when JS rendering is set to `false` (`render_js`, `browser`, `render`). |

Currently, there are two ScraperAPI parameters that are not supported: `session_number` and  `autoparse`.


### Extract rules

Specify a set of rules to scrape data from the target webpage. There are two ways how to create an extract rule: with shortened options or with full options:

#### shortened options:
- value for the given key serves as a `selector`
- using `@`, we can access attribute of the selected element

```json
{
    "title": "h1",
    "link": "a@href"
}
```

#### full options (+ nesting):

- `selector` is required,
- `type` can be either `item` (default) or `list`,
- `output` - how the result for these element(s) will look like, can be:
    - `text` (default option when `output` is omitted) - text of the element
    - `html` - HTML of the element
    - attribute name (starts with `@`, for example `@href`)
    - object with other extract rules for the given item (key + shortened or full options)
    - `table_json` or `table_array` to scrape a table in a json or array format
- `clean` - relevant when having `text` as `output`, specifies whether the text of the element should be trimmed of whitespaces (can be `true` or `false`, default `true`)

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

#### Example:
- this scrapes all links from [Apify Blog](https://blog.apify.com/) along with their titles
- axios:
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

const resp = await axios.get('https://yh8jx5mCjfv69espW.apify.actor/', {
    params: {
        url: 'https://blog.apify.com/',
        extract_rules: JSON.stringify(extractRules),
        // verbose: true,
    },
    headers: {
        Authorization: 'Bearer YOUR_APIFY_TOKEN',
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
    ...
  ]
}
```

### JS Scenario

Specify instructions in order to be executed one by one after opening the page. Set `json_response` to `true` to get a full report of the executed instructions, the results of `evaluate` instructions will be added to the `evaluate_results` field.

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
        js_scenario: JSON.stringify(instructions),
    },
    headers: {
        Authorization: 'Bearer YOUR_APIFY_TOKEN',
    },
});

console.log(resp.data);
```

#### Strict mode

If one instructions fails, then the subsequent instructions will not be executed. To disable this, you can optionally set `strict` to `false` (which is `true` by default):

```json
{
    "instructions": [
        { "click": "#button1" },
        { "click": "#button2" }
    ],
    "strict": false
}
```

#### Supported instructions:

##### wait

- wait for some time specified in ms
- example: `{"wait": 10000}`

##### wait_for

- wait for an element specified by selector
- example `{"wait_for": "#element"}`

##### click

- click on an element specified by the selector
- example `{"click": "#button"}`

##### wait_for_and_click
- combination of previous two
- example `{"wait_for_and_click": "#button"}`

##### scroll x/y

- scroll specified number of pixels horizontally or vertically
- example `{"scroll_y": 1000}` or `{"scroll_x": 1000}`

##### fill

- specify selector of the input element and the value you want to fill
- example `{"fill": ["input_1", "value_1"]}`

##### evaluate

- evaluate custom javascript on the webpage
- text/number/object results will be saved in `evaluate_results` field
- example `{"evaluate":"document.querySelectorAll('a').length"}`

export enum ScrapingBee {
    url = 'url',
    extractRules = 'extract_rules',
    device = 'device',
    jsScenario = 'js_scenario',
    renderJs = 'render_js',
    wait = 'wait',
    waitFor = 'wait_for',
    waitBrowser = 'wait_browser',
    screenshot = 'screenshot',
    screenshotFullPage = 'screenshot_full_page',
    screenshotSelector = 'screenshot_selector',
    windowWidth = 'window_width',
    windowHeight = 'window_height',
    returnPageSource = 'return_page_source',
    transparentStatusCode = 'transparent_status_code',
    forwardHeaders = 'forward_headers',
    forwardHeadersPure = 'forward_headers_pure',
    cookies = 'cookies',
    timeout = 'timeout',
    customGoogle = 'custom_google',
    ownProxy = 'own_proxy',
    premiumProxy = 'premium_proxy',
    stealthProxy = 'stealth_proxy',
    countryCode = 'country_code',
    jsonResponse = 'json_response',
    blockResources = 'block_resources'
}

export enum ScrapingAnt {
    // we already have: url, return_page_source, cookies, proxy_country
    browser = 'browser',
    jsSnippet = 'js_snippet',
    proxyType = 'proxy_type',
    waitForSelector = 'wait_for_selector',
    blockResource = 'block_resource'
}
Evme.BrowserResultsRenderer = function Evme_BrowserResultsRenderer() {
  var NAME = "BrowserResultsRenderer",
    self = this,
    containerEl,

    BROWSER_NAME = 'Firefox',
    BROWSER_SEARCH_URL = 'http://www.google.com/search?q={query}';

  this.init = function init(cfg) {
    containerEl = cfg.containerEl;
  };

  this.render = function render(data) {
    self.clear();
    
    var url, // will be opened in browser
      query; // the query the user entered
    
    query = data.query;
    
    if (!query) { return; }
    
    // if query is a valid url open it
    // else run a web search
    if (Evme.Utils.REGEX.URL.test(query)) {
      url = query;
    } else {
      url = BROWSER_SEARCH_URL.replace('{query}', query);
    }

    var result = new Evme.CloudAppResult(),
    el = result.init({
      "name": BROWSER_NAME,
      "appUrl": url
    }, {
      "animate": false
    });
    
    result.draw(Evme.DEFAULT_ICONS.BROWSER);
    containerEl.appendChild(el);
  };

  this.clear = function clear() {
    containerEl.innerHTML = '';
  };

  this.getResultCount = function getResultCount() {
    return containerEl.childElementCount;
  };
};
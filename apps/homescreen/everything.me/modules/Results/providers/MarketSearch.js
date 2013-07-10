Evme.MarketSearchResult = function Evme_MarketSearch() {
  var self = this,
    TEXT_HEIGHT = Evme.Utils.APPS_FONT_SIZE * 3,
    TEXT_WIDTH = 72 * Evme.Utils.devicePixelRatio,
    TEXT_MARGIN = 6 * Evme.Utils.devicePixelRatio,

    FONT_SIZE = 11 * Evme.Utils.devicePixelRatio;
  
  Evme.Result.call(this);
  this.type = Evme.RESULT_TYPE.MARKET_SEARCH;

  // @override
  this.initIcon = function initIcon(baseHeight, textOffset) {
    this.canvas.width = TEXT_WIDTH;
    this.canvas.height = baseHeight + TEXT_MARGIN + (2 * TEXT_HEIGHT) - 1;
    Evme.Utils.writeTextToCanvas({
      "text": "Download",
      "context": this.context,
      "offset": textOffset + TEXT_MARGIN,
      "fontSize": FONT_SIZE
    });

    Evme.Utils.writeTextToCanvas({
      "text": "More Apps",
      "context": this.context,
      "offset": textOffset + TEXT_MARGIN + FONT_SIZE + 1 * Evme.Utils.devicePixelRatio
    });
  };

}
Evme.MarketSearchResult.prototype = Object.create(Evme.Result.prototype);
Evme.MarketSearchResult.prototype.constructor = Evme.MarketSearchResult;

/*
  Renders the market-search result
*/
Evme.MarketSearchRenderer = function Evme_MarketSearchRenderer() {
  var NAME = 'MarketSearchRenderer',
    self = this,
    containerEl,
    app;

  this.init = function init(cfg) {
    containerEl = cfg.containerEl;
    app = {
      id: 'marketsearch',
      name: 'Marketplace',
      icon: EvmeManager.getMarketplaceAppIcon(),
      appUrl: "store://?search"
    };
  };

  this.render = function render() {
    this.clear();

    var marketSearchResult = new Evme.MarketSearchResult(),
      el = marketSearchResult.init(app);

    marketSearchResult.draw(app.icon);
    containerEl.appendChild(el);
  };

  this.clear = function clear() {
    containerEl.innerHTML = '';
  };

  this.getResultCount = function getResultCount() {
    return containerEl.childElementCount;
  };
};
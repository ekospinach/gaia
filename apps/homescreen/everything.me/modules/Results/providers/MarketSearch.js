Evme.MarketSearchResult = function Evme_MarketSearch() {
  Evme.Result.call(this);
  this.type = Evme.RESULT_TYPE.MARKET_SEARCH;
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
Evme.STATIC_APP_TYPE = {
  CLOUD: 'cloud'
};

Evme.StaticAppsRenderer = function Evme_StaticAppsRenderer() {
  var NAME = "StaticAppsRenderer",
    DEFAULT_ICON = Evme.Utils.getDefaultAppIcon(),
    self = this,
    containerEl,
    containerSelector,
    filterResults;

  this.init = function init(cfg) {
    containerEl = cfg.containerEl;
    containerSelector = cfg.containerSelector;
    filterResults = cfg.filterResults;
  };

  this.render = function render(apps) {
    this.clear();
    renderDocFrag(apps);
  };

  this.clear = function clear() {
    containerEl.innerHTML = '';
    filterResults && Evme.Utils.filterProviderResults({
      "id": 'static'
    });
  };

  this.getResultCount = function getResultCount() {
    return containerEl.childElementCount;
  };

  function renderDocFrag(apps) {
    var docFrag = document.createDocumentFragment(),
        appUrls = [];

    for (var i = 0, app; app = apps[i++];) {
      app.isRemovable = true;
      
      var result,
          el;
      
      debugger;
      if (app.staticType === Evme.STATIC_APP_TYPE.CLOUD){
        result = new Evme.CloudAppResult(app.collectionQuery);
      } else {
        result = new Evme.InstalledAppResult();
      }
      
      el = result.init(app);

      result.draw(app.icon || DEFAULT_ICON);
      docFrag.appendChild(el);

      if (filterResults && 'appUrl' in app) {
        appUrls.push(app.appUrl);
      }
    }
        
    containerEl.appendChild(docFrag);

    filterResults && Evme.Utils.filterProviderResults({
      "id": 'static',
      "attribute": 'data-url',
      "containerSelector": containerSelector,
      "items": appUrls
    });
  }
}
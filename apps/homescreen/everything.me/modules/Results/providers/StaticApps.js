Evme.StaticAppResult = function Evme_StaticAppResult() {
  Evme.Result.call(this);
  this.type = Evme.RESULT_TYPE.INSTALLED;

  // @override
  this.launch = function launchStaticdApp(){
    EvmeManager.openInstalledApp({
        "id": this.cfg.id,
        "origin": this.cfg.appUrl
    });
  };
};
Evme.StaticAppResult.prototype = Object.create(Evme.Result.prototype);
Evme.StaticAppResult.prototype.constructor = Evme.StaticAppResult;

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
      
      var result = new Evme.StaticAppResult(),
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
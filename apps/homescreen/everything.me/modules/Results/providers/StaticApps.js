Evme.StaticAppResult = function Evme_StaticAppResult() {
  Evme.Result.call(this);
  this.group = Evme.RESULT_GROUP.STATIC;

  // TODO: if a cloud app was pinned to folder type should be CLOUD
  // at the moment all static apps are installed apps
  this.type = Evme.RESULT_TYPE.INSTALLED;
}
Evme.StaticAppResult.prototype = Object.create(Evme.Result.prototype);
Evme.StaticAppResult.prototype.constructor = Evme.StaticAppResult;

Evme.StaticAppsRenderer = function Evme_StaticAppsRenderer() {
  var NAME = "StaticAppsRenderer",
    DEFAULT_ICON = Evme.Utils.getDefaultAppIcon(),
    self = this,
    containerEl;


  this.init = function init(cfg) {
    containerEl = cfg.containerEl;
  };

  this.render = function render(apps) {
    this.clear();
    renderDocFrag(apps);
  };

  this.clear = function clear() {
    containerEl.innerHTML = '';
  };

  this.getResultCount = function getResultCount() {
    return containerEl.childElementCount;
  };

  function renderDocFrag(apps) {
    var docFrag = document.createDocumentFragment();
    for (var i = 0, app; app = apps[i++];) {
      var result = new Evme.StaticAppResult(),
        el = result.init(app);

      result.draw(app.icon || DEFAULT_ICON);
      docFrag.appendChild(el);
    }
    containerEl.appendChild(docFrag);
  }
}
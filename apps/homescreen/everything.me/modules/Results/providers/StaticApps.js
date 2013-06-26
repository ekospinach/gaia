Evme.StaticAppResult = function Evme_StaticAppResult() {
  Evme.Result.call(this);
  this.type = Evme.RESULT_TYPE.STATIC;
}
Evme.StaticAppResult.prototype = Object.create(Evme.Result.prototype);
Evme.StaticAppResult.prototype.constructor = Evme.StaticAppResult;

Evme.StaticAppsRenderer = function Evme_StaticAppsRenderer() {
  var NAME = "StaticAppsRenderer",
    DEFAULT_ICON = Evme.Utils.getDefaultAppIcon(),
    self = this;


  this.init = function init(cfg) {
    containerEl = cfg.containerEl;
  };

  this.render = function render(apps) {
    // TODO signatures
    this.clear();
    renderDocFrag(apps);
  };

  this.clear = function clear() {
    containerEl.innerHTML = '';
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
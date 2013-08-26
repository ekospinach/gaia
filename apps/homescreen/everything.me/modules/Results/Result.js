Evme.RESULT_TYPE = {
  CONTACT: 'contact',
  INSTALLED: 'installed',
  MARKET: 'native_download',
  MARKET_SEARCH: 'market_search',
  CLOUD: 'app',
  WEBLINK: 'weblink'
};

Evme.Result = function Evme_Result(__cfg, __index, __isMore) {
  var NAME = "Result",
    self = this,
    cfg = {}, el = null,
    index = __index,
    isMore = __isMore,

    TEXT_HEIGHT = Evme.Utils.APPS_FONT_SIZE * 3,
    TEXT_WIDTH = 72 * Evme.Utils.devicePixelRatio,
    TEXT_MARGIN = 6 * Evme.Utils.devicePixelRatio,

    image = new Image();

  this.type = 'NOT_SET';
  
  this.app = null;
  this.icon = null;
  this.elIcon = null;

  this.init = function init(app) {
    cfg = app;

    this.app = app;

    el = Evme.$create('li', {
      'id': 'app_' + cfg.id,
      'data-name': cfg.name
    }, '<img />');

    if ('isOfflineReady' in cfg) {
      el.dataset.offlineReady = cfg.isOfflineReady;
    }

    this.elIcon = el.querySelector('img');

    // remove button
    if (app.isRemovable) {
      var removeButton = Evme.$create('span', {
        'class': 'remove' 
      });
      removeButton.addEventListener('click', cbRemoveClick);
      removeButton.addEventListener('touchstart', stopPropagation);
      removeButton.addEventListener('touchend', stopPropagation);
      el.appendChild(removeButton);
    }

    el.addEventListener("click", onClick);
    el.addEventListener("contextmenu", onContextMenu);

    return el;
  };

  this.draw = function draw(iconObj) {
    cfg.icon = iconObj;
    
    if (el) {
      el.setAttribute('data-name', cfg.name);

      if (Evme.Utils.isBlob(iconObj)) {
        Evme.Utils.blobToDataURI(iconObj, function onDataReady(src) {
          setImageSrc(src);
        });

      } else {
        var src  = Evme.Utils.formatImageData(iconObj);
        setImageSrc(src);
      }
    }

    function setImageSrc(src) {   
      image.onload = self.onAppIconLoad;
      image.src = src;
    }
  };

  /**
   * Save reference to the raw, unmaniputaled icon
   * Used when closing a collection to update its homescreen icon
   */
  this.setIconSrc = function(src) {
    el.dataset.iconSrc = src;
  };

  /**
   * Default implementation of Result icon rendering.
   * Currently only Evme.CloudAppResult implements different rendering.
   */
  this.onAppIconLoad = function onAppIconLoad() {
    // use OS icon rendering
    var iconCanvas = Icon.prototype.createCanvas(image),
        canvasSize = iconCanvas.width,

        canvas = self.initIcon(canvasSize, canvasSize),
        context = canvas.getContext('2d');

    context.drawImage(iconCanvas, (TEXT_WIDTH - canvasSize) / 2, 0);
    self.iconPostRendering(iconCanvas);
    self.finalizeIcon(canvas);
    self.setIconSrc(image.src);
  };

  this.initIcon = function initIcon(baseHeight, textOffset) {
    var canvas = document.createElement('canvas'),
        context = canvas.getContext('2d');

    canvas.width = TEXT_WIDTH;
    canvas.height = baseHeight + TEXT_MARGIN + TEXT_HEIGHT - 1;

    Evme.Utils.writeTextToCanvas({
      "text": cfg.name,
      "context": context,
      "offset": textOffset + TEXT_MARGIN
    });

    return canvas;
  };

  this.iconPostRendering = function iconPostRendering(iconCanvas) {
    // default: do nothing
  };

  this.finalizeIcon = function finalizeIcon(canvas) {
    self.elIcon.src = canvas.toDataURL();
  };

  this.remove = function remove() {
    Evme.$remove(el);
  };

  this.isExternal = function isExternal() {
    return cfg.isWeblink;
  };

  this.getElement = function getElement() {
    return el;
  };

  this.getId = function getId() {
    return cfg.id;
  };

  this.getLink = function getLink() {
    return cfg.appUrl;
  };

  this.getFavLink = function getFavLink() {
    return cfg.favUrl != "@" && cfg.favUrl || cfg.appUrl;
  };

  this.getIcon = function getIcon() {
    return cfg.icon;
  };

  this.getCfg = function getCfg() {
    return cfg;
  };

  function onClick(e) {
    e.stopPropagation();

    Evme.EventHandler.trigger(NAME, "click", {
      "app": self,
      "appId": cfg.id,
      "el": el,
      "data": cfg,
      "index": index,
      "isMore": isMore,
      "e": e
    });
  }

  function onContextMenu(e) {
    e.stopPropagation();
    e.preventDefault();

    Evme.EventHandler.trigger(NAME, "hold", {
      "app": self,
      "appId": cfg.id,
      "el": el,
      "data": cfg,
      "index": index,
      "isMore": isMore
    });
  }

  // prevent app click from being triggered
  function stopPropagation(e) {
    e.stopPropagation();
  }

  function cbRemoveClick() {
    Evme.EventHandler.trigger(NAME, "remove", {
      "id": cfg.id
    });
  }
}
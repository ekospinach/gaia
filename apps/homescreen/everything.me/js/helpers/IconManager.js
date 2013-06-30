Evme.IconManager = new function Evme_IconManager() {
  var NAME = "IconManager",
    self = this,
    _prefix = "_icon",
    CACHE_VERSION = "2.6";

  this.add = function add(id, icon, iconsFormat) {
    if (!icon) {
      return false;
    }

    icon.format = iconsFormat;
    icon.id = id;

    if (!icon.format || !icon.revision || !icon.id) {
      return false;
    }

    self.get(id, function fromCache(iconFromCache) {
      if (!iconFromCache || iconFromCache.format < iconsFormat) {
        Evme.Storage.set(_prefix + id, icon);
        Evme.EventHandler.trigger(NAME, "iconAdded", icon);
      }
    });

    return true;
  };

  this.addIcons = function addIcons(icons, format) {
    for (var i = 0, icon; icon = icons[i++];) {
      this.add(icon.id, icon.icon, format);
    }
  };

  this.get = function get(id, callback) {
    Evme.Storage.get(_prefix + id, callback);
  };
};

Evme.IconGroup = new function Evme_IconGroup() {
  var ICON_HEIGHT,
    TEXT_HEIGHT,
    TEXT_MARGIN,
    WIDTH,
    HEIGHT;

  this.init = function init(options) {
    ICON_HEIGHT = 42 * Evme.Utils.devicePixelRatio,
    TEXT_HEIGHT = Evme.Utils.APPS_FONT_SIZE * 3,
    TEXT_MARGIN = 9 * Evme.Utils.devicePixelRatio,
    WIDTH = 72 * Evme.Utils.devicePixelRatio,
    HEIGHT = ICON_HEIGHT + TEXT_MARGIN + TEXT_HEIGHT;
  };

  this.get = function get(ids, query, callback) {
    var el = renderCanvas({
      "apps": ids || [],  // list of objects with "id" and "icon" properties
      "icons": Evme.Utils.getIconGroup() || [],  // the settings for the icons
      "query": query,
      "onReady": callback
    });

    return el;
  };

  function renderCanvas(options) {
    var apps = options.apps,
        icons = options.icons,
        query = options.query,
        onReady = options.onReady || function() {},
        elCanvas = document.createElement('canvas'),
        context = elCanvas.getContext('2d');

    elCanvas.width = WIDTH;
    elCanvas.height = query? HEIGHT : WIDTH;
    context.imagesToLoad = apps.length;
    context.imagesLoaded = [];

    if (!Array.isArray(apps)) {
      var objectApps = apps;
      apps = [];
      for (var id in objectApps) {
        apps.push({
          "icon": objectApps[id]
        });
      }
    }

    for (var i = 0; i < apps.length; i++) {
      // render the icons from bottom to top
      var app = apps[apps.length - 1 - i];

      if (typeof app !== "object") {
      	app = {
      	  "id": app,
      	};
      }

      if (app.icon) {
        loadIcon(app.icon, icons[(icons.length - apps.length) + i], context, i, onReady);
      } else {
        (function(app, icon, context, i, onReady) {
          Evme.IconManager.get(app.id, function onIconFromCache(appIcon) {
            loadIcon(Evme.Utils.formatImageData(appIcon), icon, context, i, onReady);
          });
        }(app, icons[i], context, i, onReady));
      }
    }
    
    // add the app name
    if (query) {
      Evme.Utils.writeTextToCanvas({
        "context": context,
        "text": query,
        "offset": ICON_HEIGHT + TEXT_MARGIN
      });
    }

    return elCanvas;
  }

  function loadIcon(iconSrc, icon, context, index, onReady) {
    if (!iconSrc) {
      onIconLoaded(context, null, icon, index, onReady);
      return false;
    }

    var image = new Image();

    image.onload = function onImageLoad() {
      var elImageCanvas = document.createElement('canvas'),
    	imageContext = elImageCanvas.getContext('2d'),
    	fixedImage = new Image(),
    	size = icon.size * Evme.Utils.devicePixelRatio;

      elImageCanvas.width = elImageCanvas.height = size;

      imageContext.beginPath();
      imageContext.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, false);
      imageContext.closePath();
      imageContext.clip();

      //first we draw the image resized and clipped (to be rounded)
      imageContext.drawImage(this, 0, 0, size, size);

      // dark overlay
      if (icon.darken) {
      	imageContext.fillStyle = 'rgba(0, 0, 0, ' + icon.darken + ')';
      	imageContext.beginPath();
      	imageContext.arc(size / 2, size / 2, Math.ceil(size / 2), 0, Math.PI * 2, false);
      	imageContext.fill();
      	imageContext.closePath();
      }

      fixedImage.onload = function onImageLoad() {
        onIconLoaded(context, this, icon, index, onReady);
      };

      fixedImage.src = elImageCanvas.toDataURL('image/png');
    };

    if (Evme.Utils.isBlob(iconSrc)) {
      Evme.Utils.blobToDataURI(iconSrc, function onDataReady(src) {
        image.src = src;
      });
    } else {
      image.src = Evme.Utils.formatImageData(iconSrc);
    }

    return true;
  }

  function onIconLoaded(context, image, icon, index, onAllIconsReady) {
    // once the image is ready to be drawn, we add it to an array
    // so when all the images are loaded we can draw them in the right order
    context.imagesLoaded.push({
      "image": image,
      "icon": icon,
      "index": index
    });

    if (context.imagesLoaded.length === context.imagesToLoad) {
      // all the images were loaded- let's sort correctly before drawing
      context.imagesLoaded.sort(function(a, b) {
        return a.index > b.index ? 1 : a.index < b.index ? -1 : 0;
      });

      // finally we're ready to draw the icons!
      for (var i = 0, obj; obj = context.imagesLoaded[i++];) {
      	var image = obj.image,
        	  icon = obj.icon,
        	  size = icon.size * Evme.Utils.devicePixelRatio;

      	if (!image) {
      	  continue;
      	}

      	// shadow
      	context.shadowOffsetX = icon.shadowOffset;
      	context.shadowOffsetY = icon.shadowOffset;
      	context.shadowBlur = icon.shadowBlur;
      	context.shadowColor = 'rgba(0, 0, 0, ' + icon.shadowOpacity + ')';

      	// rotation
      	context.save();
      	context.translate(icon.x * Evme.Utils.devicePixelRatio + size / 2, icon.y * Evme.Utils.devicePixelRatio + size / 2);
      	context.rotate((icon.rotate || 0) * Math.PI / 180);
      	// draw the icon already!
      	context.drawImage(image, -size / 2, -size / 2);
      	context.restore();
      }

      onAllIconsReady && onAllIconsReady(context.canvas);
    }
  }
};
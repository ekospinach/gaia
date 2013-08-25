
"use strict";

var EvmeManager = (function EvmeManager() {
    var currentWindow = null,
        currentURL = null;

    function openApp(params) {
        var evmeApp = new EvmeApp({
            bookmarkURL: params.originUrl,
            name: params.title,
            icon: params.icon
        });

        evmeApp.launch(params.url, params.urlTitle, params.useAsyncPanZoom);
        currentURL = params.url;
    }

    function addGridItem(params) {
      var item = GridItemsFactory.create({
        "id": params.id || Evme.Utils.uuid(),
        "bookmarkURL": params.originUrl,
        "name": params.title,
        "icon": params.icon,
        "iconable": false,
        "useAsyncPanZoom": params.useAsyncPanZoom,
        "type": !!params.isCollection ? GridItemsFactory.TYPE.COLLECTION :
                                    GridItemsFactory.TYPE.BOOKMARK,
        "isEmpty": !!params.isEmpty
      });

      GridManager.install(item, params.gridPosition);
      GridManager.ensurePagesOverflow(Evme.Utils.NOOP);
    }

    function openUrl(url) {
        new MozActivity({
           name: "view",
            data: {
                type: "url",
                url: url
            }
        });
    }

    function menuShow() {
        footerStyle.MozTransform = "translateY(0)";
    }

    function menuHide() {
        footerStyle.MozTransform = "translateY(100%)";
    }

    var footerStyle = document.getElementById("footer").style;
    footerStyle.MozTransition = "-moz-transform .3s ease";

    function getMenuHeight() {
        return document.getElementById("footer").offsetHeight;
    }

    /**
     * Returns all apps on grid *excluding* collections.
     */
    function getApps() {
        return GridManager.getApps(true /* Flatten */, true /* Hide hidden */);
    }

    /**
     * Returns only the collections on the user's phone
     */
    function getCollections() {
        return GridManager.getCollections();
    }

    function getAppInfo(gridApp, cb) {
        cb = cb || Evme.Utils.NOOP;

        var id = gridApp.manifestURL || gridApp.bookmarkURL,
            icon = GridManager.getIcon(gridApp),
            appInfo;

        if (!id) return;

        appInfo = {
            "id": id,
            "name": getAppName(gridApp),
            "appUrl": gridApp.origin,
            "icon": Icon.prototype.DEFAULT_ICON_URL,
            "isOfflineReady": icon && 'isOfflineReady' in icon && icon.isOfflineReady()
        };

        if (!icon) {
            cb(appInfo);
        } else {
            retrieveIcon({
                icon: icon,
                done: function(blob) {
                    if (blob) appInfo['icon'] = blob;
                    cb(appInfo);
                }
            });
        }
    }

    function retrieveIcon(request) {
      var xhr = new XMLHttpRequest({
        mozAnon: true,
        mozSystem: true
      });

      var icon = request.icon.descriptor.icon;

      xhr.open('GET', icon, true);
      xhr.responseType = 'blob';

      try {
        xhr.send(null);
      } catch (evt) {
        request.done();
        return;
      }

      xhr.onload = function onload(evt) {
        var status = xhr.status;
        if (status !== 0 && status !== 200)
            request.done();
        else
            request.done(xhr.response);
      };

      xhr.ontimeout = xhr.onerror = function onerror(evt) {
        request.done();
      };
    }

    function getAppName(app) {
        var manifest = app.manifest;
        if (!manifest) {
            return null;
        }

        if ('locales' in manifest) {
            var locale = manifest.locales[document.documentElement.lang];
            if (locale && locale.name) {
                return locale.name;
            }
        }

        return manifest.name;
    }

    function getIconSize() {
        return Icon.prototype.MAX_ICON_SIZE;
    }

    function isEvmeVisible(isVisible) {
        GridManager.setLandingPageOpacity(isVisible ? 0.4 : 0);
    }

    function openMarketplaceApp(data) {
      var activity = new MozActivity({
        name: "marketplace-app",
        data: {slug: data.slug}
      });

      activity.onerror = function(){
        window.open('https://marketplace.firefox.com/app/'+data.slug, 'e.me');
      }
    }

    function openMarketplaceSearch(data) {
      var activity = new MozActivity({
          name: "marketplace-search",
          data: {query: data.query}
      });

      activity.onerror = function(){
        window.open('https://marketplace.firefox.com/search/?q='+data.query, 'e.me');
      }
    }

    function getApp(appId) {
      return GridManager.getIcon({
        "manifestURL": appId
      });
    }

    return {
      openApp: openApp,

      addGridItem: addGridItem,

      isAppInstalled: function isAppInstalled(url) {
          return GridManager.getIconForBookmark(url) ||
                 GridManager.getAppByOrigin(url);
      },
      getApps: getApps,
      getCollections: getCollections,
      getAppInfo: getAppInfo,

      openUrl: openUrl,
      openMarketplaceApp: openMarketplaceApp,
      openMarketplaceSearch: openMarketplaceSearch,

      isEvmeVisible: isEvmeVisible,

      menuShow: menuShow,
      menuHide: menuHide,
      getMenuHeight: getMenuHeight,

      getIconSize: getIconSize
    };
}());

var EvmeApp = function createEvmeApp(params) {
    Bookmark.call(this, params);
};

extend(EvmeApp, Bookmark);

EvmeApp.prototype.launch = function evmeapp_launch(url, name, useAsyncPanZoom) {
    var features = {
      name: this.manifest.name,
      icon: this.manifest.icons['60'],
      remote: true,
      useAsyncPanZoom: useAsyncPanZoom
    };

    if (!GridManager.getIconForBookmark(this.origin)) {
      features.originName = features.name;
      features.originUrl = this.origin;
    }

    if (url && url !== this.origin && !GridManager.getIconForBookmark(url)) {
      var searchName = navigator.mozL10n.get('wrapper-search-name', {
        topic: name,
        name: this.manifest.name
      });

      features.name = searchName;
      features.searchName = searchName;
      features.searchUrl = url;
    }

    // We use `e.me` name in order to always reuse the same window
    // so that we can only open one e.me app at a time
    return window.open(url || this.origin, 'e.me', Object.keys(features)
      .map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(features[key]);
    }).join(','));
};


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

    function addBookmark(params) {
      GridManager.install(new Bookmark({
        "id": params.id || Evme.Utils.uuid(),
        "bookmarkURL": params.originUrl,
        "name": params.title,
        "icon": params.icon,
        "iconable": false,
        "useAsyncPanZoom": params.useAsyncPanZoom,
        "isFolder": !!params.isFolder
      }), params.gridPosition);

      GridManager.ensurePagesOverflow(Evme.Utils.NOOP);
    }

    function hideFromGrid(ids) {
        if (!Array.isArray(ids)) {
            ids = [ids];
        }
        
        // we can not tell if `id` is a bookmarkURL or a manifestURL
        // since Everything.me does not distinguish apps from bookmarks
        // hence we send both as descriptors
        var manifestDescriptors = ids.map(function makeManifestDescriptor(id) {
            return { "manifestURL": id }
        });

        var bookmarkDescriptors = ids.map(function makeBookmarkDescriptor(id) {
            return { "bookmarkURL": id }
        });

        var descriptors = manifestDescriptors.concat(bookmarkDescriptors);

        return GridManager.hide(descriptors);
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

    // returns all apps on grid *excluding* folders
    function getApps() {
        return GridManager.getApps();
    }

    function getAppInfo(app) {
        var appId = app.manifestURL || app.bookmarkURL;
        if (appId) {
            return {
                'id': appId,
                'name': getAppName(app),
                'appUrl': app.origin,
                'icon': getAppIcon(app)
            }
        }

        return undefined;
    }

    function getAppIcon(app) {
        var iconObject = GridManager.getIcon(app);
        if (iconObject &&
                'descriptor' in iconObject &&
                'renderedIcon' in iconObject.descriptor) {
            return iconObject.descriptor.renderedIcon;
        }
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

    function openMarketplaceApp(data) {
	var activity = new MozActivity({
	    name: "marketplace-app",
	    data: {slug: data.slug}
	});
    }

    function openMarketplaceSearch(data) {
	var activity = new MozActivity({
	    name: "marketplace-search",
	    data: {query: data.query}
	});
    }

    return {
        openApp: openApp,

        addBookmark: addBookmark,
        hideFromGrid: hideFromGrid,

        isAppInstalled: function isAppInstalled(url) {
            return GridManager.getIconForBookmark(url) ||
                   GridManager.getAppByOrigin(url);
        },
        getApps: getApps,
    	getAppInfo: getAppInfo,

        openUrl: openUrl,
    	openMarketplaceApp: openMarketplaceApp,
    	openMarketplaceSearch: openMarketplaceSearch,

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
      name: this.manifest.name.replace(/\s/g, '&nbsp;'),
      icon: this.manifest.icons['60'],
      remote: true,
      useAsyncPanZoom: useAsyncPanZoom
    };

    if (!GridManager.getIconForBookmark(this.origin)) {
      features.origin = {
        name: features.name,
        url: encodeURIComponent(this.origin)
      };
    }

    if (url && url !== this.origin && !GridManager.getIconForBookmark(url)) {
      var searchName = navigator.mozL10n.get('wrapper-search-name', {
        topic: name,
        name: this.manifest.name
      }).replace(/\s/g, '&nbsp;');

      features.name = searchName;
      features.search = {
        name: searchName,
        url: encodeURIComponent(url)
      };
    }

    // The third parameter is received in window_manager without whitespaces
    // so we decice replace them for &nbsp;
    // We use `e.me` name in order to always reuse the same window
    // so that we can only open one e.me app at a time
    return window.open(url || this.origin, 'e.me', JSON.stringify(features));
};

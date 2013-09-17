window.Evme = new function Evme_Core() {
    var NAME = "Core", self = this,
        head_ts = new Date().getTime();

    this.shouldSearchOnInputBlur = false;

    this.init = function init(callback) {
        var data = Evme.__config,
            apiHost = Evme.Utils.getUrlParam("apiHost") || data.apiHost;

        apiHost && Evme.api.setHost(apiHost);

        bm('Brain init');
        Evme.Brain.init({
            "numberOfAppsToLoad": data.numberOfAppsToLoad+(Evme.Utils.devicePixelRatio>1? data.apps.appsPerRow: 0),
            "searchSources": data.searchSources,
            "pageViewSources": data.pageViewSources,
            "displayInstalledApps": data.apps.displayInstalledApps
        });
        bmend('Brain init');

        bm('DoATAPI init');
        Evme.DoATAPI.init({
            "apiKey": data.apiKey,
            "appVersion": data.appVersion,
            "authCookieName": data.authCookieName,
            "callback": function initCallback() {
              bmend('DoATAPI init');
              setupObjects(data, callback);
            }
        });
    };

    this.onShow = function onShow() {
      document.body.classList.add('evme-displayed');
    };

    this.onHide = function onHide() {
      document.body.classList.remove('evme-displayed');

      Evme.Searchbar.blur();
      Evme.Collection.hide();
    };

    this.onHomeButtonPress = function onHomeButtonPress() {
      Evme.Searchbar.blur();

      if (
        // hide suggested collections list if open
        Evme.CollectionsSuggest.hide() || 
        // stop editing if active
        Evme.Collection.toggleEditMode(false) || 
        // close full screen background image if visible
        Evme.Collection.hideFullscreen() || 
        // hide the collection if visible
        Evme.Collection.hide() ||
        // close search results full screen background image if visible
        Evme.BackgroundImage.closeFullScreen() ||
        // clear the searchbar and apps
        (Evme.Searchbar.clearIfHasQuery() && document.body.classList.contains('evme-displayed'))
      ) {
        return true;
      }

      return false;
    };

    this.onCollectionSuggest = function onCollectionSuggest() {
      Evme.Brain.CollectionsSuggest.showUI();
    };

    this.onCollectionCustom = function onCollectionCustom() {
      Evme.CollectionSuggest.newCustom();
    };

    this.searchFromOutside = function searchFromOutside(query) {
        Evme.Brain.Searcher.searchExactFromOutside(query);
    };

    
  // one time setup to execute on device first launch
  function setupObjects(data, callback) {
    bm('Setup Objects');
    var setupCollectionStorageKey = 'collection-storage-setup';

    Evme.Storage.get(setupCollectionStorageKey, function next(didSetup){
      if (didSetup) {
        bmend('Setup Objects');
        initObjects(data);
        callback();
      } else {
        setupCollectionStorage(function deferInit(){
          Evme.Storage.set(setupCollectionStorageKey, true);
          bmend('Setup Objects');
          initObjects(data);
          callback();
        });
      }
    });
  }

  function setupCollectionStorage(done) {
    bm('Setup Collection Storage');
    var collections = EvmeManager.getCollections(),
        total = collections.length;
    
    if (total === 0) {
      done();
      return;
    }

    for (var i = 0; i < total; i++) {
      var collection = collections[i],
          experienceId = collection.providerId;

      // TODO: populate apps from manifest file
      var apps = [];

      var collectionSettings = new Evme.CollectionSettings({
        "id": collection.id,
        "experienceId": experienceId,
        "apps": apps
      });

      Evme.CollectionStorage.add(collectionSettings, function onSaved() {
        if (--total === 0) {
          bmend('Setup Collection Storage');
          done();
        }
      });
    }
  }

  function initObjects(data) {
    bm('Init Objects');
    
    var appsEl = Evme.$("#evmeApps"),
        collectionEl = document.querySelector("#collection .evme-apps");

    bm('Features init');
    Evme.Features.init({
      "featureStateByConnection": data.featureStateByConnection
    });
    bmend('Features init');

    bm('ConnectionMessage init');
    Evme.ConnectionMessage.init();
    bmend('ConnectionMessage init');

    bm('Location init');
    Evme.Location.init({
      "refreshInterval": data.locationInterval,
      "requestTimeout": data.locationRequestTimeout
    });
    bmend('Location init');

    bm('CollectionsSuggest init');
    Evme.CollectionsSuggest.init({
      "elParent": Evme.Utils.getContainer()
    });
    bmend('CollectionsSuggest init');

    bm('Searchbar init');
    Evme.Searchbar.init({
      "el": Evme.$("#search-q"),
      "elForm": Evme.$("#search-rapper"),
      "elDefaultText": Evme.$("#default-text"),
      "timeBeforeEventPause": data.searchbar.timeBeforeEventPause,
      "timeBeforeEventIdle": data.searchbar.timeBeforeEventIdle,
      "setFocusOnClear": false
    });
    bmend('Searchbar init');

    bm('Helper init');
    Evme.Helper.init({
      "el": Evme.$("#helper"),
      "elTitle": Evme.$("#search-title"),
      "elTip": Evme.$("#helper-tip")
    });
    bmend('Helper init');

    bm('BackgroundImage init');
    Evme.BackgroundImage.init({
      "el": Evme.$("#search-overlay")
    });
    bmend('BackgroundImage init');

    bm('SearchResults init');
    Evme.SearchResults = new Evme.ResultManager();
    Evme.SearchResults.init({
      "NAME": 'SearchResults',
      "el": appsEl,
      "appsPerRow": data.apps.appsPerRow,
      "providers": [
        {
          type: Evme.PROVIDER_TYPES.CONTACTS,
          config: {
            "renderer": Evme.ContactResultsRenderer,
            "containerEl": Evme.$(".contacts", appsEl)[0]
          }
        }, {
          type: Evme.PROVIDER_TYPES.STATIC,
          config: {
            "renderer": Evme.StaticAppsRenderer,
            "containerEl": Evme.$(".static", appsEl)[0]
          }
        }, {
          type: Evme.PROVIDER_TYPES.INSTALLED,
          config: {
            "renderer": Evme.InstalledAppsRenderer,
            "containerEl": Evme.$(".installed", appsEl)[0]
          }
        }, {
          type: Evme.PROVIDER_TYPES.CLOUD,
          config: {
            "renderer": Evme.CloudAppsRenderer,
            "containerEl": Evme.$(".cloud", appsEl)[0]
          }
        }, {
          type: Evme.PROVIDER_TYPES.MARKETAPPS,
          config: {
            "renderer": Evme.MarketAppsRenderer,
            "containerEl": Evme.$(".marketapps", appsEl)[0]
          }
        }, {
          type: Evme.PROVIDER_TYPES.MARKETSEARCH,
          config: {
            "renderer": Evme.MarketSearchRenderer,
            "containerEl": Evme.$(".marketsearch", appsEl)[0]
          }
        }
      ]
    });
    bmend('SearchResults init');

    bm('CollectionResults init');
    Evme.CollectionResults = new Evme.ResultManager();
    Evme.CollectionResults.init({
      "NAME": 'CollectionResults',
      "el": collectionEl,
      "appsPerRow": data.apps.appsPerRow,
      "providers": [{
          type: Evme.PROVIDER_TYPES.STATIC,
          config: {
            "renderer": Evme.StaticAppsRenderer,
            "containerEl": Evme.$(".static", collectionEl)[0]
          }
        }, {
          type: Evme.PROVIDER_TYPES.CLOUD,
          config: {
            "renderer": Evme.CloudAppsRenderer,
            "containerEl": Evme.$(".cloud", collectionEl)[0]
          }
        }
      ]
    });
    bmend('CollectionResults init');

    bm('CollectionStorage init');
    Evme.CollectionStorage.init();
    bmend('CollectionStorage init');
    
    bm('Collection init');
    Evme.Collection.init({
      "resultsManager": Evme.CollectionResults,
      "bgImage": (Evme.BackgroundImage.get() || {}).image
    });
    bmend('Collection init');

    bm('InstalledAppsService init');
    Evme.InstalledAppsService.init();
    bmend('InstalledAppsService init');

    bm('IconGroup init');
    Evme.IconGroup.init({});
    bmend('IconGroup init');

    bm('Banner init');
    Evme.Banner.init({
      "el": Evme.$("#homescreenStatus")
    });
    bmend('Banner init');

    bm('SearchHistory init');
    Evme.SearchHistory.init({
      "maxEntries": data.maxHistoryEntries
    });
    bmend('SearchHistory init');

    bm('Analytics init');
    Evme.Analytics.init({
      "config": data.analytics,
      "namespace": Evme,
      "DoATAPI": Evme.DoATAPI,
      "Brain": Evme.Brain,
      "connectionLow": Evme.Utils.connection().speed != Evme.Utils.connection().SPEED_HIGH,
      "sessionObj": Evme.DoATAPI.Session.get(),
      "pageRenderStartTs": head_ts,
      "SEARCH_SOURCES": data.searchSources,
      "PAGEVIEW_SOURCES": data.pageViewSources
    });
    bmend('Analytics init');

    bmend('Init Objects');
    
    Evme.EventHandler.trigger(NAME, "init", {
      "deviceId": Evme.DoATAPI.getDeviceId()
    });
  }
};


Evme.Config = Evme.__config = {
    "appVersion": "2.0.145",
    "apiHost": "api.everything.me",
    "apiKey": "65106dbdb655b25f2defa18ab7d1ecd8",
    "authCookieName": "prod-credentials",
    "apps": {
        "appsPerRow": 4,
        "appHeight": 89,
        "widthForFiveApps": 400,
        "displayInstalledApps": true
    },

    // how many app icons in a Collection icon
    "numberOfAppInCollectionIcon": 3,

    "numberOfAppsToLoad": 16,
    "bgImageSize": [320, 460],
    "searchbar": {
        "timeBeforeEventPause": 10000,
        "timeBeforeEventIdle": 10000
    },
    "searchSources": {
        "URL": "url",
        "SHORTCUT": "shrt",
        "SHORTCUT_ENTITY": "enty",
        "SHORTCUT_CONTINUE_BUTTON": "shrb",
  "SHORTCUT_COLLECTION": "fldr",
        "RETURN_KEY": "rtrn",
        "SUGGESTION": "sugg",
        "SPELLING": "spel",
        "REFINE": "refi",
        "HISTORY": "hist",
        "TYPING": "type",
        "LOCATION_REFRESH": "locn",
        "PAUSE": "wait",
        "MORE": "more",
        "INFO_WHATIS": "infw",
        "EMPTY_SEARCHBOX": "mpty",
        "ME_LIKES": "like"
    },
    "pageViewSources": {
        "URL": "url",
        "TAB": "tab",
        "BACK": "back",
        "CLEAR_SEARCHBOX": "clear",
        "SHORTCUT": "shrt"
    },
    "analytics": {
        "enabled": true,
        "providers": {            
            "APIStatsEvents": {
                "enabled": true,
                "requestsPerEventCount": 1
            }
        }
    },
    "maxHistoryEntries": "10",
    "emptyCollectionIcon": "/everything.me/images/empty-collection.png",
    "iconsGroupSettings": {
  "1": [{
      "x": 10,
      "y": 6,
      "size": 54,
            "shadowOffset": 2,
            "shadowBlur": 1,
      "shadowOpacity": 0.1
  }],
  "2": [{
      "x": 20,
      "y": 10,
      "size": 54,
      "darken": 0.25,
      "shadowOffset": 2,
      "shadowBlur": 2,
      "shadowOpacity": 0.1
  },
  {
      "x": 0,
      "y": 6,
      "size": 54,
      "shadowOffset": 4,
      "shadowOffsetX": 2,
      "shadowBlur": 4,
            "shadowOpacity": 0.2
  }],
  "3": [{
      "x": 26,
      "y": 20,
      "size": 46,
      "darken": 0.4,
      "shadowOffset": 2,
      "shadowBlur": 1,
      "shadowOpacity": 0.1
        },
        {
      "x": 18,
      "y": 10,
      "size": 46,
      "darken": 0.25,
            "shadowOffset": 2,
            "shadowBlur": 2,
      "shadowOpacity": 0.1
        },
        {
      "x": 0,
      "y": 6,
      "size": 54,
            "shadowOffset": 4,
            "shadowOffsetX": 2,
            "shadowBlur": 4,
      "shadowOpacity": 0.2
  }]
    },
    "design": {
        "apps": {
            "defaultIconUrl": {
                "20": [
      "/everything.me/images/icn/default1.png?cb=1346169250",
      "/everything.me/images/icn/default2.png?cb=1346169250",
      "/everything.me/images/icn/default3.png?cb=1346169250"
                ]
      },
      "defaultAppIcon": {
    "normal": "/style/images/default.png",
    "high": "/style/images/default@2x.png"
            }
        }
    },
    // disableAfter: if the app can't render the feature under the timeout, it will disable it
    // bringBack: if, after disabling the feature, it's faster than bringBack- re-enable it
    "featureStateByConnection": {
      "iconQuality": {
        "disableAfter": 2500,
        "bringBack": 600
      },
      "typingImage": {
        "disableAfter": 3000,
        "bringBack": 1500
      },
      "typingApps": {
        "disableAfter": 3500,
        "bringBack": 800
      }
    },
    // time before refreshing user location (milliseconds)
    "locationInterval": 10 * 60 * 1000,
    // timeout for get location request (milliseconds)
    "locationRequestTimeout": 4000,
    // internal mapping of IDs to l10n keys- DON'T TOUCH
    "shortcutIdsToL10nKeys": {
        "297": "astrology",
        "288": "autos",
        "356": "beauty",
        "22": "books",
        "225": "celebs",
        "292": "daily-deals",
        "320": "dating",
        "286": "electronics",
        "248": "email",
        "361": "environment",
        "282": "fashion",
        "277": "funny",
        "207": "games",
        "307": "government",
        "275": "health",
        "274": "jobs",
        "296": "local",
        "278": "maps",
        "181": "movies",
        "142": "music",
        "355": "new-apps",
        "245": "news",
        "349": "photography",
        "270": "recipes",
        "220": "restaurants",
        "238": "shopping",
        "289": "social",
        "260": "sports",
        "244": "tech-news",
        "352": "top-apps",
        "306": "travel",
        "213": "tv",
        "211": "video",
  "249": "weather",
  "357": "utilities"
    }
};

//manager

var EvmeManager = (function EvmeManager() {
    /**
     * E.me references each entry point as a different app with unique id
     * The entry point is encapsulated as a query key
     * http://communications.gaiamobile.org:8080/manifest.webapp?eme-ep=dialer
     */
    var EME_ENTRY_POINT_KEY = "eme-ep";

    var currentWindow = null,
        currentURL = null;

    function addGridItem(params, extra) {
      GridItemsFactory.create({
        "id": params.id || Evme.Utils.uuid(),
        "bookmarkURL": params.originUrl,
        "name": params.title,
        "icon": params.icon,
        "iconable": false,
        "useAsyncPanZoom": params.useAsyncPanZoom,
        "type": !!params.isCollection ? GridItemsFactory.TYPE.COLLECTION :
                                GridItemsFactory.TYPE.BOOKMARK,
        "isEmpty": !!params.isEmpty
      }, function doAddGridItem(item) {
        GridManager.install(item, params.gridPosition, extra);
        GridManager.ensurePagesOverflow(Evme.Utils.NOOP);
      });
    }

    function removeGridItem(params) {
      var origin = params.id;

      var gridItem = GridManager.getApp(origin);
      Homescreen.showAppDialog(gridItem.app, {
  "onConfirm": params.onConfirm || Evme.Utils.NOOP
      });
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
    function getGridApps() {
        return GridManager.getApps(true /* Flatten */, true /* Hide hidden */);
    }

    /**
     * Returns only the collections on the user's phone
     */
    function getCollections() {
  return GridManager.getCollections();
    }

    function getAppByOrigin(origin, cb) {
      var gridApp = GridManager.getApp(origin);
      if (gridApp) {
  getAppInfo(gridApp, cb);
      } else {
  console.error("E.me error: app " + origin + " does not exist");
      }
    }

    /**
     * Returns E.me formatted information about an object
     * returned by GridManager.getApps.
     */
    function getAppInfo(gridApp, cb) {
        cb = cb || Evme.Utils.NOOP;

        var nativeApp = gridApp.app,  // XPCWrappedNative
            descriptor = gridApp.descriptor,
            id,
            icon,
            appInfo;

        // TODO document
        // TODO launch by entry_point
        if (nativeApp.manifestURL) {
          id = generateAppId(nativeApp.manifestURL, descriptor.entry_point);
        } else {
          id = nativeApp.bookmarkURL;
        }

        if (!id) {
          console.warn('E.me: no id found for ' + descriptor.name + '. Will not show up in results');
          return;
        }

        icon = GridManager.getIcon(descriptor);

        appInfo = {
            "id": id,
            "name": descriptor.name,
            "appUrl": nativeApp.origin,
            "icon": Icon.prototype.DEFAULT_ICON_URL
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

    /**
     * Generate a uuid for E.me to reference the app
     */
    function generateAppId(manifestURL, entryPoint){
      if (entryPoint)
  return Evme.Utils.insertParam(manifestURL, EME_ENTRY_POINT_KEY, entryPoint);

      return manifestURL;
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

    function getIconSize() {
        return Icon.prototype.MAX_ICON_SIZE;
    }

    function isEvmeVisible(isVisible) {
  // TODO remove
    }

    function openInstalledApp(params) {
        var gridApp = GridManager.getApp(params.origin),
            entryPoint = Evme.Utils.extractParam(params.id, EME_ENTRY_POINT_KEY);

        if (entryPoint) {
          gridApp.app.launch(entryPoint);
        } else {
          gridApp.app.launch();
        }
    }

    function openCloudApp(params) {
      var evmeApp = new EvmeApp({
    bookmarkURL: params.originUrl,
    name: params.title,
    icon: params.icon
      });

      evmeApp.launch(params.url, params.urlTitle, params.useAsyncPanZoom);
      currentURL = params.url;
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

    function openContact(data) {
      var activity = new MozActivity({
    name: 'open',
    data: {
        type: 'webcontacts/contact',
        params: {
      'id': data.id
        }
    }
      });
    }

    return {
      addGridItem: addGridItem,
      removeGridItem: removeGridItem,

      isAppInstalled: function isAppInstalled(origin) {
    return GridManager.getApp(origin);
      },

      getAppByOrigin: getAppByOrigin,
      getGridApps: getGridApps,
      getCollections: getCollections,
      getAppInfo: getAppInfo,

      openUrl: openUrl,
      openCloudApp: openCloudApp,
      openInstalledApp: openInstalledApp,
      openMarketplaceApp: openMarketplaceApp,
      openMarketplaceSearch: openMarketplaceSearch,
      openContact: openContact,

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

//utils
function create(tagName, parent, props, callback, adjacentNode) {
    var doc = parent ? parent.ownerDocument : document;
    var o = doc.createElement(tagName);
    if (props) for (var p in props) {
        if (p == 'style') {
            var styles = props[p];
            for (var s in styles) o.style.setProperty(s, styles[s]);
        } else o[p] = props[p];
    }
    if (callback && tagName == 'script'){
        var loaded = false;
        
        function onLoad(){
            if (loaded) {
                return;
            }
            loaded=true;
            callback();
        }
        
        o.onload = onLoad;
        o.onreadystatechange = function onReadyStateChange(){
            if (this.readyState == 'loaded'){
                onLoad();
            }
        };
    }
    if (parent){
        // IE compatibility
        try {
            parent.insertBefore(o, adjacentNode);
        }
        catch(e){
            parent.insertBefore(o);
        }
    }
    return o;
}

function parseQuery() {
    var r = {};
   (location.search || '').replace(/(?:[?&]|^)([^=]+)=([^&]*)/g, function regexMatch(ig, k, v) {r[k] = v;});
   return r;
}

function proxify(origObj,proxyObj,funkList){
    function replaceFunk(org,proxy,fName) {
        org[fName] = function applier() {
           return proxy[fName].apply(proxy, arguments);
        };
    }

    for(var v in funkList) {
      replaceFunk(origObj, proxyObj, funkList[v]);
  }
}

function unique(a) {
    if (!a) return a;
    var i=a.length, r=[], s={};
    while (i--) {
        var k = a[i];
        if (!s[k]) {
            s[k] = true;
            r.push(k);
        }
    }
    return r;
}

function aug(json1, json2){
    json1 = json1 || {};
    for (var key in json2) json1[key] = json2[key];
    return json1;
}

function addClass(el, newName){
    var curName = el.className;
    newName = curName !== '' ? ' '+newName : newName;
    el.className+= newName
}

function trim(str){
    if (str.trim){
        return str.trim();
    }
    else{
        return str.replace(/^\s+|\s+$/g, '');
    }
}

function addListener(){
    if (typeof arguments[0] === 'string'){
        arguments[2] = arguments[1];
        arguments[1] = arguments[0];
        arguments[0] = document;
    }
    var el = arguments[0],
        type = arguments[1],
        cb = arguments[2];

    if (typeof el.addEventListener !== 'undefined'){
      el.addEventListener(type, cb, false);
    }
    else if (el.attachEvent){
      el.attachEvent('on'+type, cb, false);
    }
}

function removeListener(){
    if (typeof arguments[0] === 'string'){
        arguments[2] = arguments[1];
        arguments[1] = arguments[0];
        arguments[0] = document;
    }
    var el = arguments[0],
        type = arguments[1],
        cb = arguments[2];

    if (typeof el.removeEventListener !== 'undefined'){
      el.removeEventListener(type, cb, false);
    }
    else if (el.detachEvent){
      el.detachEvent('on'+type, cb);
    }
}
//Utils
Evme.Utils = new function Evme_Utils() {
    var self = this,
        userAgent = "", connection = null, cssPrefix = "", iconsFormat = null,
        newUser = false, isTouch = false,
        parsedQuery = parseQuery(),
        elContainer = null,
  headEl = document.querySelector('html>head'),
  filterSelectorTemplate = '.evme-apps ul:not({0}) li[{1}="{2}"]',

  CONTAINER_ID = "evmeContainer", // main E.me container
  SCOPE_CLASS = "evmeScope",      // elements with E.me content

        COOKIE_NAME_CREDENTIALS = "credentials",

  CLASS_WHEN_KEYBOARD_IS_VISIBLE = 'evme-keyboard-visible',

  // all the installed apps (installed, clouds, marketplace) should be the same size
  // however when creating icons in the same size there's still a noticable difference
  // this is because the OS' native icons have a transparent padding around them
  // so to make our icons look the same we add this padding artificially
  INSTALLED_CLOUDS_APPS_ICONS_PADDING = 2,

        OSMessages = this.OSMessages = {
          "APP_INSTALL": "add-bookmark",
          "OPEN_URL": "open-url",
          "SHOW_MENU": "show-menu",
          "HIDE_MENU": "hide-menu",
          "MENU_HEIGHT": "menu-height",
          "EVME_OPEN": "evme-open",
          "GET_ICON_SIZE": "get-icon-size"
        },

        host = document.location.host,
        domain = host.replace(/(^[\w\d]+\.)?([\w\d]+\.[a-z]+)/, '$2'),
        protocol = document.location.protocol,
        homescreenOrigin = protocol + '//homescreen.' + domain;

    this.PIXEL_RATIO_NAMES = {
      NORMAL: 'normal',
      HIGH: 'high'
    };

    this.ICONS_FORMATS = {
      "Small": 10,
      "Large": 20
    };

    this.REGEXP = {
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
    };

    this.devicePixelRatio =  window.innerWidth / 320;

    this.isKeyboardVisible = false;

    this.EMPTY_IMAGE = "../../images/empty.gif";

    this.EMPTY_APPS_SIGNATURE = '';

    this.APPS_FONT_SIZE = 12 * self.devicePixelRatio;

    this.PIXEL_RATIO_NAME = (this.devicePixelRatio > 1) ? this.PIXEL_RATIO_NAMES.HIGH : this.PIXEL_RATIO_NAMES.NORMAL;

    this.NOOP = function(){};

    this.currentResultsManager = null;

    this.init = function init() {
        userAgent = navigator.userAgent;
        cssPrefix = getCSSPrefix();
        connection = Connection.get();
        isTouch = window.hasOwnProperty("ontouchstart");

        elContainer = document.getElementById(CONTAINER_ID);
    };

    this.logger = function logger(level) {
  return function Evme_logger() {
      var t = new Date(),
    h = t.getHours(),
    m = t.getMinutes(),
    s = t.getSeconds(),
    ms = t.getMilliseconds();

      h < 10 && (h = '0' + h);
      m < 10 && (m = '0' + m);
      s < 10 && (s = '0' + s);
      ms < 10 && (ms = '00' + ms) ||
    ms < 100 && (ms = '0' + ms);

      console[level]("[%s EVME]: %s", [h, m, s, ms].join(':'), Array.prototype.slice.call(arguments));
  }
    };

    this.log = this.logger("log");
    this.warn = this.logger("warn");
    this.error = this.logger("error");

    this.l10n = function l10n(module, key, args) {
        return navigator.mozL10n.get(Evme.Utils.l10nKey(module, key), args);
    };
    this.l10nAttr = function l10nAttr(module, key, args) {
        var attr = 'data-l10n-id="' + Evme.Utils.l10nKey(module, key) + '"';

        if (args) {
            try {
                attr += ' data-l10n-args="' + JSON.stringify(args).replace(/"/g, '&quot;') + '"';
            } catch(ex) {

            }
        }

        return attr;
    };
    this.l10nKey = function l10nKey(module, key) {
        return ('evme-' + module + '-' + key).toLowerCase();
    };
    this.l10nParseConfig = function l10nParseConfig(text) {
        if (typeof text === "string") {
            return text;
        }

        var firstLanguage = Object.keys(text)[0],
            currentLang = navigator.mozL10n.language.code || firstLanguage,
            translation = text[currentLang] || text[firstLanguage] || '';

        return translation;
    };

    this.shortcutIdToKey = function l10nShortcutKey(experienceId) {
        var map = Evme.__config.shortcutIdsToL10nKeys || {};
        return map[experienceId.toString()] || experienceId;
    };

    this.uuid = function generateUUID() {
        return Evme.uuid();
    };

    this.sendToOS = function sendToOS(type, data) {
        switch (type) {
            case OSMessages.APP_INSTALL:
    return EvmeManager.addGridItem(data);
            case OSMessages.OPEN_URL:
                return EvmeManager.openUrl(data.url);
            case OSMessages.SHOW_MENU:
                return EvmeManager.menuShow();
            case OSMessages.HIDE_MENU:
                return EvmeManager.menuHide();
            case OSMessages.MENU_HEIGHT:
                return EvmeManager.getMenuHeight();
            case OSMessages.GET_ICON_SIZE:
                return EvmeManager.getIconSize();
            case OSMessages.EVME_OPEN:
                EvmeManager.isEvmeVisible(data.isVisible);
                break;
        }
    };

    this.getID = function getID() {
        return CONTAINER_ID;
    };

    this.getContainer = function getContainer() {
        return elContainer;
    };

    this.getScopeElements = function getScopeElements() {
  return document.querySelectorAll("." + SCOPE_CLASS);
    };

    this.cloneObject = function cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    };

    this.valuesOf = function values(obj) {
  return Object.keys(obj).map(function getValue(key) {
    return obj[key];
  });
    };

    // remove installed apps from clouds apps
    this.dedupInstalledApps = function dedupInstalledApps(apps, installedApps) {
      var dedupCloudAppsBy = [];

      // first construct the data to filter by (an array of objects)
      // currently only the URL is relevant
      for (var i=0, appData; appData=installedApps[i++];) {
        dedupCloudAppsBy.push({
          'favUrl': appData.favUrl,
          'appUrl': appData.favUrl
        });
      }

      return self.dedup(apps, dedupCloudAppsBy);
    };

    // remove from arrayOrigin according to rulesToRemove
    // both arguments are arrays of objects
    this.dedup = function dedup(arrayOrigin, rulesToRemove) {
      for (var i=0,item; item=arrayOrigin[i++];) {
        for (var j=0,rule; rule=rulesToRemove[j++];) {
          for (var property in rule) {
            // if one of the conditions was met,
            // remove the item and continue to next item
            if (item[property] === rule[property]) {
              arrayOrigin.splice(i-1, 1);
              j = rulesToRemove.length;
              break;
            }
          }
        }
      }

      return arrayOrigin;
    };

    this.getRoundIcon = function getRoundIcon(options, callback) {
        var size = self.sendToOS(self.OSMessages.GET_ICON_SIZE) - 2,
      padding = options.padding ? INSTALLED_CLOUDS_APPS_ICONS_PADDING : 0,
      actualIconSize = size - padding*2,
            img = new Image();

        img.onload = function() {
            var canvas = document.createElement("canvas"),
                ctx = canvas.getContext("2d");

            canvas.width = size;
            canvas.height = size;

            ctx.beginPath();
      ctx.arc(size/2, size/2, actualIconSize/2, 2 * Math.PI, false);
            ctx.clip();

      ctx.drawImage(img, padding, padding, actualIconSize, actualIconSize);

            callback(canvas.toDataURL());
        };
  img.src = self.formatImageData(options.src);
    };

    /**
     * Round all icons in an icon map object
     * @param  {Object}   {1: src1, 2: src2 ...}
     * @param  {Function} Function to call when done
     *
     * @return {Object}   {1: round1, 2: round2 ...}
     */
    this.roundIconsMap = function roundIconsMap(iconsMap, callback) {
      var total = Object.keys(iconsMap).length,
    roundedIconsMap = {},
    processed = 0;

      for (var id in iconsMap) {
  var src = Evme.Utils.formatImageData(iconsMap[id]);

  (function roundIcon(id, src){
    Evme.Utils.getRoundIcon({
      "src": src
    }, function onRoundIcon(roundIcon) {
      roundedIconsMap[id] = roundIcon;

      if (++processed === total) {
        callback(roundedIconsMap);
      }
    });
  })(id, src);
      };
    };

    this.writeTextToCanvas = function writeTextToCanvas(options) {
      var context = options.context,
          text = options.text ? options.text.split(' ') : [],
          offset = options.offset || 0,
          lineWidth = 0,
          currentLine = 0,
          textToDraw = [],

          WIDTH = context.canvas.width,
    FONT_SIZE = options.fontSize || self.APPS_FONT_SIZE,
          LINE_HEIGHT = FONT_SIZE + 1 * self.devicePixelRatio;

      if (!context || !text) {
        return false;
      }

      context.save();

      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillStyle = 'rgba(255,255,255,1)';
      context.shadowOffsetX = 1;
      context.shadowOffsetY = 1;
      context.shadowBlur = 3;
      context.shadowColor = 'rgba(0, 0, 0, 0.6)';
      context.font = '600 ' + FONT_SIZE + 'px sans-serif';

      for (var i=0,word; word=text[i++];) {
        // add 1 to the word with because of the space between words
        var size = context.measureText(word).width + 1,
            draw = false,
            pushed = false;

        if (lineWidth + size >= WIDTH) {
          draw = true;
          if (textToDraw.length === 0) {
            textToDraw.push(word);
            pushed = true;
          }
        }

        if (draw) {
          drawText(textToDraw, WIDTH/2, offset + currentLine*LINE_HEIGHT);
          currentLine++;
          textToDraw = [];
          lineWidth = 0;
        }

        if (!pushed) {
          textToDraw.push(word);
          lineWidth += size;
        }
      }

      if (textToDraw.length > 0) {
        drawText(textToDraw, WIDTH/2, offset + currentLine*LINE_HEIGHT);
      }

      function drawText(text, x, y) {
  var isSingleWord, size;

  isSingleWord = text.length === 1;
  text = text.join(' ');
  size = context.measureText(text).width;

        if (isSingleWord && size >= WIDTH) {
          while (size >= WIDTH) {
            text = text.substring(0, text.length-1);
            size = context.measureText(text + '…').width;
          }

          text += '…';
        }

        context.fillText(text, x, y);
      }

      context.restore();

      return true;
    };

    this.isNewUser = function isNewUser() {
        if (newUser === undefined) {
            Evme.Storage.get("counter-ALLTIME", function storageGot(value) {
                newUser = !value;
            });
        }
        return newUser;
    };

    this.formatImageData = function formatImageData(image) {
      if (!image || typeof image !== "object") {
  return image;
      }
      if (image.MIMEType === "image/url") {
  return image.data;
      }
      if (!image.MIMEType || image.data.length < 10) {
  return null;
      }
      if (self.isBlob(image)) {
  return self.EMPTY_IMAGE;
      }

      return "data:" + image.MIMEType + ";base64," + image.data;
    };

    this.getDefaultAppIcon = function getDefaultAppIcon() {
  return Evme.Config.design.apps.defaultAppIcon[this.PIXEL_RATIO_NAME];
    };

    this.getEmptyCollectionIcon = function getEmptyCollectionIcon(){
  return Evme.__config.emptyCollectionIcon;
    };

    this.getIconGroup = function getIconGroup(numIcons) {
  // valid values are 1,2,3
  numIcons = Math.max(numIcons, 1);
  numIcons = Math.min(numIcons, 3);
  return self.cloneObject(Evme.__config.iconsGroupSettings[numIcons]);
    };

    this.getIconsFormat = function getIconsFormat() {
        return iconsFormat || _getIconsFormat();
    };

    this.isBlob = function isBlob(arg) {
        return arg instanceof Blob;
    };

    this.blobToDataURI = function blobToDataURI(blob, cbSuccess, cbError) {
        if (!self.isBlob(blob)) {
            cbError && cbError();
            return;
        }

        var reader = new FileReader();
        reader.onload = function() {
            cbSuccess(reader.result);
        };
        reader.onerror = function() {
            cbError && cbError();
        };

        reader.readAsDataURL(blob);
    };

    /**
     * Append or overrite a url string with query parameter key=value.
     * insertParam('app://homescreen.gaiamobile.org:8080', 'appId', 123) =>
     *   app://homescreen.gaiamobile.org:8080?appId=123
     *
     * adopted from http://stackoverflow.com/a/487049/1559840
     */
    this.insertParam = function insertParam(url, key, value) {
      key = encodeURI(key);
      value = encodeURI(value);

      var parts = url.split("?");
      var domain = parts[0];
      var search = parts[1] || '';
      var kvp = search.split('&');

      var i = kvp.length;
      var x;
      while (i--) {
  x = kvp[i].split('=');

  if (x[0] == key) {
    x[1] = value;
    kvp[i] = x.join('=');
    break;
  }
      }

      if (i < 0) {
  kvp[kvp.length] = [key, value].join('=');
      }

      return domain + "?" + kvp.filter(function isEmpty(pair) {
  return pair !== '';
      }).join('&');
    };

    /**
     * Get a query parameter value from a url
     * extractParam('app://homescreen.gaiamobile.org:8080?appId=123', appId) => 123
     */
    this.extractParam = function extractParam(url, key) {
      var search = url.split('?')[1];
      if (search) {
  var kvp = search.split('&');
  for (var i = 0; i < kvp.length; i++) {
    var pair = kvp[i];
    if (key === pair.split('=')[0]) {
      return pair.split('=')[1];
    }
  }
      }
      return undefined;
    };

    this.setKeyboardVisibility = function setKeyboardVisibility(value){
      if (self.isKeyboardVisible === value) return;

        self.isKeyboardVisible = value;

        if (self.isKeyboardVisible) {
      document.body.classList.add(CLASS_WHEN_KEYBOARD_IS_VISIBLE);
        } else {
      document.body.classList.remove(CLASS_WHEN_KEYBOARD_IS_VISIBLE);
        }
    };

    this.systemXHR = function systemXHR(options) {
      var url = options.url,
    responseType = options.responseType || "",
    onSuccess = options.onSuccess || self.NOOP,
    onError = options.onError || self.NOOP;

      var xhr = new XMLHttpRequest({
  mozAnon: true,
  mozSystem: true
      });

      xhr.open('GET', url, true);
      xhr.responseType = responseType;

      try {
  xhr.send(null);
      } catch (e) {
  onError(e);
  return;
      }

      xhr.onerror = onError;

      xhr.onload = function onload() {
  var status = xhr.status;
  if (status !== 0 && status !== 200) {
      onError();
  } else {
      onSuccess(xhr.response);
  }
      };
    };

    this.connection = function _connection(){
        return connection;
    };

    this.isOnline = function isOnline(callback) {
       Connection.online(callback);
    };

    this.getUrlParam = function getUrlParam(key) {
        return parsedQuery[key]
    };

    this.cssPrefix = function _cssPrefix() {
        return cssPrefix;
    };

    this.convertIconsToAPIFormat = function convertIconsToAPIFormat(icons) {
        var aIcons = [];
        if (icons instanceof Array) {
            for (var i=0; i<icons.length; i++) {
                aIcons.push(f(icons[i]));
            }
        } else {
            for (var i in icons) {
                aIcons.push(f(icons[i]));
            }
        }
        aIcons = aIcons.join(",");
        return aIcons;

        function f(icon) {
            return (icon && icon.id && icon.revision && icon.format)? icon.id + ":" + icon.revision + ":" + icon.format : "";
        }
    }

    this.hasFixedPositioning = function hasFixedPositioning(){
        return false;
    };

    this.isVersionOrHigher = function isVersionOrHigher(v1, v2) {
        if (!v2){ v2 = v1; v1 = Evme.Utils.getOS().version; };
        if (!v1){ return undefined; }

        var v1parts = v1.split('.');
        var v2parts = v2.split('.');

        for (var i = 0; i < v1parts.length; ++i) {
            if (v2parts.length == i) {
                return true;
            }

            if (v1parts[i] == v2parts[i]) {
                continue;
            } else if (parseInt(v1parts[i], 10) > parseInt(v2parts[i], 10)) {
                return true;
            } else {
                return false;
            }
        }

        if (v1parts.length != v2parts.length) {
            return false;
        }

        return true;
    };

    this.User = new function User() {
        this.creds = function creds() {
            var credsFromCookie = Evme.Utils.Cookies.get(COOKIE_NAME_CREDENTIALS);
            return credsFromCookie;
        };
    };

    this.Cookies = new function Cookies() {
        this.set = function set(name, value, expMinutes, _domain) {
            var expiration = "",
                path = norm("path","/"),
                domain = norm("domain", _domain);

            if (expMinutes) {
                expiration = new Date();
                expiration.setMinutes(expiration.getMinutes() + expMinutes);
                expiration = expiration.toGMTString();
            }
            expiration = norm("expires", expiration);

            var s = name + "=" + escape(value) + expiration + path + domain;

            try {
                document.cookie = s;
            } catch(ex) {}

            return s;
        };

        this.get = function get(name) {
            var results = null;

            try {
                results = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
            } catch(ex) {}

            return (results)? unescape(results[2]) : null;
        };

        this.remove = function remove(name) {
            Evme.Utils.Cookies.set(name, "", "Thu, 24-Jun-1999 12:34:56 GMT");
        };

        function norm(k, v) {
            return k && v ? "; "+k+"="+v : "";
        }
    };

    // check that cookies are enabled by setting and getting a temp cookie
    this.bCookiesEnabled = function bCookiesEnabled(){
        var key = "cookiesEnabled",
            value = "true";

        // set
        self.Cookies.set(key, value, 10);

        // get and check
        if (self.Cookies.get(key) === value){
            self.Cookies.remove(key);
            return true;
        }
    };

    // check that localStorage is enabled by setting and getting a temp value
    this.bLocalStorageEnabled = function bLocalStorageEnabled(){
        return Evme.Storage.enabled();
    };

    /**
     * Escape special characters in `s` so it can be used for creating a RegExp
     * source: http://stackoverflow.com/a/3561711/1559840
     */
    this.escapeRegexp = function escapeRegexp(s) {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };

    // retrieves the value of a specified property from all elements in the `collection`.
    this.pluck = function pluck(collection, property) {
  if (Array.isArray(collection)) {
      return collection.map(function(item) {
    return item[property];
      });
  } else {
      return [];
  }
    };

    // Creates a duplicate-value-free version of the `array`
    this.unique = function unique(array, property) {
      // array of objects, unique by `property` of the objects
      if (property){
  var values = Evme.Utils.pluck(array, property);
  return array.filter(function(item, pos) { return uniqueFilter(item[property], pos, values) } );
      }

      // array of literals
      else {
  return array.filter(uniqueFilter);
      }
    };

    function uniqueFilter(elem, pos, self) {
  // if first appearance of `elem` is `pos` then it is unique
  return self.indexOf(elem) === pos;
    }

    function _getIconsFormat() {
        return self.ICONS_FORMATS.Large;
    }

    function getCSSPrefix() {
        return (/webkit/i).test(navigator.appVersion) ? '-webkit-' :
                (/firefox/i).test(navigator.userAgent) ? '-moz-' :
                (/msie/i).test(navigator.userAgent) ? '-ms-' :
                'opera' in window ? '-o-' : '';
    }

    this.getCurrentSearchQuery = function getCurrentSearchQuery(){
        return Evme.Brain.Searcher.getDisplayedQuery();
    };

    this.getAppsSignature = function getAppsSignature(apps) {
  // prepend with number of apps for quick comparison (fail early)
  var key = '' + apps.length;
  for (var i=0, app; app=apps[i++];) {
      key += app.id + ':' + app.appUrl + ',';
  }
  return key || this.EMPTY_APPS_SIGNATURE;
    };

    var Connection = new function Connection(){
        var self = this,
            currentIndex,
            consts = {
                SPEED_UNKNOWN: 100,
                SPEED_HIGH: 30,
                SPEED_MED: 20,
                SPEED_LOW: 10
            },
            types = [
                {
                    "name": undefined,
                    "speed": consts.SPEED_UNKNOWN
                },
                {
                    "name": "etherenet",
                    "speed": consts.SPEED_HIGH
                },
                {
                    "name": "wifi",
                    "speed": consts.SPEED_HIGH
                },
                {
                    "name": "2g",
                    "speed": consts.SPEED_LOW
                },
                {
                    "name": "3g",
                    "speed": consts.SPEED_MED
                }
            ];

        this.init = function init() {
            window.addEventListener("online", self.setOnline);
            window.addEventListener("offline", self.setOffline);

            self.set();
        };

        this.setOnline = function setOnline() {
            Evme.EventHandler.trigger("Connection", "online");
        };
        this.setOffline = function setOffline() {
            Evme.EventHandler.trigger("Connection", "offline");
        };

        this.online = function online(callback) {
            callback(window.location.href.match(/_offline=true/)? false : navigator.onLine);
        };

        this.get = function get(){
            return getCurrent();
        };

        this.set = function set(index){
             currentIndex = index || (navigator.connection && navigator.connection.type) || 0;
             return getCurrent();
        };

        function getCurrent(){
            return aug({}, consts, types[currentIndex]);
        }

        function aug(){
            var main = arguments[0];
            for (var i=1, len=arguments.length; i<len; i++){
                for (var k in arguments[i]){ main[k] = arguments[i][k] }
            };
            return main;
        }

        // init
        self.init();
    };
    this.Connection = Connection;

    this.init();
};

/*
 * Acts as event manager. Provides bind and trigger functions.
 */
Evme.EventHandler = new function Evme_EventHandler(){
    var arr = {},
      MAIN_EVENT = "DoATEvent";
    
    function bind(eventNamesArr, cb){
        !(eventNamesArr instanceof Array) && (eventNamesArr = [eventNamesArr]);
        for (var idx in eventNamesArr){
            var eventName=eventNamesArr[idx];
            !(eventName in arr) && (arr[eventName] = []);
            arr[eventName].push(cb);
        }
    }

    function unbind(eventName, cb){
        if (!cb){
            arr[eventName] = {};
        } else {
            for (var a=arr[eventName], i=a?a.length-1:-1; i>=0; --i) {
                if (a[i]===cb) {
                    a.splice(i, 1);
                    return;
                }
            }
        }        
    }

    function trigger(eventName, data){
        if (eventName && eventName in arr){
            for (var i=0, a=arr[eventName], len=a.length; i<len; i++) {
                data = Array.prototype.slice.apply(data);
                a[i].apply(this, data);
            }
        }
    }
    
    this.bind = function _bind(cb){
        bind(MAIN_EVENT, cb)
    };
    
    this.unbind = function _unbind(cb){
        unbind(MAIN_EVENT, cb)
    };
    
    this.trigger = function _trigger(){
        trigger(MAIN_EVENT, arguments);
    };
};

/*
 * Proxy to underlying storage provider, to allow easy replacing
 * of the provider and leaving our API the same
 */
Evme.Storage = new function Evme_Storage() {
    var self = this,
        KEY_PREFIX = 'evme-';
        
    this.set = function set(key, val, ttl, callback) {
      val = {
        "value": val
      };
      
      if (ttl) {
        if (ttl instanceof Function) {
          callback = ttl;
        } else {
          val.expires = Date.now() + ttl*1000;
        }
      }
      
      asyncStorage.setItem(KEY_PREFIX + key, val, callback);
    };
    
    this.get = function get(key, callback) {
      asyncStorage.getItem(KEY_PREFIX + key, function onItemGot(value) {
        if (value && value.expires && value.expires < Date.now()) {
          self.remove(key);
          value = null;
        }
        
        // value.value since the value is an object {"value": , "expires": }
        value = value && value.value;
        
        callback && callback(value);
      });
    };
    
    this.remove = function remove(key, callback) {
      asyncStorage.removeItem(KEY_PREFIX + key, callback);
    };
    
    // legacy compatibility from localStorage
    this.enabled = function enabled() {
      return true;
    };
};

/*
 * Idle class
 * Triggers a callback after a specified amout of time gone idle
 */
Evme.Idle = function Evme_Idle(){
    var self = this,
        timer, delay, callback;
    
    this.isIdle = true;
    
    // init
    this.init = function init(options){
        // set params
        delay = options.delay;
        callback = options.callback;
        
        // start timer
        self.reset();
    };
    
    // reset timer
    this.reset = function reset(_delay){
        // set timeout delay value
        if (_delay === undefined){
            _delay = delay;
        }
        
        self.isIdle = false;
        
        // stop previous timer
        clearTimeout(timer);
        
        // start a new timer
        timer = setTimeout(onIdle, _delay);
    };
    
    this.advanceBy = function advanceBy(ms){
        self.reset(delay-ms);
    };
    
    this.flush = function flush(){
        self.reset(0);
    };
    
    function onIdle(){
        self.isIdle = true;
        
        // call callback
        callback();
    }
};

Evme.$ = function Evme_$(sSelector, elScope, iterationFunction) {
    var isById = sSelector.charAt(0) === '#',
        els = null;

    if (isById) {
        els = [document.getElementById(sSelector.replace('#', ''))];
    } else {
        els = (elScope || Evme.Utils.getContainer()).querySelectorAll(sSelector);
    }

    if (iterationFunction !== undefined) {
        for (var i=0, el=els[i]; el; el=els[++i]) {
            iterationFunction.call(el, el);
        }
    }

    return isById? els[0] : els;
};

Evme.$remove = function Evme_$remove(sSelector, scope) {
    if (typeof sSelector === "object") {
        if (sSelector && sSelector.parentNode) {
            sSelector.parentNode.removeChild(sSelector);
        }
    } else {
        Evme.$(sSelector, scope, function itemIteration(el) {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
    }
};


Evme.$create = function Evme_$create(tagName, attributes, html) {
    var el = document.createElement(tagName);

    if (attributes) {
        for (var key in attributes) {
            el.setAttribute(key, attributes[key]);
        }
    }

    if (html) {
        el.innerHTML = html;
    }

    return el;
};

Evme.$isVisible = function Evme_$isVisible(el){
    return !!el.offsetWidth && getComputedStyle(el).visibility === "visible";
};

Evme.htmlRegex = /</g;
Evme.html = function Evme_html(html) {
  return (html || '').replace(Evme.htmlRegex, '&lt;');
};


//     node-uuid/uuid.js
//
//     Copyright (c) 2010 Robert Kieffer
//     Dual licensed under the MIT and GPL licenses.
//     Documentation and details at https://github.com/broofa/node-uuid
(function(_global) {
  // Unique ID creation requires a high quality random # generator, but
  // Math.random() does not guarantee "cryptographic quality".  So we feature
  // detect for more robust APIs, normalizing each method to return 128-bits
  // (16 bytes) of random data.
  var mathRNG, nodeRNG, whatwgRNG;

  // Math.random()-based RNG.  All platforms, very fast, unknown quality
  var _rndBytes = new Array(16);
  mathRNG = function() {
    var r, b = _rndBytes, i = 0;

    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      b[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return b;
  }

  // Node.js crypto-based RNG - http://nodejs.org/docs/v0.6.2/api/crypto.html
  // Node.js only, moderately fast, high quality
  try {
    var _rb = require('crypto').randomBytes;
    nodeRNG = _rb && function() {
      return _rb(16);
    };
  } catch (e) {}

  // Select RNG with best quality
  var _rng = nodeRNG || whatwgRNG || mathRNG;

  // Buffer class to use
  var BufferClass = typeof(Buffer) == 'function' ? Buffer : Array;

  // Maps for number <-> hex string conversion
  var _byteToHex = [];
  var _hexToByte = {};
  for (var i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
  }

  // **`parse()` - Parse a UUID into it's component bytes**
  function parse(s, buf, offset) {
    var i = (buf && offset) || 0, ii = 0;

    buf = buf || [];
    s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
      if (ii < 16) { // Don't overflow!
        buf[i + ii++] = _hexToByte[oct];
      }
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
      buf[i + ii++] = 0;
    }

    return buf;
  }

  // **`unparse()` - Convert UUID byte array (ala parse()) into a string**
  function unparse(buf, offset) {
    var i = offset || 0, bth = _byteToHex;
    return  bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]];
  }

  // **`v1()` - Generate time-based UUID**
  //
  // Inspired by https://github.com/LiosK/UUID.js
  // and http://docs.python.org/library/uuid.html

  // random #'s we need to init node and clockseq
  var _seedBytes = _rng();

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  var _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  var _lastMSecs = 0, _lastNSecs = 0;

  // See https://github.com/broofa/node-uuid for API details
  function v1(options, buf, offset) {
    var i = buf && offset || 0;
    var b = buf || [];

    options = options || {};

    var clockseq = options.clockseq != null ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    var msecs = options.msecs != null ? options.msecs : new Date().getTime();

    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    var nsecs = options.nsecs != null ? options.nsecs : _lastNSecs + 1;

    // Time since last uuid creation (in msecs)
    var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

    // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq == null) {
      clockseq = clockseq + 1 & 0x3fff;
    }

    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs == null) {
      nsecs = 0;
    }

    // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
      throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;

    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;

    // `time_low`
    var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;

    // `time_mid`
    var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;

    // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;

    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // `clock_seq_low`
    b[i++] = clockseq & 0xff;

    // `node`
    var node = options.node || _nodeId;
    for (var n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : unparse(b);
  }

  // **`v4()` - Generate random UUID**

  // See https://github.com/broofa/node-uuid for API details
  function v4(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    var i = buf && offset || 0;

    if (typeof(options) == 'string') {
      buf = options == 'binary' ? new BufferClass(16) : null;
      options = null;
    }
    options = options || {};

    var rnds = options.random || (options.rng || _rng)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || unparse(rnds);
  }

  // Export public API
  var uuid = v4;
  uuid.v1 = v1;
  uuid.v4 = v4;
  uuid.parse = parse;
  uuid.unparse = unparse;
  uuid.BufferClass = BufferClass;

  // Export RNG options
  uuid.mathRNG = mathRNG;
  uuid.nodeRNG = nodeRNG;
  uuid.whatwgRNG = whatwgRNG;

  if (typeof(module) != 'undefined') {
    // Play nice with node.js
    module.exports = uuid;
  } else {
    // Play nice with browsers
    var _previousRoot = _global.uuid;

    // **`noConflict()` - (browser only) to reset global 'uuid' var**
    uuid.noConflict = function() {
      _global.uuid = _previousRoot;
      return uuid;
    }
    _global.uuid = uuid;
  }
}(Evme));

Evme.DEFAULT_ICONS = {
  CONTACT: {
    "MIMEType": "image/png",
    "data": "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAALk0lEQVR42uWaCXCURRbHG0KMLKAElo24YLiS5ZjsJEwgIRBCIIBckUvkkGASE8N9KRASiNFwiiK3HKsLuogI6iqiW5bH1ooXighWibiEI4QwEyaZzH3/93UnNVNTM5PMkYxULVU/Al+/7n6/73X3fPVlGID/K8Rffz76qUcwmzkwmUx+gXfZvcRIoghvsZN4g13C31kNocOrDBz6t15cozYRQ7ENfdr6PV9cSVM0vzDeYfcTeTjKvsMhZsFOBmwlNvsIxYo+1FeMQWPxMe86YZxk/XCMvY2DzIztDoHgobHEmDQ2n+N3F8YJ1gdvsg+xn9mxhQGbWggam89Bc53mc4ZYWIjeS3tuCw4wK7bypEIEzUVzWmjuMp5DSIRxnElwmF3Fiw3LblOIoTnF3JQDz6VFhenOzqQ7bBKTbvyd2SyqbeY5tYgwjrJC7G64yxvvDkQuu4ijrKh5hV9nm/BywyQb7jI21p/mlONm1vgfH4WPsCIxYBnx/F1KWYM05eqT8IOHP/EEl52JlxsGfS44rEvaoGb9bFQd2onKk8dQefx13H51GzQvTA1szFIX6JpDelaTwlEH/+UGDrP+2MPMKAtSdjVD9ZocVHzzNa5fv+6Rim+/gm7HdD8lvUjvZmbKXdKo8AP7P3YBr7EI7GdXxB4pDRz7CoaqXdtQceMGKioqGodiVEef8zxWie8I6VdYOXfwKtxl52kXcJA9j83ByaKQQV5WhJs3b/qF7sii+v7PEusCZCNxiJV5Ff7jS6cckGxP2rcWx6QBosmOQ1V5Oaqqqvziys8XYXu+C7CWBU4x8RKzkEsvzxXe/L4D2gOnsSEoWTGhYt8uyOVyXxGyFy5cwJkzZ3Dj8LqghAUlYj9/5LnCG94T0NqX4sWGpNcHjmUBCf/wPaqrq32isrIS58+fx9mzZwUXPznFD7vgWENsIcjJTThy/TsC7GQnxKZfFxzGeX+AkqqmVCqbhGRFZX/66ScHF86dA1ax4CkidrATbsKdik4y7GIdsI2ZRZWKg0Of1wsqlaopxDK+dOkSfvnlFzdQ+CdgJQuOZ1oBm5mV3Dq5CHdc/TajO5EtHjCKgseUFwE1VU+tVntDLOXy8nKPXL38K7AiDFjeKniKw0BuBS7C9688zrCVfSs2+tqgEXdX/d230Ol0HqHqNvrRJP/6E2Bp6+ZhJQlvYmddhPECa8dLLypU2Dxo9m6AwWBwg4RFdRUKhVcMbxQDC1s3D0tIuJTcyNEpvIWNrH8MbD5sSyOgr6iAyWRyYDQaRXVramq8oiq/DCyOBOaHNx9rCXJ0Cm9ka1HarMICY9kUmPU6WCwWgV6vh1ar9Yqmtgb2LZnAUxHNy9MdQI6FDmGSPSVO51XNj3l7Fix1dUKYquwVY40S9h1PAHltm5/FJFzCPnIKP8t+RVHLCAtK+8P0xSlYDXrYbDYX+DXrl/8EVg8Gctq1DAVEIbviFF7HasWTydMtxAIG+xPtYS+Ihm17AWyHN8B+pAzYmS+uUVuLgjwSfoapnMIlzCT23crmw5wbAev6JGAFyc67j4hsEuusLjAuHg17VhfXtiBBTkfg6TATnBVuWHorgseY3Qnq3S/AcOMaTAYDzAdWwz6nc5OYZ0RBtamU96G+16E/uBXWrG68LXjmdabcIuAUXsuo5MTywLHTsq1b/QQM1666HkgkYNxdDBtVzxvm6Q5Zl76G6zTW+iweExT2x7sAy9rCKVzITEJ4WWBY8xnU+7a7JOwmvasY1hld3DBNFbKN931tG48NFKoysbitc0mTbA0BLPEfWx5V9uAelyS9Jr5zHVWzqwPjlG6o2+KQbRTD4R18JQQCCUfBtqCd89Cyr2SXsSoA4UUMqlV5joR9kt5RAvO0aBgf6eGzrMBohKkkB+YpXf2FhB+AbX7bcoewZVGbD7CGC/iHYVZH6P/7G0/IZ4Tg8qlQ5c1wyPqK4cplmKZEwzS5mz/QHn4Q5qfaOx889AX3rRYP/Qv8Q712AU/Ef4qyUbc0N6C+xtICGCd19ws7nfbkuNYhrMvrOExUeL4fFJDwW0cDS7ooJ2Bhw3tHYRgf7RfIfQDc0Smc2zkcy8PMWMJFfMP2JIP2318ElLTuxD+gPv5mYMJnPofu4WhfoQpHw5YbZSHHexzC4WMPMHN++2+wyk/hr77kSYQU/Tf/gXZMD5+xTO8BY1bn711eAISNOcA0c6PmYlUr4CnmE3YS1nzxWciFDV9+BvXonj5jm90d5JblItxm9H5WN6dre9uiCDMW+iaMfBL+8IPQV/jj96EeFeMTunG9YZr7oJW7uQpn7Bfo5nQ5htVcxjfUR/4WcmHdG4egSo/xCcujvaF9rOsxt9e04RmvCFSPduuNReE2sU/zmkbzYmmohWnOMtSmxTSFqLB5TjcbOfVxEw5Lf8WB7rGo98VefpI1iWbZtJALq+bPg3JYbJOYp/eGemq30x5/1dJmxD4HNY/0fMhWwPdy08JGeoIxajWhkqW5tFBmJOLO0NhGUWfEwjgr2spdPAun7XOhdnL0OqwKE1L2XO9Ysxh0534I3f798RwUKRIokvt6pTqlL8wzYlCT2bOUS/okrJzQJ1w/s+tvfGnbc1ijqF/bFzLhukMHIU+WQp40wCuGzL5QZ/a4xh28Cw/f68adcTE9rbmRRizm76O8kE0VXpARMuE7M6eTlBS3B0k8os7oB920Xhaee6NfeQhL3euR6rGxmVjUFpjvXdg2tw30P59v+eV88SJuk2zVICluDZK4oRzRDyb6GKoeHTuZywUkjNmM3RnbZymWknQeCc5zB1w8PxL2hd2BxcRSYnl3aGYMgnLiCNpLaVA9koa6ycSUNDo5iWlp0BJqzlRxndpFHI8X/ZTjR6B63AgoHh4B+ZiRuJ06hGTjcUsmRaVM4kL10H4wTyPZMTHLuFjTwsP2eoSEBTVj+hRjIUnnk1yWK+AIcSKbyCXyGPRTu6J6mBR3hkuhTItDTXocakfWo8pw4LhG7SKO4kU/xVDaq0Ok9VUdHI/KREIWj5sD4wiJA8WwATBOiYFyVIw4pIIVdlA9MnY+8tvVv2Oe64K7dA6DdXZ7yFMSKPF4VKfGk0g8CRHp9dSMkIqfgjTRLuIoXvS7nZxAogm0XBNwU0YMlKEiQYYb8XEOlGkDoJ/SG4r0vgs8CXo/tFL2eMLty6XyNEmmeU6UEctbkaCLsKt0bj2KVAlVKQFyklCkktBwEuOkORGiBLWLOIon2XhUJTXIJsqEcMVAkk1IwHUumyCFZmw/aCbFmimnyTy3FhEW0qmSnuqJ0b9heYf6Jf44Mac1/STmtiZpIrueuvEP4RZViZLnEg55J26SIr7SKcqrSpKEVIarf+WxEhgz+9ISjr3Gc+E5+S88ZI8HPAoLqobGhcuHDyiyzI2yiBfc2VzYXdo8uz0ln4jKwTLcSpKhipMsIzknVZwk0S7iKL5BNpGqmojrCYm4Fj8IN+km6Cb0h2ZiXxuJFvMceC6hEHaKp8R1r82IOYWcSIiKP+kUR1a9uDy1HxcQCVdyBnMaKiloqKjb8pWRKN0Uqr52nBT6SbG2O8P7fkRzPuTIIcTCTvHk+L8o0we8aZnV3YxlnSE+xvKFMB0qnXCNKnWDqJB5RbRfa+AWSaoy4mGcLIFmnMSmSJUepzl6OeYMVjgsebcnfBR2cjNxWmRVckp+3Zh+31nndLdgEf8mTiT0tOdqRknpcBJ7lldNIB8mDizRpn1YSnFxME7tD+1EiVWZLv3x9pDkgttJEzo75rjLhAVfJatbV8uO3FOXlNNBMWTYSPmQwYV0Gr9TO3pAuWZ8f7V2Qn+jbqLEps2Ms2omSYzqcRJt7ZgBV+mj6V1FyqCi6pTkUfohkzpqB6+5l8YJ42PezcKCT1PQqkL2ebgqcWuEIWlpW2vKjHZIHdsBw4fej7RBHZE+0An9X1yndh7H43k/6t+aj9Xcwv8Dl1ddh5x7x/8AAAAASUVORK5CYII="
  },
  MARKETPLACE: {
      "MIMEType": "image/png",
      "data": "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2hpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDowNDgwMTE3NDA3MjA2ODExODIyQUI1QzMyMDQyNjY5NSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo2MDE5RjlGQTIyQjgxMUUyQkUyM0JCNEZBMkI4QTY1RSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo2MDE5RjlGOTIyQjgxMUUyQkUyM0JCNEZBMkI4QTY1RSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChNYWNpbnRvc2gpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RkI3RjExNzQwNzIwNjgxMTgyMkFBQUUyODlFQjEzQUMiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MDQ4MDExNzQwNzIwNjgxMTgyMkFCNUMzMjA0MjY2OTUiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz5kNw/pAAAWz0lEQVR42uRbe5Bf1V3/nnPu/f32kc3mBaEbSHaTJaUJJIBxKLYQKEIrThWswAAFO+UxCgp2+IOpY8fRGYs6tRXGBx2RqtMpAh1DEYujghBEHpJAQiAPFpJssiTZ7GY3m939Pe695/h9nd/vtwlQaBPrjL/Mzb2/+zv3nu/j832esyaEAMYYOCGfL/7AgMV3Gwdg8TvNY+QWXoDHuflD5+ABb+AZv//958OJIId5Pa4MX/0wcmPvAJvciec+5sxaPixee2LcKONNKoRJX8i1V8Z9GMB7fwrfu/L+48mwPa4ibGu7F5n9M7BuBrP4HTwekOB1gmd31EFj8WzjM4YO6MfzX8EtT3zjeJJ4XDS88rtbPjk9Xb9n5zPvXISUI9EJn1izzgqzThnhM6sZWLVFEO2iZg1qNvA1HoVqGj+n/3zv8+Vy8rUt1678j58qpD/+N5tXW2e+FRJz8d63R2Fy24gwy5oiJgnhFsysEiw7cw4kbQmas0G+DfMsphsgqxSw4/VxgKkMLDLridEix4OgnsO8s06Cnt65EIrwUlHAndt+7cyXflyGkx/nwcX3b5qFhP9BDuaOhNkCmByeOho74phQq/3I7NzFHThQmbVHmTAy6FHDAy+PgmfN+xmvOnRgmhnGz3l4vLD8wc0P4PC7B25eNfZRaf/INrzoLzadBcG8YgN8BUkl4IKvIYEjk+JpG5yYBkdZxZN2GMLEnCkCD5UjMHJpDP1uidkgYxHj8o6RI5BnPtqgQVnegpeber+9+fwTasM99752o0nMt501beRrUnK6qLF9e8dgYvMQ6jpRSFvRuzosgwNPXtoFJYS0j2FJTRgFB9VqDgd2osCIKYIye2oviubvOcw/51RY2DMbTTtAjlDPyd6LkCPE7xq6ffV9x92GF3xz493ogP7IJQYSdqqGHW6eFbDr2QG6UIZdix3P9NSNe6R9njI0Y2+IzkscGBRGIFBkcq+UQv/Fy9DnWbF78mvs25jxP86L8NXhr5wTjgvDJ31jw9eDtV+lqEKMoqNiZ1ut1GD/hj3obCpNR4XUz4YcysynZbt1fLY8xON/0Y6iATiEeA6SfBTIbIZMkJUcRosJ9E7iDLUMXbPgtDWnofMriSzoOfZvaAre31/z5raxu96f6fdleP7Zd8/3zt3gE/SqfX1ri7ndV1icuEAcG+Q0R6IqY9MAo5MSZpCh36s8C7fBI9CWFBC9UjUngnB8YSXKtLiMwLZKEQq9OFJPOQmJy1kPJTzKidBUzRz8dbgCfrfzUmGc2Dm5Czq720SgeM+zQFDT44f/FQZ2PukQbcYXfzu28Z7xD+WluyYGbzk8Z8k9Bqn0O3dDsctBhvjNbQq5SzXOEkTx2hu4oPI2fGb8UdgOFG4SYQLoEB1SLBaVeuZKki25J+mlkRBEcEW4B+8E7U5QfWFYB2vzXnh2Vp/E572jMLUHoY7GbEKGTOeQIAJsXlyWen8ZahHmjW5tRxd+z4fy0vUi/yVL3pSSASTaoVu0CB+Ls9PLJe8laROVBdwy8U+aKxNsE1a6Qw/LckkpDAV0cHjgdQkFlZL9W0m8SuwLHP/mcAyZDD1DskyQaUeODd/7G+Pr0Kmp0EIujOP8NvdMl8XvjoIa0+VhKq9e+V68HaPh/v4vzx6pHfpZxyHGkNTY4xZke8Qgwt/naHEJPZrDOdm7sCS8AylplLTH8BTHJlr08E66AjZ0rMJ3JDE0tEQvee+a6TehP3tdMIHvIE2T36KxFqddAoNwPiLphVKP2nTBwkdDgwRpJGYtKShI2JuqV885o++62dt2fm/iAxlGs7siBJ+Q1yTJkY5JagkShnzyExiWOFoEvF5b24k2JzBlZ2ZiUWT5vNt9HH51we0Sf0AHQqvPCOKhOz4Nj438JSz1W/GrjDNcTyANFjj7urDYCS8UC5lZ43NhMohGCY2WiSoYlfgvyX1xNU7wwAdCumrNteQA6GGCCUvNNyFDGk882g1q16AE1uQ72DkTJBmm+J+jgyCJzmd70i8elnPmXGNJLuGmyBvaot/eLC2X2sLIXHRN70vQthOU5Jr6GzzO4bMpwVnsFqEv18S4jRkN0jvt3I0faMMLl92S5nl2SbNME+nZKNEIHWY6h54wCaeHt9gm2WM6y8QSbAjSCX6/oHgR5tWmQLMFPR97PbtWhbXFy5AiRSlympA/sMp44vldfW4QluQTaNc4f5Y1mUXBEQqtKoY1jc9NZ9M/t3LJdaX3hXQ+/+RrzP63U36QoFSIRDwmFFYTH5dTPR8Y3tfYrUicOBWKtdbkDGXOM0Ai1kI7Dv+Z3wM764vRXhMtGpopKI/H772wB8puguFO4YlgbPE/Tw6cIGs8h8Tr/Btwr1/FjJJSSLMNZn3RyNS48qplbry/99dhN9z33gwn6d2pVOOsXSI8Mg3qcDznuw7OMofhKru+4ZGNapSs0zmjJW3g37tgGla5bWyXtrX+D820myvBgoqNABKojMxP5oWMF+RN8IcvmGfhKb8ItocutVmxY+ubaSkjkuksYLrwd+Lr7jsW0neuL7ePj65g1QWpXphpSWnY5ix/R4/qh+Hr7nHodFUJP0byamIuSamQD6ylxIoTI1skJPAYzT7Jzm1LSKff0hKweaRW01cTewT4PXEM8Q6XwbeSdfCpsB99CMFZa2d1WFbNUEInCung3j6467+6j9GwzWqfX9VZsb59NvKL0itJOojFgoQXFPdp9gicl70FZxeb2EFRZcNpo6acVMawjRtJPTnTZJUL7EkLoQFlr/bShDiVks5TruxVu5IrW6SBeDIY9yiNnJOMw5/YR2Bjx7kYppbDkO9A3VjhE+FCPEPXJzDicLprnqpXrsV575/JsPdXfWnPA1DCOyX8Tzxkit+ReIy5CWuRtOL4N2GWxihzCmXt1rCAjBVfELMuowIwLdkuCdQTk1o5BSuCIJopLGF6J7FZTYQJyaW2ONdvhNWV1xiAGSKwwGpLiooC6ujUMhROhjde8NdcNTWD4Vv/DeO1v0iqOqO2l0iFR54XxGFY5NS1aJaZ5ZgbODaTIDgG0xh0YKRVYyUeN8IwfuHSmOYw0iggRAQ2I81AC8nCyHEBwV4LKG+1puQyrWAhOU9xmpChjo4moYwQpR4wfJLTqwVzPtz2NHnreqJZdR+l5DYyqJ7WISZpTiKctRsdlLampD1FCbkyThMm4nWNVkdSGRrWKvH5/JYCth7IedrlCxJYe7ZrJCM0NkCISAdN1LBoUWfjxS+QcCLTOaGMzAMT74Kuqdoi08AJqUtqHZcp7cj92fiGlzWDL86gQkG05cWpcANOG4rcx3HiqHkC27BZdkyxb6dx02mDku/bpiC2D/oGs/TZMZLDlgHfRAGPM3w4pz0EfRc7OEUXx31CCDkyI40RQZyTuciPUCqs8zMUirC66aW9X8IQo0FGG2+sNa8Ei5GS0xFmNeQYgWVk1katspCEcJqYyKvWCnjp7RxisyMeGwZzqNSDzGOoXlVB03NOTNZaPTtBIDOkyqDCQ3xGo9vL9LAAiR5UAYVs9N7LWhlenHNVEjiWNtrDDO1EiniFsnXChEuksLfadbWc/jUbHDJhwqGEtPvcazmXgi6GGz3o3vqNdTCYYplSyuM5hlKyQyal3SKjiUxkmis4GhcbK9r+cyZpZGmGsz8JURhmWxkO88greFfWF4izsdBCvG12aLiCCSJNLtytb/SpnAoEtHiAcgkm6wBDhwOjxqjPjgf923ckwHhNPDZQ0yFN8W7OjJnItFVza1m5oXhveE6r/Xzf6Io60S1LKPBKhl/QquF2SnWqSbcQxFD1ymSEuMCnMaFVBlkAKpxYKSHRDDOyeXQaGzbXYjiWhATfnWrWpWiEDRuxmEA/asuBnwuJncE0Z2lBHKLU2lbnk44NURDpJGRy0xQFUjPdsU82qxmWfNFJYslsO34Za9gXGYOEFIGziSGI4GQFZ0YzKf49EkZ+sYQOBANpHhwMjRYscc6H8bUXre3k6uepp6cbfa19YwXUUOjl1LKmKAQRaKkiY9NSJ0m1Pzkp1iKtalDtbIyakEQRr/Cn5KuedMb1qo4WDWNkRClUbZtGCMkM7FEQiutgAnllTHvHEn89PxMYf5jPtqcwsDPjeMRawXG9PQ5OPT2BU5Y6WLo4EWTouwd25KwCn4jjMngOrLWC7ZXhyz0wcaBcB7PphYbpRTuUXABRazu0NPXQyvAU5cq1tFOIt02nFWt1Sw081l7z5Y4dnNVCQWYzHI/kzZQyvru34Hq2pMfqT7eh9iltC7D6ghJWSM3fhgYxmbCCu0D2Se0hcmaNRrYIn5IgPltpAHJC09INFUqE9mrSrhrOj7RCmtdJpjE+25ZmhCRCnm3HNOwl/iapDcVHHmeDahe1liD0UECU/k1MFJQs8XNUQGx9pQb1ilRkaZuD9tRjGijvnJq2nDURcgIZed3zez2nXRm7OeKPvbsSaLUzwq0dTVuNenXygTXSsOcqaqqFYX+QThWCdGiJk/GFlq2iAedGh8ZKRsXeNVgt64AhTZo5OFRnItMIN8zzDu4N+riVjAlVVbKxFx/gwJ4cenoTKQS4wJB0kkIUFwVavgotXjOywMk1x+jMN7rennlq15XIbH+T4SLsphkqSblFvVrZtAiAF760GBCP6GUZyNumy9UCn+7vHigQskECkOaGsT0ruVKzEcAM4t09OzL42BLLsIXUa/sW2JZFKkWjjmYX4rSvTT/n2gbm0kqGTNoyowMJGmjacOH3UFiqmDbOZRtdRXSJPpY2sQBo9OBUu/ICHJuJA0EGKSS8+lwNjhyiPlfCGqTMvQ2vyyhIWpXgZjuey9R4x3sl59m0p0YCvPZMlevxmOE1EEXmZVyj0c+/BXGGrbsniO74SDWUBP+539mi4WILnWpEVmjZhgAzm4vU2mn9Hh2ceOlUOow41esvZDBx0Mhim5oBhzKNJ8Y1Fxophsu6OLWCaVXRwpEDAFuer8HKT6bslcFkXCtLH7xpq62kGF1wtOqNudzEG1OuLS5C/XdTw/9y8z4MWu9UbCL9u/iyYBsvYli0rBiAOjQ2w+jJ8PqNlzI4MmKZWdJcGzJRdtSAl+ZcmZrxaJe0lEJHCb+nqeP428YaD6z1IwcMbH8xExNqIEm7ul4984xWkRd643dap8LztCGG/RgyvXVmTyvP/j3Ns1vlQVruMNLhD4k8j5N6Lzl1I5qBwpw8JBJZYH1WGbPQ4aSujg0Bk3gpNZ3I2LlGkOFcWvazGF678rS8g/PkeNSHDWT1giKYFI2mpQ/WquHo4NTvRN9ACilnVdLw06hUvHlTC8M+f2heOnFr+yyUeruDBGNIgmopYUJPiwykBa5eEqP7Uhz3jCVmS2ymriQZRoR6TAQanUwjaIgpKMut0PqWlYbXOImh3pT6QjcL83sUmM0oJKWMPoMQJcdEHV5aZaAgYrC0zzPqUyc8ljoepprCXDOByqw/dExPy+XZ+rkwOe2S0CEVDpaCvMYjpRhhlL5ThcR8JZI8m8RqKOJ+amN5pbUNy0lJTGC40WdZG7y2ZiVc5dBcxSTPGwqFaLtm4Eb7xNSRpD4bVv42l5aQ5feIs/Q2l/UwKl9RACeHcXQA+RPHdC2L9Xf5Uzunt3PTuxQgxYMbeSTdMmq1TIk9EtAG/J1qXXKzBu+bdsNjbWqOaoVqCDLa3wnRBiUskcPyHhpt2RgCSesm2iOltW1GO5xIU2q1lHRMhylxe1SaBuVE62EyoRwRGGBhR2U3PH1H7T370rbUcVOowEZnCoZXYur4khLDmF5CXpoYM85pd0IdivNswxxGona9Zi4KV9CaOS5qkDZDFErw0XVwWAw2riuBvpfKTM8LX0ZDMaGM+30UYg3ig3J3ytlLiBz87mmR3BFK099536WW63/43Kv7Ovr2cugjKKc0GULEoW2keE5ju6ZgzdqS4XG0rmlIECUvYQakPAtGmPWqWe+bOx3iqiv3ujhLs+L8gt7TvS0cdqMJEbqohMR56AyukNSW7lGhb70WMMCF/3Dac+gLT7z46AcupuXp/Mtz8rC8Xu+5JqUXWWTcEaRIq9RCoVYiHSXpN4F+l7DmdTuSrgLqVqSgyzfcSpTlXWbcaAbnY/88SCOMowAKV44gmpYGFldQkoMQbQUrx7k60oxH4MwKC4eTbv6RC+JX/vCV1/eWTn/GEWxoDRYZTkKdHQG9zJB2EeokAMKTo/Wk1CvkFdCcTAh8C2R69goHy27AjGsRmkIXjpuNNONhsSSn5d7e6x10r3TcefTUSOdFA1laIYRJI8ELypzgmOYkOkyoyZoWhlALctBq5xCctu1zj7+27kcuiNNnVd/wJft3z5o+JUyWDWe4tHqI8YzStED+NGHvSL2jQPZLjdpEF4iCwpm17GDeSg+9l0mXvf9qXY/Ji5acXTZ3nHZpYG2PbjINs2fBEYNoUpxoZYGveXNMJpUUu+qcFs/qMZGHSV/OczvnPIDBD7cxbdGfj/vxdOnlNUJoXWIdb39AZnmpElM9BpyN4UfaELTyz7sGFZbEbN8vxITBwMhGD7seL2QhCane9c8AB17R7QsY3Hs/62HuWSJiCsJs+5zo6HqRUSdghBba32HZu6lDyAs2meGk/9bPrNs88ZF24l3yj5uffhtW3Ef7KrjYYIiT96sj3DDlK0iieqB0Q1HBl1VgziIP3XicsgY1erkXDTgpWg/tKKByUBe/qDgfKWB8W9yflTHTSz+Xw8Jz69B1qoeuHnGcgFIPvoJjqo2DPXOBdGS0uSVnnknub9X7H7vw4Te+8358feBey0vXvfnbz/7y4k+sKAYvI8ZDqrUnrTAiIyGzsprLBbokDKuvn8TvJW2Z6FpoqLETyqsGqsPUaZhmUVeHS5AuCBqDNEdEinovjTvw6o3dP0ZrX9k1EGRBvS5MEm0IOthV6dl84fcHrvyJ9lqu/cHgZ9/Jel5lhmvQnKQOkg3x1oW6ronELQ0VJVZjkm4RLnV7yGoOBp5MYcdjCdTwutStSbFXTRe6OwgTAio5IWqQ56rzGKp7Q6b1goJssLJg15pH3119XDaXnvf9d8/dUV/0DEO7rkeuQZ8mrgfZegh6g4jOa8I4EPMigPn9Febr4JYERrenLIe5S+vRXnTclD4Xt1xkIlR6P60W5KJNStm9Prq7Mv/NVf8w0ndcd9Oe9+jQxW9We79TV5umyXISeE2Yj/eEqEJgX6+LhnhfVQ2Zq0E6O+M1XzrSzgwWnIEM1vHIpmQcPZvV5Vl+T2CeCV1B5y7iGYdsH1/05FkPja48IduHP/XIri/vqC+7cmIKLShCXAmAFoLYgRQKfXT1UMuBF25RHWdeMUZLfBxPV/zKYYUx/a4HM6mmUxM0eQUOa7QiQp5CsLw13febax4euvyE/wnAli+e0hb81KbFHUeWk39yJc1tS1oWJrGdepRrtDCjpp1x7VuuWyJN65kYJeEOTXXtta78M/0Pjgz/r/4JwCs39v7iHLPnoY+1F12UZ3Oeq7mvSZrMxkVy08p8awtJKybQhe/IPDMbzQXPI9NQGckX33Hu3w0+8FP9M57NX1p0Q4cZvu/k9mxOosyyAHRBybiWDXimxZBCyxFbaUUL47kyWk0nj+QLfn/lg/t+or9wOe5/t7Tr9lP7JipT351fGlvTnUKJ94mnuq/Dzmz6zWjX+OYORNCNeUeqkB2qd29xacdNy+/f9+r/zT/UavmM/lZp9v76nD8shanLOtPpntSFNqzZadGeO7zSW5U/hah7dLi5qU5ns4YzaF8/rzP52sJvvrv3hP1l2v+nz/8IMABBqbSZZcgDWQAAAABJRU5ErkJggg=="
  }
};

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

  this.get = function get(icons, callback) {
    var el;

    callback = callback || Evme.Utils.NOOP;

    if (icons && icons.length){
      el = renderCanvas({
  "icons": icons,
  "settings": Evme.Utils.getIconGroup(icons.length),
  "onReady": callback
      });
    }

    else {
      el = renderEmptyIcon({
  "onReady": callback
      });
    }

    return el;
  };

  /**
   * Draw icon for Collection with no apps.
   */
  function renderEmptyIcon(options){
    var icon = Evme.Utils.getEmptyCollectionIcon(),
      onReady = options.onReady,
      elCanvas = document.createElement('canvas'),
      context = elCanvas.getContext('2d'),
      img = new Image();

    elCanvas.width = WIDTH;
    elCanvas.height = WIDTH;

    img.onload = function onload(){
      // TODO: Ask @evyatron why does passing 60,60 renders too small?
      context.drawImage(img, 0, 0, 72, 72);
      onReady(elCanvas);
    }

    img.src = Evme.Utils.formatImageData(icon);

    return elCanvas;
  }

  function renderCanvas(options) {
    var icons = options.icons,
  settings = options.settings,
  onReady = options.onReady,
  elCanvas = document.createElement('canvas'),
  context = elCanvas.getContext('2d');

    // can't render more icons than we have settings for
    icons = icons.slice(0, settings.length);

    elCanvas.width = WIDTH;
    elCanvas.height = WIDTH;
    context.imagesToLoad = icons.length;
    context.imagesLoaded = [];

    for (var i = 0; i < icons.length; i++) {
      // render the icons from bottom to top
      var icon = icons[icons.length - 1 - i];

      loadIcon(icon, settings[(settings.length - icons.length) + i], context, i, onReady);
    }

    return elCanvas;
  }

  function loadIcon(iconSrc, settings, context, index, onReady) {
    if (!iconSrc) {
      onIconLoaded(context, null, settings, index, onReady);
      return false;
    }

    var image = new Image();

    image.onload = function onImageLoad() {
      var elImageCanvas = document.createElement('canvas'),
  imageContext = elImageCanvas.getContext('2d'),
  fixedImage = new Image(),
  size = settings.size * Evme.Utils.devicePixelRatio;

      elImageCanvas.width = elImageCanvas.height = size;

      //first we draw the image resized and clipped (to be rounded)
      imageContext.drawImage(this, 0, 0, size, size);

      // dark overlay
      if (settings.darken) {
  imageContext.fillStyle = 'rgba(0, 0, 0, ' + settings.darken + ')';
  imageContext.beginPath();
  imageContext.arc(size / 2, size / 2, Math.ceil(size / 2), 0, Math.PI * 2, false);
  imageContext.fill();
  imageContext.closePath();
      }

      fixedImage.onload = function onImageLoad() {
  onIconLoaded(context, this, settings, index, onReady);
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

  function onIconLoaded(context, image, settings, index, onAllIconsReady) {
    // once the image is ready to be drawn, we add it to an array
    // so when all the images are loaded we can draw them in the right order
    context.imagesLoaded.push({
      "image": image,
      "settings": settings,
      "index": index
    });

    if (context.imagesLoaded.length === context.imagesToLoad) {
      // all the images were loaded- let's sort correctly before drawing
      context.imagesLoaded.sort(function(a, b) {
  return a.index > b.index ? 1 : a.index < b.index ? -1 : 0;
      });

      // finally we're ready to draw the icons!
      for (var i = 0, obj; obj = context.imagesLoaded[i++];) {
  image = obj.image;
  settings = obj.settings;

  var size = settings.size * Evme.Utils.devicePixelRatio;

  if (!image) {
    continue;
  }

  // shadow
  context.shadowOffsetX = settings.shadowOffset;
  context.shadowOffsetY = settings.shadowOffset;
  context.shadowBlur = settings.shadowBlur;
  context.shadowColor = 'rgba(0, 0, 0, ' + settings.shadowOpacity + ')';

  // rotation
  context.save();
  context.translate(settings.x * Evme.Utils.devicePixelRatio + size / 2, settings.y * Evme.Utils.devicePixelRatio + size / 2);
  context.rotate((settings.rotate || 0) * Math.PI / 180);
  // draw the icon already!
  context.drawImage(image, -size / 2, -size / 2);
  context.restore();
      }

      onAllIconsReady && onAllIconsReady(context.canvas);
    }
  }
};
(function(){
  "use strict";

  function NativeScroll(el, initOptions){
    var self = this,
        startPos,
        startPointer,
        positionKey,
        dirProperty,
        altDirProperty,
        reportedDirection,
        options = {
            "hScroll": false,
            "vScroll": true
        },
        optionsOnScrollStart,
        optionsOnScrollMove,
        optionsOnScrollEnd,
        optionsOnTouchStart,
        optionsOnTouchMove,
        optionsOnTouchEnd,

        scrollEventListener,
        
        // once swiped more than this value in the correct direction, 
        // cancel system swipe altogether
        THRESHOLD_DISALLOW_SYSTEM_SWIPE = 5 * window.innerWidth / 100,
        // release system swipe (out of e.me) only after finger had passed this value
        THRESHOLD_ALLOW_SYSTEM_SWIPE = 10 * window.innerWidth / 100;

    for (var key in initOptions) {
      options[key] = initOptions[key];
    }

    positionKey = options.hScroll? 0 : 1;
    dirProperty = positionKey === 0? 'distX' : 'distY';
    altDirProperty = dirProperty === 'distY'? 'distX' : 'distY';

    el.style.cssText += ';overflow-y: ' + (options.vScroll? 'auto' : 'hidden') +
                        ';overflow-x: ' + (options.hScroll? 'auto' : 'hidden');

    
    // scroll event handlers  
    optionsOnScrollStart = options.onScrollStart;
    optionsOnScrollMove = options.onScrollMove;
    optionsOnScrollEnd = options.onScrollEnd;

    // touch event handlers
    optionsOnTouchStart = options.onTouchStart;
    optionsOnTouchMove = options.onTouchMove;
    optionsOnTouchEnd = options.onTouchEnd;

    // event bindings
    el.addEventListener('touchstart', onTouchStart);
    scrollEventListener = new ScrollEventListener({
      'el': el,
      'onMove': onScrollMove,
      'onEnd': onScrollEnd
    });

    updateY();

    this.distY = 0;
    this.distX = 0;
    this.maxX = 0;
    this.maxY = 0;
    this.hScroll = options.hScroll;
    this.vScroll = options.vScroll;

    this.refresh = function refresh(){
      // for backwrads compitability with iScroll
      // this is not needed
    };

    this.scrollTo = function scrollTo(x, y) {
      x !== undefined && (el.scrollLeft = x);
      y !== undefined && (el.scrollTop = y);
    };

    function onTouchStart(e){
      var touch = 'touches' in e ? e.touches[0] : e;

      el.dataset.touched = true;

      reportedDirection = false;
      startPos = [el.scrollLeft, el.scrollTop];
      startPointer = [touch.pageX, touch.pageY];
      self.maxX = el.scrollWidth - el.offsetWidth;
      self.maxY = el.scrollHeight - el.offsetHeight;
      self.distX = 0;
      self.distY = 0;

      el.addEventListener('touchmove', onTouchMove);
      el.addEventListener('touchend', onTouchEnd, true);

      scrollEventListener.start();
      
      optionsOnTouchStart && optionsOnTouchStart(e);
    }

    function onTouchMove(e){
      // messages panning handler to prevent it
      e.preventPanning = true;

      var currPos = [el.scrollLeft, el.scrollTop],
          touch = 'touches' in e ? e.touches[0] : e;

      updateY();
      self.distX = touch.pageX - startPointer[0];
      self.distY = touch.pageY - startPointer[1];

      if (!reportedDirection) {
        if (Math.abs(self[dirProperty]) >= THRESHOLD_DISALLOW_SYSTEM_SWIPE) {
          reportedDirection = true;
        } else if (Math.abs(self[altDirProperty]) >= THRESHOLD_ALLOW_SYSTEM_SWIPE) {
          reportedDirection = true;
          // messages panning handler to pan normally
          e.preventPanning = false;
        }
      }

      optionsOnTouchMove && optionsOnTouchMove(e);
    }

    function onTouchEnd(e){
      el.dataset.touched = false;

      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd, true);

      scrollEventListener.stop();

      updateY();
      optionsOnTouchEnd && optionsOnTouchEnd(e);
    }

    function onScrollStart(e) {
      el.dataset.scrolling = true;
      optionsOnScrollStart && optionsOnScrollStart(e);
    }

    function onScrollMove(e, first) {
      updateY();
      first && onScrollStart(e);
      optionsOnScrollMove && optionsOnScrollMove(e);
    }

    function onScrollEnd(e) {
      el.dataset.scrolling = false;
      optionsOnScrollEnd && optionsOnScrollEnd(e);
    }

    function updateY() {
      self.y = el.scrollTop;
    }
  }

  function ScrollEventListener(cfg) {
    var onMove = cfg.onMove || function(){},
        onEnd = cfg.onEnd || function(){},
        hadScrolled = false,
        isScrolling = false,
        shouldKeepListening,
        interval, intervalDelay = 100;

    cfg.el.addEventListener('scroll', onScroll);

    this.start = function(type) {
      shouldKeepListening = true;
    };

    this.stop = function(type) {
      shouldKeepListening = false;
    };

    function onScroll(e) {
      // if started scrolling, start listening to scroll stop
      if (!interval) {
        interval = setInterval(checkIfScrolled, intervalDelay);
      }
      // indicated a scroll had been triggered
      hadScrolled = true;
      onMove(e, !isScrolling);

      !isScrolling && (isScrolling = true);
    }
    
    function checkIfScrolled() {
      // if there was a scroll event
      if (!hadScrolled && !shouldKeepListening) {
        // stop listening
        interval = window.clearInterval(interval);

        isScrolling = false;

        // activate callback
        onEnd();
      } else {
        // reset indication
        hadScrolled = false;
      }
    }
  }

  window.Scroll = NativeScroll;

}());


Evme.DoATAPI = new function Evme_DoATAPI() {
    var NAME = "DoATAPI", self = this,
        requestRetry = null,
        cached = [],
        
        apiKey = '',
        deviceId = '',
        NUMBER_OF_RETRIES = 3,                          // number of retries before returning error
        RETRY_TIMEOUT = {"from": 1000, "to": 3000},     // timeout before retrying a failed request
        MAX_REQUEST_TIME = 20000,                       // timeout before declaring a request as failed (if server isn't responding)
        MAX_ITEMS_IN_CACHE = 20,                        // maximum number of calls to save in the user's cache
        CACHE_EXPIRATION_IN_MINUTES = 24*60,
        STORAGE_KEY_CREDS = "credentials",
        authCookieName = '',
        userLat,
        userLon,
        appVersion,
        manualCredentials = null,
        manualCampaignStats = null,
        requestingSession = false,
        
        requestsQueue = {},
        requestsToPerformOnOnline = [],
        sessionInitRequest = null,
        
        // here we will save the actual params to pass
        savedParamsToPass = {},
        // which param to pass from normal requests to stats and logs
        PARAM_TO_PASS_BETWEEN_REQUESTS = "requestId",
        PARAM_TO_PASS_BETWEEN_REQUESTS_NAME = "originatingRequestId",
        
        // client info- saved in cookie and sent to API
        clientInfo = {
            'lc': navigator.language,
            'tz': (new Date().getTimezoneOffset()/-60).toString(),
            'kb': ''
        },
        
        requestsToCache = {
            "Search.apps": true,
            "Search.bgimage": true,
      "Shortcuts.get": 2 * 24 * 60,
      "Shortcuts.suggestions": 2 * 24 * 60
        },
        requestsThatDontNeedConnection = {
            "Search.suggestions": true,
            "App.icons": true
        },
        paramsToCleanFromCacheKey = ["cachedIcons", "idx", "feature", "sid", "credentials"],
        doesntNeedSession = {
      "Session.init": true
        },

  // parameters for getting native app suggestions
  paramsForNativeSuggestions = {
      'nativeSuggestions': true,
      'nativeIconFormat': 64, // same as GridManager.PREFERRED_ICON_SIZE
      'nativeIconAsUrl': true,
      '_opt': 'app.type'
  },
        
        /*
         * config of params to pass from requests to reports
         * "Search.apps": ["appClick", "returnFromApp"]
         */
        paramsToPassBetweenRequests = {
            "Search.apps": ["appClick", "loadMore", "addToHomeScreen"]
        };
      
    this.ERROR_CODES = {
        "SUCCESS": 1,
        "AUTH": -9,
        "INVALID_PARAMS": -14,
        "TIMEOUT": -19
    };

    this.init = function init(options){
        apiKey = options.apiKey;
        appVersion = options.appVersion || "";
        authCookieName = options.authCookieName;
        manualCampaignStats = options.manualCampaignStats;

  // temporarily generate a device id, so that requests going out before we
  // took it from the cache won't fail
  deviceId = generateDeviceId();
        getDeviceId(function deviceIdGot(value) {
            deviceId = value;
        });

        Evme.Storage.get(STORAGE_KEY_CREDS, function storageGot(value) {
            manualCredentials = value;
        });

        // make sure our client info cookie is always updated according to phone ettings
        if (navigator.mozSettings) {
            navigator.mozSettings.addObserver('language.current', function onLanguageChange(e) {
                self.setClientInfoLocale(e.settingValue);
            });
            navigator.mozSettings.addObserver('time.timezone', function onTimeZoneChange(e) {
                self.setClientInfoTimeZone();
            });
            navigator.mozSettings.addObserver('keyboard.current', function onKeyboardLayoutChange(e) {
                self.setKeyboardLanguage(e.settingValue);
            });
        }

        self.Session.init(options.callback);
    };
    
    this.search = function search(options, callback, noSession) {
        !options && (options = {});

        var params = {
            "query": options.query,
            "experienceId": options.experienceId || '',
            "typeHint": options.typeHint || '',
            "feature": options.feature || '',
            "cachedIcons": options.cachedIcons || '',
            "exact": !!options.exact,
            "spellcheck": !!options.spellcheck,
            "suggest": !!options.suggest,
            "first": options.first || 0,
            "limit": options.limit || 16,
            "idx": options.index || '',
            "iconFormat": options.iconFormat || 10,
      "prevQuery": (options.first === 0) ? options.prevQuery || "" : "",
      "_opt": 'app.type'
        };

  if (params.first) {
    Evme.EventHandler.trigger(NAME, "loadmore", params);
  }

  if (params.exact) {
    for (var key in paramsForNativeSuggestions) {
      if (params[key] === undefined) {
        params[key] = paramsForNativeSuggestions[key];
      }
    }
  }
        
        return request({
            "methodNamespace": "Search",
            "methodName": "apps",
            "params": params,
            "callback": callback,
            "noSession": noSession
  }, options._NOCACHE || false);
    };
    
    // icons in cache, to be reported to server
    this.CachedIcons = new function CachedIcons() {
      var self = this,
    newIcons = [];

      this.add = function add(icon) {
  newIcons.push(icon);
      };

      this.clear = function clear() {
  newIcons = [];
      };

      this.yank = function yank() {
  var result = Evme.Utils.convertIconsToAPIFormat(newIcons);
  self.clear();
  return result;
      };
    };

    this.suggestions = function suggestions(options, callback) {
        !options && (options = {});
    
        var params = {
            "query": options.query
        };
        
        return request({
            "methodNamespace": "Search",
            "methodName": "suggestions",
            "params": params,
            "callback": callback
  }, options._NOCACHE || false);
    };
    
    this.icons = function icons(options, callback) {
        !options && (options = {});
        
        var params = {
            "ids": options.ids,
            "iconFormat": options.iconFormat
        };
        
        return request({
            "methodNamespace": "App",
            "methodName": "icons",
            "params": params,
            "callback": callback
  }, options._NOCACHE || false);
    };
    
    this.bgimage = function bgimage(options, callback) {
        !options && (options = {});

        var params = {
            "query": options.query,
            "experienceId": options.experienceId || '',
            "typeHint": options.typeHint || '',
            "feature": options.feature || '',
            "exact": !!options.exact,
            "width": options.width || 320,
            "height": options.height || 460,
            "idx": options.index || '',
            "prevQuery": options.prevQuery || ''
        };

        return request({
            "methodNamespace": "Search",
            "methodName": "bgimage",
            "params": params,
            "callback": callback
  }, options._NOCACHE || false);
    };
    
    this.getDisambiguations = function getDisambiguations(options, callback) {
        !options && (options = {});

        var params = {
            "query": options.query
        };

        return request({
            "methodNamespace": "Search",
            "methodName": "disambiguate",
            "params": params,
            "callback": callback
  }, options._NOCACHE || false);
    };
    
    this.Shortcuts = new function Shortcuts() {
      this.get = function get(options, callback) {
        !options && (options = {});

        var params = {
            "queries": options.queries || []
        };

        return request({
    "methodNamespace": "Shortcuts",
    "methodName": "get",
    "params": params,
    "callback": callback
  }, options._NOCACHE || false);
      };

      this.suggest = function suggest(options, callback) {
        !options && (options = {});

        var params = {
    "existing": JSON.stringify(options.existing || [])
        };

        return request({
    "methodNamespace": "Shortcuts",
    "methodName": "suggestions",
    "params": params,
    "callback": callback
  });
      };
    };
    
    this.Logger = new function Logger(){
        var self = this,
            methodArr = ["error", "warn", "info"];
        
        methodArr.forEach(function oggerMethodIteration(method){
            self[method] = function report(options, callback){
                options = addGlobals(options);
                options = addSavedParams(options);
                
                return request({
                    "methodNamespace": "Logger",
                    "methodName": method,
                    "params": options,
                    "callback": callback
                });
            }
        });
    };
    
    this.report = function report(options, callback) {
        options = addGlobals(options);
        options = addSavedParams(options);
        
        return request({
            "methodNamespace": "Stats",
            "methodName": "report",
            "params": options,
            "callback": callback
  }, options._NOCACHE || false);
    };

    this.appNativeInfo = function appNativeInfo(options, callback) {
  // string together ids like so:
  // apiurl/?guids=["guid1","guid2","guid3", ...]

  var guids = (options.guids || []).map(cleanGuid);

  for (var i=0; i<guids.length; i++) {
    if (!guids[i]) {
      guids.splice(i, 1);
      i--;
    }
  }

  var params = {
      "guids": JSON.stringify(guids)
  };

  return request({
      "methodNamespace": "App",
      "methodName": "nativeInfo",
      "params": params,
      "callback": callback
  }, options._NOCACHE || false);
    };

    function cleanGuid(str) {
  return str && str.split("?")[0];
    }
    
    function addGlobals(options) {
        var globals = options["globals"] || {};
        
        globals.deviceId = deviceId;
        try {
            options["globals"] = JSON.stringify(globals);
        } catch(ex) {
            delete options["globals"];
        }
        
        return options;
    }
    
    // add the saved params from earlier responses to the event's data
    function addSavedParams(options) {
        var events = options.data;
        if (events) {
            try {
                events = JSON.parse(events);
            } catch(ex) {
                events = null;
            }
            
            if (events && typeof events === "object") {
                for (var i=0,e; e=events[i++];) {
                    var savedValue = savedParamsToPass[e.userEvent];
                    if (savedValue) {
                        e[PARAM_TO_PASS_BETWEEN_REQUESTS_NAME] = savedValue;
                    }
                }
                
                options.data = JSON.stringify(events);
            }
        }
        return options;
    }
    
    // takes a method's response, and saves data according to paramsToPassBetweenRequests
    function saveParamFromRequest(method, response) {
        var events = paramsToPassBetweenRequests[method],
            paramValue = response && response[PARAM_TO_PASS_BETWEEN_REQUESTS];
            
        if (!paramValue || !events) {
            return;
        }
        
        // this will create a map of userEvents => requestId
        // to be added to the actual event request later
        for (var i=0,ev; ev=events[i++];) {
            savedParamsToPass[ev] = paramValue;
        }
    }
    
    this.setLocation = function setLocation(lat, lon) {
        userLat = lat;
        userLon = lon;
        
        Evme.EventHandler.trigger(NAME, "setLocation", {
            "lat": lat,
            "lon": lon
        });
    };
    
    this.hasLocation = function hasLocation() {
        return (userLat && userLon);
    };
    
    this.request = function publicRequest(methodNamespace, methodName, params, callback) {
        return request({
            "methodNamespace": methodNamespace,
            "methodName": methodName,
            "params": params,
            "callback": callback
        }, params._NOCACHE);
    };
    
    
    this.initSession = function initSession(options, callback) {
        !options && (options = {});
        
        var params = {
      "id": (self.Session.get() || {}).id,
            "deviceId": deviceId,
            "cachedIcons": options.cachedIcons,
            "stats": {
                "userAgent": navigator.userAgent,
                "referrer": document.referrer,
                "connectionType": Evme.Utils.connection().type || "",
                "locale": navigator.language || "",
                "GMT": (new Date().getTimezoneOffset()/-60).toString(),
                "sessionInitCause": options.cause,
                "sessionInitSrc": options.source,
                "cookiesEnabled": Evme.Utils.bCookiesEnabled() || false,
                "localStorageEnabled": Evme.Utils.bLocalStorageEnabled()
            }
        };
        
        if (requestingSession) {
            return;
        }
        
        requestingSession = true;
        
        return request({
            "methodNamespace": "Session",
            "methodName": "init",
            "params": params,
            "callback": function onSessionInitSuccess(data, url) {
                requestingSession = false;
                
                if (data && data.response) {
                    self.Session.update(data.response.ttl);
                    
                    // in case the API says it wrote a cookie, but it doesn't match the user's
                    if (data.response.credentials && data.response.credentials != self.Session.creds()) {
                        // send the creds with each request
                        manualCredentials = data.response.credentials;
                        
                        // save them in local storage
                        Evme.Storage.set(STORAGE_KEY_CREDS, manualCredentials);
                    }
                    
                    Evme.EventHandler.trigger("DoATAPI", "sessionInit");
                }
                
                callback && callback(data, url);
            }
        });
    };
    
    function reInitSession(initCause) {
        if (sessionInitRequest) {
            return;
        }
        
        sessionInitRequest = self.initSession({
            "cause": initCause,
            "source": "DoATAPI.reInitSession"
        }, function onInitSession(){
            for (var key in requestsQueue) {
                request(requestsQueue[key], false, true);
            }
            
            requestsQueue = {};
            sessionInitRequest = null;
        });
    }
    
    // the "requestsQueue" will empty after the session has been init'ed
    function addRequestToSessionQueue(requestOptions) {
      requestsQueue[JSON.stringify(requestOptions)] = requestOptions;
    }

    this.getSessionId = function getSessionId() {
        return self.Session.get().id;
    };
    
    this.Session = new function Session() {
        var self = this,
            _key = "session", _session = null,
            DEFAULT_TTL = -1;
            
        this.INIT_CAUSE = {
            "EXPIRED": "session expired",
            "NO_CREDS": "missing credentails",
            "ABSENT": "session absent",
            "NOT_IN_CACHE": "new session",
            "AUTH_ERROR": "API authentication error",
            "CACHE_ERROR": "cache error"
        };
        
       this.init = function init(callback) {
            Evme.Storage.get(_key, function storageGot(sessionFromCache) {
                var createCause;

    try {
      if (sessionFromCache) {
          if (!self.expired(sessionFromCache)) {
        _session = sessionFromCache;
          } else {
        createCause = self.INIT_CAUSE.EXPIRED;
          }
      } else {
          createCause = self.INIT_CAUSE.NOT_IN_CACHE;
      }

      if (!_session) {
          self.create(null, null, createCause);
      }

      callback && callback();
    } catch(ex) {
      console.error('evme Session init error: ' + ex.message);
      callback && callback();
                }
            });
        };
        
        this.shouldInit = function shouldInit() {
            if (!_session) {
                return {
                    "should": true,
                    "cause": self.INIT_CAUSE.ABSENT
                };
            }
            if (_session.ttl == DEFAULT_TTL) {
                return {
                    "should": true,
                    "cause": _session.createCause
                };
            }
            if (!self.creds()) {
                return {
                    "should": true,
                    "cause": self.INIT_CAUSE.NO_CREDS
                };
            }
            
            return { "should": false };
        };
        
        this.get = function get() {
      if (!_session) {
    self.create(null, null, self.INIT_CAUSE.NOT_IN_CACHE);
      }
            return _session;
        };
        
        this.create = function create(id, ttl, cause) {
            _session = {
                "id": id || self.generateId(),
                "ttl": ttl || DEFAULT_TTL,
                "createCause": cause
            };
            
            save();
        };
        
        this.update = function update(ttl) {
            if (!ttl) {
                return;
            }
            
            _session["ttl"] = ttl;
            save();
        };
        
        this.generateId = function generateId() {
            return Evme.Utils.uuid();
        };
        
        this.creds = function creds() {
            return Evme.Utils.Cookies.get(authCookieName) || manualCredentials || null;
        };
        
        this.expired = function expired(sessionToTest) {
            !sessionToTest && (sessionToTest = _session);
            
            var timeNow = (new Date()).getTime();
            var expiration = sessionToTest.timeWritten + sessionToTest.ttl*1000;
            
            return (timeNow >= expiration);
        };
        
        function save() {
            _session["timeWritten"] = (new Date()).getTime();
            
            Evme.Storage.set(_key, _session);
        }
    };
    
    this.cancelQueue = function cancelQueue() {
        for (var i=0; i<requestsToPerformOnOnline.length; i++) {
            requestsToPerformOnOnline[i].abort();
        }
        
        requestsToPerformOnOnline = [];
    };
    
    this.backOnline = function backOnline() {
        if (requestsToPerformOnOnline.length == 0) return;
        
        for (var i=0; i<requestsToPerformOnOnline.length; i++) {
            requestsToPerformOnOnline[i].request();
        }
        
        requestsToPerformOnOnline = [];
    };
    
    this.setClientInfoLocale = function setClientInfoLocale(newLocale) {
        clientInfo.lc = newLocale || navigator.language || '';
    };
    this.setClientInfoTimeZone = function setClientInfoTimeZone(newTimeZone) {
        clientInfo.tz = newTimeZone || (new Date().getTimezoneOffset()/-60).toString();
    };
    this.setKeyboardLanguage = function setKeyboardLanguage(newKeyboardLanguage) {
        clientInfo.kb = newKeyboardLanguage || '';
    };
    
    // go over the clientInfo object and construct a param from it
    // clientInfo=key=value,key=value,...
    this.getClientInfo = function getClientInfo() {
        var value = [];
        for (var key in clientInfo) {
            value.push(key + '=' + clientInfo[key]);
        }
        value = value.join(',');
        
        return value;
    };
    
    function request(options, ignoreCache, dontRetryIfNoSession) {
        var methodNamespace = options.methodNamespace,
            methodName = options.methodName,
            params = options.params || {},
            callback = options.callback,
            noSession = options.noSession,
            
            useCache = requestsToCache[methodNamespace+"."+methodName],
            cacheKey = '',
            
            shouldInit = Evme.DoATAPI.Session.shouldInit();
        
        if (requestsToPerformOnOnline.length != 0 && shouldInit.should && !doesntNeedSession[methodNamespace+"." + methodName] && !manualCredentials && !dontRetryIfNoSession) {
      addRequestToSessionQueue(options);
            reInitSession(shouldInit.cause);
            return false;
        }
        
        // the following params will be added to the cache key
        if (userLat && userLon && typeof params["latlon"] == "undefined") {
            params["latlon"] = userLat + "," + userLon;
        }
        params["clientInfo"] = self.getClientInfo();
        
        if (useCache) {
            cacheKey = getCacheKey(methodNamespace, methodName, params);

            if (!ignoreCache) {
                Evme.Storage.get(cacheKey, function storageGot(responseFromCache) {
                    if (responseFromCache) {
                      saveParamFromRequest(methodNamespace+"."+methodName, responseFromCache);
                      
                      callback && window.setTimeout(function() {
                          responseFromCache && (responseFromCache._cache = true);
                          callback(responseFromCache);
                      }, 10);
                      
                      return true;
                    } else {
                      actualRequest();
                    }
                });
                
                return true;
            }
        }
        
        function actualRequest() {
            // the following params WILL NOT BE ADDED TO THE CACHE KEY
            params["apiKey"] = apiKey;
            params["v"] = appVersion;
            params["native"] = true;
      params["platform.os"] = "firefox-os";

      // report server about new cached icons
      if (methodNamespace === "Search" && methodName === "apps") {
    params["cachedIcons"] = self.CachedIcons.yank();
      }

            if (manualCredentials) {
                params["credentials"] = manualCredentials;
            }
            if (manualCampaignStats) {
                for (var k in manualCampaignStats){
                    params[k] = manualCampaignStats[k];
                }
            }
            if (!noSession) {
    params["sid"] = (self.Session.get() || {}).id || '';
            }
            if (!params.stats) {
                params.stats = {};
            }
            /* ---------------- */
           
            var _request = new Evme.Request();
            _request.init({
                "methodNamespace": methodNamespace,
                "methodName": methodName,
                "params": params,
                "originalOptions": options,
                "callback": callback,
                "requestTimeout": MAX_REQUEST_TIME,
                "retries": NUMBER_OF_RETRIES,
                "retryCheck": shouldRetry,
                "timeoutBetweenRetries": RETRY_TIMEOUT,
                "request": cbRequest,
                "error": cbError,
                "success": cbSuccess,
                "clientError": cbClientError,
                "onAbort": cbRequestAbort,
                "cacheKey": cacheKey,
                "cacheTTL": (typeof useCache == "number")? useCache : CACHE_EXPIRATION_IN_MINUTES
            });
            
            if (requestsThatDontNeedConnection[methodNamespace+"."+methodName]) {
                _request.request();
            } else {
                Evme.Utils.isOnline(function isOnlineCallback(isOnline){
                    if (isOnline) {
                        _request.request();
                    } else {
                        requestsToPerformOnOnline.push(_request);
                        
                        Evme.EventHandler.trigger(NAME, "cantSendRequest", {
                            "method": methodNamespace + '/' + methodName,
                            "request": _request,
                            "queue": requestsToPerformOnOnline
                        });
                    }
                });
            }
            
            return _request;
        }

        return actualRequest();
    }
    
    function shouldRetry(data) {
        // If the parameters sent are incorrect, retrying won't help
        return data.errorCode !== self.ERROR_CODES.INVALID_PARAMS;
    }
    
    function getCacheKey(methodNamespace, methodName, params) {
        var sOptions = cacheCleanUpParams(params);
        return (methodNamespace + "." + methodName + "." + sOptions).toLowerCase();
    }
    
    this.insertToCache = function insertToCache(cacheKey, data, cacheTTL) {
        if (!data || !data.response) { return false; }
        
        // don't cache images that aren't ready (~)
        if (cacheKey.indexOf("search.bgimage") !== -1) {
            if (data.response && data.response.image.data == "~") {
                return false;
            }
        }
        
        // don't cache errors
        if (data.errorCode != self.ERROR_CODES.SUCCESS) {
            return false;
        }
        
        // this causes data to be a copy of the original.
        // without this, any changes to the data object will affect the original object (that's sent to the API callbacks)
        try {
            data = Evme.Utils.cloneObject(data);
        } catch(ex) {
            return false;
        }
        
        // clear the icons from the Apps response (to save space)
        // NOTE we don't remove an icon without a revision- cause that's an external icon and is not cached on the server
        if (cacheKey.indexOf("search.apps") !== -1 && data.response.apps && data.response.apps.length) {
            for (var i=0, l=data.response.apps.length; i<l; i++) {
                if (data.response.apps[i].revision) {
                    data.response.apps[i].icon = null;
                }
            }
        }
        
        // IndexDB stores in seconds and the cacheTTL is in minutes, so we multiply by 60 to conver it to seconds
        Evme.Storage.set(cacheKey, data, cacheTTL*60);

        Evme.Storage.get('itemsCached', function storageGot(itemsCached) {
            itemsCached = itemsCached || [];
            if (itemsCached.length == 1 && itemsCached[0] == "") {
                itemsCached = [];
            }

            itemsCached.push(cacheKey);

            if (itemsCached.length > MAX_ITEMS_IN_CACHE) {
                var itemToRemove = itemsCached[0];
                itemsCached.splice(0, 1);

                Evme.Storage.remove(itemToRemove);
            }

            Evme.Storage.set('itemsCached', itemsCached, null);
        });
        
        return true;
    };

    this.removeFromCache = function removeFromCache(cacheKey) {
        Evme.Storage.remove(cacheKey);
    };
    
    function cacheCleanUpParams(params) {
        var retParams = [];
        for (var param in params) {
            if (paramsToCleanFromCacheKey.indexOf(param) == -1) {
                retParams.push(param + ":" + params[param]);
            };
        }
        retParams.sort();
        return retParams.join(",");
    }
    
    function getDeviceId(callback) {
        Evme.Storage.get("deviceId", function storageGot(deviceId) {
            if (!deviceId) {
                deviceId = generateDeviceId();
                Evme.Storage.set("deviceId", deviceId);
            }

            callback(deviceId);
        });
    }
    
    this.getDeviceId = function getDeviceId(){
        return deviceId;
    };
    
    function generateDeviceId() {
        var queryString = {};
        (location.search || '').replace(/(?:[?&]|^)([^=]+)=([^&]*)/g, function regexmatch(ig, k, v) {queryString[k] = v;})
        return queryString['did'] || 'fxos-' + Evme.Utils.uuid();
    }

    function cbRequest(methodNamespace, method, params, retryNumber, completeURL) {
        Evme.EventHandler.trigger(NAME, "request", {
            "method": methodNamespace + "/" + method,
            "params": params,
      "retryNumber": retryNumber,
      "url": completeURL
        });
    }
    
    function cbRequestAbort(methodNamespace, method, params, retryNumber) {
        Evme.EventHandler.trigger(NAME, "abort", {
            "method": methodNamespace + "/" + method,
            "params": params,
            "retryNumber": retryNumber
        });
    }
    
    function cbSuccess(methodNamespace, method, url, params, retryNumber, data, requestDuration) {
        saveParamFromRequest(methodNamespace + '.' + method, data);
        
        Evme.EventHandler.trigger(NAME, "success", {
            "method": methodNamespace + "/" + method,
            "params": params,
            "retryNumber": retryNumber,
            "url": url,
            "response": data,
            "requestDuration": requestDuration
        });
    }
    
    function cbClientError(methodNamespace, method, url, params, data, ex) {
        Evme.EventHandler.trigger(NAME, "clientError", {
            "method": methodNamespace + "/" + method,
            "params": params,
            "url": url,
            "response": data,
            "exception": ex
        });
    }
    
    function cbError(methodNamespace, method, url, params, retryNumber, data, callback, originalOptions) {
        Evme.EventHandler.trigger(NAME, "error", {
            "method": methodNamespace + "/" + method,
            "params": params,
            "retryNumber": retryNumber,
            "url": url,
            "response": data,
            "callback": callback
        });
        
        // if it's an authentication error
        // return false so the request won't automatically retry
        // and do a sessionInit, and retry at the end of it
  if ((data && data.errorCode == Evme.DoATAPI.ERROR_CODES.AUTH && !manualCredentials) ||
      (methodNamespace == "Session" && method == "init")) {
      Evme.Utils.log('Got authentication error from API, add request to queue and re-init the session');
      addRequestToSessionQueue(originalOptions);
      reInitSession(Evme.DoATAPI.Session.INIT_CAUSE.AUTH_ERROR);
            return false;
        }
        
        return true;
    }
};

Evme.Request = function Evme_Request() {
    var self = this,
        
        methodNamespace = "",
        methodName = "",
        params = {},
  originalOptions = {},
        
        callback = null,
        
        retries = 0,
        retryNumber = 0,
        cbShouldRetry = null,
        requestRetry = null,
        timeoutBetweenRetries = 0,
        
        httpRequest = null,
        aborted = false,
        cacheKey = "",
        cacheTTL = 0,
        
        requestTimeout = null,
        maxRequestTime = 0,
        
        requestSentTime = 0,
        cbRequest = null,
        cbError = null,
        cbSuccess = null,
        cbClientError = null,
        cbAbort = null;
        
        
    this.init = function init(options) {
        methodNamespace = options.methodNamespace;
        methodName = options.methodName;
        params = options.params;
  originalOptions = options.originalOptions;
        callback = options.callback;
        maxRequestTime = options.requestTimeout;
        retries = options.retries;
        timeoutBetweenRetries = options.timeoutBetweenRetries;
        
        cbRequest = options.request;
        cbError = options.error;
        cbClientError = options.clientError;
        cbSuccess = options.success;
        cbShouldRetry = options.retryCheck;
        cbAbort = options.onAbort;
        
        cacheKey = options.cacheKey;
        cacheTTL = options.cacheTTL;
        
        return self;
    };
    
    this.request = function request() {
        if (aborted) return false;
        
        requestSentTime = (new Date()).getTime();
        
        // stats params to add to all API calls
        (!params["stats"]) && (params["stats"] = {});
        params.stats.retryNum = retryNumber;
        params.stats.firstSession = Evme.Utils.isNewUser();
        
        params.stats = JSON.stringify(params.stats);
        
        httpRequest = Evme.api[methodNamespace][methodName](params, apiCallback);

  cbRequest(methodNamespace, methodName, params, retryNumber, httpRequest.url);
  httpRequest = httpRequest.request;
        
        requestTimeout = window.setTimeout(requestTimeoutCallback, maxRequestTime);
        
        return httpRequest;
    };
    
    this.abort = function abort() {
        if (aborted) {
            return;
        }
        
        aborted = true;
        clearTimeouts();
        
        if (httpRequest) {
          httpRequest.onreadystatechange = null;
          httpRequest.abort();
        }
        
        cbAbort(methodNamespace, methodName, params, retryNumber);
    };
    
    function clearTimeouts() {
        window.clearTimeout(requestRetry);
        window.clearTimeout(requestTimeout);
    }
    
    function apiCallback(data, url) {
        var isError = (data.errorCode != Evme.DoATAPI.ERROR_CODES.SUCCESS);
        
        clearTimeouts();
        
        if (isError && retryNumber < retries) {
      var bDontRetry = cbError(methodNamespace, methodName, url, params, retryNumber, data, callback, originalOptions);
            
            if (bDontRetry && cbShouldRetry(data)) {
                retry();
            }
        } else {
            if (!isError) {
                var requestDuration = (new Date().getTime()) - requestSentTime;
                cbSuccess(methodNamespace, methodName, url, params, retryNumber, data, requestDuration);
            }
            
            if (cacheKey) {
                Evme.DoATAPI.insertToCache(cacheKey, data, cacheTTL);
            }
            
            try {
                callback && callback(data, methodNamespace, methodName, url);
            } catch(ex) {
                cbClientError && cbClientError(methodNamespace, methodName, url, params, data, ex);
            }
        }
    }
    
    function requestTimeoutCallback() {
        if (!httpRequest) {
            return;
        }
        
        httpRequest.abort();
        
        var data = {
            "errorCode": -100,
            "errorString": "Request timed out on the Client Side (took more than " + maxRequestTime + "ms)",
            "processingTime": maxRequestTime
        };
        
  cbError(methodNamespace, methodName, "", params, retryNumber, data, callback, originalOptions);

        if (retryNumber >= 0) {
            retry();
        }
        
    }
    
    function retry(data, url){
  var isSessionInit = data && data.response && data.response.credentials;

        window.clearTimeout(requestRetry);
        
        var retryTimeout = Math.round(Math.random()*(timeoutBetweenRetries.to - timeoutBetweenRetries.from)) + timeoutBetweenRetries.from;

  // if retrying a session init error - don't wait once it's ready
  if (isSessionInit) {
    retryTimeout = 0;
  }

        requestRetry = window.setTimeout(function retryTimeout(){
            retryNumber++;
            self.request();
        }, retryTimeout);
    }
};

Evme.api = new function Evme_api() {
    var self = this,
        PROTOCOL = 'https',
        DEFAULT_API_HOST = 'api.everything.me',
        API_VERSION = '2.1',
        API_HOST = DEFAULT_API_HOST,
        BASE_URL = PROTOCOL + '://' + API_HOST + '/everything/' + API_VERSION + '/',
        USE_POST = true;
    
    this.init = function init() {
    };
    
    this.setHost = function setHost(hostName) {
        if (hostName) {
            API_HOST = hostName;
        }
    };
    
    this.getHost = function getHost() {
        return API_HOST;
    };
    
    this.getBaseURL = function getBaseURL() {
        return BASE_URL;
    };
    
    this.App = new function App() {
        this.close = function close(options, callback) {
            return request("App/close", options, callback);
        };
        this.icons = function icons(options, callback) {
            return request("App/icons", options, callback);
        };
        this.nativeInfo = function nativeInfo(options, callback) {
            return request("App/nativeInfo", options, callback);
        };
    };
    
    this.Device = new function Device() {
        this.update = function update(options, callback) {
            return request("Device/update", options, callback);
        };
    };
    
    this.Location = new function Location() {
        this.search = function search(options, callback) {
            return request("Location/search", options, callback);
        };
        this.set = function set(options, callback) {
            return request("Location/set", options, callback);
        };
    };
    
    this.Logger = new function Logger() {
        this.error = function error(options, callback) {
            return request("Logger/error", options, callback);
        };
        this.info = function info(options, callback) {
            return request("Logger/info", options, callback);
        };
        this.warn = function warn(options, callback) {
            return request("Logger/warn", options, callback);
        };
    };
    
    this.Search = new function Search() {
        this.apps = function apps(options, callback) {
            return request("Search/apps", options, callback);
        };
        this.suggestions = function suggestions(options, callback) {
            return request("Search/suggestions", options, callback);
        };
        this.external = function external(options, callback) {
            return request("Search/external", options, callback);
        };
        this.bgimage = function bgimage(options, callback) {
            return request("Search/bgimage", options, callback);
        };
        this.disambiguate = function disambiguate(options, callback) {
            return request("Search/disambiguate", options, callback);
        };
    };
    
    this.Session = new function Session() {
        this.init = function init(options, callback) {
            return request("Session/init", options, callback, false);
        };
    };
    
    this.Shortcuts = new function Shortcuts() {
        this.get = function get(options, callback) {
            return request("Shortcuts/get", options, callback);
        };
        this.set = function set(options, callback) {
            return request("Shortcuts/set", options, callback);
        };
        this.suggestions = function suggestions(options, callback) {
            return request("Shortcuts/suggestions", options, callback);
        };
    };
    
    this.Stats = new function Stats() {
        this.report = function report(options, callback) {
            return request("Stats/report", options, callback);
        };
    };
    
    function request(method, options, callback, isSecured) {
      !options && (options = {});
        
      var url = BASE_URL + method,
          finalUrl = url,
          params = "",
          httpRequest = new XMLHttpRequest(),
          value;
    
      for (var k in options) {
        value = options[k];
        if (value !== null && value !== undefined && value !== '') {
          params += k + "=" + encodeURIComponent(options[k]) + "&";
        }
      }
      
      finalUrl += '?' + params;
    
      httpRequest.open("POST", url, true);
      httpRequest.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      httpRequest.onreadystatechange = function onReadyStateChange(e) {
        if (httpRequest.readyState == 4) {
          var response = null;
          
          try {
              response = JSON.parse(httpRequest.responseText);
          } catch(ex){}
          
          if (response) {
            callback(response, finalUrl);
          }
        }
      };
      httpRequest.withCredentials = true;
      httpRequest.send(params);
          
      return {
        "request": httpRequest,
        "url": finalUrl
      };
    }
    
    self.init();
}



/*
 * Analytics class
 */
Evme.Analytics = new function Evme_Analytics() {
    var self = this,
  ga, idle, providers = [],
  immediateProviders = [],
  queueArr = [],
  maxQueueCount,
  getCurrentAppsRowsCols, getCurrentSearchQuery, getCurrentSearchSource,

  STORAGE_QUERY = "analyticsLastSearchQuery",

        // Google Analytics load props
        GAScriptLoadStatus, GAScriptLoadSubscribers = [];
    
    // default values.
    // overridden by ../config/config.php
    var options = {
        "enabled": false,
        "maxQueueCount": 6,
        "dispatchDelay": 2000,
        "idleDelay": 4000,
        "localStorageTTL": 600000, // 10 min
        "SEARCH_SOURCES": {},
        "PAGEVIEW_SOURCES": {}
    };
    
    this.providers = providers;
    
    /**** PUBLIC METHODS ****/
    
    this.init = function init(_options) {
        // override defaults
  for (var i in _options){ options[i] = _options[i]; }
        if (_options.config){
      for (var i in _options.config){ options[i] = _options.config[i]; }
        }
        
        // if enabled
        if (options.enabled){
            // we send data according to the settings flag (Submit performance data)
            SettingsListener.observe('debug.performance_data.shared', false, onSettingChange);

            getCurrentAppsRowsCols = options.getCurrentAppsRowsCols;
            getCurrentSearchQuery = options.getCurrentSearchQuery;
            getCurrentSearchSource = options.getCurrentSearchSource;
            
            // Idle
            idle = new Evme.Idle();
            idle.init({
                "callback": dispatch,
                "delay": options.idleDelay
            });
            
            var requestsPerEventCount = 0;

            // register providers
      for (var name in options.providers){
                var object = options.namespace[name],
                    params = options.providers[name];
                
                if (object && params.enabled && !(params.disableOnLowConnection && options.connectionLow)){
                    registerProvider(object, params);
                    
                    requestsPerEventCount+= "requestsPerEventCount" in params ? params.requestsPerEventCount : 1;
                }
            }
        
            // set maxQueueCount
            maxQueueCount = getMaxQueueCount(requestsPerEventCount);
        
            // restore queueArr from localStorage
            restoreQueue();
            
            // DO NOT USE UNLOAD cause the browser will refresh itself when clicking back to app
            // onunload store queueArr using localStorage
            //window.addEventListener("unload", storeQueue, false);
        }      
    };
    
    /**** PRIVATE METHODS ****/
   
   function onSettingChange(value) {
        if (value) {
            Evme.EventHandler.bind(catchCallback);
        } else {
            Evme.EventHandler.unbind(catchCallback);
        }
    }

    // event handler execution
    function catchCallback(_class, _event, _data) {
        try {
            self[_class] && self[_class][_event] && self[_class][_event](_data || {});
        } catch(ex){
        }
    }
    
    function registerProvider(object, params){
        var provider = new object(self.Sandbox);
        provider.init(params);
        providers.push(provider);
        
        if (provider.immediateDispatch){
            immediateProviders.push(provider);
        }
    }
    
    function getProviderByName(name){
        for (var i=0,len=providers.length; i<len; i++){
            if (name == providers[i].name){
                return providers[i];
            }
        }
    }
    
    function queue(params, immediateDispatch){
        idle.reset();
        processItem(params);
        queueArr.push(params);

        if (immediateDispatch) {
            idle.flush();
        }

        immediateProviders.forEach(function itemIterator(provider){
            provider.dispatch([params]);
        });
    }
    
    function processItem(params){
        !params.data && (params.data = {});
        params.data.sid = options.DoATAPI.getSessionId();
        
        if (!params.data.elapsed && options.sessionObj.timeWritten){
            params.data.elapsed = getElapsedTime(options.sessionObj.timeWritten);
        };
    }
    
    function dispatch(){
        // leave if not idle or there are no items to dispatch
        if (!idle.isIdle || !queueArr.length) {
            return false;
        }
        
        var dispatchedItems = queueArr.splice(0, maxQueueCount);
        
        providers.forEach(function itemIterator(provider){
            !provider.immediateDispatch && provider.dispatch(dispatchedItems);
        });
        queueArr.length && setTimeout(dispatch, options.dispatchDelay)
    }
    
    /* 
     * devide maxQueueCount by number of providers
     * 
       example:
        maxQueueCount = 4, numProviders = 2
        when dispatching, you want no more than 4 http requests transmitted
        which means 2 requests/provider  
     */ 
    function getMaxQueueCount(requestsPerEventCount){
        return options.maxQueueCount;
        // return Math.floor(options.maxQueueCount/requestsPerEventCount);
    }
    
    // Store queueArr in localStorage
    function storeQueue() {
        var str = "", firstFlag = true;
        queueArr.forEach(function itemIterator(item){
            if (!firstFlag){
                str+= "|";
            }
            else{
                firstFlag = false;
            }
            str+= JSON.stringify(item);
        });
        Evme.Storage.set("analyticsQueue", str);
        Evme.Storage.set("analyticsQueueTimestamp", new Date().getTime());
    }
    
    // Restore queueArr from localStorage
    function restoreQueue(){
        if (queueArr.length) {
            return;
        }

        Evme.Storage.get('analyticsQueue', function storageGotQueue(queueFromStorage) {
            if (!queueFromStorage) {
                return;
            }

            Evme.Storage.get('analyticsQueueTimestamp', function storageGotTS(tsFromStorage) {
                // determine time elapsed since queue storage
                var elapsed = Date.now() - parseInt(tsFromStorage, 10);

                // if elapsed time hadn't exceeded ttl
                if (elapsed < options.localStorageTTL) {
                    // restore queue
                    var tempArr = queueFromStorage.split('|');
                    tempArr.forEach(function itemIterator(item){
                        queueArr.push(JSON.parse(item));
                    });
                }

                Evme.Storage.set('analyticsQueue', null);
                Evme.Storage.set('analyticsQueueTimestamp', null);
            });
        });
    }
    
    function loadGAScript(){
        var src = options.googleAnalyticsFile || ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
        
        var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = false;
            ga.src = src;
            ga.onload = onGAScriptLoad;
        var head = document.getElementsByTagName('head')[0]; head.appendChild(ga);
    }
    
    function onGAScriptLoad(){
        if (!options.googleAnalyticsAccount){ return false; }
        
        // create tracker
        var tracker = window._gat._createTracker(options.googleAnalyticsAccount);
        tracker._setDomainName("everything.me");
        setGACustomVars(tracker);
        
        GAScriptLoadStatus = "loaded";
        GAScriptLoadSubscribers.forEach(function itemIterator(cb){
            cb(tracker, options.googleAnalyticsAccount);
        });
    }
    
    function setGACustomVars(tracker){
        var n = Evme.Utils.getUrlParam("n"),
            c = Evme.Utils.getUrlParam("c");
            
        if (n && c) {
            tracker['_setCustomVar'](1, "CampaignTracking", n + ":" + c, 1);
        }
        
        tracker['_setCustomVar'](2, "Native", "false", 1);
        
        var orientation = (Evme.Utils.getOrientation() || {"name": "N/A"}).name || "N/A";
        tracker['_setCustomVar'](4, "Orientation", orientation, 1);
    }
    
    function getElapsedTime(start_ts){
        // calculate difference in ms e.g 2561 
        var d = new Date().getTime() - start_ts;
        // change to seconds with 2 digits after decimal point e.g 2.56
        return parseInt(d / 10, 10) / 100;
    }
    
    function getPageName(pageName) {
        return pageName == "homepage" ? "home" : pageName == "feed" ? "about" : pageName;
    }
    
    function getSearchSource(str) {
        var key = "SUGGESTION";
        switch (str.toLowerCase()) {
            case "history": key = "HISTORY"; break;
            case "refine": key = "REFINE"; break;
            case "didyoumean": key = "SPELLING"; break;
        }
        return options.SEARCH_SOURCES[key];
    }
    
    /**** SANDBOX METHODS ****/
    
    this.Sandbox = new function Sandbox(){
        
        // get DoAT API session Id
        this.getSessionId = function getSessionId(){
            return options.DoATAPI.getSessionId();
        };
        
        // Google Analytics script loader
        this.onGAScriptLoad = function onGAScriptLoad(cb){
            // if not loaded yet
            if (GAScriptLoadStatus !== "loaded"){
                // load it
                if (GAScriptLoadStatus !== "loading"){
                    loadGAScript();
                    GAScriptLoadStatus = "loading"
                }
                
                // add to queue 
                GAScriptLoadSubscribers.push(cb);
            }
            // if already loaded
            else{
                // execute callback
                cb(window._gat, options.googleAnalyticsAccount);
            }
        }
        
        this.DoATAPI = new function DoATAPI(){
            this.report = function report(params){
                options.DoATAPI.report(params);
            };
        };
        
        this.Logger = new function Logger(){
            this.warn = function warn(params){
                options.DoATAPI.Logger.warn(params);
            };
            
            this.error = function error(params){
                options.DoATAPI.Logger.error(params);
            };
            
            this.info = function info(params){
                options.DoATAPI.Logger.info(params);
            };
        };
        
        // not used anymore, remove on next pull-request
        this.isNewSearchQuery = function isNewSearchQuery(newQuery){
      var lastSearchQuery = Evme.Storage.get(STORAGE_QUERY);

      newQuery = newQuery.toLowerCase();

            if (newQuery !== lastSearchQuery){
                Evme.Storage.set(STORAGE_QUERY, newQuery);
                return true;
            }
            return false;
        };
    };
    
    /**** EVENTS ****/
   
    this.DoATAPI = new function DoATAPI(){
        var LOGGER_WARN_SLOW_API_RESPONSE_TIME = 2000,
            LOGGER_WARN_SLOW_API_RESPONSE_TEXT = "Slow API response",
      blacklistMethods = ["logger/", "stats/", "search/bgimage"];
        
        this.success = function success(data){
            // Supress report for blacklist methods
            for (var i=0, len=blacklistMethods.length; i<len; i++){
                var method = blacklistMethods[i];
                if (data.method.toLowerCase().indexOf(method) === 0) { return false; }
            }

            // If it's too long
            if (data.requestDuration >= LOGGER_WARN_SLOW_API_RESPONSE_TIME){
                // construct params
                var params = {
                    "class": "Logger",
                    "event": "warn",
                    "data": {
                        "text": LOGGER_WARN_SLOW_API_RESPONSE_TEXT,
                        "responseTime": data.requestDuration,
                        "method": data.method,
                        "url": data.url,
                        "connectionType": Evme.Utils.connection().name || "",
                        "processingTime": data.response.processingTime || ""
                    }
                };
                
                queue(params);
            }
        };
        
        this.sessionInitOnPageLoad = function sessionInitOnPageLoad(data){
            data.elapsed = getElapsedTime(options.pageRenderStartTs);
            queue({
                "class": "DoATAPI",
                "event": "sessionInitOnPageLoad",
                "data": data
            });
        };

  this.loadmore = function loadmore(data) {
      queue({
    "class": "DoATAPI",
    "event": "loadmore"
      });

      if (Evme.Utils.isKeyboardVisible){
    queue({
        "class": "Results",
        "event": "search",
        "data": {
      "query": data.query,
      "page": "",
      "feature": "more"
        }
    });
      }
  };
    };
    
    this.Analytics = new function Analytics(){
        this.gaEvent = function gaEvent(data){
            var GAEvents = getProviderByName("GAEvents");
            
            GAEvents && GAEvents.dispatch([{
                "class": "event",
                "event": "override",
                "data": {
                    "category": data.args[0],
                    "action": data.args[1],
                    "label": data.args[2],
                    "value": data.args[3]
                }
            }]);
        };
    };
   
    this.Core = new function Core(){
        var ROWS = 1, COLS = 0, redirectData;
           
        this.redirectedToApp = function redirectedToApp(data) {
            var queueData = {
                "url": data.appUrl,
                "more": data.isMore ? 1 : 0,
                "appName": data.name,
                "appId": data.id,
                "appType": data.appType,
                "appIdName": data.id+":"+data.name,
                "keyboardVisible": data.keyboardVisible,
                "query": data.query,
                "source": data.source,
                "rowIndex": data.rowIndex,
                "colIndex": data.colIndex,
                "totalRows": data.totalRows,
                "totalCols": data.totalCols
            };

            queue({
                "class": "Core",
                "event": "redirectedToApp",
                "data": queueData
            }, true); // immediate dispatch
            
            if (queueData.source === options.SEARCH_SOURCES.EMPTY_SEARCHBOX) {
                queue({
                    "class": "Results",
                    "event": "search",
                    "data": {
                        "query": data.query,
                        "page": "FirstHelper",
                        "feature": "appClick"
                    }
                });
            } else  if (queueData.keyboardVisible){
                queue({
                    "class": "Results",
                    "event": "search",
                    "data": {
                        "query": queueData.query,
                        "page": "",
                        "feature": "appClick"
                    }
                }, true);
            }

            redirectData = {
                "blurTime":new Date().getTime(),
                "query": queueData.query,
                "source": queueData.source,
                "url": queueData.url,
                "appName": queueData.appName,
                "appId": queueData.appId
            };
        };
        
        this.returnedFromApp = function returnedFromApp() {

            if (redirectData){
                // end timer
                var focusTime = new Date().getTime(),
                    elapsedTime = focusTime - redirectData["blurTime"];
                    elapsedTime = parseInt(elapsedTime/1000, 10); // convert to seconds
                
                queue({
                    "class": "Core",
                    "event": "returnedFromApp",
                    "data": {
                        "elapsedTime": elapsedTime,
                        "appName": redirectData["appName"],
                        "appId": redirectData["appId"],
                        "query": redirectData["query"],
                        "source": redirectData["source"],
                        "url": redirectData["url"]
                    }
                });
                
                redirectData = undefined;
            }            
        };
        
        this.error = function error(data){
            data.text = "Client error";
            data.ua = navigator.userAgent;
            data.platform = Evme.Utils.platform();
            
            queue({
                "class": "Core",
                "event": "error",
                "data": data
            });
        };
        
        this.initError = function initError(data){
            queue({
                "class": "Core",
                "event": "initError",
                "data": data
            });
        };
        
        this.initLoadFile = function initLoadFile(data){
            queue({
                "class": "Core",
                "event": "initLoadFile",
                "data": data
            });
        };

        this.searchOnPageLoad = function searchOnPageLoad(data){
            if (data.query){
                queue({
                    "class": "Results",
                    "event": "search",
                    "data": {
                        "query": data.query,
                        "feature": "pageLoad",
                        "source": options.PAGEVIEW_SOURCES.URL
                    }
                });
            }
        };
    
        this.firstPageLoad = function firstPageLoad(data){
            data.page = getPageName(data.page);
            
            queue({
                "class": "Url",
                "event": "goTo",
                "data": data
            });
        };
        
        this.requestInvite = function requestInvite(data) {
            queue({
                "class": "Core",
                "event": "requestInvite",
                "data": data
            });
        };
    };
   
    this.Searchbar = new function Searchbar() {
        this.returnPressed = function returnPressed(data) {
            data.query = data.value;
            queue({
                "class": "Searchbar",
                "event": "returnPressed",
                "data": data
            });
            
            queue({
                "class": "Results",
                "event": "search",
                "data": {
                    "query": data.value,
                    "page": "",
                    "feature": "rtrn"
                }
            });
        };
        
        this.idle = function idle(data){
            if (data.query.length > 2){
                queue({
                    "class": "Results",
                    "event": "search",
                    "data": {
                        "query": data.query,
                        "page": "",
                        "feature": "idle"
                    }
                });
            }
        };
    };
    
    this.Shortcuts = new function Shortcuts() {
        this.show = function show(data) {
            if (!data.report) {
                return;
            }
            
            queue({
                "class": "Shortcuts",
                "event": "show",
                "data": data
            });
        };
        
        this.hide = function hide(data) {
            if (!data.report) {
                return;
            }
            
            queue({
                "class": "Shortcuts",
                "event": "hide",
                "data": data
            });
        };
        
        this.categoryPageShow = function categoryPageShow(data) {
            queue({
                "class": "Shortcuts",
                "event": "categoryPageShow",
                "data": data
            });
        };
    };
        
    this.Shortcut = new function Shortcut() {
        this.click = function click(data) {
            queue({
                "class": "Shortcut",
                "event": "click",
                "data": data
            });
        };
        
        this.search = function search(data) {
            queue({
                "class": "Results",
                "event": "search",
                "data": {
                    "query": data.query,
                    "type": data.type || "",
                    "page": "Shortcut",
                    "feature": data.source
                }
            });
        };
    };
    
    this.BackgroundImage = new function BackgroundImage() {
        this.showFullScreen = function showFullScreen(data) {
            queue({
                "class": "BackgroundImage",
                "event": "showFullScreen",
                "data": data
            });
        };
    };
    
    this.Helper = new function Helper() {        
        this.click = function click(data) {
            data.visible = data.visible ? 1 : 0;
            data.query = data.value !== "." ? data.value : "";
            
            if (data.query){
                var classname = data.source || "suggestions";
                data.source = getSearchSource(classname);
                
                queue({
                    "class": classname,
                    "event": "click",
                    "data": data
                });
                
                queue({
                    "class": "Results",
                    "event": "search",
                    "data": {
                        "query": data.query,
                        "page": "",
                        "feature": data.source
                    }
                });
            }
        };
        
        this.showAppsFromFirstSuggestion = function showAppsFromFirstSuggestion(data) {
            queue({
                "class": "Helper",
                "event": "searchFromFirstSuggestion",
                "data": data
            });  
            
            queue({
                "class": "Results",
                "event": "search",
                "data": {
                    "query": data.query,
                    "page": "FirstHelper",
                    "feature": "appClick"
                }
            });
        };
        
        this.showAppsFromDefault = function showAppsFromDefault(data) {
            if (options.Brain.Searchbar.emptySource) {
                
                queue({
                    "class": "Results",
                    "event": "search",
                    "data": {
                        "query": data.query,
                        "feature": options.SEARCH_SOURCES.EMPTY_SEARCHBOX,
                        "source": options.Brain.Searchbar.emptySource
                    }
                });
                options.Brain.Searchbar.emptySource = undefined;
            }
        };
    };
    
    this.Result = new function Result() {
        this.addToHomeScreen = function addToHomeScreen(data) {
            queue({
    "class": "Result",
                "event": "addToHomeScreen",
                "data": data
            });
        };
    };
    
    this.Prompt = new function Prompt() {
        this.show = function show(data) {
            if (!data.text || typeof data.text != "string") {
                data.text = "N/A";
            }
            
            queue({
                "class": "Prompt",
                "event": "show",
                "data": data
            });
        };
        
        this.click = function click(data) {
            if (!data.text || typeof data.text != "string") {
                data.text = "N/A";
            }
            
            queue({
                "class": "Prompt",
                "event": "click",
                "data": data
            });
        };
        
        this.dismiss = function dismiss(data) {
            if (!data.text || typeof data.text != "string") {
                data.text = "N/A";
            }
            
            queue({
                "class": "Prompt",
                "event": "dismiss",
                "data": data
            });
        };
    };
    
    this.CollectionsSuggest = new function CollectionsSuggest() {
        this.show = function show(data) {
            queue({
    "class": "CollectionsSuggest",
                "event": "show",
                "data": data
            });
        };
        
        this.done = function done(data) {
            queue({
    "class": "CollectionsSuggest",
                "event": "done",
                "data": data
            });
        };
    };
}

/*
 * APIStatsEvents class
 */
Evme.APIStatsEvents = function Evme_APIStatsEvents(Sandbox){
    var self = this, config, processedItems, tracker = Sandbox.DoATAPI, tempEventArr = [], templatesStr = "",
        templates = {
            "Results_search": {
                "userEvent": "pageView",
                "page": "searchResults",
                "query": "{query}",
                "type": "{type}",
                "feature": "{feature}",
                "src": "{source}"
            },
      "DoATAPI_loadmore": {
                "userEvent":"loadMore"
            },
            "Core_redirectedToApp": {
                "userEvent": "appClick",
                "url": "{url}",
                "rowIdx": "{rowIndex}",
                "totalRows": "{totalRows}",
                "colIdx": "{colIndex}",
                "totalCols": "{totalCols}",
                "keyboardVisible": "{keyboardVisible}",
                "more": "{more}",
                "appName": "{appName}",
                "appId": "{appId}",
                "appType": "{appType}",
                "query": "{query}",
                "feature": "{source}"
            },
      "Result_addToHomeScreen": {
                "userEvent": "addToHomeScreen",
                "appName": "{name}",
                "appId": "{id}"
            }
        };
        
    this.name = "APIStatsEvents";
    
    this.init = function init(_config){
        // set config
        config = _config;
        
        // add common params
        for (var k in templates){
            templates[k]["sessionId"] = "{sid}";
            templates[k]["elapsed"] = "{elapsed}";
            templates[k]["deviceId"] = Evme.DoATAPI.getDeviceId();
        }
        
        // stringify templates
        templatesStr = stringify(templates);
    };
    
    function stringify(old){
        var temp = {};
        
  for (var key in old){
            var value = old[key];
                value = JSON.stringify(value);
            temp[key] = value;
        }
        
        return temp;
    }
    
    // actual report
    this.dispatch = function dispatch(items){
        // leave if no items
        if (!items.length) { return false;}
        
        // process
        items = process(items);
        
        // report   
        items.length && tracker.report({
            "data": "["+ items.toString()+"]"
        });
    };
    
    function process(items){
        processedItems = [];
        
        // make into an array if not
        if (!(items instanceof Array)){
            items = [items];
        }
        
        // process
        items.forEach(function itemIteration(item){
            
            // authenticate
            if (authenticate(item)) {
                
                // render template
                var template = templatesStr[item["class"]+"_"+item["event"]],
                    data = renderTemplate(template, item["data"]);
                
                data && processedItems.push( data );
            }
        });
        
        return processedItems;
    }    
    
    function authenticate(item){
        var method = item["class"]+"_"+item["event"];
        return method in templates;
    }
    
    // template rendering
    function renderTemplate(str, attrArr) {
        if (str && attrArr) {
            for ( var key in attrArr ) {
                str = str.replace("{" + key + "}", attrArr[key]);
            }
        }
        return str;
    }
}



/*
 * Brain.js
 * A subscriber to all EventHandler published event
 * The glue that sticks all components to one another
 */
Evme.Brain = new function Evme_Brain() {
    var self = this,
        Brain = this,
        _config = {},
        elContainer = null,
        isActive = false,
  DEFAULT_NUMBER_OF_APPS_TO_LOAD = Evme.Config.numberOfAppsToLoad,
  NUMBER_OF_APPS_TO_LOAD_IN_COLLECTION = 16,
        NUMBER_OF_APPS_TO_LOAD = "FROM CONFIG",
        TIME_BEFORE_INVOKING_HASH_CHANGE = 200,
        MINIMUM_LETTERS_TO_SEARCH = 2,
        SEARCH_SOURCES = {},
        PAGEVIEW_SOURCES = {},

        TIMEOUT_BEFORE_REQUESTING_APPS_AGAIN = 500,
        TIMEOUT_BEFORE_SHOWING_DEFAULT_IMAGE = 3000,
        TIMEOUT_BEFORE_SHOWING_HELPER = 3000,
        TIMEOUT_BEFORE_RENDERING_AC = 300,
        TIMEOUT_BEFORE_RUNNING_APPS_SEARCH = 600,
        TIMEOUT_BEFORE_RUNNING_IMAGE_SEARCH = 800,
        TIMEOUT_BEFORE_AUTO_RENDERING_MORE_APPS = 200,

  CLASS_WHEN_EVME_READY = 'evme-ready',
  CLASS_WHEN_HAS_QUERY = 'evme-has-query',
  CLASS_WHEN_COLLECTION_VISIBLE = 'evme-collection-visible',
  CLASS_WHEN_LOADING_SHORTCUTS_SUGGESTIONS = 'evme-suggest-collections-loading',

  L10N_SYSTEM_ALERT = 'alert',

        // whether to show shortcuts customize on startup or not
        ENABLE_FAVORITES_SHORTCUTS_SCREEN = false,

        QUERY_TYPES = {
            "EXPERIENCE": "experience",
            "APP": "app",
            "QUERY": "query"
        },

        DISPLAY_INSTALLED_APPS = "FROM_CONFIG",

  currentResultsManager = null,

        timeoutSetUrlAsActive = null,
        timeoutHashChange = null,
        _ = navigator.mozL10n.get,
        mozL10nTranslate = navigator.mozL10n.translate;

    /*
        Init sequense triggered by Core.js
    */
    this.init = function init(options) {
        // bind to events
        Evme.EventHandler && Evme.EventHandler.bind(catchCallback);
        elContainer = Evme.Utils.getContainer();

        initL10nObserver();

        // init event listeners     
        window.addEventListener('collectionlaunch', function onCollectionLaunch(e){
            Evme.Collection.show(e);
        });
        window.addEventListener('EvmeDropApp', onAppDrop);

  // prevent homescreen contextmenu
  elContainer.addEventListener('contextmenu', function onTouchStart(e) {
      e.stopPropagation();
  });

        _config = options;

        NUMBER_OF_APPS_TO_LOAD = _config.numberOfAppsToLoad || DEFAULT_NUMBER_OF_APPS_TO_LOAD;
  NUMBER_OF_APPS_TO_LOAD_IN_COLLECTION = _config.numberOfAppsToLoad || NUMBER_OF_APPS_TO_LOAD_IN_COLLECTION;

        SEARCH_SOURCES = _config.searchSources;
        PAGEVIEW_SOURCES = _config.pageViewSources;

        DISPLAY_INSTALLED_APPS = _config.displayInstalledApps;
    };

    function onAppDrop(e) {
        var options = e.detail;

        // dropping app on collection
        if (options.app && options.collection) {
            var appId = options.app.id,
                collectionId = options.collection.id;

            Evme.InstalledAppsService.getAppById(appId, function getAppByOrigin(installedApp) {
                if (installedApp) {
                    Evme.Collection.addInstalledApp(installedApp, collectionId);
                }    
            });
        }
    }

    // l10n: create a mutation observer to know when a node was added
    // and check if it needs to be translated
    function initL10nObserver() {
  Array.prototype.forEach.call(Evme.Utils.getScopeElements(), function createObserver(elScope) {
      new MutationObserver(Evme.Brain.l10nMutationObserver)
    .observe(elScope, {
        childList: true,
        subtree: true
    });
  });
    }

    // callback for "node added" mutation observer
    // this translates all the new nodes added
    // the mozL10nTranslate method is defined above, it's a reference to the mozilla l10n function
    this.l10nMutationObserver = function onMutationEventNodeAdded(mutations) {
  for (var i = 0, mutation; mutation = mutations[i++];) {
            var children = mutation.addedNodes || [];
      for (var j = 0, node; node = children[j++];) {
                if (node instanceof HTMLElement) {
                    node && mozL10nTranslate(node);
                }
            }
        }
    }

    /**
     * main event handling method that catches all the events from the different modules,
     * and calls the appropriate method in Brain
     * @_class (string) : the class that issued the event (Apps, Collection, Helper, etc.)
     * @_event (string) : the event that the class sent
     * @_data (object)  : data sent with the event
     */

    function catchCallback(_class, _event, _data) {
        Evme.Utils.log('Callback: ' + _class + '.' + _event);

        try {
            self[_class] && self[_class][_event] && self[_class][_event](_data || {});
  } catch (ex) {
      Evme.Utils.error('CB Error! ' + ex.message, ex.stack);
        }
    }

    /*  EVENT HANDLERS */

    // Core.js
    this.Core = new function Core() {
        var self = this;

        this.init = function init() {
            Searcher.empty();
            Evme.Searchbar.clear();
            Brain.Searchbar.setEmptyClass();
      document.body.classList.add(CLASS_WHEN_EVME_READY);
        };
    };

    // modules/Searchbar/
    this.Searchbar = new function Searchbar() {
        var self = this,
            timeoutBlur = null,
            TIMEOUT_BEFORE_RUNNING_BLUR = 50;

        // Searchbar focused. Keyboard shows
        this.focus = function focus(data) {
            Evme.Utils.setKeyboardVisibility(true);

            Evme.Helper.disableCloseAnimation();
            Evme.Helper.hideTitle();
            if (Evme.Searchbar.getValue() !== "") {
                Evme.Helper.showSuggestions();
            } else {
                Brain.Helper.showDefault();
            }
        };

        // Searchbar blurred. Keyboard hides.
        this.blur = function blur(data) {
            // Gaia bug workaround because of this http://b2g.everything.me/tests/input-blur.html
            if (data && data.e && data.e.stopPropagation) {
                data.e.stopPropagation();
            }

            var didClickApp = false,
                elClicked = data && data.e && data.e.explicitOriginalTarget;
            if (elClicked) {
                for (var elParent = elClicked.parentNode; elParent; elParent = elParent.parentNode) {
                    if (elParent.classList && elParent.classList.contains('evme-apps')) {
                        didClickApp = true;
                        break;
                    }
                }
            }

            Evme.Utils.setKeyboardVisibility(false);
            self.setEmptyClass();

            var searchbarValue = Evme.Searchbar.getValue();
            if (searchbarValue === "") {
                Evme.Helper.setTitle();
                Evme.Helper.showTitle();
            } else if (didClickApp) {
                Evme.Searchbar.setValue(searchbarValue);
                Evme.Helper.setTitle(searchbarValue);
                Evme.Helper.showTitle();
            }

      if (!didClickApp && Evme.shouldSearchOnInputBlur) {
                window.clearTimeout(timeoutBlur);
                timeoutBlur = window.setTimeout(function autoReturn() {
        self.returnPressed(true);
                }, TIMEOUT_BEFORE_RUNNING_BLUR);
            }
        };

        this.onfocus = this.focus;
        this.onblur = this.blur;

        // Searchbar value is empty
        this.empty = function empty(data) {
            Searcher.cancelRequests();
            self.emptySource = (data && data.pageviewSource) || (data.sourceObjectName === "Searchbar" && PAGEVIEW_SOURCES.CLEAR);
            Searcher.empty();

            self.setEmptyClass();

            Evme.DoATAPI.cancelQueue();
            Evme.ConnectionMessage.hide();
        };

        // Searchbar was cleared
        this.clear = function clear(e) {
            Searcher.cancelRequests();
      Evme.SearchResults.clear();
            Evme.Helper.setTitle();
            Brain.Helper.showDefault();
        };

        // Keyboard action key ("search") pressed
        this.returnPressed = function returnPressed(isFromBlur) {
      var query = Evme.Searchbar.getValue();
      isFromBlur = isFromBlur === true;

            if (query) {
    Searcher.searchExactFromOutside(query, SEARCH_SOURCES.RETURN_KEY);
            }
        };

        // toggle classname when searchbar is empty
        this.setEmptyClass = function setEmptyClass() {
            var query = Evme.Searchbar.getValue();
      if (!query) {
                elContainer.classList.add("empty-query");
    document.body.classList.remove(CLASS_WHEN_HAS_QUERY);
      } else {
    elContainer.classList.remove("empty-query");
    document.body.classList.add(CLASS_WHEN_HAS_QUERY);
            }
        };

        // if an event was captured - cancel the blur timeout
        this.cancelBlur = function cancelBlur() {
            window.clearTimeout(timeoutBlur);
        };

        // clear button was clicked
        this.clearButtonClick = function clearButtonClick(data) {
            self.cancelBlur();
            Evme.Searchbar.focus();
        };

        // searchbar value changed
        this.valueChanged = function valueChanged(data) {
            if (data.value) {
                Searcher.searchAsYouType(data.value, SEARCH_SOURCES.TYPING);
            }

            self.setEmptyClass();
            Evme.Helper.hideTitle();
        };

        // Searchbar is focused but no action is taken
        this.idle = function idle(data) {

        };

        // User paused for a slight time when typing
        this.pause = function pause(data) {
            var suggestions = Evme.Helper.getData().suggestions || [];
            if (suggestions.length === 0) {
                return;
            }

            var typedQuery = Evme.Searchbar.getValue(),
                suggestionsQuery = Evme.Helper.getSuggestionsQuery(),
                firstSuggestion = suggestions[0].replace(/[\[\]]/g, "");

            if (typedQuery === suggestionsQuery) {
                Searcher.searchExactAsYouType(firstSuggestion, typedQuery);
            }
        };
    };

    // modules/SearchHistory/
    this.SearchHistory = new function SearchHistory() {

        // items were loaded from the cache
        this.populate = function populate() {
            Evme.Brain.Helper.showDefault();
        };
    };

    // modules/Helper/
    this.Helper = new function Helper() {
        var self = this,
            cleared = false,
            refineQueryShown = "",
            flashCounter = 0,
            previousFirstSuggestion = "",
            SEARCHES_BEFORE_FLASHING_HELPER = 4,
            TIMEOUT_ANDROID_BEFORE_HELPER_CLICK = 500;

        var sourcesMap = {
            "suggestions": SEARCH_SOURCES.SUGGESTION,
            "didyoumean": SEARCH_SOURCES.SPELLING,
            "refine": SEARCH_SOURCES.REFINE,
            "history": SEARCH_SOURCES.HISTORY
        };

        // items loaded
        this.load = function load(data) {
            refineQueryShown = "";
        };

        // helper item was selected
        this.click = function click(data) {
            var query = data.value,
                index = data.index,
                source = data.source || "suggestions",
                type = data.type;

            if (query == ".") {
                query = Evme.Searchbar.getValue();
            }

            Evme.Helper.enableCloseAnimation();
            Evme.Helper.setTitle(query);
            window.setTimeout(Evme.Helper.showTitle, 0);

            Searcher.searchExactFromOutside(query, sourcesMap[source], index, type);
        };

        // Items were cleared
        this.clear = function clear() {
            if (!cleared) {
                cleared = true;
                self.showDefault();
            }
        };

        // slide items in
        this.animateDefault = function animateDefault() {
      Evme.Helper.animateLeft(function onAnimationComplete() {
                self.showDefault();
                Evme.Helper.animateFromRight();
            });
        };

        // transition to default items
        this.showDefault = function showDefault() {
            Evme.BackgroundImage.loadDefault();

            if (Evme.Searchbar.getValue() == "" && !Evme.Utils.isKeyboardVisible) {
                Evme.Helper.setTitle();
                Evme.Helper.showTitle();
            } else {
                self.loadHistory();
            }
        };

        // transition to history items
        this.animateIntoHistory = function animateIntoHistory(history) {
            if (!history || history.length > 0) {
    Evme.Helper.animateLeft(function onAnimationComplete() {
                    self.loadHistory(history);
                    Evme.Helper.animateFromRight();
                });
            }
        };

        // load history items
        this.loadHistory = function loadHistory(history) {
            history = history || Evme.SearchHistory.get();

            if (history && history.length > 0) {
                var items = [];
    for (var i = 0, l = history.length; i < l; i++) {
                    items.push({
                        "id": history[i].type,
                        "type": history[i].type,
                        "name": history[i].query
                    });
                }

                Evme.Helper.loadHistory(items);
                Evme.Helper.showHistory();
            }
        };

        // Show disambiguation items
        this.showRefinement = function showRefinement(data) {
            var types = data.data;
            var query = Searcher.getDisplayedQuery();

            if (refineQueryShown != query) {
                Evme.DoATAPI.getDisambiguations({
                    "query": query
                }, function onSuccess(data) {
                    if (data.errorCode != Evme.DoATAPI.ERROR_CODES.SUCCESS) {
                        return;
                    }

                    var types = data.response;
                    if (types) {
                        Evme.Helper.loadRefinement(types);
                        Evme.Helper.showRefinement();
                        refineQueryShown = query;
                    }
                });
            }
        };

        // display hepler
        this.show = function show(data) {
            var items = data.data,
                type = data.type;

            cleared = false;

            Evme.Helper.getList().classList.remove("default");

            if (type !== "refine") {
                refineQueryShown = "";
            }

            switch (type) {
                case "":
                    var history = Evme.SearchHistory.get() || [];
                    if (history && history.length > 0) {
      Evme.Helper.addLink('history-link', function onLinkAdded() {
                            self.animateIntoHistory(history);
                        });
                    }
                    break;
                case "refine":
                    if (refineQueryShown == Searcher.getDisplayedQuery()) {
                        if (items.length == 1) {
                            Evme.Helper.addText('no-refine');
                        }

                        Evme.Helper.addLink('dismiss', didyoumeanClick);
                    }
                    break;

                case "didyoumean":
                    Evme.Helper.addLink('dismiss', didyoumeanClick);
                    break;

                case "history":
        Evme.Helper.addLink('history-clear', function historyclearClick(e) {
                        Evme.SearchHistory.clear();

                        if (Evme.Searchbar.getValue()) {
                            Evme.Helper.showSuggestions();
                        } else {
                            Evme.Helper.clear();
                        }
                    });

                    break;
            }
        };

        // Spelling correction item click

        function didyoumeanClick(e) {
            e && e.stopPropagation();
            e && e.preventDefault();

      setTimeout(Evme.Utils.isKeyboardVisible ? Evme.Helper.showSuggestions : Evme.Helper.showTitle, TIMEOUT_ANDROID_BEFORE_HELPER_CLICK);
        }
    };

    // modules/Location/
    this.Location = new function Location() {
        var self = this,
            CLASS_REQUESTING = 'requesting-location';

        // Location is being requested
        this.request = function request() {
            elContainer.classList.add(CLASS_REQUESTING);
        };

        // location retrieved successfully
        this.success = function success(data) {
            elContainer.classList.remove(CLASS_REQUESTING);

            var coords = data && data.position && data.position.coords,
                lat = coords && coords.latitude,
                lon = coords && coords.longitude;

            if (lat && lon) {
                Evme.DoATAPI.setLocation(lat, lon);
            }
        };

        // location request error has occured
        this.error = function error(data) {
            elContainer.classList.remove(CLASS_REQUESTING);

            var s = [];
            for (var k in data) {
                s.push(k + ': ' + data[k]);
            }
            Evme.Utils.log('{' + s.join('},{') + '}');
        };
    };

    // modules/Results/ResultManager
    this.ResultManager = new function ResultManager() {
  // get missing icons
  this.requestMissingIcons = function requestMissingIcons(ids) {
      var format = Evme.Utils.ICONS_FORMATS.Large;

      requestIcons = Evme.DoATAPI.icons({
    "ids": ids.join(","),
    "iconFormat": format
      }, function onSuccess(data) {
    var icons = data.response || [];
    if (icons.length) {
        currentResultsManager && currentResultsManager.cbMissingIcons(icons);
        Evme.IconManager.addIcons(icons, format);
                }
            });
  };
    };

    // modules/Results/ResultManager instance
    this.SearchResults = new function SearchResults() {
        var bShouldGetHighResIcons = false;

        // init sequence ended
        this.init = function init() {
            bShouldGetHighResIcons = Evme.Utils.getIconsFormat() == Evme.Utils.ICONS_FORMATS.Large;
      currentResultsManager = Evme.SearchResults;
        };

        // app list has scrolled to top
        this.scrollTop = function scrollTop() {
            Evme.BackgroundImage.showFullScreen();
        };

        // app list has scrolled to bottom
        this.scrollBottom = function scrollBottom() {
            Searcher.loadMoreApps();
        };

        this.clearIfHas = function clearIfHas() {
      var hadApps = Evme.SearchResults.clear();
            if (!hadApps) {
                return false;
            }

            Evme.Searchbar.setValue('', true);
            return true;
        }
    };

    // modules/Results/ResultManager instance
    this.CollectionResults = new function CollectionResults() {
  // propogate events to Collection
  // TODO: this is temporary.
  this.scrollTop = function scrollTop() {
      Evme.EventHandler.trigger("Collection", "scrollTop");
        };

  this.scrollBottom = function scrollBottom() {
      Evme.EventHandler.trigger("Collection", "scrollBottom");
        };
    }

    this.InstalledAppsService = new function InstalledAppsService() {
  // get app info from API
  this.requestAppsInfo = function getAppsInfo(guids) {
      Evme.DoATAPI.appNativeInfo({
    "guids": guids
      }, function onSuccess(response) {
    var appsInfo = response && response.response;
    if (appsInfo) {
        Evme.InstalledAppsService.requestAppsInfoCb(appsInfo);
    }
      });
  };

  this.queryIndexUpdated = function queryIndexUpdated() {
      Evme.Collection.onQueryIndexUpdated();
        };
    };

    // modules/Apps/
    this.Result = new function Result() {
        var self = this,
      NAME = "Result",
            isKeyboardOpenWhenClicking = false,
            loadingApp = null,
            loadingAppAnalyticsData,
            loadingAppId = false;

        var STORAGE_KEY_CLOSE_WHEN_RETURNING = "needsToCloseKeyboard";

  var cloudAppMenu = document.querySelector('.cloud-app-actions'),
      actionsButtons = Evme.$('button', cloudAppMenu),
      currentHoldData = null;

  for (var i = 0, button; button = actionsButtons[i++];) {
      button.addEventListener('click', function cloudAppAction(e) {
    if (this.dataset.action === "pin") {
        pinToCollection(currentHoldData);
    } else if (this.dataset.action === "save") {
        saveToHomescreen(currentHoldData);
    }
    closeCloudAppMenu();
      });
  }

        // app pressed and held
        this.hold = function hold(data) {
      currentHoldData = data;

      if (data.app.type === Evme.RESULT_TYPE.CLOUD) {
    if (Evme.Collection.isOpen()) {
        Evme.Collection.toggleEditMode(false);
        openCloudAppMenu(data);
    } else {
        saveToHomescreen(data, true);
    }
      } else if (data.app.type === Evme.RESULT_TYPE.INSTALLED && !Evme.Collection.editMode) {
    Evme.Collection.toggleEditMode(true);
      }
  };

  this.remove = function remove(data) {
      var id = data.id;
      if (id) {
    Evme.Collection.removeResult(data);
      }
  };

  function openCloudAppMenu(data) {
      cloudAppMenu.classList.add('show');
  }

  function closeCloudAppMenu(data) {
      cloudAppMenu.classList.remove('show');
  }

  function pinToCollection(data) {
      var cloudResult = data.app;
      Evme.Collection.addCloudApp(cloudResult);
  }

  function saveToHomescreen(data, showConfirm) {
      var isAppInstalled = EvmeManager.isAppInstalled(data.app.getFavLink());

            if (isAppInstalled) {
    window.alert(Evme.Utils.l10n(L10N_SYSTEM_ALERT, 'app-install-exists', {
        'name': data.data.name
    }));
                return;
            }

      if (showConfirm) {
    var msg = Evme.Utils.l10n(L10N_SYSTEM_ALERT, 'app-install-confirm', {
        'name': data.data.name
    });
    if (!window.confirm(msg)) {
        return;
    }
            }

            // get icon data
            var appIcon = Evme.Utils.formatImageData(data.app.getIcon());
            // make it round
      Evme.Utils.getRoundIcon({
    "src": appIcon
      }, function onIconReady(roundedAppIcon) {
                // bookmark - add to homescreen
                Evme.Utils.sendToOS(Evme.Utils.OSMessages.APP_INSTALL, {
                    'originUrl': data.app.getFavLink(),
                    'title': data.data.name,
                    'icon': roundedAppIcon,
                    'useAsyncPanZoom': data.app.isExternal()
                });
                // display system banner
                Evme.Banner.show('app-install-success', {
                    'name': data.data.name
                });

    // analytics
    Evme.EventHandler.trigger(NAME, "addToHomeScreen", {
                    "id": data.data.id,
                    "name": data.data.name
                });
            });
  }

        // app clicked
        this.click = function click(data) {
      if (Evme.Collection.editMode) {
    Evme.Collection.toggleEditMode(false);
    return;
      }

      if (!Searcher.isLoadingApps() || Evme.Utils.isKeyboardVisible) {
                data.keyboardVisible = Evme.Utils.isKeyboardVisible ? 1 : 0;
                var query = Searcher.getDisplayedQuery();

    data.isCollection = !query;

                if (!Searcher.searchedExact()) {
        if (!data.isCollection) {
                        Evme.Storage.set(STORAGE_KEY_CLOSE_WHEN_RETURNING, true);

      Evme.Searchbar.setValue(data.app.type === Evme.RESULT_TYPE.INSTALLED ? data.data.name : Searcher.getDisplayedQuery(), false, true);

                        Evme.Searchbar.blur();
                        Brain.Searchbar.cancelBlur();
                    }

        window.setTimeout(function onTimeout() {
                        self.animateAppLoading(data);
                    }, 50);
                } else {
                    Evme.Storage.set(STORAGE_KEY_CLOSE_WHEN_RETURNING, false);
                    self.animateAppLoading(data);
                }
            }
        };

        // returns if app is currently loading
        this.isLoadingApp = function isLoadingApp() {
            return loadingApp;
        };

        // animate icon position after click
        this.animateAppLoading = function animateAppLoading(data) {
            Searcher.cancelRequests();

            loadingApp = data.app;
            loadingAppId = data.data.id;
            loadingAppAnalyticsData = {
                "index": data.index,
                "keyboardVisible": data.keyboardVisible,
                "isMore": data.isMore,
                "appUrl": data.app.getLink(),
                "favUrl": data.app.getFavLink(),
                "name": data.data.name,
    "appType": data.app.type === Evme.RESULT_TYPE.CLOUD ? "cloud" : data.app.type,
    "isExternal": loadingApp.isExternal(),
                "query": Searcher.getDisplayedQuery(),
                "source": Searcher.getDisplayedSource(),
                "icon": data.data.icon,
                "entryPoint": data.data.entryPoint
            };

      var appId;
      switch (data.app.type) {
    case Evme.RESULT_TYPE.CLOUD:
        appId = data.appId;
        break;
    case Evme.RESULT_TYPE.WEBLINK:
        appId = 0;
        break;
    default:
        appId = -1;
            }
      loadingAppAnalyticsData.id = appId;

      if (currentResultsManager) {
    var grid = currentResultsManager.getResultGridData(data.app);
    loadingAppAnalyticsData.totalRows = grid.rows;
    loadingAppAnalyticsData.totalCols = grid.cols;
    loadingAppAnalyticsData.rowIndex = grid.rowIndex;
    loadingAppAnalyticsData.colIndex = grid.colIndex;
      }
      Evme.EventHandler.trigger("Core", "redirectedToApp", loadingAppAnalyticsData);

      setTimeout(returnFromOutside, 2000);
        };

        function updateLoadingAppData(apps) {
      for (var i = 0; i < apps.length; i++) {
                if (apps[i].id == loadingAppId) {
                    loadingApp.update(apps[i]);
                    loadingAppAnalyticsData.appUrl = apps[i].appUrl;
                    break;
                }
            }
        }

        // returned from opened app

        function returnFromOutside() {
            if (loadingApp) {
                loadingApp = null;

                loadingAppAnalyticsData = null;
                loadingAppId = false;

                Searcher.clearTimeoutForShowingDefaultImage();
                Evme.$remove("#loading-app");
                Evme.BackgroundImage.cancelFullScreenFade();
                elContainer.classList.remove("loading-app");

                Evme.Storage.get(STORAGE_KEY_CLOSE_WHEN_RETURNING, function storageGot(value) {
                    if (value) {
                        Searcher.searchAgain(null, Evme.Searchbar.getValue());
                    }

                    Evme.Storage.remove(STORAGE_KEY_CLOSE_WHEN_RETURNING);
                });

                Evme.EventHandler.trigger("Core", "returnedFromApp");
            }
        }

        this.cancel = function app_cancel() {
      returnFromOutside();
        }
    };

    // modules/BackgroundImage/
    this.BackgroundImage = new function BackgroundImage() {
        // show
        this.showFullScreen = function showFullScreen() {
            elContainer.classList.add("fullscreen-bgimage");
        };

        // hide
        this.hideFullScreen = function hideFullScreen() {
            elContainer.classList.remove("fullscreen-bgimage");
        };

  this.updated = function updated(data) {
      if (data && data.image) {
    Evme.SearchResults.changeFadeOnScroll(true);
      }
  };

  this.removed = function removed() {
      Evme.SearchResults.changeFadeOnScroll(false);
  };
    };

    // modules/Collection/
    this.Collection = new function Collection() {
        var self = this,
      appsPaging = null,
      requestCollectionApps = null,
      requestCollectionImage = null,
            timeoutShowAppsLoading = null;

  // a collection is shown
  this.show = function show(data) {
      document.getElementById('icongrid').classList.add(CLASS_WHEN_COLLECTION_VISIBLE);
      window.setTimeout(loadAppsIntoCollection, 600);
      currentResultsManager = Evme.CollectionResults;
        };

  // hiding the collection
        this.hide = function hide() {
      document.getElementById('icongrid').classList.remove(CLASS_WHEN_COLLECTION_VISIBLE);
      Evme.Brain.Collection.cancelRequests();
            Evme.ConnectionMessage.hide();

      currentResultsManager = Evme.SearchResults;
        };

  // cancel the current outgoing collection requests
        this.cancelRequests = function cancelRequests() {
      Evme.CollectionResults.APIData.onRequestCanceled();
      requestCollectionApps && requestCollectionApps.abort && requestCollectionApps.abort();
      requestCollectionImage && requestCollectionImage.abort && requestCollectionImage.abort();
        };

  // a collection was renamed
  this.rename = function rename(data) {
      loadAppsIntoCollection();
        };

  // load the cloud apps into the collection

  function loadAppsIntoCollection() {
      if (!Evme.Collection.isOpen()) return;

      var experienceId = Evme.Collection.getExperience(),
    query = Evme.Collection.getQuery(),
    iconsFormat = Evme.Utils.getIconsFormat();

      appsPaging = {
    "offset": 0,
    "limit": NUMBER_OF_APPS_TO_LOAD_IN_COLLECTION
      };

      Evme.CollectionResults.APIData.onRequestSent();

      requestCollectionApps = Evme.DoATAPI.search({
    "query": experienceId ? '' : query,
                "experienceId": experienceId,
    "feature": SEARCH_SOURCES.SHORTCUT_COLLECTION,
                "exact": true,
                "spellcheck": false,
                "suggest": false,
    "limit": appsPaging.limit,
    "first": appsPaging.offset,
                "iconFormat": iconsFormat
            }, function onSuccess(data) {
    Evme.CollectionResults.APIData.onResponseRecieved(data.response);

    requestCollectionApps = null;

    Evme.Location.updateIfNeeded();
            });

      loadBGImage();
        };

  function loadBGImage() {
      if (!Evme.Collection.isOpen()) return;
      if (Evme.Collection.userSetBg()) return;

      var query = Evme.Collection.getQuery();

      requestCollectionImage = Evme.DoATAPI.bgimage({
    "query": query,
    "feature": SEARCH_SOURCES.SHORTCUT_COLLECTION,
    "exact": true,
    "width": screen.width,
    "height": screen.height
      }, function onSuccess(data) {
    Evme.Collection.setBackground({
        "image": Evme.Utils.formatImageData(data.response.image),
        "query": query,
        "source": data.response.source,
        "setByUser": false
    });

    requestCollectionImage = null;
            });
        };

  // app list has scrolled to top
  this.scrollTop = function scrollTop() {
      Evme.Collection.showFullscreen();

      // TODO: FIXME This is temporary.
      // BackgroundImage should be an instance used in parallel to ResultsManager
      Evme.BackgroundImage.cancelFullScreenFade();
        };

  // load more apps in collection
  this.scrollBottom = function scrollBottom() {
      if (!Evme.Collection.isOpen()) return;

      appsPaging.offset += appsPaging.limit;

      if (requestCollectionApps) {
    return;
            }

      Evme.CollectionResults.APIData.onRequestSent();

      var experienceId = Evme.Collection.getExperience(),
    query = Evme.Collection.getQuery(),
    iconsFormat = Evme.Utils.getIconsFormat();

      requestCollectionApps = Evme.DoATAPI.search({
    "query": experienceId ? '' : query,
    "experienceId": experienceId,
    "feature": SEARCH_SOURCES.SHORTCUT_COLLECTION,
    "exact": true,
    "spellcheck": false,
    "suggest": false,
    "limit": appsPaging.limit,
    "first": appsPaging.offset,
    "iconFormat": iconsFormat
      }, function onSuccess(data) {
    Evme.CollectionResults.APIData.onResponseRecieved(data.response);

    requestCollectionApps = null;
      });
        };
    };

    // modules/CollectionsSuggest/
    this.CollectionsSuggest = new function CollectionsSuggest() {
        var self = this,
            isRequesting = false,
            isFirstShow = true,
            requestSuggest = null,
            isOpen = false;

        this.show = function show() {
            isOpen = true;
        };

        this.hide = function hide() {
      Evme.CollectionsSuggest.Loading.hide();
            isOpen = false;
        };

  this.loadingShow = function loadingShow() {
      document.body.classList.add(CLASS_WHEN_LOADING_SHORTCUTS_SUGGESTIONS);
  };

  this.loadingHide = function loadingHide() {
      document.body.classList.remove(CLASS_WHEN_LOADING_SHORTCUTS_SUGGESTIONS);
  };

        this.hideIfOpen = function hideIfOpen() {
            if (isOpen) {
    Evme.CollectionsSuggest.hide();
                return true;
            }

            return false;
        };

        this.hideIfRequesting = function hideIfRequesting() {
            if (isRequesting) {
                self.loadingCancel();
                return true;
            }

            return false;
        };

        this.isOpen = function _isOpen() {
            return isOpen;
        };

        // done button clicked
        this.done = function done(data) {
            if (data.shortcuts && data.shortcuts.length > 0) {
    self.addShortcuts(data.shortcuts);
      }
  };

  this.custom = function custom(data) {
      if (!data || !data.query) {
    return;
      }

      // create the collection (even if offline), then update with icons
      var query = data.query;
      Evme.Collection.create({
    "query": query,
    "callback": updateShortcutIcons
      });

      function updateShortcutIcons(collectionSettings) {
    Evme.DoATAPI.Shortcuts.get({
        "queries": JSON.stringify([query]),
        "_NOCACHE": true
    }, function onShortcutsGet(response) {
        var shortcut = response.response.shortcuts[0],
      shortcutIconsMap = {};

        shortcut.appIds.forEach(function getIcon(appId) {
      shortcutIconsMap[appId] = response.response.icons[appId];
        });

        Evme.Utils.roundIconsMap(shortcutIconsMap, function onRoundedIcons(iconsMap) {
      var extraIconsData = shortcut.appIds.map(function wrapIcon(appId) {
          return {"id": appId, "icon": iconsMap[appId]};
      });

      Evme.Collection.update(collectionSettings, {
          "extraIconsData": extraIconsData
      });
        });
                });
            }
        };

  // this gets a list of queries and creates shortcuts
  this.addShortcuts = function addShortcuts(shortcuts) {
      if (!Array.isArray(shortcuts)) {
    shortcuts = [shortcuts];
      }

      var queries = [];
      for (var i = 0, shortcut; shortcut = shortcuts[i++];) {
    queries.push(shortcut.query);
      }

      // get the query's apps (icons)
      Evme.DoATAPI.Shortcuts.get({
    "queries": JSON.stringify(queries),
    "_NOCACHE": true
      }, function onShortcutsGet(response) {
    var shortcuts = response.response.shortcuts,
        iconsMap = response.response.icons;

    // first we need to round the icons
    Evme.Utils.roundIconsMap(iconsMap, function onRoundedIcons(roundedIconsMap){
        for (var i = 0, shortcut; shortcut = shortcuts[i++];) {
      var extraIconsData = shortcut.appIds.map(function wrapIcon(appId) {
          return {"id": appId, "icon": roundedIconsMap[appId]};
      });

      Evme.Collection.create({
          "extraIconsData": extraIconsData,
          "query": shortcut.query
      });
        }
    });

      });
  };


        // prepare and show
        this.showUI = function showUI() {
            if (isRequesting) return;

            isRequesting = true;

            Evme.Utils.isOnline(function(isOnline) {
                if (!isOnline) {
                    window.alert(Evme.Utils.l10n(L10N_SYSTEM_ALERT, 'offline-shortcuts-more'));
                    window.setTimeout(function() {
                        isRequesting = false;
                    }, 200);

                    return;
                }

    Evme.CollectionsSuggest.Loading.show();

    Evme.CollectionStorage.getAllCollections(function onCollections(collections) {
        var existingCollectionsQueries = [];
        for (var i = 0, collection; collection = collections[i++];) {
      existingCollectionsQueries.push(collection.query);
                    }

                    // load suggested shortcuts from API
                    requestSuggest = Evme.DoATAPI.Shortcuts.suggest({
      "existing": existingCollectionsQueries
                    }, function onSuccess(data) {
                        var suggestedShortcuts = data.response.shortcuts || [],
                            icons = data.response.icons || {};

      if (!isRequesting) {
          return;
                        }

                        isFirstShow = false;
                        isRequesting = false;

                        if (suggestedShortcuts.length === 0) {
          window.alert(Evme.Utils.l10n(L10N_SYSTEM_ALERT, 'no-more-shortcuts'));
          Evme.CollectionsSuggest.Loading.hide();
                        } else {
          Evme.CollectionsSuggest.load({
        "shortcuts": suggestedShortcuts,
        "icons": icons
          });

          Evme.CollectionsSuggest.show();
          // setting timeout to give the select box enough time to show
          // otherwise there's visible flickering
          window.setTimeout(Evme.CollectionsSuggest.Loading.hide, 300);
                        }
                    });
                });
            });
        };

        // cancel button clicked
        this.loadingCancel = function loadingCancel(data) {
            data && data.e.preventDefault();
            data && data.e.stopPropagation();

            requestSuggest && requestSuggest.abort && requestSuggest.abort();
      window.setTimeout(Evme.CollectionsSuggest.Loading.hide, 50);
            isRequesting = false;
        };
    };

    // modules/Features/Features.js
    this.Features = new function Features() {
  // called when a feature state is changed
  this.set = function set(data) {
      var featureName = data.featureName,
    isEnabled = data.newValue;

      if (!isEnabled) {
    if (featureName === 'typingApps') {
        Searcher.cancelSearch();
        Evme.SearchResults.clear();

        // if there are no icons, we also disable images
        // no point in showing background image without apps
        Evme.Features.disable('typingImage');
    }
    if (featureName === 'typingImage') {
        Searcher.cancelImageSearch();
        Evme.BackgroundImage.loadDefault();
    }
      } else {
    if (featureName === 'typingImage') {
        Evme.Features.enable('typingApps');
    }
      }
  };
    };

    // helpers/Utils.Connection
    this.Connection = new function Connection() {
  // upon going online
        this.online = function online() {
            Evme.ConnectionMessage.hide();
            Evme.DoATAPI.backOnline();
        };
    };

    // helpers/IconManager
    this.IconManager = new function IconManager() {
  // icon added to cache
  this.iconAdded = function iconAdded(icon) {
      Evme.DoATAPI.CachedIcons.add(icon);
  };
    };

    // api/DoATAPI.js
    this.DoATAPI = new function DoATAPI() {
        // a request was made to the API
        this.request = function request(data) {
      Evme.Utils.log("DoATAPI.request " + data.url);
        };

        this.cantSendRequest = function cantSendRequest(data) {
      Searcher.cancelRequests();

      if (currentResultsManager && data.method === 'Search/apps') {
    var query = Evme.Searchbar.getElement().value || Evme.Collection.getQuery() || '',
        textKey = currentResultsManager.hasResults() ? 'apps-has-installed' : 'apps';

    Evme.ConnectionMessage.show(textKey, {
        'query': query
    });
            }
        };

        // an API callback method had en error
        this.clientError = function onAPIClientError(data) {
      Evme.Utils.error('API Client Error: ' + data.exception.message, data.exception.stack);
        };

        // an API callback method had en error
        this.error = function onAPIError(data) {
      Evme.Utils.error('API Server Error: ' + JSON.stringify(data.response));
        };

        // user location was updated
        this.setLocation = function setLocation(data) {
            // TODO in the future, we might want to refresh results
            // to reflect accurate location.
            // but for now only the next request will use the location
        };
    };

    // Searcher object to handle all search events
    this.Searcher = new function _Searcher() {
        var appsCurrentOffset = 0,
            lastSearch = {},
            lastQueryForImage = "",
            hasMoreApps = false,
            autocompleteCache = {},
      lastRequestAppsTime = 0,

            requestSearch = null,
            requestImage = null,
            requestIcons = null,
            requestAutocomplete = null,

            timeoutShowDefaultImage = null,
            timeoutHideHelper = null,
            timeoutSearchImageWhileTyping = null,
            timeoutSearch = null,
            timeoutSearchWhileTyping = null,
            timeoutAutocomplete = null,
            timeoutShowAppsLoading = null;

        function resetLastSearch(bKeepImageQuery) {
            lastSearch = {
                "query": "",
                "exact": false,
                "type": "",
                "offset": false,
                "source": ""
            };

            if (!bKeepImageQuery) {
                lastQueryForImage = "";
            }
        }
        resetLastSearch();

        this.isLoadingApps = function isLoadingApps() {
            return requestSearch;
        };

        this.getApps = function getApps(options) {
            var query = options.query,
                type = options.type,
                source = options.source,
                index = options.index,
                reloadingIcons = options.reloadingIcons,
                exact = options.exact || false,
                iconsFormat = options.iconsFormat,
                offset = options.offset,
                onlyDidYouMean = options.onlyDidYouMean,
    callback = options.callback || function() {};

            Evme.Searchbar.startRequest();

            var removeSession = reloadingIcons;
      var prevQuery = removeSession ? "" : lastSearch.query;
            var getSpelling = (source !== SEARCH_SOURCES.SUGGESTION && source !== SEARCH_SOURCES.REFINE && source !== SEARCH_SOURCES.SPELLING);

            if (exact && appsCurrentOffset === 0) {
                window.clearTimeout(timeoutHideHelper);

                if (!onlyDidYouMean) {
                    if (!options.automaticSearch) {
      var urlOffset = appsCurrentOffset + NUMBER_OF_APPS_TO_LOAD;
                        if (urlOffset == NUMBER_OF_APPS_TO_LOAD && NUMBER_OF_APPS_TO_LOAD == DEFAULT_NUMBER_OF_APPS_TO_LOAD) {
                            urlOffset = 0;
                        }

                        Evme.SearchHistory.save(query, type);
                    }

                    timeoutHideHelper = window.setTimeout(Evme.Helper.showTitle, TIMEOUT_BEFORE_SHOWING_HELPER);
                }
            }

            iconsFormat = Evme.Utils.getIconsFormat();

            // override icons format according to connection
            if (!Evme.Features.isOn('iconQuality')) {
    iconsFormat = Evme.Utils.ICONS_FORMATS.Small;
    Evme.Features.startTimingFeature('iconQuality', Evme.Features.ENABLE);
            } else {
    Evme.Features.startTimingFeature('iconQuality', Evme.Features.DISABLE);
            }

      options.iconsFormat = iconsFormat;

            Searcher.cancelSearch();

      // set timer for progress indicator
      Evme.SearchResults.APIData.onRequestSent();

      // triggers installed provider search
      Evme.SearchResults.onNewQuery({
    "query": Evme.Searchbar.getValue()
            });

      if (!exact && query.length < MINIMUM_LETTERS_TO_SEARCH) {
    Searcher.cancelRequests();
    return;
            }

      var requestAppsTime = Date.now();
      lastRequestAppsTime = requestAppsTime;
      requestSearch = Evme.DoATAPI.search({
    "query": query,
    "typeHint": type,
    "index": index,
    "feature": source,
    "exact": exact,
    "spellcheck": getSpelling,
    "suggest": !onlyDidYouMean,
    "limit": NUMBER_OF_APPS_TO_LOAD,
    "first": appsCurrentOffset,
    "iconFormat": iconsFormat,
    "prevQuery": prevQuery
      }, function onSuccess(data) {
    getAppsComplete(data, options, requestAppsTime);
    requestSearch = null;

    // only try to refresh location of it's a "real" search- with keyboard down
    if (exact && appsCurrentOffset === 0 && !Evme.Utils.isKeyboardVisible) {
        Evme.Location.updateIfNeeded();
                }
      }, removeSession);
        };

  function getAppsComplete(data, options, requestAppsTime) {
            if (data.errorCode !== Evme.DoATAPI.ERROR_CODES.SUCCESS) {
                return false;
            }
      if (requestAppsTime < lastRequestAppsTime) {
                return;
            }

            window.clearTimeout(timeoutHideHelper);

            var _query = options.query,
                _type = options.type,
                _source = options.source,
                _index = options.index,
                reloadingIcons = options.reloadingIcons,
                isExactMatch = options.exact,
                iconsFormat = options.iconsFormat,
                queryTyped = options.queryTyped, // used for searching for exact results if user stopped typing for X seconds
                onlyDidYouMean = options.onlyDidYouMean,
                hasInstalledApps = options.hasInstalledApps,

                searchResults = data.response,
                query = searchResults.query || _query,
                disambig = searchResults.disambiguation || [],
                suggestions = searchResults.suggestions || [],
                apps = searchResults.apps || [],
                spelling = searchResults.spellingCorrection || [],
                isMore = (appsCurrentOffset > 0),
    bSameQuery = (lastSearch.query === query);

            // searching after a timeout while user it typing
            if (onlyDidYouMean || options.automaticSearch) {
                // show only spelling or disambiguation, and only if the query is the same as what the user typed
                if (query == queryTyped && (spelling.length > 0 || disambig.length > 1)) {
                    Evme.Helper.load(queryTyped, query, undefined, spelling, disambig);
                    Evme.Helper.hideTitle();
                    Evme.Helper.showSpelling();
                }
            } else {
                if (!isMore && !reloadingIcons) {
                    Evme.Helper.load(_query, query, suggestions, spelling, disambig);

                    if (isExactMatch) {
                        if (spelling.length > 0 || disambig.length > 1) {
                            Evme.Helper.hideTitle();
                            Evme.Helper.showSpelling();
                        } else {
          Evme.Helper.showTitle();
                        }
                    } else {
                        Evme.Helper.showSuggestions(_query);
                    }
                }
            }

            lastSearch.exact = isExactMatch && !onlyDidYouMean;

            if (isMore || !bSameQuery) {
                if (apps) {
                    lastSearch.query = query;
                    lastSearch.source = _source;
                    lastSearch.type = _type;

        Evme.SearchResults.APIData.onResponseRecieved(data.response);

        // if got less apps then requested, assume no more apps
        if (searchResults.paging.limit < NUMBER_OF_APPS_TO_LOAD) {
      hasMoreApps = false;
        } else {
      var maxApps = (searchResults.paging && searchResults.paging.max) || NUMBER_OF_APPS_TO_LOAD * 2;
      hasMoreApps = appsCurrentOffset + searchResults.paging.limit < maxApps;
                    }

                    if (hasMoreApps) {
                        hasMoreApps = {
                            "query": _query,
                            "type": _type,
                            "isExact": isExactMatch
                        };
                    }
                }
            }

            Evme.Searchbar.endRequest();

            // consider this benchmark only if the response didn't come from the cache
            if (!data._cache) {
    Evme.Features.stopTimingFeature('typingApps', true);
    Evme.Features.stopTimingFeature('iconQuality', true);
            }

            return true;
        }

        this.getBackgroundImage = function getBackgroundImage(options) {
            var query = options.query,
                type = options.type,
                source = options.source,
                index = options.index,
                exact = options.exact;

            if (query == lastQueryForImage) {
                return;
            }

            setTimeoutForShowingDefaultImage();

            requestImage && requestImage.abort && requestImage.abort();
            requestImage = Evme.DoATAPI.bgimage({
                "query": query,
                "typeHint": type,
                "index": index,
                "feature": source,
                "exact": exact,
                "prevQuery": lastQueryForImage,
                "width": Evme.__config.bgImageSize[0] * Evme.Utils.devicePixelRatio,
                "height": Evme.__config.bgImageSize[1] * Evme.Utils.devicePixelRatio
            }, getBackgroundImageComplete);
        };

        function getBackgroundImageComplete(data) {
            if (data.errorCode !== Evme.DoATAPI.ERROR_CODES.SUCCESS) {
                return;
            }
            if (!requestImage) {
                return;
            }

            Searcher.clearTimeoutForShowingDefaultImage();

            var query = data.response.completion,
                image = Evme.Utils.formatImageData(data.response.image);

            if (image) {
                lastQueryForImage = query;

                image = {
                    "image": image,
                    "query": query,
                    "source": data.response.source
                };

                Evme.BackgroundImage.update(image);
            }

      Evme.Features.stopTimingFeature('typingImage');
        }

        this.getAutocomplete = function getAutocomplete(query) {
            if (autocompleteCache[query]) {
                getAutocompleteComplete(autocompleteCache[query]);
                return;
            }

            requestAutocomplete = Evme.DoATAPI.suggestions({
                "query": query
            }, function onSuccess(data) {
                if (!data) {
                    return;
                }
                var items = data.response || [];
                autocompleteCache[query] = items;
                getAutocompleteComplete(items, query);
            });
        };

        function getAutocompleteComplete(items, querySentWith) {
            window.clearTimeout(timeoutAutocomplete);
      timeoutAutocomplete = window.setTimeout(function onTimeout() {
                if (Evme.Utils.isKeyboardVisible && !requestSearch) {
                    Evme.Helper.loadSuggestions(items);
                    Evme.Helper.showSuggestions(querySentWith);
                    requestAutocomplete = null;
                }
            }, TIMEOUT_BEFORE_RENDERING_AC);
        };


        function setTimeoutForShowingDefaultImage() {
            Searcher.clearTimeoutForShowingDefaultImage();
            timeoutShowDefaultImage = window.setTimeout(Evme.BackgroundImage.loadDefault, TIMEOUT_BEFORE_SHOWING_DEFAULT_IMAGE);
        }

        this.clearTimeoutForShowingDefaultImage = function clearTimeoutForShowingDefaultImage() {
            window.clearTimeout(timeoutShowDefaultImage);
        };

        this.loadMoreApps = function loadMoreApps() {
      if (!requestSearch) {
                Searcher.nextAppsPage(hasMoreApps.query, hasMoreApps.type, hasMoreApps.isExact);
            }
        };

  this.empty = function empty() {
            Searcher.cancelRequests();
      Evme.SearchResults.clear();
            resetLastSearch();
            lastQueryForImage = "";

            if (!Evme.Searchbar.getValue()) {
                Evme.Helper.clear();
            }
        };

        this.nextAppsPage = function nextAppsPage(query, type, exact) {
            appsCurrentOffset += NUMBER_OF_APPS_TO_LOAD;
            lastSearch.offset = appsCurrentOffset;

            Searcher.getApps({
                "query": query,
                "type": type,
                "source": SEARCH_SOURCES.MORE,
                "exact": exact,
                "offset": appsCurrentOffset
            });
        };

        this.searchAgain = function searchAgain(source, query) {
            Searcher.cancelRequests();

            var _query = query || lastSearch.query || Evme.Searchbar.getValue(),
                _source = source || lastSearch.source,
                _type = lastSearch.type,
                _offset = lastSearch.offset;

            if (_query) {
                resetLastSearch();
                Searcher.searchExact(_query, _source, null, _type, _offset);
            }
        };

        this.searchExactFromOutside = function searchExactFromOutside(query, source, index, type, callback) {
            !type && (type = '');

            if (query) {
                Evme.Helper.reset();
                Evme.Searchbar.setValue(query, false);

                if (lastSearch.query != query || lastSearch.type != type || !lastSearch.exact) {
                    resetLastSearch();

                    Searcher.searchExact(query, source, index, type, 0, false, callback);
                } else {
                    Evme.Helper.enableCloseAnimation();

                    Evme.Helper.setTitle(query);
                    window.setTimeout(Evme.Helper.showTitle, 50);
                }

                Evme.Searchbar.blur();
    window.setTimeout(function onTimeout() {
                    Brain.Searchbar.cancelBlur();
                }, 0);
            }

            Brain.Searchbar.setEmptyClass();
        };

        this.searchExact = function searchExact(query, source, index, type, offset, automaticSearch, callback) {
            Searcher.cancelRequests();
            appsCurrentOffset = 0;

            if (!automaticSearch) {
                Evme.Searchbar.setValue(query, false, true);
                Evme.Helper.setTitle(query);
            }

            var options = {
                "query": query,
                "type": type,
                "source": source,
                "index": index,
                "exact": true,
                "offset": offset,
                "automaticSearch": automaticSearch,
                "callback": callback
            };

            Evme.Features.startTimingFeature('typingApps', Evme.Features.ENABLE);
            Searcher.getApps(options);

            Evme.Features.startTimingFeature('typingImage', Evme.Features.ENABLE);
            Searcher.getBackgroundImage(options);
        };

        this.searchExactAsYouType = function searchExactAsYouType(query, queryTyped) {
            resetLastSearch(true);

            Searcher.cancelSearch();
            appsCurrentOffset = 0;

            var options = {
                "query": query,
                "queryTyped": queryTyped,
                "source": SEARCH_SOURCES.PAUSE,
                "exact": true,
                "offset": 0,
                "onlyDidYouMean": true
            };

            if (Evme.Features.isOn('typingApps')) {
    Evme.Features.startTimingFeature('typingApps', Evme.Features.ENABLE);
    Searcher.getApps(options);
            }

            if (Evme.Features.isOn('typingImage')) {
    Evme.Features.startTimingFeature('typingImage', Evme.Features.ENABLE);
    Searcher.getBackgroundImage(options);
            }
        };

        this.searchAsYouType = function searchAsYouType(query, source) {
            appsCurrentOffset = 0;

            Searcher.getAutocomplete(query);

            var searchOptions = {
                "query": query,
                "source": source
            };

            if (Evme.Features.isOn('typingApps')) {
    requestSearch && requestSearch.abort && requestSearch.abort();
    window.clearTimeout(timeoutSearchWhileTyping);
    timeoutSearchWhileTyping = window.setTimeout(function onTimeout() {
        Evme.Features.startTimingFeature('typingApps', Evme.Features.DISABLE);
        Searcher.getApps(searchOptions);
    }, TIMEOUT_BEFORE_RUNNING_APPS_SEARCH);
            }

            if (Evme.Features.isOn('typingImage')) {
    requestImage && requestImage.abort && requestImage.abort();
    window.clearTimeout(timeoutSearchImageWhileTyping);
    timeoutSearchImageWhileTyping = window.setTimeout(function onTimeout() {
        Evme.Features.startTimingFeature('typingImage', Evme.Features.DISABLE);
        Searcher.getBackgroundImage(searchOptions);
    }, TIMEOUT_BEFORE_RUNNING_IMAGE_SEARCH);
            }
        };

        this.cancelRequests = function cancelRequests() {
            Evme.Features.stopTimingFeature('typingApps');
            Evme.Features.stopTimingFeature('typingImage');

            Searcher.cancelSearch();
            cancelAutocomplete();

            Searcher.cancelImageSearch();

            requestIcons && requestIcons.abort && requestIcons.abort();
            requestIcons = null;
        };

        this.cancelImageSearch = function cancelImageSearch() {
            Searcher.clearTimeoutForShowingDefaultImage();
            window.clearTimeout(timeoutSearchImageWhileTyping);
            requestImage && requestImage.abort && requestImage.abort();
            requestImage = null;
        };

        this.cancelSearch = function cancelSearch() {
      Evme.SearchResults.APIData.onRequestCanceled();
            window.clearTimeout(timeoutSearchWhileTyping);
            window.clearTimeout(timeoutSearch);
            requestSearch && requestSearch.abort && requestSearch.abort();
            requestSearch = null;
        };

        function cancelAutocomplete() {
            window.clearTimeout(timeoutAutocomplete);
            requestAutocomplete && requestAutocomplete.abort && requestAutocomplete.abort();
            requestAutocomplete = null;
        };

        this.setLastQuery = function setLastQuery() {
            Evme.Searchbar.setValue(lastSearch.query, false, true);
            Evme.Helper.setTitle(lastSearch.query, lastSearch.type);
        };

        this.getDisplayedQuery = function getDisplayedQuery() {
            return lastSearch.query;
        };

        this.getDisplayedSource = function getDisplayedSource() {
            return lastSearch.source;
        };

        this.searchedExact = function searchedExact() {
            return lastSearch.exact;
        };
    }
    var Searcher = this.Searcher;
};




Evme.BackgroundImage = new function Evme_BackgroundImage() {
    var NAME = "BackgroundImage", self = this,
        el = null, elFullScreen = null, elementsToFade = null, elStyle = null,
        currentImage = null, elCurrentImage = null, active = false, changeOpacityTransitionCallback = null,
        defaultImage = "",
        TIMEOUT_BEFORE_REMOVING_OLD_IMAGE = 1500;

    this.init = function init(options) {
        !options && (options = {});

        defaultImage = options.defaultImage || "";
        el = options.el;
        elStyle = el.style;

  elementsToFade = document.querySelectorAll('*[data-opacity-on-swipe=true]');
  elementsToFade = Array.prototype.slice.call(elementsToFade, 0);

        Evme.EventHandler.trigger(NAME, "init");
    };

    this.update = function update(oImage, isDefault) {
        if (typeof oImage === "string") {
            oImage = {
                "image": oImage,
                "source": "",
                "query": ""
            };
        }

        if (!currentImage || currentImage.image !== oImage.image) {
            removeCurrent();

            if (isDefault) {
                el.classList.add("default");
            } else {
                currentImage = oImage;

                elCurrentImage = Evme.$create('div',{'class': 'img'});
                elCurrentImage.style.backgroundImage = 'url(' + currentImage.image + ')';
                el.appendChild(elCurrentImage);

    cbUpdated(currentImage);

                window.setTimeout(function onTimeout(){
                    elCurrentImage.classList.add("visible");

                    window.setTimeout(function onTimeout(){
                        el.classList.remove("default");
                    }, 300);
                }, 10);
            }
        }
    };

    this.loadDefault = function loadDefault() {
        self.update(defaultImage, true);
    };

    this.clear = function clear() {
        removeCurrent();
    };

    function onElementsToFade(cb) {
  for (var i=0, el; el=elementsToFade[i++];) {
            cb.call(el);
        }
    }

    this.fadeFullScreen = function fadeFullScreen(per) {
  per = Math.max(1 - (Math.round(per*100)/100), 0);
  for (var i=0, el; el=elementsToFade[i++];) {
    el.style.opacity = per;
  }
    };

    this.cancelFullScreenFade = function cancelFullScreenFade() {
        onElementsToFade(function onElement(){
            this.classList.add('animate');
        });

        window.setTimeout(function onTimeout(){
            onElementsToFade(function onElement(){
                this.style.cssText = this.style.cssText.replace(/opacity: .*;/, "");
            });

            window.setTimeout(function onTimeout(){
                onElementsToFade(function onElement(){
                    this.classList.remove('animate');
                });
            }, 500);
        }, 0);

    };

    this.showFullScreen = function showFullScreen() {
        Evme.$remove(elFullScreen);
        elFullScreen = null;

        onElementsToFade(function onElement(){
            this.classList.add('animate');
        });
        window.setTimeout(function onTimeout(){
            onElementsToFade(function onElement(){
                this.style.opacity = 0;
            });
        }, 0);

        elFullScreen = self.getFullscreenElement(currentImage, self.closeFullScreen);

        el.parentNode.appendChild(elFullScreen);

        window.setTimeout(function onTimeout(){
            elFullScreen.classList.add("ontop");
            elFullScreen.classList.add("active");
        }, 0);

        active = true;

        cbShowFullScreen();
    };

    this.getFullscreenElement = function getFullscreenElement(data, onClose) {
        !data && (data = currentImage);

        var el = Evme.$create('div', {'id': "bgimage-overlay"},
                        '<div class="img" style="background-image: url(' + data.image + ')"></div>' +
                        '<div class="content">' +
                            ((data.query)? '<h2>' + data.query + '</h2>' : '') +
                            ((data.source)? '<div class="source"><b ' + Evme.Utils.l10nAttr(NAME, 'source-label') + '></b> <span>' + data.source + '</span></div>' : '') +
                            '<b class="close"></b>' +
                        '</div>');



        Evme.$(".close, .img", el, function onElement(el) {
            el.addEventListener("touchstart", function onTouchStart(e) {
                e.preventDefault();
                e.stopPropagation();
                onClose && onClose();
            });
        });

        if (data.source) {
            Evme.$(".content", el)[0].addEventListener("touchstart", function onTouchEnd(e){
                Evme.Utils.sendToOS(Evme.Utils.OSMessages.OPEN_URL, {
                    "url": data.source
                });
            });
        } else {
            el.classList.add("nosource");
        }

        return el;
    };

    this.closeFullScreen = function closeFullScreen(e) {
        if (elFullScreen && active) {
            self.cancelFullScreenFade();
            elFullScreen.classList.remove("active");

            window.setTimeout(function onTimeout(){
                Evme.$remove(elFullScreen);
            }, 700);

            e && e.preventDefault();
            cbHideFullScreen();
            active = false;
            return true;
        }

        active = false;
        return false;
    };

    this.isFullScreen = function isFullScreen() {
        return active;
    };

    this.get = function get() {
        return currentImage || {"image": defaultImage};
    };

    this.changeOpacity = function changeOpacity(value, duration, cb) {
        if (duration) {
            changeOpacityTransitionCallback = cb;
            elStyle.MozTransition = 'opacity ' + duration + 'ms linear';
            el.addEventListener('transitionend', transitionEnd);
        }
        this.closeFullScreen();
        elStyle.opacity = value;
    };

    function transitionEnd(e) {
        el.removeEventListener('transitionend', transitionEnd);
        elStyle.MozTransition = '';
        window.setTimeout(function onTimeout(){
            changeOpacityTransitionCallback && changeOpacityTransitionCallback();
            changeOpacityTransitionCallback = null;
        }, 0);
    }

    function removeCurrent() {
        if (elCurrentImage) {
            // Keep it as a local var cause it might change during this timeout
            var elRemove = elCurrentImage;
            elRemove.classList.remove("visible");
            currentImage = {};

      cbRemoved();

            window.setTimeout(function onTimeout(){
                Evme.$remove(elRemove);
            }, TIMEOUT_BEFORE_REMOVING_OLD_IMAGE);
        }
    }

    function imageLoaded() {
        cbLoaded();
    }

    function cbUpdated(image) {
        Evme.EventHandler.trigger(NAME, "updated", {
            "image": image
        });
    }

    function cbRemoved() {
  Evme.EventHandler.trigger(NAME, "removed");
    }

    function cbLoaded() {
        Evme.EventHandler.trigger(NAME, "load", {
            "image": currentImage
        });
    }

    function cbShowFullScreen() {
        Evme.EventHandler.trigger(NAME, "showFullScreen");
    }

    function cbHideFullScreen() {
        Evme.EventHandler.trigger(NAME, "hideFullScreen");
    }
}

Evme.Banner = new function Evme_Banner() {
    var NAME = 'Banner', self = this,
        el = null, timerId = null;

    this.init = function init(options) {
        !options && (options = {});

        el = options.el;
        
        Evme.EventHandler.trigger(NAME, 'init');
    };
    
    this.show = function show(property, args, latency) {
        if (timerId) {
            window.clearTimeout(timerId);
        }
        
        latency = latency || 4000;
        timerId = window.setTimeout(self.hide, latency);
        
  el.innerHTML = '<p class="noreset">' + Evme.Utils.l10n(NAME, property, args) + '</p>';
        el.classList.add('visible');
        
        Evme.EventHandler.trigger(NAME, 'show');
    };

    this.hide = function hide() {
        timerId = null;
        el.classList.remove('visible');
        
        Evme.EventHandler.trigger(NAME, 'hide');
    };

    this.getElement = function getElement() {
        return el;
    };
}

/**
 * Collection.js
 * Main Evme object for using Collection
 *
 */
 void function() {
  Evme.Collection = new function Evme_Collection() {
    var self = this,
      NAME = 'Collection',

      currentSettings = null,

      el = null,
      elTitle = null,
      elClose = null,
      elAppsContainer = null,
      elImage = null,
      elImageFullscreen = null,
      resultsManager = null,
      isFullScreenVisible = false,

      title = '',

      CLASS_WHEN_IMAGE_FULLSCREEN = 'full-image',
      CLASS_WHEN_ANIMATING = 'animate',
      TRANSITION_DURATION = 400;

    this.editMode = false;

    this.init = function init(options) {
      !options && (options = {});

      resultsManager = options.resultsManager;

      el = document.getElementById('collection');

      elAppsContainer = resultsManager.getElement();

      elTitle = Evme.$('.title', el)[0];
      elImage = Evme.$('.image', el)[0];
      elClose = Evme.$('.close', el)[0];

      elClose.addEventListener('click', self.hide);
      elAppsContainer.dataset.scrollOffset = 0;

      Evme.EventHandler.trigger(NAME, 'init');
    };

    this.create = function create(options) {
      var query = options.query,
  apps = options.apps,
  gridPosition = options.gridPosition,
  callback = options.callback || Evme.Utils.NOOP,
  extra = {'extraIconsData': options.extraIconsData};

      if (query) {
  Evme.CollectionSettings.createByQuery(query, extra, function onCreate(collectionSettings) {
    addCollectionToHomescreen(collectionSettings, gridPosition, {
      "callback": function onAddedToHomescreen() {
        callback(collectionSettings);
      }
    });
  });
      }
    };

    this.remove = function removeCollection(id, params) {
      params = params || {};

      EvmeManager.removeGridItem({
  "id": id,
  "onConfirm": function onConfirm() {
    Evme.CollectionStorage.remove(id);
    params.callback && params.callback();
  }
      });
    };

    /**
     * Overwrite a collection's settings with new data
     * and update the homescreen icon if needed.
     */
    this.update = function updateCollection(collectionSettings, data, callback){
      Evme.CollectionSettings.update(collectionSettings, data, function onUpdate(updatedSettings){
  // TODO compare ids of collectionSettings.app with data.apps
  // and collectionSettings.extraIconsData with data.extraIconsData
  // to conclude homescreen icon should be updated
  if ('apps' in data || 'extraIconsData' in data || 'name' in data) {
    addCollectionToHomescreen(updatedSettings);
  }

  // collection is open and apps changed
  if (currentSettings && 'apps' in data) {
    resultsManager.renderStaticApps(updatedSettings.apps);
  }

  callback(updatedSettings);
      });
    };

    // cloud app is always added to the currently open collection
    this.addCloudApp = function addCloudApp(cloudResult) {
      var cloudAppData = cloudResult.cfg;

      Evme.Utils.getRoundIcon({
    "src": cloudAppData.icon,
    "padding": true
      }, function onIconReady(roundedAppIcon) {
        // add some properties we will use when rendering a CloudAppResult
        // see StaticApps.js@render
        cloudAppData.staticType = Evme.STATIC_APP_TYPE.CLOUD;
        cloudAppData.collectionQuery = currentSettings.query;

        // save the rounded version as the icon
        cloudAppData.icon = roundedAppIcon;

        self.update(currentSettings, {
          "apps": currentSettings.apps.concat(cloudAppData)
        });

      });
    };

    // add installed app to open collection via settings menu
    // or to some other collection by dropping an app into it
    this.addInstalledApp = function addInstalledApp(installedApp, collectionId) {
      Evme.CollectionStorage.get(collectionId, function onGotSettings(collectionSettings) {
  self.update(collectionSettings, {
    "apps": collectionSettings.apps.concat(installedApp)
  });
      });
    };

    // remove app from the open collection via settings menu
    this.removeApp = function removeApp(id) {
      var apps = currentSettings.apps.filter(function keepIt(app) {
  return app.id !== id;
      });

      if (apps.length < currentSettings.apps.length) {
  self.update(currentSettings, {'apps': apps});
      }
    };

    // apps added to the open collection via the settings menu
    this.addApps = function addApps(newApps) {
      if (newApps && newApps.length) {
  self.update(currentSettings, {
    'apps': currentSettings.apps.concat(newApps)
  });
      }
    };

    this.onQueryIndexUpdated = function onQueryIndexUpdated() {
      // TODO
      Evme.CollectionSettings.updateAll();
      // move update homescreen here
    };

    this.show = function show(e) {
      var data = e.detail;
      Evme.CollectionStorage.get(data.id, function onGotFromStorage(collectionSettings) {
  currentSettings = collectionSettings;

        var id = el.dataset.id = collectionSettings.id;
        var icon = GridManager.getApp(id);
        var title = collectionSettings.name || collectionSettings.query;
        if (icon) {
          title = icon.descriptor.name;
        }

        self.setTitle(title);
        collectionSettings.bg && self.setBackground(collectionSettings.bg);

  self.editMode = false;

  resultsManager.renderStaticApps(collectionSettings.apps);

  window.mozRequestAnimationFrame(function() {
    el.classList.add('visible');
    Evme.EventHandler.trigger(NAME, 'show');
  });
      });
    };

    this.hide = function hide() {
      if (!currentSettings) {
  return false;
      }

      // update homescreen icon with first three visible icons
      var extraIconsData = resultsManager.getCloudResultsIconData();
      self.update(currentSettings, {'extraIconsData': extraIconsData});

      currentSettings = null;

      // hack for preventing the browser from saving the scroll position
      // and restoring it when a new Collection opens
      resultsManager.scrollToTop();

      resultsManager.clear();
      self.clearBackground();

      self.toggleEditMode(false);

      window.mozRequestAnimationFrame(function() {
  el.classList.remove('visible');
  Evme.EventHandler.trigger(NAME, 'hide');
      });

      return true;
    };

    this.isOpen = function isOpen() {
  return currentSettings !== null;
    };

    this.setTitle = function setTitle(newTitle) {
      title = newTitle;

      elTitle.innerHTML = '<em></em>' + '<span>' + title + '</span>' + ' ' +
  '<span ' + Evme.Utils.l10nAttr(NAME, 'title-suffix') + '/>';
    };

    this.setBackground = function setBackground(newBg) {
      if (!currentSettings) return;

      self.clearBackground();

      elImage.style.backgroundImage = 'url(' + newBg.image + ')';

      elImageFullscreen = Evme.BackgroundImage.getFullscreenElement(newBg, self.hideFullscreen);
      el.appendChild(elImageFullscreen);

      self.update(currentSettings, {"bg": newBg});

      resultsManager.changeFadeOnScroll(true);
    };

    this.clearBackground = function clearBackground() {
      el.style.backgroundImage = 'none';
      elImage.style.backgroundImage = 'none';

      Evme.$remove(elImageFullscreen);

      resultsManager.changeFadeOnScroll(false);
    };

    this.showFullscreen = function showFullScreen(e) {
      if (isFullScreenVisible) {
  return false;
      }

      e && e.preventDefault();
      e && e.stopPropagation();

      isFullScreenVisible = true;
      el.classList.add(CLASS_WHEN_ANIMATING);
      window.setTimeout(function onTimeout() {
  self.fadeImage(0);
  el.classList.add(CLASS_WHEN_IMAGE_FULLSCREEN);
      }, 10);

      return true;
    };

    this.hideFullscreen = function hideFullscreen(e) {
      if (!isFullScreenVisible) {
  return false;
      }

      e && e.preventDefault();
      e && e.stopPropagation();

      isFullScreenVisible = false;
      el.classList.add(CLASS_WHEN_ANIMATING);
      window.setTimeout(function onTimeout() {
  self.fadeImage(1);
  el.classList.remove(CLASS_WHEN_IMAGE_FULLSCREEN);

  window.setTimeout(function onTimeout() {
    el.classList.remove(CLASS_WHEN_ANIMATING);
  }, TRANSITION_DURATION);
      }, 10);

      return true;
    };

    this.fadeImage = function fadeImage(howMuch) {
      elAppsContainer.style.opacity = howMuch;
    };

    this.getExperience = function getExperience() {
      return currentSettings.experienceId;
    };

    this.getQuery = function getQuery() {
      var query = currentSettings.query || '';
      
      if (!query && currentSettings.experienceId) {
        var l10nkey = 'id-' + Evme.Utils.shortcutIdToKey(currentSettings.experienceId);
        query = Evme.Utils.l10n('shortcut', l10nkey);
      }

      return query;
    };

    this.userSetBg = function userSetBg() {
      return (currentSettings.bg && currentSettings.bg.setByUser);
    };

    this.toggleEditMode = function toggleEditMode(bool) {
      if (self.editMode === bool) {
  return false;
      }

      self.editMode = bool;
      if (bool) {
  el.dataset.mode = 'edit';
  document.addEventListener('mozvisibilitychange', onVisibilityChange);
      } else {
  delete el.dataset.mode;
  document.removeEventListener('mozvisibilitychange', onVisibilityChange);
      }

      return true;
    };

    function onVisibilityChange() {
      if (document.mozHidden) {
  self.toggleEditMode(false);
      }
    }
  };


  /**
   * The data required for displaying a collection
   * @param {Object} args
   */
  Evme.CollectionSettings = function Evme_CollectionSettings(args) {
    this.id = args.id;
    this.name = args.name || args.query;
    this.bg = args.bg || null;  // object containing backgound information (image, query, source, setByUser)

    // collection performs search by query or by experience
    this.query = args.query || args.name;
    this.experienceId = args.experienceId;

    this.apps = args.apps || [];

    // TODO save only reference, get data from IconManager
    // get static apps' icons from InstalledAppsService
    this.extraIconsData = args.extraIconsData || [];  // list of {"id": 3, "icon": "base64icon"}

  };

  /**
   * Create a settings object from a query
   * @param  {String}   query
   * @param  {Object}   extra
   * @param  {Function} cb
   */
  Evme.CollectionSettings.createByQuery = function createByQuery(query, extra={}, cb=Evme.Utils.NOOP) {
    var installedApps = Evme.InstalledAppsService.getMatchingApps({
      'query': query
    });

    var installedIcons = Evme.Utils.pluck(installedApps, 'icon');

    var settings = new Evme.CollectionSettings({
      id: Evme.Utils.uuid(),
      query: query,
      extraIconsData: extra.extraIconsData,
      apps: installedApps
    });

    saveSettings(settings, cb);
  };

  /**
   * wrapper for update calls
   * code should not call CollectionStorage.update directly
   */
  Evme.CollectionSettings.update = function update(settings, data, cb) {
    // remove duplicates
    if ('apps' in data){
      data.apps = Evme.Utils.unique(data.apps, 'id');
    }

    Evme.CollectionStorage.update(settings, data, cb);
  };

  Evme.CollectionSettings.updateAll = function updateAll() {
    // TODO
    // see if this method required any changes
    // get collection by EvmeManager.getCollections?
    var ids = Evme.CollectionStorage.getAllIds();

    for (var i = 0, id; id = ids[i++];) {
      Evme.CollectionStorage.get(id, populateCollection);
    }
  };

  // save collection settings in storage and run callback async.
  function saveSettings(settings, cb) {
    Evme.CollectionStorage.add(settings, function onStored() {
      cb && cb(settings);
    });
  }

  function populateCollection(settings) {
    var existingIds = Evme.Utils.pluck(settings.apps, 'id');

    var newApps = Evme.InstalledAppsService.getMatchingApps({
      'query': settings.query
    });

    newApps = newApps.filter(function isNew(app) {
      return existingIds.indexOf(app.id) === -1;
    });

    if (newApps.length){
      Evme.Collection.update(settings, {"apps": settings.apps.concat(newApps)});
    }
  };

  /**
   * Add a collection to the homescreen.
   * If collection exists only update the icon.
   */
  function addCollectionToHomescreen(settings, gridPosition, extra) {
    var icons = Evme.Utils.pluck(settings.apps, 'icon');

    if (icons.length < Evme.Config.numberOfAppInCollectionIcon) {
      var extraIcons = Evme.Utils.pluck(settings.extraIconsData, 'icon');
      icons = icons.concat(extraIcons).slice(0, Evme.Config.numberOfAppInCollectionIcon);
    }

    Evme.IconGroup.get(icons, function onIconCreated(canvas) {
      EvmeManager.addGridItem({
  'id': settings.id,
  'originUrl': settings.id,
  'title': settings.name,
  'icon': canvas.toDataURL(),
  'isCollection': true,
  'isEmpty': !(icons.length),
  'gridPosition': gridPosition
      }, extra);
    });
  }

  /**
   * CollectionStorage
   * Persists settings to local storage
   *
   * TODO encapsulate - don't expose as Evme.CollectionStorage
   */
  Evme.CollectionStorage = new function Evme_CollectionStorage() {
    var NAME = 'CollectionStorage',
  IDS_STORAGE_KEY = 'evmeCollection',
  PREFIX = 'collectionsettings_',
  self = this,
  ids = null,
  locked = false;  // locks the ids list

    this.init = function init() {
      Evme.Storage.get(IDS_STORAGE_KEY, function onGet(storedIds) {
  ids = storedIds || [];
      });

      window.addEventListener('collectionUninstalled', onCollectionUninstalled);
    };

    this.remove = function remove(collectionId) {
      removeId(collectionId);
    };

    this.add = function add(settings, cb) {
      if (!settings.id) return;

      Evme.Storage.set(PREFIX + settings.id, settings, function onSet() {
  addId(settings.id);
  cb instanceof Function && cb(settings);
      });
    };

    this.update = function update(settings, data, cb) {
      for (var prop in data) {
  settings[prop] = data[prop];
      }
      self.add(settings, cb);
    };

    this.get = function get(settingsId, cb) {
      Evme.Storage.get(PREFIX + settingsId, function onGet(storedSettings) {
  if (cb && storedSettings !== null) {
    var settings = new Evme.CollectionSettings(storedSettings);
    cb instanceof Function && cb(settings);
  }
      });
    };

    this.getAllIds = function getAllIds() {
      return ids;
    };

    this.getAllCollections = function getAllCollections(callback) {
      var ids = self.getAllIds(),
    collections = [];

      for (var i = 0, id; id = ids[i++];) {
  self.get(id, onGotCollectionSettings);
      }

      function onGotCollectionSettings(settings) {
  collections.push(settings);
  if (collections.length === ids.length) {
    callback(collections);
  }
      }
    };

    function onCollectionUninstalled(e) {
      self.removeId(e.detail.collection.id);
    }

    function addId(id) {
      if (ids && ids.indexOf(id) > -1) return;

      if (ids === null || locked) {
  setTimeout(function retry() {addId(id); }, 100);
  return;
      }

      try {
  lock();
  ids.push(id);
  Evme.Storage.set(IDS_STORAGE_KEY, ids, unlock);
      } catch (ex) {
  unlock();
      }
    }

    function removeId(id) {
      if (ids === null || locked) {
  setTimeout(function retry() {removeId(id); }, 100);
  return;
      }

      try {
  lock();
  ids = ids.filter(function neqId(storedId) {return storedId !== id });
  Evme.CollectionStorage.set(IDS_STORAGE_KEY, ids, function onRemoved() {
    unlock();
    Evme.Storage.remove(PREFIX + collectionId);
  });
      } catch (ex) {
  unlock();
      }
    }

    function lock() {
      locked = true;
    }

    function unlock() {
      locked = false;
    }
  };

}();

Evme.CollectionsSuggest = new function Evme_CollectionsSuggest() {
  var NAME = 'CollectionsSuggest', self = this,
      elList = null, elParent = null, active = false,
      savedIcons = null;

  this.init = function init(options) {
    elParent = options.elParent;

    elList = Evme.$create('select', {
      "multiple": "true",
      "id": "shortcuts-select"
    });
    elList.addEventListener("blur", onHide);

    elParent.appendChild(elList);

    Evme.EventHandler.trigger(NAME, 'init');
  };

  this.show = function show() {
    if (active) {
      return false;
    }

    active = true;
    elList.focus();
    Evme.EventHandler.trigger(NAME, 'show');

    return true;
  };

  this.hide = function hide() {
    if (!active) {
      return false;
    }

    active = false;
    window.focus();
    elList.blur();

    return true;
  };

  this.newCustom = function newCustom() {
    var customQuery = prompt(Evme.Utils.l10n(NAME, "prompt-create"));

    if (!customQuery) {
      return;
    }

    Evme.EventHandler.trigger(NAME, 'custom', {
      "query": customQuery
    });
  };

  this.get = function get() {
    var selectedShortcuts = [],
  elShourtcuts = Evme.$('option', elList);

    for (var i=0, elOption; elOption=elShourtcuts[i++];) {
      if (elOption.selected) {
  selectedShortcuts.push({
    "query": elOption.value,
    "experienceId": elOption.dataset.experience || ''
  });
      }
    }

    return selectedShortcuts;
  };

  this.load = function load(data) {
    savedIcons = data.icons;

    elList.innerHTML = '';
    self.add(data.shortcuts);

    Evme.EventHandler.trigger(NAME, 'load');
  };

  this.add = function add(shortcuts) {
    var html = '',
  shortcutsAdded = {};

    for (var i=0,shortcut,query,queryKey,experienceId,name; shortcut=shortcuts[i++];) {
      query = shortcut.query;
      queryKey = query.toLowerCase();
      experienceId = shortcut.experienceId || '';
      name = query;

      if (experienceId) {
  var l10nkey = 'id-' + Evme.Utils.shortcutIdToKey(experienceId),
      translatedName = Evme.Utils.l10n('shortcut', l10nkey);

  if (translatedName) {
    name = translatedName;
  }
      }

      name = name.replace(/</g, '&lt;');

      if (!shortcutsAdded[queryKey]) {
  html += '<option ' +
        'value="' + query.replace(/"/g, '&quot;') + '" ' +
        'data-experience="' + experienceId + '"' +
    '>' + Evme.html(name) + '</option>';

  shortcutsAdded[queryKey] = true;
      }
    }

    elList.innerHTML = html;
  };

  this.Loading = new function Loading() {
    var active = false,
  ID = 'shortcuts-customize-loading';

    this.show = function loadingShow() {
      if (active) return;

      var el = Evme.$create('form',
      {'id': ID, 'role': 'dialog', 'data-type': 'confirm'},
      '<section>' +
          '<h1 ' + Evme.Utils.l10nAttr(NAME, 'loading') + '></h1>' +
          '<p class="noreset">' +
        '<progress></progress>' +
          '</p>' +
      '</section>' +
      '<menu>' +
          '<button ' + Evme.Utils.l10nAttr(NAME, 'loading-cancel') + ' class="full"></button>' +
      '</menu>');

      Evme.$("button", el, function onItem(elButton) {
  elButton.addEventListener("click", onLoadingCancel)
      });

      Evme.Utils.getContainer().appendChild(el);

      active = true;

      Evme.EventHandler.trigger(NAME, 'loadingShow');
    };

    this.hide = function loadingHide() {
      if (!active) return;

      Evme.$remove('#' + ID);
      active = false;

      Evme.EventHandler.trigger(NAME, 'loadingHide');
    };
  };

  function onHide() {
    active = false;
    Evme.EventHandler.trigger(NAME, 'hide');
    done();
  }

  function onLoadingCancel(e) {
    e.stopPropagation();
    Evme.EventHandler.trigger(NAME, 'loadingCancel', {
      "e": e
    });
  }

  function done() {
    Evme.EventHandler.trigger(NAME, 'done', {
      "shortcuts": self.get(),
      "icons": savedIcons
    });
  }
};

'use strict';

Evme.ConnectionMessage = new function Evme_ConnectionMessage() {
  var NAME = "ConnectionMessage",
      self = this,
      elScopes = [],
      elMessages = [],

      CLASS_NO_CONNECTION = "connection-error",
      SELECTOR_CONNECTION_MESSAGE = '[role="notification"].connection-message div span';

  this.init = function init(options) {
    elScopes = Evme.Utils.getScopeElements();
    elMessages = document.querySelectorAll(SELECTOR_CONNECTION_MESSAGE);

    Evme.EventHandler.trigger(NAME, "init");
  };

  this.show = function show(l10nKey, l10nArgs) {
    var msg = Evme.Utils.l10n(NAME, l10nKey, l10nArgs);
    
    for (var i = 0, el; el = elMessages[i++];) {
      el.innerHTML = msg;
    }

    for (var i = 0, el; el = elScopes[i++];) {
      el.classList.add(CLASS_NO_CONNECTION);
    }

    Evme.EventHandler.trigger(NAME, "show");
  };

  this.hide = function hide() {
    for (var i = 0, el; el = elScopes[i++];) {
      el.classList.remove(CLASS_NO_CONNECTION);
    }

    Evme.EventHandler.trigger(NAME, "hide");
  };
};

Evme.Features = new function Evme_Features() {
    var NAME = 'Features', self = this,
        currentFeatures = {},
        FEATURES = "FROM CONFIG";
    
    this.ENABLE = true;
    this.DISABLE = false;

    this.init = function init(options) {
        !options && (options = {});

        FEATURES = options.featureStateByConnection;
        
        // start by enabling all configurable features
        for (var feature in FEATURES) {
          currentFeatures[feature] = {
            "value": true
          };
        }
        
        Evme.EventHandler.trigger(NAME, 'init');
    };
    
    this.isOn = function isOn(featureName) {
        return !!self.get(featureName).value;
    };
    
    this.get = function get(featureName) {
      verifyFeature(featureName);
      return currentFeatures[featureName];
    };
    
    this.set = function set(featureName, featureValue) {
      Evme.Utils.log('Features: ' + (featureValue? 'enable' : 'disable') + ' ' + featureName);
      verifyFeature(featureName);
      
      var oldValue = currentFeatures[featureName].value;
      
      if (oldValue === featureValue) {
        return false;
      }
      
      currentFeatures[featureName].value = featureValue;
      currentFeatures[featureName].lastChanged = Date.now();
      
      Evme.EventHandler.trigger(NAME, 'set', {
        "featureName": featureName,
        "oldValue": oldValue,
        "newValue": featureValue
      });
      
      return true;
    };
    
    this.enable = function enable(featureName) {
      return self.set(featureName, true);
    };
    
    this.disable = function disable(featureName) {
      return self.set(featureName, false);
    };
    
    this.startTimingFeature = function startTimingFeature(featureName, isTurningOn) {
      verifyFeature(featureName);
      
      var timeout = FEATURES[featureName][isTurningOn? 'bringBack' : 'disableAfter'];
      
      window.clearTimeout(currentFeatures[featureName].timeout);
      
      currentFeatures[featureName].started = Date.now();
      currentFeatures[featureName].isTurningOn = isTurningOn;
      
      if (!isTurningOn) {
        currentFeatures[featureName].timeout = window.setTimeout(function onFeatureTimeoutfunction() {
          currentFeatures[featureName].timeout = null;
          self.disable(featureName);
        }, timeout);
      }
    };
    
    // didSucceed should be true for timeouts that try to see if ti should be re-enabled
    // for example: when re-enabling apps, this should be set to true.
    // but when canceling the apps search, this will NOT be true 
    this.stopTimingFeature = function stopTimingFeature(featureName, didSucceed) {
      verifyFeature(featureName);
      
      if (!didSucceed && currentFeatures[featureName].isTurningOn) {
        return;
      }
      
      var timePassed = Date.now() - currentFeatures[featureName].started,
          inBringBackLimit = timePassed < FEATURES[featureName].bringBack;
      
      window.clearTimeout(currentFeatures[featureName].timeout);
      currentFeatures[featureName].timeout = null;
      
      if (inBringBackLimit && currentFeatures[featureName].isTurningOn) {
        self.enable(featureName);
      }
    };
    
    function verifyFeature(featureName) {
      if (!currentFeatures.hasOwnProperty(featureName)) {
        throw new Exception('No such feature');
      }
    }
}

Evme.Helper = new function Evme_Helper() {
    var NAME = "Helper",
  self = this,
  el = null,
  elWrapper = null,
  elTitle = null,
  elList = null,
  elTip = null,
  _data = {},
  defaultText = "",
  scroll = null,
  currentDisplayedType = "",
  timeoutShowRefine = null,
  queryForSuggestions = "",
  lastVisibleItem,
  clicked = false,
  title = '',
  titleVisible = false,
  bShouldAnimate = true,
  ftr = {};
           
    this.init = function init(options) {
        !options && (options = {});        
        
        // features
        if (options.features){
            for (var i in options.features) {
    ftr[i] = options.features[i];
            }
        }

        el = options.el;
        elTitle = options.elTitle;
        elTip = options.elTip;
        elWrapper = el.parentNode;
        elList = Evme.$("ul", el)[0];

        elList.addEventListener("click", elementClick, false);
        elTitle.addEventListener("click", titleClicked, false);
        
        self.reset();

        scroll = new Scroll(el, {
            "vScroll": false,
            "hScroll": true
        });
        
        // feature animation disable
        if (ftr.Animation === false){
            elWrapper.classList.add("anim-disabled");
        }
        if (ftr.Suggestions && ftr.Suggestions.Animation !== undefined){
            var c = "anim-sugg-";
                c += ftr.Suggestions.Animation ? "enabled" : "disabled";
                
            elWrapper.classList.add(c);
        }

        Evme.EventHandler.trigger(NAME, "init");
    };
    
    this.reset = function reset() {
        _data = {
            "suggestions": [],
            "spelling": [],
            "types": [],
            "history": [],
            "queries": {
                "input": "",
                "parsed": ""
            }
        };
        
        self.setTitle();
    };
    
    this.empty = function empty() {
        elList.innerHTML = '<li class="label" ' + Evme.Utils.l10nAttr(NAME, 'default2') + '></li>';
        elList.classList.remove("default");
    };
    
    this.clear = function clear() {
        self.empty();
        
        Evme.EventHandler.trigger(NAME, "clear");
    };
    
    this.getElement = function getElement() {
        return el;
    };
    this.getList = function getList() {
        return elList;
    };
    
    this.enableCloseAnimation = function enableCloseAnimation() {
        elWrapper.classList.add("animate");
    };
    this.disableCloseAnimation = function disableCloseAnimation() {
        elWrapper.classList.remove("animate");
    };
    this.animateLeft = function animateLeft(callback) {
        el.classList.add("animate");
        window.setTimeout(function onTimeout(){
            el.style.cssText += "; -moz-transform: translateX(" + -el.offsetWidth + "px)";
            window.setTimeout(function onTimeout(){
                el.classList.remove("animate");
                window.setTimeout(function onTimeout(){
                    callback && callback();
                }, 50);
            }, 400);
        }, 50);
    };
    this.animateRight = function animateRight(callback) {
        el.classList.add("animate");
        window.setTimeout(function onTimeout(){
            el.style.cssText += "; -moz-transform: translateX(" + el.offsetWidth + "px)";
            window.setTimeout(function onTimeout(){
                el.classList.remove("animate");
                window.setTimeout(function onTimeout(){
                    callback && callback();
                }, 50);
            }, 400);
        }, 50);
    };
    this.animateFromRight = function animateFromRight() {
        el.style.cssText += "; -moz-transform: translateX(" + el.offsetWidth + "px)";
        window.setTimeout(function onTimeout(){
            el.classList.add("animate");
            window.setTimeout(function onTimeout(){
                el.style.cssText += "; -moz-transform: translateX(0)";
                window.setTimeout(function onTimeout(){
                    el.classList.remove("animate");
                }, 400);
            }, 20);
        }, 20);
    };
    this.animateFromLeft = function animateFromLeft() {
        el.style.cssText += "; -moz-transform: translateX(" + -el.offsetWidth + "px)";
        window.setTimeout(function onTimeout(){
            el.classList.add("animate");
            window.setTimeout(function onTimeout(){
                el.style.cssText += "; -moz-transform: translateX(0)";
                window.setTimeout(function onTimeout(){
                    el.classList.remove("animate");
                }, 400);
            }, 20);
        }, 20);
    };
    
    this.load = function load(inputQuery, parsedQuery, suggestions, spelling, types) {
        inputQuery = inputQuery || "";
        
        types = types || [];
        
        (typeof suggestions !== "undefined") && (_data.suggestions = suggestions);
        (typeof spelling !== "undefined") && (_data.spelling = spelling);
        (typeof types !== "undefined") && (_data.types = types);
        
        _data.queries.input = inputQuery;
        _data.queries.parsed = parsedQuery;
        
        if (_data.suggestions.length > 4) {
            _data.suggestions = _data.suggestions.slice(0, 4);
        }
        
         var _type = (_data.types && _data.types.length >= 1)? _data.types[0].name : "";
         
        self.setTitle(parsedQuery, _type);
        
        self.empty();
        
        cbLoaded(inputQuery, parsedQuery, suggestions, spelling, types);
    };
    
    this.loadSuggestions = function loadSuggestions(suggestions) {
        self.reset();
        self.load("", "", suggestions);
    };
    
    this.loadHistory = function loadHistory(history) {
        _data.history = history;
    };
    
    this.showSuggestions = function showSuggestions(querySentWith) {
        querySentWith && (queryForSuggestions = querySentWith);
        
        if (_data.suggestions.length > 0) {
            if (_data.suggestions.length > 4) {
                _data.suggestions = _data.suggestions.slice(0, 4);
            }
            self.showList({
                "data": _data.suggestions
            });
        }
        
        Evme.EventHandler.trigger(NAME, "showSuggestions", {
            "data": _data.suggestions
        });
    };
    
    this.getSuggestionsQuery = function getSuggestionsQuery() {
        return queryForSuggestions;
    };
    
    this.showHistory = function showHistory() {
        self.disableAnimation();
        
        self.showList({
            "data": _data.history,
            "l10nKey": 'history-title',
            "className": "history"
        });
        
        Evme.EventHandler.trigger(NAME, "showHistory", {
            "data": _data.history
        });
    };
    
    this.showSpelling = function showSpelling() {
        self.disableAnimation();
        
        var list = _data.spelling;
        if (list.length == 0) {
            list = _data.types;
        }
        
        self.showList({
            "data": list,
            "l10nKey": 'didyoumean-title',
            "className": "didyoumean"
        });
        
        if (list.length > 0) {
            self.flash();
        }
        
        Evme.EventHandler.trigger(NAME, "showSpelling", {
            "data": _data.spelling
        });
    };
    
    this.loadRefinement = function loadRefinement(types) {
        _data.types = types;
    };
    
    this.showRefinement = function showRefinement() {
        self.enableCloseAnimation();
        self.disableAnimation();
        
        self.showList({
            "data": _data.types,
            "l10nKey": 'refine-title',
            "className": "refine"
        });
        
        Evme.EventHandler.trigger(NAME, "showRefinement", {
            "data": _data.types
        });
    };
    
    this.showList = function showList(data) {
        var classToAdd = data.className || '',
            label = data.l10nKey? Evme.Utils.l10nAttr(NAME, data.l10nKey) : '',
            items = (data.data || []).slice(0);
            
        currentDisplayedType = classToAdd;
        
        self.empty();
        
        elList.className = classToAdd;
        
        var html = "";
        
        if (label) {
            html += '<li class="label" ' + label + '></li>';
        }
        
        for (var i=0; i<items.length; i++) {
            html += getElement(items[i], i, classToAdd);
        }
        elList.innerHTML = html;
        
        window.setTimeout(self.scrollToStart, 0);
        
        if (bShouldAnimate) {
            self.disableAnimation();
            animateSuggestions();
        }
        
        Evme.EventHandler.trigger(NAME, "show", {
            "type": classToAdd,
            "data": items
        });
    };
    
    this.flash = function flash() {
        elWrapper.classList.remove("flash");
        elTip.classList.remove("flash");
        
        window.setTimeout(function onTimeout() {
            elWrapper.classList.add("flash");
            elTip.classList.add("flash");
            
            window.setTimeout(function onTimeout(){
                elWrapper.classList.remove("flash");
                elTip.classList.remove("flash");
            }, 4000);
        }, 0);
    };
    
    this.scrollToStart = function refreshScroll() {
        scroll.scrollTo(0,0);
    };

    this.setTitle = function setTitle(newTitle, type) {
  title = newTitle;

        if (!title) {
            elTitle.innerHTML = '<b ' + Evme.Utils.l10nAttr(NAME, 'title-empty') + '></b>';
            return false;
        }
        
        
        var currentTitle = Evme.$('.query', elTitle)[0],
            currentType = Evme.$('.type', elTitle)[0];
       
        currentTitle = currentTitle? currentTitle.textContent : '';
        currentType = currentType? currentType.textContent.replace(/\(\)/g, "") : '';
        
        title = title.replace(/</g, "&lt;");
        
        // if trying to set the title to the one already there, don't doanything
        if (currentTitle == title) {
            if ((!type && currentType) || type == currentType) {
                return false;
            }
        }
        
        var html =  '<b ' + Evme.Utils.l10nAttr(NAME, 'title-prefix') + '></b>' +
                    '<span class="query">' + Evme.html(title) + '</span>' +
                    '<em class="type">(' + Evme.html(type) + ')</em>';
        
        elTitle.innerHTML = html;
        
        if (type) {
            elTitle.classList.remove("notype");
        } else {
            elTitle.classList.add("notype");
        }

        return html;
    };
    
    this.showTitle = function showTitle() {
        if (titleVisible) return;
        
        elWrapper.classList.add("close");
        elTitle.classList.remove("close");
        self.hideTip();
        window.setTimeout(self.disableCloseAnimation, 50);
        
        titleVisible = true;
    };
    
    this.hideTitle = function hideTitle() {
        if (!titleVisible) return;
        
        elWrapper.classList.remove("close");
        elTitle.classList.add("close");
        window.setTimeout(self.disableCloseAnimation, 50);
        self.scrollToStart();
        
        titleVisible = false;
    };

    this.selectItem = function selectItem(index) {
        elList.childNodes[index].click();
    };
    
    this.getList = function getList() {
        return elList;
    };
    
    this.getData = function getData() {
        return _data;
    };
    
    this.enableAnimation = function enableAnimation() {
        bShouldAnimate = true;
    };
    this.disableAnimation = function disableAnimation() {
        bShouldAnimate = false;
    };
    
    this.showTip = function showTip() {
        elTip.style.visibility = 'visible';
    };
    
    this.hideTip = function hideTip() {
        elTip.style.visibility = 'hidden';
    };
    
    this.addLink = function addLink(l10Key, callback, isBefore) {
        var elLink = Evme.$create('li', {
            'class': "link",
            'data-l10n-id': Evme.Utils.l10nKey(NAME, l10Key)
        });
        
        elLink.addEventListener("click", function onClick(e) {
            callback(e);
        });

        // prevents input blur
        elLink.addEventListener("mousedown", function onClick(e) {
            e.stopPropagation();
            e.preventDefault();
        });
        
        if (isBefore) {
            elList.insertBefore(elLink, elList.firstChild);
        } else {
            elList.appendChild(elLink);
        }
        
        window.setTimeout(self.scrollToStart, 0);
        
        return elLink;
    };
    
    this.addText = function addText(l10Key) {
        var el = Evme.$create('li', {
            'class': "text",
            'data-l10n-id': Evme.Utils.l10nKey(NAME, l10Key)
        });
        
        el.addEventListener("click", function onClick(e) {
            e.stopPropagation();
            e.preventDefault();
        });
        
        elList.appendChild(el);
        
        self.scrollToStart();
    };
    
    function animateSuggestions() {
        elList.classList.remove("anim");
        elList.classList.add("start");
        
        window.setTimeout(function onTimeout(){
            elList.classList.add("anim");
            
            window.setTimeout(function onTimeout(){
                elList.classList.remove("start");
                
                window.setTimeout(function onTimeout(){
                    elList.classList.remove("anim");
                    
                    if (currentDisplayedType == "" && !Evme.Utils.Cookies.get("fs")) {
                        self.flash();
                    }
                }, 50);
            }, 50);
        }, 50);
    }

    function removeElement(text) {
        if (!text) {
            return false;
        }
        
        text = text.toLowerCase().replace(/\[\]/gi, "");
        
        var removed = false,
            elItems = elList.childNodes;
        
        for (var i=0,el=elItems[i]; el; el=elItems[++i]) {
            var sugg = (el.dataset.suggestion || "").toLowerCase().replace(/\[\]/gi, "");
            
            if (sugg === text) {
                Evme.$remove(el);
                removed = true;
            }
        }
        
        return removed;
    }

    function getElement(item, index, source) {
        var id = "",
            isSmartObject = (typeof item === "object"),
            text = item;
            
        if (isSmartObject) {
            id = item.id;
            text = item.name;
        }
        
        if (!text) {
            return false;
        }
        
        text = text.replace(/</g, "&lt;");
        
        var content = text.replace(/\[/g, "<b>").replace(/\]/g, "</b>");
        
        
        // Pass . so that Brain will know not to search for it
        if (isSmartObject && !item.type && item.type != "") {
            text = ".";
        }
        
        return '<li data-index="' + index + '" data-suggestion="' + text.replace(/"/g, "&quot;") + '" data-source="' + source + '" data-type="' + id + '">' + content + '</li>';
    }

    function elementClick(e) {
        e.stopPropagation();
        e.preventDefault();
        
        clicked = true;
        window.setTimeout(function onTimeout(){
            clicked = false;
        }, 500);
        
        var elClicked = e.originalTarget || e.target;
        
        while (elClicked && elClicked.nodeName !== "LI") {
            elClicked = elClicked.parentNode;
        }
        
        if (!elClicked) {
            clicked = false;
            return;
        }
        
        if (elClicked.classList.contains("label") || elClicked.classList.contains("text")) {
            return;
        }
        
        var val = elClicked.dataset.suggestion,
            valToSend = (val || "").replace(/[\[\]]/g, "").toLowerCase(),
            index = elClicked.dataset.index,
      source = elClicked.dataset.source,
            type = elClicked.dataset.type;
            
        if (val) {
            cbClick(elClicked, index, isVisibleItem(index), val, valToSend, source, type);
        }
    }

    function titleClicked(e){
        e.preventDefault();
        e.stopPropagation();
        
        if (Evme.$('.query', elTitle).length === 0) {
            return;
        }
        
        window.setTimeout(function onTimeout(){
            if (!clicked) {
                self.hideTitle();
                self.showRefinement();
            }
        }, 100);
    }
    
    function isVisibleItem(index){
        return index <= lastVisibleItem;
    }

    function cbLoaded(inputQuery, parsedQuery, suggestions, spelling, types) {
        Evme.EventHandler.trigger(NAME, "load", {
            "suggestions": suggestions,
            "spelling": spelling,
            "types": types,
            "query": inputQuery
        });
    }
    
    function cbClick(elClicked, index, isVisibleItem, originalValue, val, source, type) {
        Evme.EventHandler.trigger(NAME, "click", {
            "el": elClicked,
            "originalValue": originalValue,
            "value": val,
            "source": source,
            "type": type,
            "index": index,
            "visible": isVisibleItem
        });
    }
}


Evme.Location = new function Evme_Location() {
    var NAME = 'Location', self = this,
        lastUpdateTime = 0,
  timeoutRequest = null,

        requestTimeout = 'FROM CONFIG',
  refreshInterval = 'FROM CONFIG',

  // since we update location right before apps are rendered
  // we give it a timeout so it doesn't block the actual rendering
  TIMEOUT_BEFORE_UPDATING_LOCATION = 2000;
    
    this.init = function init(options) {
        options || (options = {});
        
        refreshInterval = options.refreshInterval;
        requestTimeout = options.requestTimeout;
        
        Evme.EventHandler.trigger(NAME, 'init');
    };
    
    this.requestUserLocation = function requestUserLocation() {
      window.clearTimeout(timeoutRequest);
      timeoutRequest = window.setTimeout(function requestLocation() {
        var hadError = false;
        
        // this method prevents double error-reporting
        // in case we get both error and timeout, for example
        function reportError(data) {
            if (!hadError) {
                hadError = true;
                cbError(data);
            }
        }
        
        cbRequest();
        
        navigator.geolocation.getCurrentPosition(function onLocationSuccess(data){
            if (!data || !data.coords) {
                reportError(data);
            } else if (!hadError) {
                cbSuccess(data);
            }
        }, reportError,
        { "timeout": requestTimeout });
      }, TIMEOUT_BEFORE_UPDATING_LOCATION);
    };
    
    this.updateIfNeeded = function updateIfNeeded() {
        if (self.shouldUpdate()) {
            self.requestUserLocation();
            return true;
        }
        return false;
    };
    
    this.shouldUpdate = function shouldUpdate() {
        return Date.now() - lastUpdateTime > refreshInterval;
    };
    
    function cbRequest() {
        Evme.EventHandler.trigger(NAME, "request");
    }
    
    function cbSuccess(data) {
        lastUpdateTime = Date.now();
        
        Evme.EventHandler.trigger(NAME, "success", {
            "position": data
        });
    }
    
    function cbError(data) {
        Evme.EventHandler.trigger(NAME, "error", data);
    }
};

Evme.Searchbar = new function Evme_Searchbar() {
    var NAME = "Searchbar", self = this,
        el = null, elForm = null, elClear = null, elDefaultText = null,
        value = "", isFocused = false,
        timeoutSearchOnBackspace = null, timeoutPause = null, timeoutIdle = null,
        intervalPolling = null,

  pending,
        
        SEARCHBAR_POLLING_INTERVAL = 300,
        TIMEOUT_BEFORE_SEARCHING_ON_BACKSPACE = 500,
        TIMEOUT_BEFORE_SENDING_PAUSE_EVENT = "FROM CONFIG",
        TIMEOUT_BEFORE_SENDING_IDLE_EVENT = "FROM CONFIG",
        RETURN_KEY_CODE = 13,
        SET_FOCUS_ON_CLEAR = true,
        BACKSPACE_KEY_CODE = 8,
        DELETE_KEY_CODE = 46;

    this.init = function init(options) {
        !options && (options = {});
        
        el = options.el;
        elDefaultText = options.elDefaultText;
        elForm = options.elForm;
        
        if (typeof options.setFocusOnClear === "boolean") {
            SET_FOCUS_ON_CLEAR = options.setFocusOnClear;
        }
        
        elForm.addEventListener("submit", function oSubmit(e){
            e.preventDefault();
            e.stopPropagation();
            cbReturnPressed(e, el.value);
        });
        
        TIMEOUT_BEFORE_SENDING_PAUSE_EVENT = options.timeBeforeEventPause;
        TIMEOUT_BEFORE_SENDING_IDLE_EVENT = options.timeBeforeEventIdle;
        
        el.addEventListener("focus", cbFocus);
        el.addEventListener("blur", cbBlur);
        el.addEventListener("keydown", inputKeyDown);
        el.addEventListener("keyup", inputKeyUp);
        el.addEventListener('contextmenu', onContextMenu);
        
        var elButtonClear = Evme.$("#button-clear");
        elButtonClear.addEventListener("touchstart", function onTouchStart(e){
            e.preventDefault();
            e.stopPropagation();
            clearButtonClick();
        });
        
        Evme.EventHandler.trigger(NAME, "init");
    };
    
    this.getValue = function getValue() {
        return trim(value) === '' ? '' : value;
    };
    
    this.isFocused = function getIsFocused() {
        return isFocused;
    };
    
    this.setValue = function setValue(newValue, bPerformSearch, bDontBlur) {
        if (newValue !== "") {
            self.showClearButton();
        }
        
        if (value !== newValue) {
            value = newValue;
            el.value = value;

            if (bPerformSearch) {
                if (value === "") {
                    cbEmpty();
                } else {
                    cbValueChanged(value);
                }
            }

            if (!bDontBlur) {
                self.blur();
            }
        }
    };

    this.clear = function clear() {
        self.hideClearButton();
        value = "";
        el.value = "";
    };
    
    this.clearIfHasQuery = function clearIfHasQuery() {
        if (value) {
            self.setValue('', true);
            return true;
        }
        
        return false;
    };

    this.focus = function focus() {
        if (isFocused) {
            return;
        }
        
        el.focus();
        cbFocus();
    };

    this.blur = function blur(e) {
        if (!isFocused) return;
        
        el.blur();
        cbBlur(e);
    };
    
    this.getElement = function getElement() {
        return el;
    };

    this.startRequest = function startRequest() {
        pending = true;
    };

    this.endRequest = function endRequest() {
        pending = false;
    };

    this.isWaiting = function isWaiting() {
        return pending;
    };
    
    this.hideClearButton = function hideClearButton() {
        Evme.$("#search-header").classList.remove("clear-visible");
    };
    
    this.showClearButton = function showClearButton() {
        Evme.$("#search-header").classList.add("clear-visible");
    };
    
    function clearButtonClick() {
        self.setValue("", false, true);
        
        if (SET_FOCUS_ON_CLEAR) {
            el.focus();
        }
        
        window.setTimeout(function onTimeout(){
            cbClear();
            cbEmpty();
        }, 0);
        
        Evme.EventHandler.trigger(NAME, "clearButtonClick");
    }
    
    function inputKeyDown(e) {
        window.clearTimeout(timeoutPause);
        window.clearTimeout(timeoutIdle);
    }
    
    function inputKeyUp(e) {
        var currentValue = el.value;
        
        if (currentValue !== value) {
            value = currentValue;

            if (self.getValue() === '') {
                timeoutSearchOnBackspace && window.clearTimeout(timeoutSearchOnBackspace);
                cbEmpty();
            } else {
                self.showClearButton();
                if (e.keyCode === BACKSPACE_KEY_CODE) {
                    timeoutSearchOnBackspace && window.clearTimeout(timeoutSearchOnBackspace);
                    timeoutSearchOnBackspace = window.setTimeout(function onTimeout(){
                        cbValueChanged(value);
                    }, TIMEOUT_BEFORE_SEARCHING_ON_BACKSPACE);
                } else {
                    cbValueChanged(value);
                }
            }
        }
    }

    function onContextMenu(e) {
        e.stopPropagation();
    }

    function pasted(e) {
        //
         // Setting timeout because otherwise the value of the input is the one
         // before the paste.
         //
        window.setTimeout(function onTimeout(){
            inputKeyUp({
                "keyCode": ""
            });
        }, 0);
    }

    function cbValueChanged(val) {
        timeoutPause = window.setTimeout(cbPause, TIMEOUT_BEFORE_SENDING_PAUSE_EVENT);
        timeoutIdle = window.setTimeout(cbIdle, TIMEOUT_BEFORE_SENDING_IDLE_EVENT);
        
        Evme.EventHandler.trigger(NAME, "valueChanged", {
            "value": val
        });
    }
    
    function cbEmpty() {
        self.hideClearButton();
        Evme.EventHandler.trigger(NAME, "empty", {
            "sourceObjectName": NAME
        });
    }
    
    function cbReturnPressed(e, val) {
        Evme.EventHandler.trigger(NAME, "returnPressed", {
            "e": e,
            "value": val
        });
    }
    
    function cbClear() {
        Evme.EventHandler.trigger(NAME, "clear");
    }
    
    function cbFocus(e) {
        if (isFocused) {
            return;
        }
        isFocused = true;
        
        Evme.Brain && Evme.Brain[NAME].onfocus({
            "e": e
        });
    }
    
    function cbBlur(e) {
        if (!isFocused) {
            return;
        }
        
        isFocused = false;
        
        Evme.Brain && Evme.Brain[NAME].onblur({
            "e": e
        });
    }
    
    function cbPause(e) {
        Evme.EventHandler.trigger(NAME, "pause", {
            "query": value
        });
    }
    
    function cbIdle(e) {
        Evme.EventHandler.trigger(NAME, "idle", {
            "query": value
        });
    }
}

Evme.SearchHistory = new function Evme_SearchHistory() {
    var NAME = "SearchHistory", self = this, history = [],
        STORAGE_KEY = "userHistory",
        MAXIMUM_ENTRIES = "FROM CONFIG";
    
    this.init = function init(options) {
        !options && (options = {});
        
        MAXIMUM_ENTRIES = options.maxEntries;
        
        populate();
        
        Evme.EventHandler.trigger(NAME, "init");
    };
    
    this.save = function save(query, type) {
        !type && (type = "");
        query = query.toLowerCase();
        type = type.toLowerCase();
        
        var obj = {
            "query": query,
            "type": type
        };
        
        var removed = self.remove(obj);
        
        history.push(obj);
        trim();
        
        saveToStorage();
        
        return removed;
    };
    
    this.remove = function remove(obj) {
        var itemPosition = -1;
        
        for (var i=0,l=history.length; i<l; i++) {
            if (history[i].query == obj.query) {
                itemPosition = i;
                break;
            }
        }
        
        if (itemPosition != -1) {
            history.splice(itemPosition, 1);
        }
        
        return (itemPosition != -1);
    }
    
    this.get = function get() {
        // use slice(0) to clone the array (return val and not ref)
        return history.slice(0).reverse();
    };
    
    this.clear = function clear() {
        history = [];
        Evme.Storage.remove(STORAGE_KEY);
        
        Evme.EventHandler.trigger(NAME, "clear");
    };
    
    function trim() {
        if (history.length > MAXIMUM_ENTRIES) {
            history.splice(0, history.length-MAXIMUM_ENTRIES);
        }
    }
    
    function saveToStorage() {
        var historyString = "";
        try {
            historyString = JSON.stringify(history);
        } catch(ex) {
            
        }
        
        Evme.Storage.set(STORAGE_KEY, historyString);
    }
    
    function populate() {
        Evme.Storage.get(STORAGE_KEY, function storageGot(fromStorage) {
            if (fromStorage) {
                try {
                    history = JSON.parse(fromStorage);
                    trim();
                } catch(ex) {
                    history = [];
                }
            } else {
                history = [];
            }
            
            var changed = false;
            for (var i=0; i<history.length; i++) {
              if (!history[i].query.replace(/\s/g, '')) {
                history.splice(i, 1);
                i--;
                changed = true;
              }
            }
            
            if (changed) {
              saveToStorage();
            }
            
            Evme.EventHandler.trigger(NAME, "populate");
        });
    }
}

Evme.RESULT_TYPE = {
  CONTACT: 'contact',
  INSTALLED: 'installed',
  MARKET: 'native_download',
  MARKET_SEARCH: 'market_search',
  CLOUD: 'app',
  WEBLINK: 'weblink'
};

Evme.Result = function Evme_Result() {
  var NAME = "Result",
      self = this,
      el = null,

      TEXT_HEIGHT = Evme.Utils.APPS_FONT_SIZE * 3,
      TEXT_WIDTH = 72 * Evme.Utils.devicePixelRatio,
      TEXT_MARGIN = 6 * Evme.Utils.devicePixelRatio,

      image = new Image();


  this.type = 'NOT_SET';
  this.cfg = {};
  this.elIcon = null;

  this.init = function init(cfg) {
    self.cfg = cfg;

    el = Evme.$create('li', {
      'id': 'app_' + cfg.id,
      'data-name': cfg.name
    }, '<img />');

    this.elIcon = el.querySelector('img');

    // remove button
    if (cfg.isRemovable) {
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
    self.cfg.icon = iconObj;

    if (el) {
      el.setAttribute('data-name', self.cfg.name);

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
    el.dataset.iconId = this.cfg.id;
    el.dataset.iconSrc = src;
  };

  // @default
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

  // @default
  this.initIcon = function initIcon(baseHeight, textOffset) {
    var canvas = document.createElement('canvas'),
  context = canvas.getContext('2d');

    canvas.width = TEXT_WIDTH;
    canvas.height = baseHeight + TEXT_MARGIN + TEXT_HEIGHT - 1;

    Evme.Utils.writeTextToCanvas({
      "text": self.cfg.name,
      "context": context,
      "offset": textOffset + TEXT_MARGIN
    });

    return canvas;
  };

  // @default
  this.iconPostRendering = function iconPostRendering(iconCanvas) {
    // do nothing
  };

  // @default
  this.finalizeIcon = function finalizeIcon(canvas) {
    self.elIcon.src = canvas.toDataURL();
  };

  // @default
  this.launch = function launchResult() {
    Evme.Utils.log("Result.launch [not implemented]");
  };

  this.remove = function remove() {
    Evme.$remove(el);
  };

  this.isExternal = function isExternal() {
    return self.cfg.isWeblink;
  };

  this.getElement = function getElement() {
    return el;
  };

  this.getId = function getId() {
    return self.cfg.id;
  };

  this.getLink = function getLink() {
    return self.cfg.appUrl;
  };

  this.getFavLink = function getFavLink() {
    return self.cfg.favUrl != "@" && self.cfg.favUrl || self.cfg.appUrl;
  };

  this.getIcon = function getIcon() {
    return self.cfg.icon;
  };

  this.getCfg = function getCfg() {
    return self.cfg;
  };

  function onClick(e) {
    e.stopPropagation();
    self.launch();

    Evme.EventHandler.trigger(NAME, "click", {
      "app": self,
      "appId": self.cfg.id,
      "el": el,
      "data": self.cfg,
      "e": e
    });
  }

  function onContextMenu(e) {
    e.stopPropagation();
    e.preventDefault();

    Evme.EventHandler.trigger(NAME, "hold", {
      "app": self,
      "appId": self.cfg.id,
      "el": el,
      "data": self.cfg
    });
  }

  // prevent app click from being triggered
  function stopPropagation(e) {
    e.stopPropagation();
  }

  function cbRemoveClick() {
    Evme.EventHandler.trigger(NAME, "remove", {
      "id": self.cfg.id
    });
  }
}

Evme.PROVIDER_TYPES = {
  CLOUD: 'cloud',
  CONTACTS: 'contacts',
  INSTALLED: 'installed',
  MARKETAPPS: 'marketapps',
  MARKETSEARCH: 'marketsearch',
  STATIC: 'static'
};

Evme.ResultManager = function Evme_ResultsManager() {

  var NAME = "NOT_SET", // SearchResults or CollectionResults
    self = this,
    progressIndicator,
    DEFAULT_NUMBER_OF_APPS_TO_LOAD = Evme.Config.numberOfAppsToLoad,
    SELECTOR_PROGRESS_INDICATOR = '[role="notification"].loading-more',
    TIMEOUT_BEFORE_SHOWING_PROGRESS_INDICATOR = 10,
    providers = {},

    el = null,
    elHeight = null,
    scrollableEl = null,
    appsArray = {}, appsDataArray = [],
    numberOfApps = 0,
    scroll = null,
    reportedScrollMove = false,
    shouldFadeBG = false,
    isSwiping = false,

    fadeBy = 0,
    showingFullScreen = false,
    apiHasMoreCloudApps = false,

    // for convenience
    CLOUD = Evme.PROVIDER_TYPES.CLOUD,
    CONTACTS = Evme.PROVIDER_TYPES.CONTACTS,
    INSTALLED = Evme.PROVIDER_TYPES.INSTALLED,
    MARKETAPPS = Evme.PROVIDER_TYPES.MARKETAPPS,
    MARKETSEARCH = Evme.PROVIDER_TYPES.MARKETSEARCH,
    STATIC = Evme.PROVIDER_TYPES.STATIC,

    SELECTOR_CLOUD_RESULTS = 'ul.cloud>li',
    SELECTOR_ALL_RESULTS = 'div>ul>li',

    SCROLL_BOTTOM_THRESHOLD = 5,
    MAX_SCROLL_FADE = 200,
    FULLSCREEN_THRESHOLD = 0.8,
    MAX_APPS_CLASSES = 150,
    APPS_PER_ROW = "FROM CONFIG",
    ICONS_STYLE_ID = "apps-icons",
    DEFAULT_ICON_URL = "FROM CONFIG",
    TIMEOUT_BEFORE_REPORTING_APP_HOLD = 800,
    SLUG_PREFIX = 'store://',
    CLASS_HAS_MORE_APPS = "has-more",
    ftr = {
      'fadeOnScroll': false
    };

  MAX_SCROLL_FADE *= Evme.Utils.devicePixelRatio;

  this.init = function init(options) {
    !options && (options = {});

    for (var k in options.features) {
      ftr[k] = options.features[k]
    }

    NAME = options.NAME;
    APPS_PER_ROW = options.appsPerRow;

    el = options.el;
    scrollableEl = Evme.$('div', el)[0];

    options.providers.forEach(function registerProviders(provider){
      registerProvider(provider.type, provider.config);
    });

    progressIndicator = new Evme.ResultsProgressIndicator();
    progressIndicator.init({
      "el": Evme.$(SELECTOR_PROGRESS_INDICATOR, el)[0],
      "waitTime": TIMEOUT_BEFORE_SHOWING_PROGRESS_INDICATOR
    });

    scrollableEl.addEventListener("touchend", function onTouchEnd() {
      self.timeoutHold && window.clearTimeout(self.timeoutHold);
    });

    scroll = new Scroll(el, {
      "onTouchStart": touchStart,
      "onTouchMove": touchMove,
      "onTouchEnd": touchEnd,
      "onScrollEnd": scrollEnd
    });

    Evme.EventHandler.trigger(NAME, "init");
  };

  this.clear = function clear() {
    self.scrollToTop();

    forEachProvider(function() {
      this.clear();
    });

    numberOfApps = 0;

    progressIndicator.hide();
    el.classList.remove(CLASS_HAS_MORE_APPS);

    return true;
  };

  this.renderStaticApps = function renderStaticApps(apps) {
    STATIC in providers && providers[STATIC].render(apps);
  };

  this.onNewQuery = function onNewQuery(data) {
    CONTACTS in providers && providers[CONTACTS].render(data);
    INSTALLED in providers && providers[INSTALLED].render(data);
  };

  this.APIData = {
    onRequestSent: function APIData_onRequest() {
      Evme.Utils.isOnline(function isOnlineCallback(isOnline) {
  isOnline && progressIndicator.wait();
      });
    },

    onRequestCanceled: function APIData_onRequestCancel() {
      progressIndicator.hide();
    },

    onResponseRecieved: function APIData_onResponse(response) {
      progressIndicator.hide();

      handleAPIHasMoreCloudApps(response.paging);

      var cloudApps = [],
  marketApps = [],
  pageNum = response.paging.first;

      // separate cloud from marketplace apps
      response.apps.forEach(function(app) {
  if (app.type === Evme.RESULT_TYPE.MARKET) {
    app.slug = getSlug(app);
    marketApps.push(app);
  } else if (app.type === Evme.RESULT_TYPE.CLOUD || app.type === Evme.RESULT_TYPE.WEBLINK) {
    cloudApps.push(app);
  }
      });

      // first results page
      // render market apps and result for launching market search
      if (!pageNum) {
  self.scrollToTop();

  MARKETAPPS in providers
    && providers[MARKETAPPS].render(marketApps, pageNum);

  response.nativeAppsHint && MARKETSEARCH in providers
    && providers[MARKETSEARCH].render({
      "query": response.query
    });
      }

      CLOUD in providers && providers[CLOUD].render(cloudApps, {
  "query": response.query,
  "pageNum": pageNum,
  "requestMissingIcons": requestMissingIcons
      });
    }
  };

  this.getElement = function getElement() {
    return el;
  };

  // used to update a collection icon when closing it
  this.getCloudResultsIconData = function getCloudResultsIconData(numToGet=Evme.Config.numberOfAppInCollectionIcon) {
    var iconData = [],
  items = Evme.$(SELECTOR_CLOUD_RESULTS, el);

    for (var i = 0, item; item = items[i++];) {
      if (item.dataset.iconSrc && Evme.$isVisible(item)) {
  iconData.push({"id": item.dataset.iconId, "icon": item.dataset.iconSrc});
      }

      if (iconData.length === numToGet) break;
    }

    return iconData;
  };

  this.getAppTapAndHoldTime = function getAppTapAndHoldTime() {
    return TIMEOUT_BEFORE_REPORTING_APP_HOLD;
  };

  this.disableScroll = function disableScroll() {
    scroll.disable();
  };
  this.enableScroll = function enableScroll() {
    scroll.enable();
  };

  this.getScrollPosition = function getScrollPosition() {
    return scroll.y;
  };

  this.getResultGridData = function getCurrentRowsCols(clickedResult) {
    var data = {},
      numBelow = 0, // num of results above the separator
      numAbove = 0; // num of results above the separator

    // get total rows cols
    forEachProvider(function(providerName) {
      var count = this.getResultCount();
      if (providerName === CLOUD) {
  numBelow += count;
      } else {
  numAbove += count;
      }
    });

    var maxResults = Math.max(numAbove, numBelow),
      cols = Math.min(maxResults, APPS_PER_ROW),
      rowsAbove = Math.ceil(numAbove / APPS_PER_ROW),
      rowsBelow = Math.ceil(numBelow / APPS_PER_ROW);

    // get clicked result index
    var itemSelector = (clickedResult.type === Evme.RESULT_TYPE.CLOUD) ? SELECTOR_CLOUD_RESULTS : SELECTOR_ALL_RESULTS;
    var nodeList = Array.prototype.slice.call(Evme.$(itemSelector, scrollableEl));
    var resultIndex = nodeList.indexOf(clickedResult.getElement());

    // calculate result row col
    var col = (resultIndex % APPS_PER_ROW) + 1;
    var row = Math.floor(resultIndex / APPS_PER_ROW) + 1;
    if (clickedResult.type === Evme.RESULT_TYPE.CLOUD) {
      row += rowsAbove;
    }

    return {
      "cols": cols,
      "rows": rowsAbove + rowsBelow,
      "rowIndex": row,
      "colIndex": col
    }
  };

  this.hasResults = function hasResults() {
    forEachProvider(function providerHasResults() {
      if (this.getResultCount()) {
  return true;
      }
    });
    return false;
  };

  this.changeFadeOnScroll = function changeFadeOnScroll(newValue) {
    ftr.fadeOnScroll = newValue;
  };

  function forEachProvider(callback) {
    for (var k in providers) {
      callback.call(providers[k], k);
    }
  }

  function registerProvider(key, cfg) {
    providers[key] = new cfg.renderer();
    providers[key].init(cfg);
  }

  // extract slug from API result (marketplace app)
  function getSlug(app) {
    if (app.appUrl) {
      var split = app.appUrl.split(SLUG_PREFIX);
      if (split.length) {
  return split[1];
      }
    }
  }

  function getAppIndex(elApp) {
    var elApps = elList.childNodes;
    for (var i = 0, el = elApps[i]; el; el = elApps[++i]) {
      if (el[i] === elApp) {
  return i;
      }
    }

    return 0;
  }

  function requestMissingIcons(ids) {
    Evme.Utils.log("requestMissingIcons: requesting " + ids.length + " icons");
    Evme.EventHandler.trigger("ResultManager", "requestMissingIcons", ids);
  }

  this.cbMissingIcons = function cbMissingIcons(data) {
    providers[CLOUD].updateIcons(data);
  }

  function touchStart(e) {
    if (ftr.fadeOnScroll) {
      shouldFadeBG = scroll.y === 0;
    } else {
      shouldFadeBG = false;
    }
    fadeBy = 0;
    reportedScrollMove = false;
  }

  function touchMove(e) {
    if (shouldFadeBG) {
      var _fadeBy = scroll.distY / MAX_SCROLL_FADE;

      if (_fadeBy < fadeBy) {
  _fadeBy = 0;
  shouldFadeBG = false;
      }

      fadeBy = _fadeBy;
      Evme.BackgroundImage.fadeFullScreen(fadeBy);
    } else {
      Evme.BackgroundImage.fadeFullScreen(0);
    }
  }

  function touchEnd(data) {
    if (shouldFadeBG && scroll.distY >= FULLSCREEN_THRESHOLD * MAX_SCROLL_FADE) {
      showingFullScreen = true;
      cbScrolledToTop();
      window.setTimeout(function onTimeout() {
  showingFullScreen = false;
      }, 1000);
    } else {
      !showingFullScreen && Evme.BackgroundImage.cancelFullScreenFade();
    }
  }

  function scrollEnd() {
    if (apiHasMoreCloudApps) {

      // kept separate for performance reasons
      var reachedBottom = scrollableEl.offsetHeight - el.offsetHeight <= scroll.y;
      if (reachedBottom) {
  cbScrolledToEnd();
      }
    }
  }

  function cbLoadComplete(data, missingIcons) {
    Evme.EventHandler.trigger(NAME, "loadComplete", {
      "data": data,
      "icons": missingIcons
    });
  }

  this.scrollToTop = function scrollToTop() {
    scroll.scrollTo(0, 0);
  }

  function cbScrolledToTop() {
    Evme.EventHandler.trigger(NAME, "scrollTop");
  }

  function cbScrolledToEnd() {
    Evme.EventHandler.trigger(NAME, "scrollBottom");
  }

  function handleAPIHasMoreCloudApps(data) {
    // if got less apps then requested, assume no more apps
    if (data.limit < DEFAULT_NUMBER_OF_APPS_TO_LOAD) {
      apiHasMoreCloudApps = false;
    } else {
      apiHasMoreCloudApps = data ? data.limit + data.first < data.max : false;
    }

    if (apiHasMoreCloudApps) {
      el.classList.add(CLASS_HAS_MORE_APPS);
    } else {
      el.classList.remove(CLASS_HAS_MORE_APPS);
    }
  }
}

Evme.ResultsProgressIndicator = function Evme_ResultsProgressIndicator() {
  var self = this,
    el, timer, waitTime;

  this.init = function init(cfg) {
    el = cfg.el;
    waitTime = cfg.waitTime;
  };

  this.wait = function wait() {
    clearTimeout(timer);
    timer = setTimeout(self.show, waitTime);
  };

  this.show = function show() {
    clearTimeout(timer);
    el.classList.add('show');
  };

  this.hide = function hide() {
    clearTimeout(timer);
    el.classList.remove('show');
  };
}

Evme.CloudAppResult = function Evme_CloudAppsResult(query) {
  Evme.Result.call(this);

  this.type = Evme.RESULT_TYPE.CLOUD;

  var SHADOW_OFFSET = 2 * Evme.Utils.devicePixelRatio,
      SHADOW_BLUR = 2 * Evme.Utils.devicePixelRatio,
      SIZE = 52 * Evme.Utils.devicePixelRatio,
      FULL_SIZE = SIZE + SHADOW_OFFSET + SHADOW_BLUR,

      self = this,
      roundedAppIcon;

  // @override
  // manipulate the icon (clipping, shadow, resize)
  this.onAppIconLoad = function CloudResult_onAppIconLoad() {
    var canvas = self.initIcon(FULL_SIZE, SIZE),
  context = canvas.getContext('2d'),

  elImageCanvas = document.createElement('canvas'),
  imageContext = elImageCanvas.getContext('2d'),
  fixedImage = new Image();

    elImageCanvas.width = elImageCanvas.height = FULL_SIZE;

    imageContext.beginPath();
    imageContext.arc(FULL_SIZE / 2, FULL_SIZE / 2, SIZE / 2, 0, Math.PI * 2, false);
    imageContext.closePath();
    imageContext.clip();
    imageContext.drawImage(this, (FULL_SIZE - SIZE) / 2, (FULL_SIZE - SIZE) / 2, SIZE, SIZE);

    // save a reference to the clipped icon
    roundedAppIcon = elImageCanvas.toDataURL();
    self.setIconSrc(roundedAppIcon);

    fixedImage.onload = function onImageLoad() {
      // shadow
      context.shadowOffsetX = 0;
      context.shadowOffsetY = SHADOW_OFFSET;
      context.shadowBlur = SHADOW_BLUR;
      context.shadowColor = 'rgba(0, 0, 0, 0.6)';
      context.drawImage(fixedImage, (canvas.width - FULL_SIZE) / 2, 0);
      self.finalizeIcon(canvas);
    };

    fixedImage.src = elImageCanvas.toDataURL('image/png');
  };

  // @override
  this.launch = function launchCloudApp() {
    EvmeManager.openCloudApp({
  "url": self.cfg.appUrl,
  "originUrl": self.getFavLink(),
  "title": self.cfg.name,
  "icon": roundedAppIcon,
  "urlTitle": query,
  "useAsyncPanZoom": self.cfg.isWeblink
    });
  };
};
Evme.CloudAppResult.prototype = Object.create(Evme.Result.prototype);
Evme.CloudAppResult.prototype.constructor = Evme.CloudAppResult;


Evme.CloudAppsRenderer = function Evme_CloudAppsRenderer() {
  var NAME = 'CloudAppsRenderer',
    self = this,
    containerEl,
    lastRenderedResults = {}, // app.id -> Result instance
    lastSignature = Evme.Utils.EMPTY_APPS_SIGNATURE,
    iconFormat = Evme.Utils.getIconsFormat(),
    defaultIconIndex = 0,

    DEFAULT_ICON_URLS = Evme.Config.design.apps.defaultIconUrl[Evme.Utils.ICONS_FORMATS.Large];


  this.init = function init(cfg) {
    containerEl = cfg.containerEl;
  };

  this.render = function render(apps, params) {
    if (!apps.length) return;

    var query = params.query,
  pageNum = params.pageNum,
  requestMissingIcons = params.requestMissingIcons,
  newSignature = Evme.Utils.getAppsSignature(apps);

    // if same apps as last - do nothing
    if (lastSignature === newSignature) {
      Evme.Utils.log("CloudAppsRenderer: nothing to render (signature match)");
      return;
    }
    lastSignature = newSignature;

    // if not "loaded more", clear current results
    if (pageNum === 0) {
      self.clear();
    }

    _render(apps, query, requestMissingIcons);
  };

  this.clear = function clear() {
    containerEl.innerHTML = '';
    lastRenderedResults = {};
    lastSignature = Evme.Utils.EMPTY_APPS_SIGNATURE;
    defaultIconIndex = 0;
  };

  /*
    data = [{ id: id, icon: {} }, ... ]
  */
  this.updateIcons = function updateIcons(data) {
    for (var i=0, entry; entry=data[i++];){
      var result = lastRenderedResults[entry.id];
      result && result.draw(entry.icon);
    }
  };

  this.getResultCount = function getResultCount() {
    return containerEl.childElementCount;
  };

  function _render(apps, query, requestMissingIcons){
    var docFrag = document.createDocumentFragment(),
      noIconAppIds = [];  // ids of apps received without an icon

    for (var i = 0, app; app = apps[i++];) {
      var result = new Evme.CloudAppResult(query),
    el = result.init(app);

      if (app.icon) {  // app with icon url from API response
  result.draw(app.icon);
  Evme.IconManager.add(app.id, app.icon, iconFormat);

      } else if (isWebLink(app)) {  // no id for weblinks so generate one
  app.id = 'app-' + Evme.Utils.uuid();
  app.icon = getDefaultIcon();
  result.draw(app.icon);

      } else {  // icon will be drawn from cache (or requested if missing)
  noIconAppIds.push(app.id);
      }

      lastRenderedResults[app.id] = result;

      docFrag.appendChild(el);
    }

    containerEl.appendChild(docFrag);

    noIconAppIds.length && getCachedIconsAsync(noIconAppIds, requestMissingIcons);
  }

  function getCachedIconsAsync(appIds, requestMissingIcons) {
    var idsMissing = [], // ids of apps which have no cached icon
      pendingRequests = appIds.length;

    for (var i=0, appId; appId=appIds[i++];) {
      _getCachedIcon(appId);
    }

    // wrapped in function to create new scope (with correct value of appId)
    function _getCachedIcon(appId) {
      Evme.IconManager.get(appId, function onIconFromCache(iconFromCache) {
  // make sure app still appears in results
  var app = lastRenderedResults[appId];
  if (!app) {
    return;
  }

  if (iconFromCache) {
    app.icon = iconFromCache;
    app.draw(iconFromCache);
  } else {
    idsMissing.push(appId);
    app.draw(getDefaultIcon());
  }

  pendingRequests--;

  // all cache requests returned - request missing icons
  if (pendingRequests === 0) {
    idsMissing.length && requestMissingIcons(idsMissing);
  }
      });
    }

  }

  function isWebLink(app){
    // apps that are not indexed by E.me (web links)
    // or missing id for some reason
    return app.isWebLink || app.type === Evme.RESULT_TYPE.WEBLINK || !app.id;
  }

  function getDefaultIcon() {
    var defaultIcon = DEFAULT_ICON_URLS[defaultIconIndex];
    defaultIconIndex = (defaultIconIndex + 1) % DEFAULT_ICON_URLS.length;
    return defaultIcon;
  }
};

Evme.ContactResult = function Evme_ContactResult(contactId) {
  var self = this;

  Evme.Result.call(this);
  this.type = Evme.RESULT_TYPE.CONTACT;

  // @override
  this.launch = function launchContactResult() {
    EvmeManager.openContact({"id": contactId});
  };
};
Evme.ContactResult.prototype = Object.create(Evme.Result.prototype);
Evme.ContactResult.prototype.constructor = Evme.ContactResult;

Evme.ContactResultsRenderer = function Evme_ContactResultsRenderer() {
  var NAME = "ContactResultsRenderer",
    self = this,
    containerEl,

    searchOptions = {
      filterBy: ["givenName"],
      filterOp: "contains",
      filterValue: "NOT_SET",
      filterLimit: 2
    };

  this.init = function init(cfg) {
    containerEl = cfg.containerEl;
  };

  this.render = function render(data) {
    self.clear();

    searchOptions.filterValue = data.query;

    var request = navigator.mozContacts.find(searchOptions);

    request.onsuccess = function(e) {
      var contacts = e.target.result;
      if (contacts && contacts.length) {
  renderDocFrag(contacts);
      }
    };
  };

  this.clear = function clear() {
    containerEl.innerHTML = '';
  };

  this.getResultCount = function getResultCount() {
    return containerEl.childElementCount;
  };

  function renderDocFrag(contacts) {
    var docFrag = document.createDocumentFragment();
    for (var i = 0, contact; contact = contacts[i++];) {
      var result = new Evme.ContactResult(contact.id),
  el = result.init({
    "name": contact.name[0]
  });

      result.draw(contact.photo[0] || Evme.DEFAULT_ICONS.CONTACT);
      docFrag.appendChild(el);
    }
    containerEl.appendChild(docFrag);
  }
};

Evme.InstalledAppResult = function Evme_InstalledAppResult() {
  Evme.Result.call(this);
  this.type = Evme.RESULT_TYPE.INSTALLED;

  // @override
  this.launch = function launchInstalledApp(){
    EvmeManager.openInstalledApp({
  "id": this.cfg.id,
  "origin": this.cfg.appUrl
    });
  };
};
Evme.InstalledAppResult.prototype = Object.create(Evme.Result.prototype);
Evme.InstalledAppResult.prototype.constructor = Evme.InstalledAppResult;

/*
  Renders installed apps
*/
Evme.InstalledAppsRenderer = function Evme_InstalledAppsRenderer() {
  var NAME = "InstalledAppsRenderer",
    DEFAULT_ICON = Evme.Utils.getDefaultAppIcon(),
    self = this,
    appsSignature = Evme.Utils.EMPTY_APPS_SIGNATURE,
    containerEl;

  this.init = function init(cfg) {
    containerEl = cfg.containerEl;
  };

  this.render = function render(data) {
    var apps = Evme.InstalledAppsService.getMatchingApps(data),
      newSignature = Evme.Utils.getAppsSignature(apps);

    if (!apps || !apps.length) {
      self.clear();
      return;
    }

    if (appsSignature === newSignature) {
      Evme.Utils.log("InstalledAppsRenderer: nothing new to render (signatures match)");

    } else {
      self.clear();
      renderDocFrag(apps);
      appsSignature = newSignature;
    }
  };

  this.clear = function clear() {
    containerEl.innerHTML = '';
    appsSignature = Evme.Utils.EMPTY_APPS_SIGNATURE;
  };

  this.getResultCount = function getResultCount() {
    return containerEl.childElementCount;
  };

  function renderDocFrag(apps) {
    var docFrag = document.createDocumentFragment();

    for (var i = 0, app; app = apps[i++];) {
      var result = new Evme.InstalledAppResult(),
  el = result.init(app);

      result.draw(app.icon || DEFAULT_ICON);
      docFrag.appendChild(el);
    }
    containerEl.appendChild(docFrag);
  }
};

/*
Responsible for maintaining app indexes

App index - list of apps installed on device, including apps and bookmarks but *excluding* collections
[
  {app id}: {
    "name": {display name},
    "icon": {HTML element},
    "appUrl": {app url}
  },
  ...
]

 Query index - a mapping from experience name to app ids (manifestURLs or bookmarkURLs)
{
  "music": ["manifestURL1", "bookmarkURL1"],
  "top apps": ["manifestURL2", "bookmarkURL2"],
  "radio": ["manifestURL3", "bookmarkURL3"],
  ...
}
*/
Evme.InstalledAppsService = new function Evme_InstalledAppsService() {
  var NAME = "InstalledAppsService",
    self = this,
    appIndex = {}, APP_INDEX_STORAGE_KEY = NAME + "-app-index",
    queryIndex = {}, QUERY_INDEX_STORAGE_KEY = NAME + "-query-index",
    appIndexPendingSubscribers = [],
    appIndexComplete = false;

  this.init = function init() {
    // create indexes
    createAppIndex();
    loadQueryIndex();

    // listeners
    window.addEventListener('appInstalled', onAppInstallChanged);
    window.addEventListener('appUninstalled', onAppInstallChanged);
  }

  this.requestAppsInfo = function requestAppsInfo() {
    var gridApps = EvmeManager.getGridApps(),
  guids = gridApps.map(function getId(gridApp){
    return gridApp.manifestURL || gridApp.bookmarkURL;
  });

    Evme.EventHandler.trigger(NAME, "requestAppsInfo", guids);
  };

  this.requestAppsInfoCb = function requestAppsInfoCb(appsInfoFromAPI) {
    queryIndex = {};

    for (var k in appsInfoFromAPI) {
      var appInfo = appsInfoFromAPI[k];

      // verify that the app info relates to an existing one in the appIndex
      var idInAppIndex = appInfo.guid;
      if (!(idInAppIndex in appIndex)) {
  continue;
      }

      // Store the marketplace api slug, in order to compare and dedup Marketplace app suggestions later on
      appIndex[idInAppIndex].slug = appInfo.nativeId;

      // queries is comprised of tags and experiences
      var tags = appInfo.tags || [],
  experiences = appInfo.experiences || [],
  queries = Evme.Utils.unique(tags.concat(experiences));

      // populate queryIndex
      for (var i = 0, query; query = queries[i++];) {
  query = normalizeQuery(query);
  if (!(query in queryIndex)) {
    queryIndex[query] = [];
  }
  queryIndex[query].push(idInAppIndex);
      }
    }

    Evme.Storage.set(QUERY_INDEX_STORAGE_KEY, queryIndex);
    Evme.EventHandler.trigger(NAME, "queryIndexUpdated");
  };

  this.getMatchingApps = function getMatchingApps(data) {
    if (!data || !data.query) {
      return [];
    }

    var matchingApps = [],
      query = normalizeQuery(data.query);

    // search appIndex
    // search query within first letters of app name words
    var regex = new RegExp('\\b' + query, 'i');
    for (var appId in appIndex) {
      // if there's a match, add to matchingApps
      var app = appIndex[appId];
      if ("name" in app && regex.test(app.name)) {
  matchingApps.push(app);
      }
    }

    // search query
    // search for only exact query match
    if (query in queryIndex) {
      for (var i = 0, appId; appId = queryIndex[query][i++];) {
  if (appId in appIndex) {
    var app = appIndex[appId];
    matchingApps.push(app);
  }
      }
    }

    matchingApps = Evme.Utils.unique(matchingApps, 'id');

    return matchingApps;
  };


  this.getAppById = function getAppById(appId, cb) {
    if (appIndexComplete) {
      cb(appIndex[appId]);
    } else {
      appIndexPendingSubscribers.push([appId, cb])
    }
  };

  this.getApps = function() {
    return appIndex;
  };

  this.getSlugs = function getAPIIds() {
    var ids = [];
    for (var id in appIndex) {
      var app = appIndex[id];
      app.slug && ids.push(app.slug);
    }
    return ids;
  };

  function onAppInstallChanged() {
    createAppIndex();
    self.requestAppsInfo();
  }

  function createAppIndex() {
    // empty current index and create a new one
    appIndex = {};

    appIndexComplete = false;

    var gridApps = EvmeManager.getGridApps(),
        gridAppsCount = gridApps.length;

    for (var i = 0, gridApp; gridApp = gridApps[i++];) {
      var appInfo = EvmeManager.getAppInfo(gridApp, function onAppInfo(appInfo){
        appIndex[appInfo.id] = appInfo;
        if (--gridAppsCount === 0) {
          onAppIndexComplete();
        }
      });
    }
  }

  function onAppIndexComplete() {
    appIndexComplete = true;
    appIndexPendingSubscribers.forEach(function execute(args) {
      self.getAppById.apply(self, args);
    });
  }

  function loadQueryIndex() {
    Evme.Storage.get(QUERY_INDEX_STORAGE_KEY, function queryIndexCb(queryIndexFromStorage) {
      if (queryIndexFromStorage) {
  queryIndex = queryIndexFromStorage;
      } else {
  self.requestAppsInfo();
      }
    });
  }

  function normalizeQuery(query) {
    return Evme.Utils.escapeRegexp(query.toLowerCase());
  }
};

Evme.MarketResult = function Evme_MarketResult(slug) {
  Evme.Result.call(this);

  var self = this,
    TEXT_HEIGHT = Evme.Utils.APPS_FONT_SIZE * 3,
    TEXT_WIDTH = 72 * Evme.Utils.devicePixelRatio,
    TEXT_MARGIN = 6 * Evme.Utils.devicePixelRatio,

    FONT_SIZE = 11 * Evme.Utils.devicePixelRatio;

  this.type = Evme.RESULT_TYPE.MARKET;
  this.slug = slug;

  // @override
  this.initIcon = function initIcon(baseHeight, textOffset) {
    var canvas = document.createElement('canvas'),
      context = canvas.getContext('2d');

    canvas.width = TEXT_WIDTH;
    canvas.height = baseHeight + TEXT_MARGIN + (2 * TEXT_HEIGHT) - 1;

    Evme.Utils.writeTextToCanvas({
      "text": "Download",
      "context": context,
      "offset": textOffset + TEXT_MARGIN,
      "fontSize": FONT_SIZE
    });

    Evme.Utils.writeTextToCanvas({
      "text": this.cfg.name,
      "context": context,
      "offset": textOffset + TEXT_MARGIN + FONT_SIZE + 1 * Evme.Utils.devicePixelRatio
    });

    return canvas;
  };

  // @override
  this.launch = function launchMarketResult() {
    if (slug) {
      EvmeManager.openMarketplaceApp({"slug": slug});
    }
  };
};

Evme.MarketResult.prototype = Object.create(Evme.Result.prototype);
Evme.MarketResult.prototype.constructor = Evme.Evme_MarketResult;


Evme.MarketAppsRenderer = function Evme_MarketAppsRenderer() {
  var NAME = 'MarketAppsRenderer',
    DEFAULT_ICON = Evme.Utils.getDefaultAppIcon(),

    lastSignature = Evme.Utils.EMPTY_APPS_SIGNATURE,
    self = this,
    containerEl;


  this.init = function init(cfg) {
    // container in which to render apps in
    containerEl = cfg.containerEl;
  };

  this.render = function render(apps, pageNum) {
    if (!apps.length) {
      this.clear();
      return;
    }

    var newSignature = Evme.Utils.getAppsSignature(apps);
    if (lastSignature === newSignature) {
      Evme.Utils.log("MarketAppsRenderer: nothing to render (signature match)");
      return;
    }
    lastSignature = newSignature;

    // always renders the first page - clear previous results
    self.clear();

    _render(apps);
  };

  this.clear = function clear() {
    containerEl.innerHTML = '';
    lastSignature = Evme.Utils.EMPTY_APPS_SIGNATURE;
  };

  this.getResultCount = function getResultCount() {
    return containerEl.childElementCount;
  };

  function _render(apps) {
    var docFrag = document.createDocumentFragment();

    for (var i = 0, app; app = apps[i++];) {
      var result = new Evme.MarketResult(app.slug),
  el = result.init(app);

      if (app.icon) {
  getMarketIcon(app, result);
      } else {
  app.icon = DEFAULT_ICON;
  result.draw(app.icon);
      }

      docFrag.appendChild(el);
    }

    containerEl.appendChild(docFrag);
  }

  /**
   * Market icons are hosted on marketplace.cdn.mozilla.net
   * Get it using system XHR to avoid canvas security issues.
   * see http://www.w3.org/TR/2011/WD-html5-20110525/the-canvas-element.html#security-with-canvas-elements
   */
  function getMarketIcon(app, result) {
    Evme.Utils.systemXHR({
      "url": app.icon.data,
      "responseType": 'blob',
      "onSuccess": function onIconSuccess(response) {
  app.icon = response;
  result.draw(app.icon);
      },
      "onError": function onIconError(e) {
  app.icon = DEFAULT_ICON;
  result.draw(app.icon);
      }
    });
  }
};

Evme.MarketSearchResult = function Evme_MarketSearch(query) {
  var self = this,
    TEXT_HEIGHT = Evme.Utils.APPS_FONT_SIZE * 3,
    TEXT_WIDTH = 72 * Evme.Utils.devicePixelRatio,
    TEXT_MARGIN = 6 * Evme.Utils.devicePixelRatio,

    FONT_SIZE = 11 * Evme.Utils.devicePixelRatio;

  Evme.Result.call(this);
  this.type = Evme.RESULT_TYPE.MARKET_SEARCH;

  // @override
  this.initIcon = function initIcon(baseHeight, textOffset) {
    var canvas = document.createElement('canvas'),
  context = canvas.getContext('2d');

    canvas.width = TEXT_WIDTH;
    canvas.height = baseHeight + TEXT_MARGIN + (2 * TEXT_HEIGHT) - 1;

    Evme.Utils.writeTextToCanvas({
      "text": "Download",
      "context": context,
      "offset": textOffset + TEXT_MARGIN,
      "fontSize": FONT_SIZE
    });

    Evme.Utils.writeTextToCanvas({
      "text": "More Apps",
      "context": context,
      "offset": textOffset + TEXT_MARGIN + FONT_SIZE + 1 * Evme.Utils.devicePixelRatio
    });

    return canvas;
  };

  // @override
  this.launch = function launchMarketSearch() {
    EvmeManager.openMarketplaceSearch({"query" : query});
  };
};
Evme.MarketSearchResult.prototype = Object.create(Evme.Result.prototype);
Evme.MarketSearchResult.prototype.constructor = Evme.MarketSearchResult;

/*
  Renders the market-search result
*/
Evme.MarketSearchRenderer = function Evme_MarketSearchRenderer() {
  var NAME = 'MarketSearchRenderer',
      self = this,
      containerEl,
      app = {
  id: 'marketsearch',
  icon: Evme.DEFAULT_ICONS.MARKETPLACE,
  appUrl: 'store://?search'
      };

  this.init = function init(cfg) {
    containerEl = cfg.containerEl;
  };

  this.render = function render(data) {
    var query = data.query;

    this.clear();

    var marketSearchResult = new Evme.MarketSearchResult(query),
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

Evme.STATIC_APP_TYPE = {
  CLOUD: 'cloud'
};

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
      app.isRemovable = true;

      var result,
    el;

      if (app.staticType === Evme.STATIC_APP_TYPE.CLOUD){
  result = new Evme.CloudAppResult(app.collectionQuery);
      } else {
  result = new Evme.InstalledAppResult();
      }

      el = result.init(app);

      result.draw(app.icon || DEFAULT_ICON);
      docFrag.appendChild(el);
    }

    containerEl.appendChild(docFrag);
  }
}
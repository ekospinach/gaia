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

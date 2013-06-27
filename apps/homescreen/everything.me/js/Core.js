window.Evme = new function Evme_Core() {
  var NAME = "Core",
    self = this,
    recalculateHeightRetries = 1,
    TIMEOUT_BEFORE_INIT_SESSION = "FROM CONFIG",
    OPACITY_CHANGE_DURATION = 300,
    head_ts = new Date().getTime();

  this.shouldSearchOnInputBlur = true;

  this.init = function init() {
    var data = Evme.__config,
      apiHost = Evme.Utils.getUrlParam("apiHost") || data.apiHost;

    apiHost && Evme.api.setHost(apiHost);

    TIMEOUT_BEFORE_INIT_SESSION = data.timeoutBeforeSessionInit;

    Evme.Brain.init({
      "numberOfAppsToLoad": data.numberOfAppsToLoad + (Evme.Utils.devicePixelRatio > 1 ? data.apps.appsPerRow : 0),
      "minimumLettersForSearch": data.minimumLettersForSearch,
      "searchSources": data.searchSources,
      "pageViewSources": data.pageViewSources,
      "displayInstalledApps": data.apps.displayInstalledApps
    });

    Evme.DoATAPI.init({
      "apiKey": data.apiKey,
      "appVersion": data.appVersion,
      "authCookieName": data.authCookieName,
      "callback": function initCallback() {
        initObjects(data)
      }
    });
  };

  // Gaia communication methods
  this.setOpacityBackground = function setOpacityBackground(value) {
    Evme.BackgroundImage.changeOpacity(value, OPACITY_CHANGE_DURATION);
  };

  this.pageMove = function pageMove(value) {
    Evme.BackgroundImage.changeOpacity(Math.floor(value * 100) / 100);
  };

  this.onShow = function onShow() {
    document.body.classList.add('evme-displayed');
  };
  this.onHide = function onHide() {
    document.body.classList.remove('evme-displayed');

    Evme.Brain.Shortcuts.doneEdit();
    Evme.Brain.SmartFolder.closeCurrent();
    Evme.Shortcuts.scrollTo(0, 0);
  };

  this.onHideStart = function onHideStart(source) {
    Evme.Brain.SmartFolder.hideIfOpen();

    Evme.Searchbar.blur();

    if (source === "homeButtonClick") {
      if (
        Evme.Brain.Shortcuts.hideIfEditing() ||
        Evme.Brain.ShortcutsCustomize.hideIfOpen() ||
        Evme.Brain.ShortcutsCustomize.hideIfRequesting() ||
        Evme.Searchbar.clearIfHasQuery()) {
        return true;
      }
    }

    return false;
  };

  this.onSmartfolderSuggest = function onSmartfolderSuggest() {
    Evme.Brain.ShortcutsCustomize.showUI();
  };
  
  this.onSmartfolderCustom = function onSmartfolderCustom() {
    Evme.ShortcutsCustomize.newCustom();
  };

  function initObjects(data) {
    var appsEl = Evme.$("#evmeApps"),
      smartFolderEl = document.querySelector(".smart-folder .evme-apps");

    Evme.Features.init({
      "featureStateByConnection": data.featureStateByConnection
    });

    Evme.ConnectionMessage.init({
      "elParent": Evme.Utils.getContainer()
    });

    Evme.Location.init({
      "refreshInterval": data.locationInterval,
      "requestTimeout": data.locationRequestTimeout
    });

    Evme.Shortcuts.init({
      "el": Evme.$("#shortcuts"),
      "elLoading": Evme.$("#shortcuts-loading"),
      "design": data.design.shortcuts,
      "defaultShortcuts": data._defaultShortcuts
    });

    Evme.ShortcutsCustomize.init({
      "elParent": Evme.Utils.getContainer()
    });

    Evme.Searchbar.init({
      "el": Evme.$("#search-q"),
      "elForm": Evme.$("#search-rapper"),
      "elDefaultText": Evme.$("#default-text"),
      "timeBeforeEventPause": data.searchbar.timeBeforeEventPause,
      "timeBeforeEventIdle": data.searchbar.timeBeforeEventIdle,
      "setFocusOnClear": false
    });

    Evme.Helper.init({
      "el": Evme.$("#helper"),
      "elTitle": Evme.$("#search-title"),
      "elTip": Evme.$("#helper-tip")
    });

    Evme.SearchResults = new Evme.ResultManager();
    Evme.SearchResults.init({
      "NAME": 'SearchResults',
      "el": appsEl,
      "appsPerRow": data.apps.appsPerRow,
      "providers": [{
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

    Evme.SmartfolderResults = new Evme.ResultManager();
    Evme.SmartfolderResults.init({
      "NAME": 'SmartfolderResults',
      "el": smartFolderEl,
      "appsPerRow": data.apps.appsPerRow,
      "providers": [{
          type: Evme.PROVIDER_TYPES.STATIC,
          config: {
            "renderer": Evme.StaticAppsRenderer,
            "containerEl": Evme.$(".static", smartFolderEl)[0]
          }
        }, {
          type: Evme.PROVIDER_TYPES.CLOUD,
          config: {
            "renderer": Evme.CloudAppsRenderer,
            "containerEl": Evme.$(".cloud", smartFolderEl)[0]
          }
        }
      ]
    });

    Evme.InstalledAppsService.init();
    // TODO: this is some testing data
    Evme.InstalledAppsService._loadFixtures();

    Evme.IconGroup.init({});

    Evme.BackgroundImage.init({
      "el": Evme.$("#search-overlay"),
      "elementsToFade": [Evme.$(".smart-folder .evme-apps")[0], Evme.$("#evmeApps"), Evme.$("#header"), Evme.$("#search-header")],
      "defaultImage": data.defaultBGImage
    });

    Evme.Banner.init({
      "el": Evme.$("#evmeBanner")
    });

    Evme.SearchHistory.init({
      "maxEntries": data.maxHistoryEntries
    });

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

    Evme.Tasker.init({
      "triggerInterval": data.taskerTriggerInterval
    });

    Evme.EventHandler.trigger(NAME, "init", {
      "deviceId": Evme.DoATAPI.getDeviceId()
    });
  }
};

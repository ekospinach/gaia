(function(){
    "use strict";
    
    var NAME = "Core", self = this, logger,
        recalculateHeightRetries = 1,
        TIMEOUT_BEFORE_INIT_SESSION = "FROM CONFIG",
        OPACITY_CHANGE_DURATION = 300,
        head_ts = new Date().getTime();

    Evme.shouldSearchOnInputBlur = true;

    Evme.init = function init() {
        var data = Evme.__config;
        
        logger = (typeof Logger !== "undefined") ? new Logger() : console;
        
        TIMEOUT_BEFORE_INIT_SESSION = data.timeoutBeforeSessionInit;
        
        Evme.api.init({
            "host": data.api.host,
            "version": data.api.version
        });
        
        Evme.Brain.init({
            "numberOfAppsToLoad": data.numberOfAppsToLoad,
            "logger": logger,
            "minimumLettersForSearch": data.minimumLettersForSearch,
            "timeBeforeAllowingDialogsRemoval": data.timeBeforeAllowingDialogsRemoval,
            "tips": data.tips,
            "searchSources": data.searchSources,
            "pageViewSources": data.pageViewSources,
            "displayInstalledApps": data.apps.displayInstalledApps
        });

        Evme.DoATAPI.init({
            "env": data.env.server,
            "apiKey": data.api.key,
            "appVersion": data.appVersion,
            "authCookieName": data.authCookieName
        });

        initObjects(data);
    };

    // Gaia communication methods
    Evme.setOpacityBackground = function setOpacityBackground(value) {
        Evme.BackgroundImage.changeOpacity(value, OPACITY_CHANGE_DURATION);
    };

    Evme.pageMove = function pageMove(value) {
        Evme.BackgroundImage.changeOpacity(Math.floor(value*100)/100);
    };

    Evme.onShow = function onShow() {
        document.body.classList.add('evme-displayed');

        Evme.Shortcuts.refreshScroll();
        Evme.Helper.refreshScroll();
    };
    Evme.onHide = function onHide() {
        document.body.classList.remove('evme-displayed');

        Evme.Brain.Shortcuts.doneEdit();
        Evme.Brain.SmartFolder.closeCurrent();
    };

    Evme.onHideStart = function onHideStart(source) {
        if (source === "homeButtonClick") {
            if (
                Evme.Brain.Shortcuts.hideIfEditing() ||
                Evme.Brain.ShortcutsCustomize.isOpen() ||
                Evme.Brain.ShortcutsCustomize.hideIfRequesting() ||
                Evme.Brain.SmartFolder.hideIfOpen() ||
                Evme.Brain.Apps.clearIfHas()
            ) {
                return true;
            }
        }

        Evme.Brain.Searchbar.blur();
        return false; // allow navigation to homescreen
    };

    function initObjects(data) {
        var Evme = window.Evme;
        
        Evme.ConnectionMessage.init({
            
        });

        Evme.Location.init({
            
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

        Evme.Apps.init({
            "el": Evme.$("#evmeApps"),
            "elHeader": Evme.$("#header"),
            "design": data.design.apps,
            "appHeight": data.apps.appHeight,
            "minHeightForMoreButton": data.minHeightForMoreButton,
            "defaultScreenWidth": {
                "portrait": 320,
                "landscape": 480
            }
        });

        Evme.BackgroundImage.init({
            "el": Evme.$("#search-overlay"),
            "elementsToFade": [Evme.$("#evmeApps"), Evme.$("#header"), Evme.$("#search-header")],
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
            "logger": logger,
            "namespace": Evme,
            "DoATAPI": Evme.DoATAPI,
            "getCurrentAppsRowsCols": Evme.Apps.getCurrentRowsCols,
            "Brain": Evme.Brain,
            "env": data.env.server,
            "connectionLow": Evme.Utils.connection().speed != Evme.Utils.connection().SPEED_HIGH,
            "sessionObj": Evme.DoATAPI.Session.get(),
            "pageRenderStartTs": head_ts,
            "SEARCH_SOURCES": data.searchSources,
            "PAGEVIEW_SOURCES": data.pageViewSources
        });
        
        Evme.Storage.init({
            
        });
        
        // once this event is triggered- the app starts running!
        Evme.EventHandler.trigger(NAME, "init", {"deviceId": Evme.DoATAPI.getDeviceId()});
    }
}());
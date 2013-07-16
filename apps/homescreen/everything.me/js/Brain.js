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
        QUERIES_TO_NOT_CACHE = "",
        DEFAULT_NUMBER_OF_APPS_TO_LOAD = Evme.Config.numberOfAppsToLoad,
        NUMBER_OF_APPS_TO_LOAD_IN_FOLDER = 16,
        NUMBER_OF_APPS_TO_LOAD = "FROM CONFIG",
        TIME_BEFORE_INVOKING_HASH_CHANGE = 200,
        MINIMUM_LETTERS_TO_SEARCH = 2,
        SEARCH_SOURCES = {},
        PAGEVIEW_SOURCES = {},
        ICON_SIZE = null,

        TIMEOUT_BEFORE_REQUESTING_APPS_AGAIN = 500,
        TIMEOUT_BEFORE_SHOWING_DEFAULT_IMAGE = 3000,
        TIMEOUT_BEFORE_SHOWING_HELPER = 3000,
        TIMEOUT_BEFORE_RENDERING_AC = 300,
        TIMEOUT_BEFORE_RUNNING_APPS_SEARCH = 600,
        TIMEOUT_BEFORE_RUNNING_IMAGE_SEARCH = 800,
        TIMEOUT_BEFORE_AUTO_RENDERING_MORE_APPS = 200,
        
        CLASS_WHEN_HAS_QUERY = 'evme-has-query',
        CLASS_WHEN_SMART_FOLDER_VISIBLE = 'evme-smart-folder-visible',
        CLASS_WHEN_LOADING_SHORTCUTS_SUGGESTIONS = 'evme-suggest-folders-loading',

        L10N_SYSTEM_ALERT="alert",

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
        window.addEventListener('EvmeSmartFolderLaunch', onSmartFolderLaunch);
        window.addEventListener('EvmeShortcutCreate', onShortcutCreate);
        window.addEventListener('EvmeShortcutAddApp', onShortcutAddApp);

        _config = options;

        NUMBER_OF_APPS_TO_LOAD = _config.numberOfAppsToLoad || DEFAULT_NUMBER_OF_APPS_TO_LOAD;
        NUMBER_OF_APPS_TO_LOAD_IN_FOLDER = _config.numberOfAppsToLoad || NUMBER_OF_APPS_TO_LOAD_IN_FOLDER;

        SEARCH_SOURCES = _config.searchSources;
        PAGEVIEW_SOURCES = _config.pageViewSources;

        DISPLAY_INSTALLED_APPS = _config.displayInstalledApps;

        ICON_SIZE = Evme.Utils.sendToOS(Evme.Utils.OSMessages.GET_ICON_SIZE);
    };

    function onSmartFolderLaunch(e) {
        var data = e.detail;
        Evme.SmartFolderStorage.get(data.id, function onGotFromStorage(folderSettings) {
            Evme.SmartFolder.show(folderSettings);
        });
    }

    function onShortcutCreate(e) {
        var options = e && e.detail;
        
        if (options) {
            // if shortcut created by dragging apps, hide the apps that created it
            if (options.apps && options.apps.length > 1) {
                // first hide the target app, where the folder will be created
                options.apps && Evme.Utils.sendToOS(Evme.Utils.OSMessages.HIDE_APP_FROM_GRID, options.apps[1]);
                addFolder(options);
                options.apps && Evme.Utils.sendToOS(Evme.Utils.OSMessages.HIDE_APP_FROM_GRID, options.apps[0]);
            } else {
                addFolder(options);
            }
            
        }
    }

    function onShortcutAddApp(e) {
        var options = e && e.detail,
            appManifest = options.app && options.app.manifestURL,
            folderId = options.folder && options.folder.id;

        if (appManifest && folderId) {
            Evme.SmartFolderStorage.get(folderId, function onGotSettings(folderSettings) {
                var app = Evme.InstalledAppsService.getAppByManifest(appManifest);
                if (app) {
                    Evme.SmartFolder.addApps([app], folderSettings);
                    Evme.Utils.sendToOS(Evme.Utils.OSMessages.HIDE_APP_FROM_GRID, {"manifestURL": appManifest});
                };
            });
        };
    }

    // create the shortcut icon and send it to the OS
    function addFolder(options) {
      var query = options.query,
          experienceId = options.experienceId,
          apps = options.apps,  // should have "name" and "manifest"
          shortcutIcons = options.icons || [],
          gridPosition = options.gridPosition,
          shortcutCanvas = null;

      // create the special icon (three apps icons on top of each other)
      Evme.IconGroup.get(shortcutIcons, '', createSmartFolder);

      function createSmartFolder(elCanvas) {
        shortcutCanvas = elCanvas;

        if (experienceId) {
          Evme.SmartFolderSettings.createByExperience(experienceId, {"icons": shortcutIcons}, addFolderToHomescreen);
        } else if (query) {
          Evme.SmartFolderSettings.createByQuery(query, {"icons": shortcutIcons}, addFolderToHomescreen);
        } else if (apps.length > 1) {
            Evme.SmartFolderSettings.createByAppPair(apps[0], apps[1], {"icons": shortcutIcons}, addFolderToHomescreen);
        }
      }

      function addFolderToHomescreen(folderSettings){
        // install the newely created shortcut!
        Evme.Utils.sendToOS(Evme.Utils.OSMessages.APP_INSTALL, {
          "id": folderSettings.id,
          "originUrl": 'fldr://' + folderSettings.id,
          "title": folderSettings.name,
          "icon": shortcutCanvas.toDataURL(),
          "isFolder": true,
          "gridPosition": gridPosition
        });

        // populate installed apps and update icon
        Evme.SmartFolderSettings.update(folderSettings);
      }
    }

    function initShortcuts() {
        var cacheKey = 'createdInitialShortcuts',
            appsFirstPage = 8;
        
        Evme.Storage.get(cacheKey, function onCacheValue(didInitShortcuts) {
            if (didInitShortcuts) {
                return;
            }

            var defaultShortcuts = Evme.__config['_localShortcuts'];

            for (var i = 0; i < defaultShortcuts.length; i++) {
                var page = (i < appsFirstPage) ? 0 : 1,
                    index = (i < appsFirstPage) ? i : (i % appsFirstPage),
                    shortcut = defaultShortcuts[i];

                if (shortcut.experienceId) {  // smartfolder shortcut
                    preinstalledFolder(shortcut, page, index);
                }
            }

            Evme.Storage.set(cacheKey, true);
        });
    }
      
    function preinstalledFolder(shortcut, page, index) {
        var query = shortcut.query,
            experienceId = shortcut.experienceId,
            appIds = shortcut.appIds,
            shortcutIcons = [],
            defaultIcons = Evme.__config['_localShortcutsIcons'];

        if (!query && experienceId) {
            var l10nkey = 'id-' + Evme.Utils.shortcutIdToKey(experienceId),
                translatedExperience = Evme.Utils.l10n('Shortcut', l10nkey);

            if (translatedExperience) {
                query = translatedExperience;
            }
        }

        for (var j = 0, appId; appId = appIds[j++];) {
            shortcutIcons.push({
                'id': appId,
                'icon': defaultIcons[appId] || defaultIcons['' + appId]
            });
        }

        addFolder({
            "icons": shortcutIcons.slice(0,3),
            "experienceId": experienceId,
            "query": query,
            "gridPosition": {
                "page": page,
                "index": index
            }
        });
    }

    // l10n: create a mutation observer to know when a node was added
    // and check if it needs to be translated
    function initL10nObserver() {
        new MutationObserver(Evme.Brain.l10nMutationObserver)
            .observe(elContainer, {
                childList: true,
                subtree: true
            });
    }
    
    // callback for "node added" mutation observer
    // this translates all the new nodes added
    // the mozL10nTranslate method is defined above, it's a reference to the mozilla l10n function
    this.l10nMutationObserver = function onMutationEventNodeAdded(mutations) {
        for (var i=0, mutation; mutation=mutations[i++];) {
            var children = mutation.addedNodes || [];
            for (var j=0, node; node=children[j++];) {
                if (node instanceof HTMLElement) {
                    node && mozL10nTranslate(node);
                }
            }
        }
    }

    /**
     * main event handling method that catches all the events from the different modules,
     * and calls the appropriate method in Brain
     * @_class (string) : the class that issued the event (Apps, SmartFolder, Helper, etc.)
     * @_event (string) : the event that the class sent
     * @_data (object)  : data sent with the event
     */
    function catchCallback(_class, _event, _data) {       
        Evme.Utils.log('Callback: ' + _class + '.' + _event);
        
        try {
            self[_class] && self[_class][_event] && self[_class][_event](_data || {});
        } catch(ex){
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
            initShortcuts();
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
            if (data && data.e) {
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

            if (!didClickApp && Evme.shouldSearchOnInputBlur){
                window.clearTimeout(timeoutBlur);
                timeoutBlur = window.setTimeout(self.returnPressed, TIMEOUT_BEFORE_RUNNING_BLUR);
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
        this.returnPressed = function returnPressed(data) {
            var query = Evme.Searchbar.getValue();
            Searcher.searchExactFromOutside(query, SEARCH_SOURCES.RETURN_KEY);
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
            Evme.Helper.animateLeft(function onAnimationComplete(){
                self.showDefault();
                Evme.Helper.animateFromRight();
            });
        };

        // transition to default items
        this.showDefault = function showDefault() {
            Searcher.cancelRequests();
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
                Evme.Helper.animateLeft(function onAnimationComplete(){
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
                for (var i=0,l=history.length; i<l; i++) {
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
                        Evme.Helper.addLink('history-link', function onLinkAdded(){
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
                    Evme.Helper.addLink('history-clear', function historyclearClick(e){
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
            
            setTimeout(Evme.Utils.isKeyboardVisible? Evme.Helper.showSuggestions : Evme.Helper.showTitle, TIMEOUT_ANDROID_BEFORE_HELPER_CLICK);
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

    // modules/Tasker/
    this.Tasker = new function Tasker() {
        var self = this;

        this.TASK_UPDATE_SHORTCUT_ICONS = "updateShortcutIcons";
        this.TASK_UPDATE_INSTALLED_QUERY_INDEX = "installedQueryIndexUpdate";

        // module init
        this.init = function init() {
            Evme.Tasker.add({
                "id": self.TASK_UPDATE_INSTALLED_QUERY_INDEX
            });

            Evme.Tasker.add({
                "id": self.TASK_UPDATE_SHORTCUT_ICONS
            });

            // trigger when language changes. pass "true" to force the trigger
            if (navigator.mozSettings) {
                navigator.mozSettings.addObserver('language.current', function onLanguageChange(e) {
                    Evme.Tasker.trigger(self.TASK_UPDATE_SHORTCUT_ICONS);
                });
            }
        };

        // when a new task is added to the queue
        this.taskAdded = function taskAdded(data) {

        };

        // process the queue
        this.trigger = function trigger(data) {
            var tasks = data.tasks;

            for (var id in tasks) {
                if (self['callback_' + id]) {
                    self['callback_' + id](tasks[id])
                } else {
                    Evme.Utils.log('Error: No handler for task [' + id + ']');
                }
            }
        };

        this['callback_' + this.TASK_UPDATE_INSTALLED_QUERY_INDEX] = function updateInstalledQueryIndex(taskData) {
            Evme.InstalledAppsService.requestAppsInfo();
        };

        this['callback_' + this.TASK_UPDATE_SHORTCUT_ICONS] = function updateShortcutIcons(taskData) {
            if (Evme.Brain.ShortcutsCustomize.isOpen()) {
                return false;
            }

            Evme.DoATAPI.Shortcuts.get(null, function onSuccess(data) {
                var appsKey = [],
                    currentShortcuts = data && data.response && data.response.shortcuts || [],
                    shortcutsToSend = {};

                for (var i = 0, shortcut, query; shortcut = currentShortcuts[i++];) {
                    query = shortcut.query;

                    if (shortcut.experienceId && !query) {
                        query = Evme.Utils.l10n('shortcut', 'id-' + Evme.Utils.shortcutIdToKey(shortcut.experienceId));
                    }

                    if (query) {
                        shortcutsToSend[query.toLowerCase()] = shortcut.experienceId;
                    }

                    // the appsKey will be used later on to determine change
                    appsKey = appsKey.concat(shortcut.appIds);
                }

                // re-request all the user's shortcuts to upadte them from the API
                // otherwise the shortcut icons will remain static and will never change, even if
                // the apps inside them have
                Evme.DoATAPI.shortcutsGet({
                    "queries": JSON.stringify(Object.keys(shortcutsToSend)),
                    "_NOCACHE": true
                }, function onShortcutsGet(response) {
                    var shortcuts = response.response.shortcuts,
                        icons = response.response.icons,
                        newAppsKey = [];

                    if (!shortcuts || !icons) {
                        return;
                    }

                    // create a key from the new shortcuts' icons to determine change
                    for (var i = 0, shortcut; shortcut = shortcuts[i++];) {
                        newAppsKey = newAppsKey.concat(shortcut.appIds);
                    }

                    // if the icons haven't changed- no need to update everything and cause a UI refresh
                    if (appsKey.join(',') === newAppsKey.join(',')) {
                        Evme.Utils.log('Shortcuts keys are the same- no need to refresh')
                        return;
                    }

                    // experience is more "important" than the query, so if we got it
                    // we reomve the query
                    for (var i = 0, shortcut; shortcut = shortcuts[i++];) {
                        if (!shortcut.experienceId) {
                            shortcut.experienceId = shortcutsToSend[shortcut.query];
                        }
                        if (shortcut.experienceId) {
                            delete shortcut.query;
                        }
                    }

                    Evme.Utils.log('Updating shortcuts: ' + JSON.stringify(shortcuts));

                    Evme.DoATAPI.Shortcuts.clear(function onShortcuteCleared() {
                        Evme.DoATAPI.Shortcuts.add({
                            "shortcuts": shortcuts,
                            "icons": icons
                        }, function onSuccess() {
                            Brain.Shortcuts.loadFromAPI();
                        });
                    });
                });

                return true;
            });
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
    this.SmartfolderResults = new function SmartfolderResults() {
        // propogate events to SmartFolder
        // TODO: this is temporary.
        this.scrollTop = function scrollTop() {
            Evme.EventHandler.trigger("SmartFolder", "scrollTop");
        };

        this.scrollBottom = function scrollBottom() {
            Evme.EventHandler.trigger("SmartFolder", "scrollBottom");
        };
    }

    this.InstalledAppsService = new function InstalledAppsService() {
        this.requestAppsInfo = function getAppsInfo(data) {
            // string together ids like so:
            // apiurl/?guids=["guid1","guid2","guid3", ...]
            var guidArr = Object.keys(data.appIndex || {}),
                guidStr = JSON.stringify(guidArr);

            // get app info from API
            Evme.DoATAPI.appNativeInfo({
                "guids": guidStr
            }, function onSuccess(response) {
                var appsInfo = response && response.response;
                if (appsInfo) {
                    Evme.InstalledAppsService.requestAppsInfoCb(appsInfo);
                }
            });
        };

        this.queryIndexUpdated = function queryIndexUpdated() {
            Evme.SmartFolderSettings.update();
        }
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
          button.addEventListener('click', function cloudAppAction(e){
            if (this.dataset.action === "pin") {
                pinToSmartFolder(currentHoldData);
            } else if (this.dataset.action === "save") {
                saveToHomescreen(currentHoldData);
            }
            closeCloudAppMenu();
          });
        }

        // Remove app clicked
        this.close = function close(data) {
            Evme.SearchResults.removeApp(data.data.id);
        };

        // app pressed and held
        this.hold = function hold(data) {
            currentHoldData = data;

            if (data.app.type === Evme.RESULT_TYPE.CLOUD) {
                if (Brain.SmartFolder.isOpen()) {
                    openCloudAppMenu(data);
                } else {
                    saveToHomescreen(data, true);
                }
            } else if (data.app.group === Evme.RESULT_GROUP.STATIC) {
                Brain.SmartFolder.staticAppHold(data);
            }
        };

        function openCloudAppMenu(data) {
            cloudAppMenu.classList.add('show');
        }
        function closeCloudAppMenu(data) {
            cloudAppMenu.classList.remove('show');
        }

        function pinToSmartFolder(data) {
            var appIcon = Evme.Utils.formatImageData(data.app.getIcon());
            Evme.Utils.getRoundIcon(appIcon, function onIconReady(roundedAppIcon) {
                var _app = data.app.app;
                _app.icon = roundedAppIcon;
                Brain.SmartFolder.cloudAppHold(_app);
                data.el.remove();
            });
        }

        function saveToHomescreen(data, showConfirm) {
            var isAppInstalled = Evme.Utils.sendToOS(
                Evme.Utils.OSMessages.IS_APP_INSTALLED, {
                'url': data.app.getFavLink()
            });

            if (isAppInstalled) {
                window.alert(Evme.Utils.l10n(L10N_SYSTEM_ALERT, 'app-install-exists', {
                    'name': data.data.name
                }));
                return;
            }

            if (showConfirm) {
                var msg = Evme.Utils.l10n(L10N_SYSTEM_ALERT, 'app-install-confirm', {'name': data.data.name});
                if (!window.confirm(msg)) {
                    return;
                }
            }

            // get icon data
            var appIcon = Evme.Utils.formatImageData(data.app.getIcon());
            // make it round
            Evme.Utils.getRoundIcon(appIcon, function onIconReady(roundedAppIcon) {
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

                Evme.EventHandler.trigger(NAME, "addToHomeScreen", {
                    "id": data.data.id,
                    "name": data.data.name
                });
            });
        }

        // app clicked
        this.click = function click(data) {
            if (!Searcher.isLoadingApps() || Evme.Utils.isKeyboardVisible) {
                data.keyboardVisible = Evme.Utils.isKeyboardVisible ? 1 : 0;
                var query = Searcher.getDisplayedQuery();

                data.isFolder = !query;

                if (!Searcher.searchedExact()) {
                    if (!data.isFolder) {
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
                "icon": data.data.icon
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

            var resultType = data.app.type;
            if (resultType === Evme.RESULT_TYPE.INSTALLED) {
                
                // TODO: DEMO MODE
                // we currently don't have support for STATIC cloud apps that are displayed above the separator
                var installedApp = GridManager.getAppByOrigin(data.app.getLink());
                if (installedApp) {
                    installedApp.launch();
                } else {  // this is a cloud result that is not really installed on the device
                    Evme.Utils.sendToOS(Evme.Utils.OSMessages.APP_CLICK, {
                        "url": data.app.getLink(),
                        "originUrl": data.app.getFavLink(),
                        "title": data.data.name,
                        "icon": data.app.icon,
                        "urlTitle": Evme.Searchbar.getValue(),
                        "useAsyncPanZoom": data.app.isExternal()
                    });
                }

            } else if (resultType === Evme.RESULT_TYPE.MARKET) {
                if (data.app.slug) {
                    Evme.Utils.sendToOS(Evme.Utils.OSMessages.OPEN_MARKETPLACE_APP, {
                        "slug": data.app.slug
                    });
                }

            } else if (resultType === Evme.RESULT_TYPE.CLOUD) {
                var appIcon = Evme.Utils.formatImageData(data.data.icon);
                Evme.Utils.getRoundIcon(appIcon, function onIconReady(roundedAppIcon) {
                    Evme.Utils.sendToOS(Evme.Utils.OSMessages.APP_CLICK, {
                        "url": data.app.getLink(),
                        "originUrl": data.app.getFavLink(),
                        "title": data.data.name,
                        "icon": roundedAppIcon,
                        "urlTitle": Evme.Searchbar.getValue(),
                        "useAsyncPanZoom": data.app.isExternal()
                    });
                });

            } else if (resultType == Evme.RESULT_TYPE.MARKET_SEARCH) {
                Evme.Utils.sendToOS(Evme.Utils.OSMessages.OPEN_MARKETPLACE_SEARCH, {
                    query: Evme.Searchbar.getElement().value
                });
            } else if (resultType === Evme.RESULT_TYPE.CONTACT){
                var activity = new MozActivity({
                    name: 'open',
                    data: {
                        type: 'webcontacts/contact',
                        params: {
                            'id': data.appId
                        }
                    }
                });
            }

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

    // modules/SmartFolder/
    this.SmartFolder = new function SmartFolder() {
        var self = this,
            currentFolder = null,
            requestSmartFolderApps = null,
            requestSmartFolderImage = null,
            timeoutShowAppsLoading = null;

        this.isOpen = function isOpen(){
            return currentFolder !== null;
        };

        // a folder is shown
        this.show = function show(data) {
            document.body.classList.add(CLASS_WHEN_SMART_FOLDER_VISIBLE);

            currentFolder = data.folder;
            window.setTimeout(loadAppsIntoFolder, 400);

            currentResultsManager = Evme.SmartfolderResults;
        };

        // hiding the folder
        this.hide = function hide() {
          document.body.classList.remove(CLASS_WHEN_SMART_FOLDER_VISIBLE);
            Evme.Brain.SmartFolder.cancelRequests();
            Evme.ConnectionMessage.hide();

            currentResultsManager = Evme.SearchResults;
        };

        // close button was clicked
        this.close = function close() {
            currentFolder = null;
        };

        // get current folder
        this.get = function get() {
            return currentFolder;
        };

        // close current folder
        this.closeCurrent = function closeCurrent() {
            currentFolder && currentFolder.close();
        };

        // if a folder is open- close it
        this.hideIfOpen = function hideIfOpen() {
            if (self.get()) {
                self.closeCurrent();
                return true;
            }

            return false;
        };

        // cancel the current outgoing smart folder requests
        this.cancelRequests = function cancelRequests() {
            Evme.SmartfolderResults.APIData.onRequestCanceled();
            requestSmartFolderApps && requestSmartFolderApps.abort && requestSmartFolderApps.abort();
            requestSmartFolderImage && requestSmartFolderImage.abort && requestSmartFolderImage.abort();
        };

        // a smart folder was renamed
        this.rename = function rename(data) {
            loadBGImage();
            loadAppsIntoFolder();
            // TOOD: update the shortcut name
        };

        // load the folder's background image

        function loadBGImage() {
            if (!currentFolder) return;
            if (currentFolder.userSetBg()) return;
            
            var query = currentFolder.getQuery();

            requestSmartFolderImage = Evme.DoATAPI.bgimage({
                "query": query,
                "feature": SEARCH_SOURCES.SHORTCUT_SMART_FOLDER,
                "exact": true,
                "width": screen.width,
                "height": screen.height
            }, function onSuccess(data) {
                currentFolder && currentFolder.setBackground({
                    "image": Evme.Utils.formatImageData(data.response.image),
                    "query": query,
                    "source": data.response.source,
                    "setByUser": false
                });

                requestSmartFolderImage = null;
            });
        };

        // load the cloud apps into the folder
        function loadAppsIntoFolder() {
            if (!currentFolder) return;

            var experienceId = currentFolder.getExperience(),
                query = currentFolder.getQuery(),
                iconsFormat = Evme.Utils.getIconsFormat();

            currentFolder.appsPaging = {
                "offset": 0,
                "limit": NUMBER_OF_APPS_TO_LOAD_IN_FOLDER
            };

            Evme.SmartfolderResults.APIData.onRequestSent();

            requestSmartFolderApps = Evme.DoATAPI.search({
                "query": experienceId ? '' : query,
                "experienceId": experienceId,
                "feature": SEARCH_SOURCES.SHORTCUT_SMART_FOLDER,
                "exact": true,
                "spellcheck": false,
                "suggest": false,
                "limit": currentFolder.appsPaging.limit,
                "first": currentFolder.appsPaging.offset,
                "iconFormat": iconsFormat
            }, function onSuccess(data) {
                Evme.SmartfolderResults.APIData.onResponseRecieved(data.response);

                updateShortcutIcons(experienceId || query, data.response.apps);

                requestSmartFolderApps = null;

                Evme.Location.updateIfNeeded();
            });

            loadBGImage();
        };

        // app list has scrolled to top
        this.scrollTop = function scrollTop() {
            currentFolder.showFullscreen();

            // TODO: FIXME This is temporary.
            // BackgroundImage should be an instance used in parallel to ResultsManager
            Evme.BackgroundImage.cancelFullScreenFade();
        };

        // load more apps in smartfolder
        this.scrollBottom = function scrollBottom() {
            if (!currentFolder) return;

            currentFolder.appsPaging.offset += currentFolder.appsPaging.limit;

            if (requestSmartFolderApps) {
                return;
            }

            Evme.SmartfolderResults.APIData.onRequestSent();

            var experienceId = currentFolder.getExperience(),
                query = currentFolder.getQuery(),
                iconsFormat = Evme.Utils.getIconsFormat();

            requestSmartFolderApps = Evme.DoATAPI.search({
                "query": experienceId ? '' : query,
                "experienceId": experienceId,
                "feature": SEARCH_SOURCES.SHORTCUT_SMART_FOLDER,
                "exact": true,
                "spellcheck": false,
                "suggest": false,
                "limit": currentFolder.appsPaging.limit,
                "first": currentFolder.appsPaging.offset,
                "iconFormat": iconsFormat
            }, function onSuccess(data) {
                Evme.SmartfolderResults.APIData.onResponseRecieved(data.response);

                requestSmartFolderApps = null;
            });
        };

        function updateShortcutIcons(key, apps) {
            var shortcutsToUpdate = {},
                icons = {},
                numberOfIconsInShortcut = (Evme.Utils.getIconGroup() || []).length;

            shortcutsToUpdate[key] = [];
            for (var i = 0, app; i < numberOfIconsInShortcut; i++) {
                app = apps[i];
                icons[app.id] = app.icon;
                shortcutsToUpdate[key].push(app.id);
            }

            Evme.DoATAPI.Shortcuts.update({
                "shortcuts": shortcutsToUpdate,
                "icons": icons
            }, function onShortcutsUpdated() {
                for (var key in shortcutsToUpdate) {
                    var shortcut = Evme.Shortcuts.getShortcutByKey(key);
                    if (shortcut) {
                        shortcut.setImage(shortcutsToUpdate[key]);
                    }
                }
            });
        }

        this.actionAddApp = function actionAddApp(data) {
            // create <select multiple>
            var select = new Evme.SelectBox();
            select.init({
                "callback": function(selectedArr) {
                    select = null;
                    currentFolder && currentFolder.addApps(selectedArr);
                }
            });

            // get all apps
            var appIndex = Evme.InstalledAppsService.getApps(),
                appArray = [],
                staticAppIds = [];

            // convert static apps to ids for later filtering
            for (var i=0,app; app=data.staticApps[i++];) {
                staticAppIds.push(app.id);
            }

            // normalize to selectbox format
            for (var k in appIndex) {
                var app = appIndex[k];

                // filter out already displayed static apps
                if (staticAppIds.indexOf(app.id) !== -1) { continue; }

                appArray.push({
                    "text": app.name,
                    "return": app
                });
            }
            // load apps into select and show
            select.load(appArray);
        };

        this.cloudAppHold = function cloudAppHold(app) {
            currentFolder && currentFolder.addApps([app]);
        };
        this.staticAppHold = function staticAppHold(data) {
            currentFolder && currentFolder.openAppActions(data);
        };
    };

    // modules/Shortcuts/
    this.Shortcuts = new function Shortcuts() {
        var self = this,
            customizeInited = false,
            timeoutShowLoading = null,
            clickedCustomizeHandle = false,
            loadingCustomization = false;
        
        // module was inited
        this.init = function init() {
            //elContainer.addEventListener('click', checkCustomizeDone);
        };

        // show
        this.show = function show() {
            //self.loadFromAPI();
        };

        /// load items from API (as opposed to persistent storage)
        this.loadFromAPI = function loadFromAPI() {
            //Evme.DoATAPI.Shortcuts.get(null, function onSuccess(data) {
            //    Evme.Shortcuts.load(data.response);
            //});
        };

        // return to normal shortcut mode
        this.doneEdit = function doneEdit() {
            if (!Evme.Shortcuts.isEditing) return;

            Evme.Shortcuts.isEditing = false;
            elContainer.classList.remove("shortcuts-customizing");
        };

        // returns edit status
        this.isEditing = function isEditing() {
            return Evme.Shortcuts.isEditing;
        };

        // checks all clicks inside our app, and stops the customizing mode
        function checkCustomizeDone(e) {
            if (e.target.tagName === 'DIV' || e.target.tagName === 'UL') {
                if (!e.target.classList.contains('apps-group')) {
                    Brain.Shortcuts.doneEdit();
                }
            }
        }

        // stops editing (if active)
        this.hideIfEditing = function hideIfEditing() {
            if (self.isEditing()) {
                self.doneEdit();
                return true;
            }

            return false;
        };
    };

    // modules/Shortcuts/
    this.Shortcut = new function Shortcut() {
        // item clicked and held, remove item mode
        this.hold = function hold() {
            Evme.Shortcuts.isEditing = true;
            elContainer.classList.add("shortcuts-customizing");
        };

        // item clicked
        this.click = function click(data) {
            // TOOD remove
        };

        // item remove
        this.remove = function remove(data) {
            Evme.Utils.log('Remove shortcut: ' + JSON.stringify(data));

            Evme.Shortcuts.remove(data.shortcut);
            Evme.DoATAPI.Shortcuts.remove(data.data);
        };
    };

    // modules/ShortcutsCustomize/
    this.ShortcutsCustomize = new function ShortcutsCustomize() {
        var self = this,
            isRequesting = false,
            isFirstShow = true,
            requestSuggest = null,
            isOpen = false;

        this.show = function show() {
            isOpen = true;
        };

        this.hide = function hide() {
            Evme.ShortcutsCustomize.Loading.hide();
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
                Evme.ShortcutsCustomize.hide();
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

          self.addShortcuts({'query': data.query});
        };
        
        // this gets a list of queries and creates shortcuts
        this.addShortcuts = function addShortcuts(shortcuts) {
          if (!Array.isArray(shortcuts)) {
            shortcuts = [shortcuts];
          }
          
          var queries = [];
          for (var i=0,shortcut; shortcut = shortcuts[i++];) {
            queries.push(shortcut.query);
          }

          // get the query's apps (icons)
          Evme.DoATAPI.shortcutsGet({
            "queries": JSON.stringify(queries),
            "_NOCACHE": true
          }, function onShortcutsGet(response) {
            var shortcuts = response.response.shortcuts,
                icons = response.response.icons,
                query, appIds, experienceId, shortcutIcons;

            for (var i=0, shortcut; shortcut=shortcuts[i++];) {
              query = shortcut.query;
              experienceId = shortcut.experienceId;
              appIds = shortcut.appIds;
              shortcutIcons = [];

              for (var j=0,appId; appId=appIds[j++];) {
                shortcutIcons.push({
                  'id': appId,
                  'icon': icons[appId]
                });
              }

              window.dispatchEvent(new CustomEvent('EvmeShortcutCreate', {
                "detail": {
                  "icons": shortcutIcons,
                  "experienceId": experienceId,
                  "query": query
                }
              }));
            }
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
                
                Evme.ShortcutsCustomize.Loading.show();
                
                // need to get from the GridManager
                var existingShortcuts = [];

                // load suggested shortcuts from API
                requestSuggest = Evme.DoATAPI.Shortcuts.suggest({
                    "existing": existingShortcuts
                }, function onSuccess(data) {
                    var suggestedShortcuts = data.response.shortcuts || [],
                        icons = data.response.icons || {};

                    if(!isRequesting) {
                      return;
                    }

                    isFirstShow = false;
                    isRequesting = false;

                    if (suggestedShortcuts.length === 0) {
                      window.alert(Evme.Utils.l10n(L10N_SYSTEM_ALERT, 'no-more-shortcuts'));
                      Evme.ShortcutsCustomize.Loading.hide();
                    } else {
                      Evme.ShortcutsCustomize.load({
                          "shortcuts": suggestedShortcuts,
                          "icons": icons
                      });
  
                      Evme.ShortcutsCustomize.show();
                      // setting timeout to give the select box enough time to show
                      // otherwise there's visible flickering
                      window.setTimeout(Evme.ShortcutsCustomize.Loading.hide, 300);
                    }
                });
            });
        };

        // cancel button clicked
        this.loadingCancel = function loadingCancel(data) {
            data && data.e.preventDefault();
            data && data.e.stopPropagation();

            requestSuggest && requestSuggest.abort && requestSuggest.abort();
            window.setTimeout(Evme.ShortcutsCustomize.Loading.hide, 50);
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
	this.iconAdded  = function iconAdded(icon) {
	    Evme.DoATAPI.CachedIcons.add(icon);
	};
    };

    // api/DoATAPI.js
    this.DoATAPI = new function DoATAPI() {
        // a request was made to the API
        this.request = function request(data) {
            Evme.Utils.log("DoATAPI.request " + getRequestUrl(data));
        };
        
        this.cantSendRequest = function cantSendRequest(data) {
    	    Searcher.cancelRequests();

    	    if (currentResultsManager && data.method === 'Search/apps') {
                var folder = Brain.SmartFolder.get(),
                    query = Evme.Searchbar.getElement().value || (folder && folder.getQuery()) || '',
                    textKey = currentResultsManager.hasResults() ? 'apps-has-installed' : 'apps';

                Evme.ConnectionMessage.show(textKey, { 'query': query });
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

            Evme.Tasker.trigger(Brain.Tasker.TASK_UPDATE_SHORTCUT_ICONS);
        };
        
        // construct a valid API url- for debugging purposes
        function getRequestUrl(eventData) {
            var params = eventData.params || {},
                urlParams = [];
                
            for (var p in params) {
                urlParams.push(p + '=' + encodeURIComponent(params[p]));
            }
            urlParams = urlParams.join('&');
            
            return Evme.api.getBaseURL() + eventData.method + '?' + urlParams;
        }
    };

    // Searcher object to handle all search events
    this.Searcher = new function _Searcher() {
        var appsCurrentOffset = 0,
            lastSearch = {},
            lastQueryForImage = "",
            hasMoreApps = false,
            autocompleteCache = {},

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

        // TODO: DEMO MODE - hardcoded results to appear on all searches
        var browserApp = {
            "name": "Firefox",
            "icon": {
              "MIMEType": "image/png",
              "data": "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"
            }
        };

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
                onlyDidYouMean = options.onlyDidYouMean;

            Evme.Searchbar.startRequest();

            var removeSession = reloadingIcons;
            var prevQuery = removeSession? "" : lastSearch.query;
            var getSpelling = (source !== SEARCH_SOURCES.SUGGESTION && source !== SEARCH_SOURCES.REFINE && source !== SEARCH_SOURCES.SPELLING);

            if (exact && appsCurrentOffset === 0) {
                window.clearTimeout(timeoutHideHelper);

                if (!onlyDidYouMean) {
                    if (!options.automaticSearch) {
                        var urlOffset = appsCurrentOffset+NUMBER_OF_APPS_TO_LOAD;
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

            var _NOCACHE = false;
            if (QUERIES_TO_NOT_CACHE.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                _NOCACHE = true;
            }

            Searcher.cancelSearch();

	    // set timer for progress indicator
	    Evme.SearchResults.APIData.onRequestSent();

	    // DEMO MODE choose static apps to display
        var staticApps = [], searchValue = Evme.Searchbar.getValue();
        if (searchValue.indexOf('.') > -1) {
            browserApp["appUrl"] = "http://"+ searchValue.replace("http://","");
            staticApps.push(browserApp);
        }
                
        // triggers installed provider search
        Evme.SearchResults.onNewQuery({
            "query": Evme.Searchbar.getValue(),
            "staticApps": staticApps
        });

	    if (!exact && query.length < MINIMUM_LETTERS_TO_SEARCH) {
		Searcher.cancelRequests();
		return;
            }

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
		"prevQuery": prevQuery,
		"_NOCACHE": _NOCACHE
	    }, function onSuccess(data) {
		getAppsComplete(data, options);
		requestSearch = null;

		// only try to refresh location of it's a "real" search- with keyboard down
		if (exact && appsCurrentOffset === 0 && !Evme.Utils.isKeyboardVisible) {
		    Evme.Location.updateIfNeeded();
                }
	    }, removeSession);
        };

	function getAppsComplete(data, options) {
            if (data.errorCode !== Evme.DoATAPI.ERROR_CODES.SUCCESS) {
                return false;
            }
            if (!requestSearch) {
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
            timeoutAutocomplete = window.setTimeout(function onTimeout(){
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

        this.empty = function empty(){
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

        this.searchExactFromOutside = function searchExactFromOutside(query, source, index, type, offset, isGetAllAppsForPage) {
            !type && (type = "");
            !offset && (offset = 0);

            if (query) {
                Evme.Helper.reset();
                Evme.Searchbar.setValue(query, false);

                if (lastSearch.query != query || lastSearch.type != type || !lastSearch.exact) {
                    resetLastSearch();

                    if (isGetAllAppsForPage && offset) {
                        NUMBER_OF_APPS_TO_LOAD = offset*1;
                        offset = 0;
                    }

                    Searcher.searchExact(query, source, index, type, offset);
                } else {
                    Evme.Helper.enableCloseAnimation();

                    Evme.Helper.setTitle(query);
                    window.setTimeout(Evme.Helper.showTitle, 50);
                }

                Evme.Searchbar.blur();
                window.setTimeout(function onTimeout(){
                    Brain.Searchbar.cancelBlur();
                }, 0);
            }

            Brain.Searchbar.setEmptyClass();
        };

        this.searchExact = function searchExact(query, source, index, type, offset, automaticSearch) {
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
                "automaticSearch": automaticSearch
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
              timeoutSearchWhileTyping = window.setTimeout(function onTimeout(){
                  Evme.Features.startTimingFeature('typingApps', Evme.Features.DISABLE);
                  Searcher.getApps(searchOptions);
              }, TIMEOUT_BEFORE_RUNNING_APPS_SEARCH);
            }

            if (Evme.Features.isOn('typingImage')) {
              requestImage && requestImage.abort && requestImage.abort();
              window.clearTimeout(timeoutSearchImageWhileTyping);
              timeoutSearchImageWhileTyping = window.setTimeout(function onTimeout(){
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

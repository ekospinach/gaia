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
                    folderSettings.apps.push(app);
                    Evme.SmartFolderStorage.update(folderSettings, {
                        "apps": folderSettings.apps
                    }, function onUpdateSettings() {
                        Evme.Utils.sendToOS(Evme.Utils.OSMessages.HIDE_APP_FROM_GRID, {"manifestURL": appManifest});
                    });
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

        // Remove app clicked
        this.close = function close(data) {
            Evme.SearchResults.removeApp(data.data.id);
        };

        // app pressed and held
        this.hold = function hold(data) {
            if (data.app.type === Evme.RESULT_TYPE.CLOUD) {
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

                var msg = Evme.Utils.l10n(L10N_SYSTEM_ALERT, 'app-install-confirm', {
                    'name': data.data.name
                });
                if (!window.confirm(msg)) {
                    return;
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
            } else if (data.app.group === Evme.RESULT_GROUP.STATIC) {
                Brain.SmartFolder.staticAppHold(data);
            }

        };

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
        var searchApps = [{
            "name": "Google",
            "searchUrl": "http://www.google.com/search?q=",
            "icon": {
              "MIMEType": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAytpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MjcyOEM3OUVFMTIxMTFFMjg3QUI5RjREQTY0OUU2Q0EiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MjcyOEM3OURFMTIxMTFFMjg3QUI5RjREQTY0OUU2Q0EiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5kaWQ6ODFhZmM5MzctMzNkOS00NmM5LThkYjgtNjhjYzcwZmNhYzBhIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjgxYWZjOTM3LTMzZDktNDZjOS04ZGI4LTY4Y2M3MGZjYWMwYSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Ppv4OyMAABYoSURB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"
            }
          }, {
            "name": "YouTube",
            "searchUrl": "http://m.youtube.com/#/results?q=",
            "icon": {
              "MIMEType": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAytpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MjcyOEM3OUFFMTIxMTFFMjg3QUI5RjREQTY0OUU2Q0EiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MjcyOEM3OTlFMTIxMTFFMjg3QUI5RjREQTY0OUU2Q0EiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5kaWQ6ODFhZmM5MzctMzNkOS00NmM5LThkYjgtNjhjYzcwZmNhYzBhIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjgxYWZjOTM3LTMzZDktNDZjOS04ZGI4LTY4Y2M3MGZjYWMwYSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PsPp6aoAAA3aSURB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"
            }
          }, {
            "name": "Twitter",
            "searchUrl": "https://mobile.twitter.com/search?q=",
            "icon": {
              "MIMEType": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAytpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MjcyOEM3QTJFMTIxMTFFMjg3QUI5RjREQTY0OUU2Q0EiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MjcyOEM3QTFFMTIxMTFFMjg3QUI5RjREQTY0OUU2Q0EiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5kaWQ6ODFhZmM5MzctMzNkOS00NmM5LThkYjgtNjhjYzcwZmNhYzBhIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjgxYWZjOTM3LTMzZDktNDZjOS04ZGI4LTY4Y2M3MGZjYWMwYSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pg32fjEAAAybSURBVHja5Ft7cFTVGf/de/eZ3Wx2s9kk5MWSEPKSgIRqEGGgOlIVX7RjO+PY4jj+ISr2j3ba8fVPHR3HGRRB7R8qo05ta8eKT4QK2qIiCmqgQBJpEgIhT5KQbPZ1d+/td+7eJLubu9lNNg9mODO/5CZ777nf73znfI9zvuVkWcbl1HTsx0c/dl0WZG8uz48QZm3nsB5BmZvJ/gVCHWENoZZQTigiZBFs6j1DhIuEc4QfCccIBwlHCeGZEsTAyXgwUxzXMGseaUbIGgm3E+4kXKeSm6zZVBQTVkX9nw3CfsLbhN2EQDpCRStyjLCB1nIavToJWwkPqNfpNjZQm1RcILxIeEG9npYWRhs/eiGP/pgaMghPEtoITxCc0+gjGZxq323quzKm2oesRXgagtxCOEl4lGCdBaLxsKrvOqW+e2rPT9AwTWnmoVKAibCD8D5hYYrPzCRK1HfvVGVJ4Rl54hqOjERSn7yAeTHClZeAl2H24hrmbQidU/LDwPhoTNKWEPYS3JeQa2UD/xVhA6E50U2yFuEI44SuabHqH3NnnwMTj4sTdVKX6VZlW004nYxynIY1VcyChU/nhizjxkXR5MaFm7zlqn57tRrEpKJhzX6ZC3ufsHDW+DHLSSS9EtDjDyEQCkGv+hKRYNALyDUbYaG4TZKkGOE5NRyT6UrPySWSrMi6arJARRdtpTGR8LZoA8VuCbHO+ZRGPWnjSeIQLaPTwwE4BQkbsw1Y6bDCZYho9kIghCP9fvy7dxBnZT0W2S0wUpjIiIPj0R8MY0QMwW0xICzJo2t6m2rQUtCwFCPPbYQtYzeSdH7qdMDnh9GgR46JYu/Q9MNd1t9gUMY5jw+bi0y4vywTlXbzhPvuZQtzwIOXGvuw62wvLDY7gkRYJKKlZg7PLsvBkc4BvHYugCJ7JulB2kJc9tFj72lEG7F+OMpxsSdfinZmg0EJLp2Ml5ZmIts3QEL4oNfppuVI2UtZfz1E9rmaTGyvy9UkO2YxSevbVrnxAt2b4x/ERqeAF2tt+PL6YtyaQ/P4u0aYSRY2tSEp72Cy20bfp+2HpZhZ+kdCQbQh6fAEcGu2ET8rtqNACOP6fa2U3ixAOQkaFMUpaTdMgp0Z8ilC/2axI+Xn7q4pxF1LRPB6/dj/bnplPxqGMrG83AqdHFLWvSr7HwiPjnJLEGkpcBK2Rv0dGQgyJsuzIuNTW+DEpxtKYRvqQUP3EARBrxo9OSnYC09fDOA2l25KZMcEVsm29fbjuuffxp7uMJ65ox7XWELoGfJGR1dbVS4xGuajDZIyEhIeJljVawUhgpWMhdsyPiFqF2TjwE1lqOOH8e3ZPvhlHgIZkujntOCnZW+SQnik2j7t9S+S7fihvRtXlZVg8LHbsTUviKMnmmg2cxHbzaZ1hMPWuJkbmzzQByxLvF9r6XFk0XRx/r/YYcPnt1Xh924Bree60DwQgMzrFP85UbuRfvp8IVzt0KHGaZn+zoLA4/a6Kjx9Sz2yAh5Ub/8QjSEzcjMpkWKua1zuLYyTdvJAo0K4kZCjXo+BpwdGyMh0jgQ13q7D09eW4YN1+ag3enGyoxctQwFyXwLR5sesv9IXXXvI1SzOENJ0Z5GRbznfhYpnd6PL7kZ1WSlZ7jDkcIzsOSqnBFNalu+eaFWZdmV4wxwaBxJvEaxzu/DxxnL8pd6JepMfHbTG/tvrwfmRMHxhFj3xiubDYQm5Rj5tH/5FYytW7vgYHa4lWFZTjUCAZlc4rOUV7o6e0rooDRvpgw2acSgJmWMxY8/ZYfxuBXXKJdIQjzuW5BJy8HXHED4558GhviDOkO/+n1+GSM/5Bv1oHUx/O+lgWw8GMgpwdWUlAj4vC8MShd0bGDf6IBAfePxEZgs9QeCdZzbgQLuIv5/oxC+vKEo26VBfaFdAw04E/Wi44EfzkIjve4ESc/qEnVlZMDg4BANBeoU0nnRMDACtJM5K+v1lfGh5daJokU1IPZk7Y4YVv/qoBWWODKwszE4xWBawyGFRMJPNGxQRZpGeFO12tAnQx/WjhKOMFioSuZIA9RsMiHh1lRObavKx+Z2j2N90lt41f5v43RR/84KgGKdkrlDhppEPVyaWn0drvwfrXdm4a/ESnOrOx6DXFzF03PwQbhkYoZjeobohOVmKXanhlrAw3h2NgsU2QwEJ77cMKvdW5dmwalEeBH5+2HpHPGjs88JutSCRzLEYT2+jQ0t7wnifjILVZMKn7cOXxL5OA0V2py+KsJnNimwpbOI5JkZaEmyRkGwi2LQpspmxu3UEB1u6559w5yC85GkEXlBkSyT3OJCpnTxISAiBfmRlOXDPxy0Y8XrnlfAnzT0wOXIi2g1PLrcCWQ5qreHhybIc5gKKbSa0Uaq87vWj6LwwOC9kz3b1UDwwjMJcFySKrFLJ0IibR0vDA8lGSiTXtJRSwwbRjkU7v8GTe4+hre8iQmFpzgi/dqgZwxRLmA2GiIaTaTei4WGtLZ4z9EFJsg1Ury+A6gVOlJXa8dcTzegiTT+wtgpVRa45sc4vH25HXukKSJSfy1KKAy1z7VqxdCMt7jXJd405nOgYwI5NRViz8TqIYRkc5iYAeW7fD+gOWVFDYWVYDEbS1pT4EjeNbKkplfUgsFMtkwH3vdeobNboBQ46gZ91st19F/DU5y3IK68ge6JqN5X1G8nFmzTcknw4lfUgkUYLrCY0efTY/Lcf5mzt3rPrM3gtBcjJsqnTGSmDuH2tpeFvaTQ8qYxYSKQkvtCF108FcN9bh6nD4KySfXnP19jT7Ed5ZQUZzqC6mZAyiBOOaFnpAK3hvckCcQa2ES6EQyh1F+GVxjCu3fEl3jlMs0b0zzjZ/xxrxpZ/HEfesjpFWFnJkDAV7FW4TTRaCuk36fLnKW21kksQOBkVZSX4prsfv/hnK5Z+1oYCynUfWrsYN19ZmjbZpjMduOGFAzCVrUA2GSox4E+YAk7S3pQlTvv0kEjvQaSOIrU6DSLMrCVbV52SCceH+lGSLaPYmZk22e+b27Du2U8QLrwC5SVFCPr96oKcUsLSR9ijbMolOD1ki/FlwmMx5z/K9qqsbJ6xR9k5jo/+OewVla2VPCuPe2sysWVlLVYsyEib7IeHjuPOV7+CP7+GZlApgj4/O0KZNMlP0P4MVsSjVcWjJNKRvp4n/FbZGmF3E1GbgYfbpkNbvx9+MlgmckVFFh5L3Rasd1uxfqEVJQ7zDKzYMB59Yz+e2tcKc+UKVBQVEFnfdDTLGgsnt49x0z5MUz5gU5qVCD3C/mA2YsgbxJ0LDbjrhkK4czKVLdsMmiaCTpgx47T/6Ck8/u73OHSeQ27dWmTZrAgoZOXpaJa1neqUjkxTrSkd1eczhM3sjMas4+AJ8Nh2qAeNZ7rw8OoCXFVVHDNW028SDjacxvZ/ncA7x/uB3FKU1pcq28Ihf1oW/zzh6RhuEw/TYs5ghtQz1nfDNKUteh4mZy7eau/HW8dOYrmrEZuuyMHaxU6sXpIPnXEK61YW8V1zB75o6sTuY+fxGeXYsLhQULcGZpORjKA44dx2Gu1BlQPiD9MmK2phJX+7WJCjHDZzEhblOxHOd+HUhYt44kA3uP3nUOs6ifqFWajOz0R+pgHZFgMyjXoYdLxyfuyhDGtgJIjuIT9+7BnGN239+O78CAKiAXAtQMGyWpgo85HIr4coqEg5QE7cmMzvxu1aahFWdwcmjhQ7VV/OnmIBB0eWOt9hAecsh0iWuvHiMBqOUW78LZtFIUWDZONAfCmxkJTkQqkzlQl6EwQ7hYcVDkWbTJMsJg4HA7FSTT8XaVBljp1UPBIYrYkvYlsbtyBSGlQ8NlwSJd5kUdlpYV6WFZzdRhkJpxg9SR0Y9psdAQk8rwwSz36P+nsiKonBGSmbiGqsmGWjKrPWWcKkRiu+o5+qG9mxlTzqWpPVSl9GjNltgTHloypwIlkHZrEYvZewHhoVPImNVtzBcVxj9U8sV568MG1+NubbCDciYY3WJBpOIi+rdGOlfpdK6aESgSKF0sMEB+JyKlWpnYRrCDvnoHo2GV5UZelMfq+caA2nNCVZRPAQYZ8azZTMsVbbVUv8QcquPyqW5uNVPwV8QKgiPEXwzEHZsEd9V7X67pSfjT0li17YU4dXLdp2q9Xq/bMwdfvVvt3qu0am1U/8lPaJaYVzLOF4nPAn1WL+mnA9xr+9MtXGwkJW0PqGks9S0paOcD5RYw1nGXkEQmm7FSbYeyqiv8azDJESZFY6wE7S2em4qKZwA2xTUnUro1/jOYIZ/BqPMar8iGO+93L6ohZ3uX0V7/8CDACMu3JL3az8CAAAAABJRU5ErkJggg=="
            }
          }
        ]
        , contactsApp = {
            "name": "Contacts",
            "icon": {
              "MIMEType": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyNpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkY1QzM1NUVDRTExRjExRTI4N0FCOUY0REE2NDlFNkNBIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkY1QzM1NUVERTExRjExRTI4N0FCOUY0REE2NDlFNkNBIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RjVDMzU1RUFFMTFGMTFFMjg3QUI5RjREQTY0OUU2Q0EiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6RjVDMzU1RUJFMTFGMTFFMjg3QUI5RjREQTY0OUU2Q0EiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz6JWcCEAAARv0lEQVR42uRbe3RV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"

            }
        }
        , browserApp = {
            "name": "Browser",
            "icon": {
              "MIMEType": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyNpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkY1QzM1NUYwRTExRjExRTI4N0FCOUY0REE2NDlFNkNBIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkY1QzM1NUYxRTExRjExRTI4N0FCOUY0REE2NDlFNkNBIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RjVDMzU1RUVFMTFGMTFFMjg3QUI5RjREQTY0OUU2Q0EiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6RjVDMzU1RUZFMTFGMTFFMjg3QUI5RjREQTY0OUU2Q0EiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7MpLtFAAAXPklEQVR42uRbW4xk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"
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
        if (searchValue.search(/Ami|Rami|Josh|Rick/i) > -1) {
            staticApps.push(contactsApp);
        }
        for (var i=0, searchApp; searchApp = searchApps[i++]; ){
            searchApp['appUrl'] = searchApp['searchUrl'] + searchValue;
        }

        staticApps = staticApps.concat(searchApps);
        
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

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
                    saveToHomescreen(data);
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
            });
        }

        function saveToHomescreen(data) {
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
        var contactsApp = {
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
        if (searchValue.search(/Ami|Rami|Josh|Rick/i) > -1) {
            staticApps.push(contactsApp);
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

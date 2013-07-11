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
            "name": "Firefox",
            "icon": {
              "MIMEType": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo1QzgwMkE4M0UyODQxMUUyQTIzNkUxMDE4REYxNDM4MyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo1QzgwMkE4NEUyODQxMUUyQTIzNkUxMDE4REYxNDM4MyI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjVDODAyQTgxRTI4NDExRTJBMjM2RTEwMThERjE0MzgzIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjVDODAyQTgyRTI4NDExRTJBMjM2RTEwMThERjE0MzgzIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+SNhLVAAAGt9JREFUeNrsewm0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"
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

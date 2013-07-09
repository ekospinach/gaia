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
        
        // init activities
        if ('mozSetMessageHandler' in window.navigator) {
          window.navigator.mozSetMessageHandler('activity', onActivity);
        }
        
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

    function onShortcutCreate(e) {
        var options = e && e.detail;
        
        if (options) {
            // if shortcut created by dragging apps, hide the apps that created it
            if (options.apps && options.apps.length > 1) {
                options.apps && Evme.Utils.sendToOS(Evme.Utils.OSMessages.HIDE_APP_FROM_GRID, options.apps[0]);
                addFolder(options);
                options.apps && Evme.Utils.sendToOS(Evme.Utils.OSMessages.HIDE_APP_FROM_GRID, options.apps[1]);
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

    function onActivity(activity) {
      var activityName = activity.source.name;

      if (activityName === 'smartfolder') {
        var data = activity.source.data;

        Evme.SmartFolderStorage.get(data.id, function onGotFromStorage(folderSettings) {
            Evme.SmartFolder.show(folderSettings);
        });
      }
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
              "data": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2hpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDowMTgwMTE3NDA3MjA2ODExODIyQUY2NkIzMUZGRTJGRCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpDOUE4Nzc4MkRGRUQxMUUyQkNFRkNENzU1MDgxNTdCQyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoyMkM0NEREOERGRUQxMUUyQkNFRkNENzU1MDgxNTdCQyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChNYWNpbnRvc2gpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RjcyQjE3NEI3MURDMTFFMkE0MzZENDIyNkFERkE3NEMiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6RjcyQjE3NEM3MURDMTFFMkE0MzZENDIyNkFERkE3NEMiLz4gPC9yZGY6RGVzY3Jp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"
            }
          }, {
            "name": "YouTube",
            "searchUrl": "http://m.youtube.com/#/results?q=",
            "icon": {
              "MIMEType": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2hpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDowMTgwMTE3NDA3MjA2ODExODIyQUY2NkIzMUZGRTJGRCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpDOUE4Nzc4QURGRUQxMUUyQkNFRkNENzU1MDgxNTdCQyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpDOUE4Nzc4OURGRUQxMUUyQkNFRkNENzU1MDgxNTdCQyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChNYWNpbnRvc2gpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RjcyQjE3NEI3MURDMTFFMkE0MzZENDIyNkFERkE3NEMiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6RjcyQjE3NEM3MURDMTFFMkE0MzZENDIyNkFERkE3NEMiLz4gPC9yZGY6RGVzY3Jp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"
            }
          }, {
            "name": "Twitter",
            "searchUrl": "https://mobile.twitter.com/search?q=",
            "icon": {
              "MIMEType": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2hpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDowMTgwMTE3NDA3MjA2ODExODIyQUY2NkIzMUZGRTJGRCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpDOUE4Nzc4NkRGRUQxMUUyQkNFRkNENzU1MDgxNTdCQyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpDOUE4Nzc4NURGRUQxMUUyQkNFRkNENzU1MDgxNTdCQyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChNYWNpbnRvc2gpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RjcyQjE3NEI3MURDMTFFMkE0MzZENDIyNkFERkE3NEMiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6RjcyQjE3NEM3MURDMTFFMkE0MzZENDIyNkFERkE3NEMiLz4gPC9yZGY6RGVzY3Jp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"
            }
          }
        ]
        , contactsApp = {
            "name": "Contacts",
            "icon": {
              "MIMEType": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAALk0lEQVR42uWaCXCURRbHG0KMLKAElo24YLiS5ZjsJEwgIRBCIIBckUvkkGASE8N9KRASiNFwiiK3HKsLuogI6iqiW5bH1ooXighWibiEI4QwEyaZzH3/93UnNVNTM5PMkYxULVU/Al+/7n6/73X3fPVlGID/K8Rffz76qUcwmzkwmUx+gXfZvcRIoghvsZN4g13C31kNocOrDBz6t15cozYRQ7ENfdr6PV9cSVM0vzDeYfcTeTjKvsMhZsFOBmwlNvsIxYo+1FeMQWPxMe86YZxk/XCMvY2DzIztDoHgobHEmDQ2n+N3F8YJ1gdvsg+xn9mxhQGbWggam89Bc53mc4ZYWIjeS3tuCw4wK7bypEIEzUVzWmjuMp5DSIRxnElwmF3Fiw3LblOIoTnF3JQDz6VFhenOzqQ7bBKTbvyd2SyqbeY5tYgwjrJC7G64yxvvDkQuu4ijrKh5hV9nm/BywyQb7jI21p/mlONm1vgfH4WPsCIxYBnx/F1KWYM05eqT8IOHP/EEl52JlxsGfS44rEvaoGb9bFQd2onKk8dQefx13H51GzQvTA1szFIX6JpDelaTwlEH/+UGDrP+2MPMKAtSdjVD9ZocVHzzNa5fv+6Rim+/gm7HdD8lvUjvZmbKXdKo8AP7P3YBr7EI7GdXxB4pDRz7CoaqXdtQceMGKioqGodiVEef8zxWie8I6VdYOXfwKtxl52kXcJA9j83ByaKQQV5WhJs3b/qF7sii+v7PEusCZCNxiJV5Ff7jS6cckGxP2rcWx6QBosmOQ1V5Oaqqqvziys8XYXu+C7CWBU4x8RKzkEsvzxXe/L4D2gOnsSEoWTGhYt8uyOVyXxGyFy5cwJkzZ3Dj8LqghAUlYj9/5LnCG94T0NqX4sWGpNcHjmUBCf/wPaqrq32isrIS58+fx9mzZwUXPznFD7vgWENsIcjJTThy/TsC7GQnxKZfFxzGeX+AkqqmVCqbhGRFZX/66ScHF86dA1ax4CkidrATbsKdik4y7GIdsI2ZRZWKg0Of1wsqlaopxDK+dOkSfvnlFzdQ+CdgJQuOZ1oBm5mV3Dq5CHdc/TajO5EtHjCKgseUFwE1VU+tVntDLOXy8nKPXL38K7AiDFjeKniKw0BuBS7C9688zrCVfSs2+tqgEXdX/d230Ol0HqHqNvrRJP/6E2Bp6+ZhJQlvYmddhPECa8dLLypU2Dxo9m6AwWBwg4RFdRUKhVcMbxQDC1s3D0tIuJTcyNEpvIWNrH8MbD5sSyOgr6iAyWRyYDQaRXVramq8oiq/DCyOBOaHNx9rCXJ0Cm9ka1HarMICY9kUmPU6WCwWgV6vh1ar9Yqmtgb2LZnAUxHNy9MdQI6FDmGSPSVO51XNj3l7Fix1dUKYquwVY40S9h1PAHltm5/FJFzCPnIKP8t+RVHLCAtK+8P0xSlYDXrYbDYX+DXrl/8EVg8Gctq1DAVEIbviFF7HasWTydMtxAIG+xPtYS+Ihm17AWyHN8B+pAzYmS+uUVuLgjwSfoapnMIlzCT23crmw5wbAev6JGAFyc67j4hsEuusLjAuHg17VhfXtiBBTkfg6TATnBVuWHorgseY3Qnq3S/AcOMaTAYDzAdWwz6nc5OYZ0RBtamU96G+16E/uBXWrG68LXjmdabcIuAUXsuo5MTywLHTsq1b/QQM1666HkgkYNxdDBtVzxvm6Q5Zl76G6zTW+iweExT2x7sAy9rCKVzITEJ4WWBY8xnU+7a7JOwmvasY1hld3DBNFbKN931tG48NFKoysbitc0mTbA0BLPEfWx5V9uAelyS9Jr5zHVWzqwPjlG6o2+KQbRTD4R18JQQCCUfBtqCd89Cyr2SXsSoA4UUMqlV5joR9kt5RAvO0aBgf6eGzrMBohKkkB+YpXf2FhB+AbX7bcoewZVGbD7CGC/iHYVZH6P/7G0/IZ4Tg8qlQ5c1wyPqK4cplmKZEwzS5mz/QHn4Q5qfaOx889AX3rRYP/Qv8Q712AU/Ef4qyUbc0N6C+xtICGCd19ws7nfbkuNYhrMvrOExUeL4fFJDwW0cDS7ooJ2Bhw3tHYRgf7RfIfQDc0Smc2zkcy8PMWMJFfMP2JIP2318ElLTuxD+gPv5mYMJnPofu4WhfoQpHw5YbZSHHexzC4WMPMHN++2+wyk/hr77kSYQU/Tf/gXZMD5+xTO8BY1bn711eAISNOcA0c6PmYlUr4CnmE3YS1nzxWciFDV9+BvXonj5jm90d5JblItxm9H5WN6dre9uiCDMW+iaMfBL+8IPQV/jj96EeFeMTunG9YZr7oJW7uQpn7Bfo5nQ5htVcxjfUR/4WcmHdG4egSo/xCcujvaF9rOsxt9e04RmvCFSPduuNReE2sU/zmkbzYmmohWnOMtSmxTSFqLB5TjcbOfVxEw5Lf8WB7rGo98VefpI1iWbZtJALq+bPg3JYbJOYp/eGemq30x5/1dJmxD4HNY/0fMhWwPdy08JGeoIxajWhkqW5tFBmJOLO0NhGUWfEwjgr2spdPAun7XOhdnL0OqwKE1L2XO9Ysxh0534I3f798RwUKRIokvt6pTqlL8wzYlCT2bOUS/okrJzQJ1w/s+tvfGnbc1ijqF/bFzLhukMHIU+WQp40wCuGzL5QZ/a4xh28Cw/f68adcTE9rbmRRizm76O8kE0VXpARMuE7M6eTlBS3B0k8os7oB920Xhaee6NfeQhL3euR6rGxmVjUFpjvXdg2tw30P59v+eV88SJuk2zVICluDZK4oRzRDyb6GKoeHTuZywUkjNmM3RnbZymWknQeCc5zB1w8PxL2hd2BxcRSYnl3aGYMgnLiCNpLaVA9koa6ycSUNDo5iWlp0BJqzlRxndpFHI8X/ZTjR6B63AgoHh4B+ZiRuJ06hGTjcUsmRaVM4kL10H4wTyPZMTHLuFjTwsP2eoSEBTVj+hRjIUnnk1yWK+AIcSKbyCXyGPRTu6J6mBR3hkuhTItDTXocakfWo8pw4LhG7SKO4kU/xVDaq0Ok9VUdHI/KREIWj5sD4wiJA8WwATBOiYFyVIw4pIIVdlA9MnY+8tvVv2Oe64K7dA6DdXZ7yFMSKPF4VKfGk0g8CRHp9dSMkIqfgjTRLuIoXvS7nZxAogm0XBNwU0YMlKEiQYYb8XEOlGkDoJ/SG4r0vgs8CXo/tFL2eMLty6XyNEmmeU6UEctbkaCLsKt0bj2KVAlVKQFyklCkktBwEuOkORGiBLWLOIon2XhUJTXIJsqEcMVAkk1IwHUumyCFZmw/aCbFmimnyTy3FhEW0qmSnuqJ0b9heYf6Jf44Mac1/STmtiZpIrueuvEP4RZViZLnEg55J26SIr7SKcqrSpKEVIarf+WxEhgz+9ISjr3Gc+E5+S88ZI8HPAoLqobGhcuHDyiyzI2yiBfc2VzYXdo8uz0ln4jKwTLcSpKhipMsIzknVZwk0S7iKL5BNpGqmojrCYm4Fj8IN+km6Cb0h2ZiXxuJFvMceC6hEHaKp8R1r82IOYWcSIiKP+kUR1a9uDy1HxcQCVdyBnMaKiloqKjb8pWRKN0Uqr52nBT6SbG2O8P7fkRzPuTIIcTCTvHk+L8o0we8aZnV3YxlnSE+xvKFMB0qnXCNKnWDqJB5RbRfa+AWSaoy4mGcLIFmnMSmSJUepzl6OeYMVjgsebcnfBR2cjNxWmRVckp+3Zh+31nndLdgEf8mTiT0tOdqRknpcBJ7lldNIB8mDizRpn1YSnFxME7tD+1EiVWZLv3x9pDkgttJEzo75rjLhAVfJatbV8uO3FOXlNNBMWTYSPmQwYV0Gr9TO3pAuWZ8f7V2Qn+jbqLEps2Ms2omSYzqcRJt7ZgBV+mj6V1FyqCi6pTkUfohkzpqB6+5l8YJ42PezcKCT1PQqkL2ebgqcWuEIWlpW2vKjHZIHdsBw4fej7RBHZE+0An9X1yndh7H43k/6t+aj9Xcwv8Dl1ddh5x7x/8AAAAASUVORK5CYII="

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

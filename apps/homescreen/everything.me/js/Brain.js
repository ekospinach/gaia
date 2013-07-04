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
            addShortcut(options);
            
            // if shortcut created by dragging apps, hide the apps that created it
            options.apps && Evme.Utils.sendToOS(Evme.Utils.OSMessages.HIDE_APP_FROM_GRID, descriptors);
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
    function addShortcut(options) {
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
          Evme.SmartFolderSettings.prototype.byExperience(experienceId, addShortcutToHomescreen);
        } else if (query) {
          Evme.SmartFolderSettings.prototype.byQuery(query, addShortcutToHomescreen);
        } else if (apps.length > 1) {
            Evme.SmartFolderSettings.prototype.byAppPair(apps[0], apps[1], addShortcutToHomescreen);
        }
      }

      function addShortcutToHomescreen(folderSettings){
        // install the newely created shortcut!
        Evme.Utils.sendToOS(Evme.Utils.OSMessages.APP_INSTALL, {
          "id": folderSettings.id,
          "originUrl": 'fldr://' + folderSettings.id,
          "title": folderSettings.name,
          "icon": shortcutCanvas.toDataURL(),
          "isFolder": true,
          "gridPosition": gridPosition
        });
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
                } else if (shortcut.originUrl) {  // app shortcut
                    preinstalledApp(shortcut, page, index);
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

	addShortcut({
                "icons": shortcutIcons,
                "experienceId": experienceId,
                "query": query,
                "gridPosition": {
                    "page": page,
                    "index": index
                }
	});
    }

    function preinstalledApp(shortcut, page, index) {
        var defaultIcons = Evme.__config['_localShortcutsIcons'],
            appIcon = Evme.Utils.formatImageData(defaultIcons[shortcut.appId]);

        Evme.Utils.getRoundIcon(appIcon, function onIconReady(roundedAppIcon) {
            Evme.Utils.sendToOS(Evme.Utils.OSMessages.APP_INSTALL, {
                "originUrl": shortcut.originUrl,
                "title": shortcut.title,
                "icon": roundedAppIcon,
                "useAsyncPanZoom": false,
                "gridPosition": {
                    "page": page,
                    "index": index
                }
            });
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
        };
    };

    // modules/Searchbar/
    this.Searchbar = new function Searchbar() {
        var self = this,
            timeoutBlur = null,
            TIMEOUT_BEFORE_RUNNING_BLUR = 50;

        // Searchbar focused. Keyboard shows
        this.focus = function focus(data) {
            Evme.Utils.sendToOS(Evme.Utils.OSMessages.HIDE_MENU);
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

            Evme.Utils.sendToOS(Evme.Utils.OSMessages.SHOW_MENU);

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
                initShortcuts();
            });
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
                
                GridManager.getAppByOrigin(data.app.getLink()).launch();

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

	    // triggers installed provider search
	    Evme.SearchResults.onNewQuery({
		"query": Evme.Searchbar.getValue()
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

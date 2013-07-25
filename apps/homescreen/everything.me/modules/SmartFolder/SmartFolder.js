/**
 * SmartFolder.js
 * Main Evme object for using SmartFolders
 * 
 */
 void function() {
  Evme.SmartFolder = new function Evme_SmartFolder() {
    var self = this,
      NAME = "SmartFolder",
      
      currentSettings = null,

      el = null,
      elScreen = null,
      elTitle = null,
      elClose = null,
      elAppsContainer = null,
      elImage = null,
      elImageFullscreen = null,
      resultsManager = null,
      elFolderActions = null,
      isFullScreenVisible = false,

      title = '',

      CLASS_WHEN_VISIBLE = 'visible',
      CLASS_WHEN_IMAGE_FULLSCREEN = 'full-image',
      CLASS_WHEN_ANIMATING = 'animate',
      TRANSITION_DURATION = 400;

    this.init = function init(options) {
      var actionsButtons;

      !options && (options = {});

      resultsManager = options.resultsManager;

      el = document.getElementsByClassName("smart-folder")[0];
      elScreen = document.getElementsByClassName("smart-folder-screen")[0];

      elAppsContainer = resultsManager.getElement();

      elTitle = Evme.$(".title", el)[0];
      elImage = Evme.$(".image", el)[0];
      elClose = Evme.$('.close', el)[0];

      elFolderActions = Evme.$('.folder-actions', el)[0];
      actionsButtons = Evme.$('menu button', elFolderActions);
      for (var i=0,button; button=actionsButtons[i++];) {
          button.addEventListener('click', folderActionClick);
      }

      elOpenActions = Evme.$('.open-actions', el)[0];
      elOpenActions.addEventListener('click', function onClick() {
          elFolderActions.classList.toggle('show');
      });    

      elClose.addEventListener("click", self.hide);
      elAppsContainer.dataset.scrollOffset = 0;

      initPreinstalled();
      Evme.EventHandler.trigger(NAME, "init");
    };

    this.create = function create(options) {
      var query = options.query,
        apps = options.apps,
        icons = options.icons || [],
        gridPosition = options.gridPosition,
        extra = {"icons": icons};
      
      if (query) {
        Evme.SmartFolderSettings.createByQuery(query, extra, function onCreate(folderSettings) {
          addFolderToHomescreen(folderSettings, gridPosition)
        });
      } else if (apps.length > 1) {
        Evme.SmartFolderSettings.createByAppPair(apps[0], apps[1], extra, function onCreate(folderSettings) {
          addFolderToHomescreen(folderSettings, gridPosition)
        });
      }
    }

    this.show = function launch(e) {
      var data = e.detail;
      Evme.SmartFolderStorage.get(data.id, function onGotFromStorage(folderSettings) {
        currentSettings = folderSettings;

        el.dataset.id = folderSettings.id;
        self.setTitle(folderSettings.name || folderSettings.query);
        folderSettings.bg && self.setBackground(folderSettings.bg);

        this.editMode = false;
        
        resultsManager.renderStaticApps(folderSettings.apps);

        window.setTimeout(function onTimeout() {
          el.classList.add(CLASS_WHEN_VISIBLE);
          elScreen.classList.add(CLASS_WHEN_VISIBLE);
        }, 0);

        Evme.EventHandler.trigger(NAME, "show", {
          "folder": self
        });
      });
    }

    this.hide = function hide() {
      if (!currentSettings) {
        return false;
      }

      currentSettings = null;

      el.classList.remove(CLASS_WHEN_VISIBLE);
      elScreen.classList.remove(CLASS_WHEN_VISIBLE);

      // hack for preventing the browser from saving the scroll position
      // and restoring it when a new SmartFolder opens
      resultsManager.scrollToTop();

      resultsManager.clear();
      self.clearBackground();

      self.toggleEditMode(false);

      Evme.EventHandler.trigger(NAME, "hide", {
        "folder": self
      });

      return true;
    };

    this.isOpen = function isOpen(){
        return currentSettings !== null;
    };

    this.setTitle = function setTitle(newTitle) {
      title = newTitle;
      
      elTitle.innerHTML = '<em></em>' + '<span>' + title + '</span>' + ' ' +
        '<span ' + Evme.Utils.l10nAttr(NAME, 'title-suffix') + '>Phone</span>';
    };

    this.setBackground = function setBackground(newBg) {
      self.clearBackground();

      elImage.style.backgroundImage = 'url(' + newBg.image + ')';

      elImageFullscreen = Evme.BackgroundImage.getFullscreenElement(newBg, self.hideFullscreen);
      el.appendChild(elImageFullscreen);

      Evme.SmartFolderStorage.update(currentSettings, {bg: newBg});
      
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
      return currentSettings.query;
    };

    this.userSetBg = function userSetBg() {
      return (currentSettings.bg && currentSettings.bg.setByUser);
    }
    
    this.addApps = function addApps(newApps, folderSettings) {
      var settings = folderSettings || currentSettings;
      if (newApps && newApps.length) {
        var allApps = settings.apps.concat(newApps);
        setStaticApps(allApps, settings);
      }
    };

    this.removeResult = function removeResult(data) {
      var newApps = currentSettings.apps.filter(function(app) {
        return app.id !== data.id;
      });

      if (newApps.length !== currentSettings.apps.length) {
        setStaticApps(newApps);
      }
    };

    this.toggleEditMode = function toggleEditMode(bool) {
      if (self.editMode === bool) {
        return false;
      }

      self.editMode = bool;
      if (bool) {
        el.dataset.mode = 'edit';
      } else {
        delete el.dataset.mode;
      }

      return true;
    };

    function setStaticApps(apps, folderSettings) {
      var settings = folderSettings || currentSettings,
        uniqueApps = Evme.Utils.unique(apps, 'id')
        icons = getHomescreenIcons(settings, uniqueApps);

      Evme.SmartFolderStorage.update(settings, {"apps": uniqueApps, "icons": icons}, function onUpdate(updatedSettings){
        resultsManager.renderStaticApps(updatedSettings.apps);
        addFolderToHomescreen(updatedSettings);
      });
    }

    function folderActionClick(e) {
      e.preventDefault();
      e.stopPropagation();
      switch (this.dataset.action) {
        case "addApp":
          Evme.EventHandler.trigger(NAME, "actionAddApp", {
            "staticApps": currentSettings.apps
          });
          break;

        case "rename":
          var newTitle = prompt("Rename Smart Folder", title);
          if (newTitle && newTitle !== title) {
            Evme.SmartFolderStorage.update(currentSettings, {
              "experienceId": null,
              "query": newTitle,
              "name": newTitle
            }, function onUpdate(updatedSettings) {
              self.setTitle(newTitle);
              addFolderToHomescreen(updatedSettings);
              Evme.EventHandler.trigger(NAME, "rename", {
                "id": currentSettings.id,
                "newName": newTitle
              });
            });
          }
          break;

      }
      elFolderActions.classList.remove('show');
    }

    function initPreinstalled() {
      var cacheKey = 'createdInitialShortcuts',
        appsFirstPage = 8;

      Evme.Storage.get(cacheKey, function onCacheValue(didInitShortcuts) {
        if (didInitShortcuts) {
          return;
        }

        var defaultShortcuts = Evme.__config['_localShortcuts'],
          defaultIcons = Evme.__config['_localShortcutsIcons'];

        for (var i = 0; i < defaultShortcuts.length; i++) {
          var shortcut = defaultShortcuts[i],
            gridPosition = {
              "page": (i < appsFirstPage) ? 0 : 1,
              "index": (i < appsFirstPage) ? i : (i % appsFirstPage)
            };

          var shortcutIcons = shortcut.appIds.map(function addIcon(appId) {
            return defaultIcons[appId];
          });

          createPreinstalledFolder(shortcut.experienceId, shortcutIcons, gridPosition);
        }

        Evme.Storage.set(cacheKey, true);
      });

      // create the icon, create the folder, add it to homescreen
      function createPreinstalledFolder(experienceId, icons, position) {
        var l10nkey = 'id-' + Evme.Utils.shortcutIdToKey(experienceId),
          query = Evme.Utils.l10n('shortcut', l10nkey);

        var folderSettings = new Evme.SmartFolderSettings({
          id: Evme.Utils.uuid(),
          experienceId: experienceId,
          query: query,
          icons: icons,
          apps: Evme.InstalledAppsService.getMatchingApps({
            'query': query
          })
        });

        saveFolderSettings(folderSettings, function onSettingsSaved(folderSettings) {
          addFolderToHomescreen(folderSettings, position);
          populateFolder(folderSettings);
        });
      };
    }
  };


  /**
   * The data required for displaying a folder
   * @param {Object} args
   */
  Evme.SmartFolderSettings = function Evme_SmartFolderSettings(args) {
    this.id = args.id;
    this.name = args.name || args.query;
    this.bg = args.bg || null;  // object containing backgound information (image, query, source, setByUser)
    
    // folder performs search by query or by experience
    this.query = args.query || args.name;
    this.experienceId = args.experienceId;
    
    this.apps = args.apps || [];
    this.icons = args.icons || [];
  };

  /**
   * Create a settings object from a query
   * @param  {String}   query
   * @param  {Object}   extra
   * @param  {Function} cb
   */
  Evme.SmartFolderSettings.createByQuery = function createByQuery(query, extra, cb) {
    if (extra instanceof Function) {
      (cb = extra) && (extra = {});
    };

    var installedApps = Evme.InstalledAppsService.getMatchingApps({
      'query': query
    });

    var installedIcons = Evme.Utils.pluck(installedApps, 'icon');

    var folderSettings = new Evme.SmartFolderSettings({
      id: Evme.Utils.uuid(),
      query: query,
      icons: installedIcons.concat(extra.icons || []),
      apps: installedApps
    });

    saveFolderSettings(folderSettings, cb);
  };

  /**
   * Create a settings object from 2 apps.
   * @param  {Object}   sourceApp - the app being dragged
   * @param  {Object}   targetApp - the app being dropped on
   * @param  {Object}   extra
   * @param  {Function} cb
   */
  Evme.SmartFolderSettings.createByAppPair = function createByAppPair(sourceApp, targetApp, extra, cb) {
    if (extra instanceof Function) {
      (cb = extra) && (extra = {});
    };

    var folderId = Evme.Utils.uuid(),
      folderName,
      folderApps,
      folderSettings,

      queriesA = Evme.InstalledAppsService.getMatchingQueries(sourceApp.id),
      queriesB = Evme.InstalledAppsService.getMatchingQueries(targetApp.id);

    // find a suitable name for the folder
    if (queriesA.length && queriesB.length) {
      // search for a common query
      for (var i = 0, q; q = queriesA[i++]; ) {
        if (queriesB.indexOf(q) > -1) {
          folderName = q;
          break;
        }
      }
    } 

    if (folderName === undefined) {
      folderName = queriesA[0] || queriesB[0] || sourceApp.name || targetApp.name || "New Folder";
    }

    folderApps = Evme.InstalledAppsService.getMatchingApps({
      'query': folderName
    });

    folderApps.unshift(targetApp);
    folderApps.unshift(sourceApp);
    
    folderApps = Evme.Utils.unique(folderApps, 'id');

    folderSettings = new Evme.SmartFolderSettings({
      id: folderId,
      name: folderName,
      apps: folderApps,
      icons: Evme.Utils.pluck(folderApps, 'icon')
    });
    
    saveFolderSettings(folderSettings, cb);
  };

  Evme.SmartFolderSettings.updateAll = function updateAll(){
    var folderIds = Evme.SmartFolderStorage.getAllIds();

    for (var i = 0, id; id = folderIds[i++];) {
      Evme.SmartFolderStorage.get(id, populateFolder);
    }
  }

  function saveFolderSettings(folderSettings, cb) {
    // save folder settings in storage and run callback async.
    Evme.SmartFolderStorage.add(folderSettings, function onFolderStored() {
      cb && cb(folderSettings);
    });
  }

  function populateFolder(folderSettings){ 
    var existingIds = Evme.Utils.pluck(folderSettings.apps, 'id');

    var newApps = Evme.InstalledAppsService.getMatchingApps({
      'query': folderSettings.query
    });

    newApps = newApps.filter(function isNew(app) {
      return existingIds.indexOf(app.id) === -1
    })

    if (!newApps.length) return;

    var folderApps = folderSettings.apps.concat(newApps);
    
    Evme.SmartFolderStorage.update(folderSettings, {"apps": folderApps, "icons": getHomescreenIcons(folderSettings, folderApps)}, addFolderToHomescreen);
  };

  function addFolderToHomescreen(folderSettings, gridPosition) {
    Evme.IconGroup.get(folderSettings.icons, function onIconCreated(canvas){
      
      Evme.Utils.sendToOS(Evme.Utils.OSMessages.APP_INSTALL, {
        "id": folderSettings.id,
        "originUrl": 'fldr://' + folderSettings.id,
        "title": folderSettings.name,
        "icon": canvas.toDataURL(),
        "isFolder": true,
        "gridPosition": gridPosition
      });
    });
  }

  function getHomescreenIcons(folderSettings, folderApps){
    var firstApps = folderApps || folderSettings.apps;
    return Evme.Utils.pluck(firstApps, 'icon').concat(folderSettings.icons).slice(0,3);
  }

  /**
   * Persists settings to local storage
   */
  Evme.SmartFolderStorage = new function Evme_SmartFolderStorage() {
    var NAME = "SmartFolderStorage",
      IDS_STORAGE_KEY = "evmeSmartFolders",
      PREFIX = "fldrsttngs_",
      self = this,
      ids = null;

    this.init = function init() {
      Evme.Storage.get(IDS_STORAGE_KEY, function onGet(storedIds){
        ids = storedIds || [];
      });

      window.addEventListener('folderUninstalled', this.remove);
    };

    this.remove = function remove(gridFolder) {
      Evme.Storage.remove(PREFIX + gridFolder.id);
    }
    
    this.add = function add(folderSettings, cb) {
      if (!folderSettings.id) return;
      
      Evme.Storage.set(PREFIX + folderSettings.id, folderSettings, function onSet() {
        addId(folderSettings.id);
        cb instanceof Function && cb(folderSettings);
      });
    };

    this.update = function update(folderSettings, data, cb) {
      for (var prop in data) {
        folderSettings[prop] = data[prop];
      }
      self.add(folderSettings, cb);
    };

    this.get = function get(folderSettingsId, cb) {
      Evme.Storage.get(PREFIX + folderSettingsId, function onGet(storedSettings) {
        if (cb && storedSettings !== null) {
          var folderSettings = new Evme.SmartFolderSettings(storedSettings);
          cb instanceof Function && cb(folderSettings);
        }
      });
    };

    this.getAllIds = function getAllIds() {
      return ids;
    };

    // TODO handle sync. issues (read/write)
    function addId(id) {
      if (ids === null) {
        setTimeout(function retry() {
          Evme.Utils.warn("SmartFolderStorage: addId called but storage is not ready. Will retry.");
          addId(id);
        }, 100);
      } else {
        ids.push(id);
        Evme.Storage.set(IDS_STORAGE_KEY, ids);
      }
    }
  };
}();
Evme.SmartFolder = new function Evme_SmartFolder(_options) {
  var self = this,
    NAME = "SmartFolder",
    
    folderSettings = null,

    el = null,
    elScreen = null,
    elTitle = null,
    elClose = null,
    elAppsContainer = null,
    elImage = null,
    elImageFullscreen = null,
    resultsManager = null,
    elFolderActions = null,
    elStaticAppActions = null,

    title = '',
    pendingActionAppId = null,  // the id of the app that triggered the actions menu

    CLASS_WHEN_VISIBLE = 'visible',
    CLASS_WHEN_IMAGE_FULLSCREEN = 'full-image',
    CLASS_WHEN_ANIMATING = 'animate',
    TRANSITION_DURATION = 400;

  this.init = function init(options) {
    var actionsButtons;

    !options && (options = {});

    resultsManager = options.resultsManager;

    el = Evme.$(".smart-folder")[0];
    elScreen = Evme.$(".smart-folder-screen")[0];

    elAppsContainer = resultsManager.getElement();

    elTitle = Evme.$(".title", el)[0];
    elImage = Evme.$(".image", el)[0];
    elClose = Evme.$('.close', el)[0];

    elStaticAppActions = Evme.$('.static-app-actions', el)[0];
    actionsButtons = Evme.$('menu button', elStaticAppActions);
    for (var i = 0, button; button = actionsButtons[i++];) {
      button.addEventListener('click', staticAppActionClick);
    }

    elFolderActions = Evme.$('.folder-actions', el)[0];
    actionsButtons = Evme.$('menu button', elFolderActions);
    for (var i=0,button; button=actionsButtons[i++];) {
        button.addEventListener('click', folderActionClick);
    }

    elOpenActions = Evme.$('.open-actions', el)[0];
    elOpenActions.addEventListener('click', function onClick() {
        elFolderActions.classList.toggle('show');
    });    

    elClose.addEventListener("click", self.close);
    elAppsContainer.dataset.scrollOffset = 0;

    Evme.EventHandler.trigger(NAME, "init");
  };

  this.show = function show(_folderSettings) {
    folderSettings = _folderSettings;

    self.setTitle(folderSettings.name || folderSettings.query);
    folderSettings.bg && self.setBackground(folderSettings.bg);
    
    resultsManager.renderStaticApps(folderSettings.apps);

    window.setTimeout(function onTimeout() {
      el.classList.add(CLASS_WHEN_VISIBLE);
      elScreen.classList.add(CLASS_WHEN_VISIBLE);
    }, 0);

    Evme.EventHandler.trigger(NAME, "show", {
      "folder": self
    });
  };

  this.hide = function hide() {
    el.classList.remove(CLASS_WHEN_VISIBLE);
    elScreen.classList.remove(CLASS_WHEN_VISIBLE);

    resultsManager.clear();
    self.clearBackground();

    Evme.EventHandler.trigger(NAME, "hide", {
      "folder": self
    });

    return self;
  };

  this.close = function close(e) {
    // hack for preventing the browser from saving the scroll position
    // and restoring it when a new SmartFolder opens
    resultsManager.scrollToTop();

    e && e.preventDefault();
    e && e.stopPropagation();

    self.hide();

    Evme.EventHandler.trigger(NAME, "close", {
      "folder": self
    });

    return self;
  };

  this.setTitle = function setTitle(newTitle) {
    title = newTitle;
    
    elTitle.innerHTML = '<em></em>' + '<span>' + title + '</span>' + ' ' +
      '<span ' + Evme.Utils.l10nAttr(NAME, 'title-suffix') + '></span>';
  };

  this.setBackground = function setBackground(newBg) {
    self.clearBackground();

    elImage.style.backgroundImage = 'url(' + newBg.image + ')';

    elImageFullscreen = Evme.BackgroundImage.getFullscreenElement(newBg, self.hideFullscreen);
    el.appendChild(elImageFullscreen);

    Evme.SmartFolderStorage.update(folderSettings, {bg: newBg});
    
    resultsManager.changeFadeOnScroll(true);
  };

  this.clearBackground = function clearBackground() {
    el.style.backgroundImage = 'none';
    elImage.style.backgroundImage = 'none';

    Evme.$remove(elImageFullscreen);

    resultsManager.changeFadeOnScroll(false);
  };

  this.showFullscreen = function showFullScreen(e) {
    e && e.preventDefault();
    e && e.stopPropagation();

    el.classList.add(CLASS_WHEN_ANIMATING);
    window.setTimeout(function onTimeout() {
      self.fadeImage(0);
      el.classList.add(CLASS_WHEN_IMAGE_FULLSCREEN);

    }, 10);
  };

  this.hideFullscreen = function hideFullscreen(e) {
    e && e.preventDefault();
    e && e.stopPropagation();

    el.classList.add(CLASS_WHEN_ANIMATING);
    window.setTimeout(function onTimeout() {
      self.fadeImage(1);
      el.classList.remove(CLASS_WHEN_IMAGE_FULLSCREEN);

      window.setTimeout(function onTimeout() {
        el.classList.remove(CLASS_WHEN_ANIMATING);
      }, TRANSITION_DURATION);
    }, 10);
  };

  this.fadeImage = function fadeImage(howMuch) {
    elAppsContainer.style.opacity = howMuch;
  };

  this.getElement = function getElement() {
    return el;
  };
  
  this.getExperience = function getExperience() {
    return folderSettings.experienceId;
  };
  
  this.getQuery = function getQuery() {
    return folderSettings.query;
  };

  this.userSetBg = function userSetBg() {
    return (folderSettings.bg && folderSettings.bg.setByUser);
  }
  
  this.addApps = function addApps(newApps) {
    if (newApps && newApps.length) {
      var allApps = folderSettings.apps.concat(newApps);
      setStaticApps(allApps);
    }
  };

  this.removeApp = function removeApp(appId) {
    var newApps = folderSettings.apps.filter(function(app) {
      return app.id !== appId;
    });

    if (newApps.length !== folderSettings.apps.length) {
      setStaticApps(newApps);
    }
  };

  this.openAppActions = function openAppActions(data) {
    pendingActionAppId = data.appId;
    elStaticAppActions.classList.add("show");
  };

  function setStaticApps(apps) {
    Evme.SmartFolderStorage.update(folderSettings, {"apps": apps}, function onUpdate(updatedSettings){
      folderSettings = updatedSettings;
      resultsManager.renderStaticApps(folderSettings.apps);
    });
  }

  function staticAppActionClick(e) {
    e.preventDefault();
    e.stopPropagation();
    switch (this.dataset.action) {
        case "remove":
            self.removeApp(pendingActionAppId);
            break;
    }
    elStaticAppActions.classList.remove('show');
    pendingActionAppId = null;
  }

  function folderActionClick(e) {
    e.preventDefault();
    e.stopPropagation();
    switch (this.dataset.action) {
      case "addApp":
        Evme.EventHandler.trigger(NAME, "actionAddApp", {
          "staticApps": folderSettings.apps
        });
        break;

      case "rename":
        var newTitle = prompt("Rename Smart Folder", title);
        if (newTitle && newTitle !== title) {
          Evme.SmartFolderStorage.update(folderSettings, {
            "experienceId": null,
            "query": newTitle,
            "name": newTitle
          }, function onUpdate() {
            self.setTitle(newTitle);
            Evme.EventHandler.trigger(NAME, "rename", {
              "id": folderSettings.id,
              "newName": newTitle
            });
          });
        }
        break;

    }
    elFolderActions.classList.remove('show');
  }
};


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

Evme.SmartFolderSettings.createByExperience = function createByExperience(experienceId, extra, cb) {
  if (extra instanceof Function) {
    (cb = extra) && (extra = {});
  };

  var l10nkey = 'id-' + Evme.Utils.shortcutIdToKey(experienceId),
    query = Evme.Utils.l10n('shortcut', l10nkey);

    var folderSettings = new Evme.SmartFolderSettings({
      id: Evme.Utils.uuid(),
      experienceId: experienceId,
      query: query,
      icons: extra.icons || [],
      apps: Evme.InstalledAppsService.getMatchingApps({
        'query': query
      })
    });

    saveFolderSettings(folderSettings, cb);
};

Evme.SmartFolderSettings.createByQuery = function createByQuery(query, extra, cb) {
  if (extra instanceof Function) {
    (cb = extra) && (extra = {});
  };


  var folderSettings = new Evme.SmartFolderSettings({
    id: Evme.Utils.uuid(),
    query: query,
    icons: extra.icons || [],
    apps: Evme.InstalledAppsService.getMatchingApps({
      'query': query
    })
  });

  saveFolderSettings(folderSettings, cb);
};

Evme.SmartFolderSettings.createByAppPair = function createByAppPair(appA, appB, extra, cb) {
  if (extra instanceof Function) {
    (cb = extra) && (extra = {});
  };

  var folderId = Evme.Utils.uuid(),
    folderName,
    folderApps,
    folderSettings,

    queriesA = Evme.InstalledAppsService.getMatchingQueries(appA.manifest),
    queriesB = Evme.InstalledAppsService.getMatchingQueries(appB.manifest);

  // find a suitable name for the folder
  if (queriesA.length && queriesB.length) {
    // search for a common query
    for (q in queriesA) {
      if (q in queriesB) {
        folderName = q;
        break;
      }
    }
  } else {
    folderName = queriesA[0] || queriesB[0] || appA.name || appB.name;
  }

  folderApps = Evme.InstalledAppsService.getMatchingApps({
    'query': folderName
  });

  // ensure folderApps contains both apps and no duplicates
  var appAFromIndex = Evme.InstalledAppsService.getAppByManifest(appA.manifest),
    appBFromIndex = Evme.InstalledAppsService.getAppByManifest(appB.manifest);
  
  appAFromIndex && folderApps.push(appAFromIndex);
  appBFromIndex && folderApps.push(appBFromIndex);
  
  folderApps = Evme.Utils.unique(folderApps);

  folderSettings = new Evme.SmartFolderSettings({
    id: folderId,
    name: folderName,
    apps: folderApps,
    icons: extra.icons || []
  });
  
  saveFolderSettings(folderSettings, cb);
};

Evme.SmartFolderSettings.refreshIcons = function refreshIcons() {
  var folderIds = Evme.SmartFolderStorage.getAllIds();
  
  for (var i = 0, id; id = folderIds[i++];) {
    Evme.SmartFolderStorage.get(id, refreshIcon);
  }
};

function saveFolderSettings(folderSettings, cb) {
  // save folder settings in storage and run callback async.
  Evme.SmartFolderStorage.add(folderSettings, function onFolderStored() {
    cb && cb(folderSettings);
  });
}

function refreshIcon(folderSettings){
  var apps = Evme.InstalledAppsService.getMatchingApps({
    'query': folderSettings.query
  });

  if (!apps.length) return;

  var appIcons = [];
  for (var i=0, app; app=apps[i++]; ){
    appIcons.push({"id": app.id, "icon": app.icon});
  }

  var shortcutIcons = appIcons.concat(folderSettings.icons).slice(0,3);
  
  Evme.IconGroup.get(shortcutIcons, '', function(elCanvas){
      Evme.Utils.sendToOS(Evme.Utils.OSMessages.APP_INSTALL, {
        "id": folderSettings.id,
        "originUrl": 'fldr://' + folderSettings.id,
        "title": folderSettings.name,
        "icon": elCanvas.toDataURL(),
        "isFolder": true
      });
  });
};

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
  };

  this.remove = function remove(folderSettingsId) {
    // TODO
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
Evme.SmartFolder = function Evme_SmartFolder(_options) {
  var self = this,
    NAME = "SmartFolder",
    
    folderSettings = null,

    el = null,
    elScreen = null,
    elTitle = null,
    elClose = null,
    elAppsContainer = null,
    elApps = null,
    elImage = null,
    elImageFullscreen = null,
    resultsManager = null,

    SCROLL_BOTTOM_THRESHOLD = 5,
    CLASS_WHEN_LOADING = 'show-loading-apps',
    CLASS_WHEN_VISIBLE = 'visible',
    CLASS_WHEN_IMAGE_FULLSCREEN = 'full-image',
    CLASS_WHEN_ANIMATING = 'animate',
    SCROLL_TO_SHOW_IMAGE = 80,
    TRANSITION_DURATION = 400,
    LOAD_MORE_SCROLL_THRESHOLD = -30,
    MAX_SCROLL_FADE = 200,
    FULLSCREEN_THRESHOLD = 0.8;

  this.init = function init(options) {
    !options && (options = {});

    folderSettings = options.folderSettings;
    resultsManager = options.resultsManager;

    elScreen = Evme.$(".smart-folder-screen")[0];

    el = Evme.$(".smart-folder")[0];

    elAppsContainer = resultsManager.getElement();
    elApps = Evme.$('div', elAppsContainer)[0];

    elTitle = Evme.$(".title", el)[0];
    elImage = Evme.$(".image", el)[0];
    elClose = Evme.$('.close', el)[0];

    elClose.addEventListener("click", self.close);
    elAppsContainer.dataset.scrollOffset = 0;

    self.setTitle();
    folderSettings.bg && self.setBackground(folderSettings.bg);
    
    // render apps
    resultsManager.renderStaticApps(folderSettings.apps);
    resultsManager.onNewQuery({
      "query": folderSettings.query
    });

    Evme.EventHandler.trigger(NAME, "init");

    return self;
  };

  this.show = function show() {
    window.setTimeout(function onTimeout() {
      el.classList.add(CLASS_WHEN_VISIBLE);
      elScreen.classList.add(CLASS_WHEN_VISIBLE);
    }, 0);

    Evme.EventHandler.trigger(NAME, "show", {
      "folder": self
    });

    return self;
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

  this.appendTo = function appendTo(elParent) {
    elParent.appendChild(el);
    elParent.appendChild(elScreen);

    return self;
  };

  this.setTitle = function setTitle() {
    var title = folderSettings.name || folderSettings.query;
    
    elTitle.innerHTML = '<em></em>' +
      '<b ' + Evme.Utils.l10nAttr(NAME, 'title-prefix') + '></b> ' +
      '<span>' + title + '</span>';
  };

  this.setBackground = function setBackground(newBg) {
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
  
  self.init(_options);
};


Evme.SmartFolderSettings = function Evme_SmartFolderSettings(args) {
  this.id = args.id;
  this.name = args.name || args.query;
  this.bg = args.bg || null;  // object containing backgound information (image, query, source, setByUser)
  
  // folder performs search by query or by experience
  this.query = args.query || args.name;
  this.experienceId = args.experienceId;
  
  this.apps = args.apps;
};

Evme.SmartFolderSettings.prototype = new function Evme_SmartFolderSettingsPrototype() {
  
  this.byExperience = function byExperience(experienceId, cb) {
    var l10nkey = 'id-' + Evme.Utils.shortcutIdToKey(experienceId),
      query = Evme.Utils.l10n('shortcut', l10nkey);

      var folderSettings = new Evme.SmartFolderSettings({
        id: Evme.Utils.uuid(),
        experienceId: experienceId,
        query: query,
        apps: Evme.InstalledAppsService.getMatchingApps({
          'query': query
        })
      });

      saveFolderSettings(folderSettings, cb);
  };

  this.byQuery = function byQuery(query, cb) {
    var folderSettings = new Evme.SmartFolderSettings({
      id: Evme.Utils.uuid(),
      query: query,
      apps: Evme.InstalledAppsService.getMatchingApps({
        'query': query
      })
    });

    saveFolderSettings(folderSettings, cb);
  };

  this.byAppPair = function byAppPair(appA, appB, cb) {
    var folderId = Evme.Utils.uuid(),
      folderName,
      folderApps,
      folderSettings,

      queriesA = Evme.InstalledAppsService.getMatchingQueries(appA),
      queriesB = Evme.InstalledAppsService.getMatchingQueries(appB);

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

    folderSettings = new Evme.SmartFolderSettings({
      id: folderId,
      name: folderName,
      apps: folderApps
    });
    
    saveFolderSettings(folderSettings, cb);
  };

  function saveFolderSettings(folderSettings, cb) {
    // save folder settings in storage and run callback async.
    Evme.SmartFolderStorage.add(folderSettings, function onFolderStored() {
      Evme.Utils.log("saved SmartFolderSettings", JSON.stringify(folderSettings));
      cb && cb(folderSettings);
    });
  }
};


Evme.SmartFolderStorage = new function Evme_SmartFolderStorage() {
  var NAME = "SmartFolderStorage",
    PREFIX = "fldrsttngs_",
    self = this;

  this.add = function add(folderSettings, cb) {
    Evme.Storage.set(PREFIX + folderSettings.id, folderSettings, function onSet() {
      cb instanceof Function && cb();
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
};
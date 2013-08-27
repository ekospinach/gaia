/**
 * Collection.js
 * Main Evme object for using Collection
 *
 */
 void function() {
  Evme.Collection = new function Evme_Collection() {
    var self = this,
      NAME = 'Collection',

      currentSettings = null,

      el = null,
      elTitle = null,
      elClose = null,
      elAppsContainer = null,
      elImage = null,
      elImageFullscreen = null,
      resultsManager = null,
      elActions = null,
      elOpenActions = null,
      isFullScreenVisible = false,

      title = '',

      CLASS_WHEN_IMAGE_FULLSCREEN = 'full-image',
      CLASS_WHEN_ANIMATING = 'animate',
      TRANSITION_DURATION = 400,

      // number of preinstalled collections to create on the first page
      NUM_COLLECTIONS_FIRST_PAGE = 6;

    this.editMode = false;

    this.init = function init(options) {
      var actionsButtons;

      !options && (options = {});

      resultsManager = options.resultsManager;

      el = document.getElementsByClassName('collection')[0];

      elAppsContainer = resultsManager.getElement();

      elTitle = Evme.$('.title', el)[0];
      elImage = Evme.$('.image', el)[0];
      elClose = Evme.$('.close', el)[0];

      elActions = Evme.$('.collection-actions', el)[0];
      actionsButtons = Evme.$('menu button', elActions);
      for (var i = 0, button; button = actionsButtons[i++];) {
          button.addEventListener('click', collectionActionClick);
      }

      elOpenActions = Evme.$('.open-actions', el)[0];
      elOpenActions.addEventListener('click', function onClick() {
          Evme.Collection.toggleEditMode(false);
          elActions.classList.toggle('show');
      });

      elClose.addEventListener('click', self.hide);
      elAppsContainer.dataset.scrollOffset = 0;

      initPreinstalled();
      Evme.EventHandler.trigger(NAME, 'init');
    };

    this.create = function create(options) {
      var query = options.query,
        apps = options.apps,
        icons = options.icons || [],
        gridPosition = options.gridPosition,
        callback = options.callback || Evme.Utils.NOOP,
        extra = {'icons': icons};

      if (query) {
        Evme.CollectionSettings.createByQuery(query, extra, function onCreate(collectionSettings) {
          addCollectionToHomescreen(collectionSettings, gridPosition, {
            "callback": function onAddedToHomescreen() {
              callback(collectionSettings);
            }
          });
        });
      }
    };

    this.remove = function removeCollection(id, params) {
      params = params || {};
      
      EvmeManager.removeGridItem({
        "id": id,
        "onConfirm": function onConfirm() {
          Evme.CollectionStorage.remove(id);
          params.callback && params.callback();
        }
      });
    };

    this.show = function launch(e) {
      var data = e.detail;
      Evme.CollectionStorage.get(data.id, function onGotFromStorage(collectionSettings) {
        currentSettings = collectionSettings;

        el.dataset.id = collectionSettings.id;
        self.setTitle(collectionSettings.name || collectionSettings.query);
        collectionSettings.bg && self.setBackground(collectionSettings.bg);

        self.editMode = false;

        resultsManager.renderStaticApps(collectionSettings.apps);

        window.mozRequestAnimationFrame(function() {
          el.classList.add('visible');
          Evme.EventHandler.trigger(NAME, 'show');
        });
      });
    };

    this.hide = function hide() {
      if (!currentSettings) {
        return false;
      }

      // update homescreen icon with first three visible icons
      var icons = resultsManager.getIcons();
      self.updateIcons(currentSettings, icons);

      currentSettings = null;

      // hack for preventing the browser from saving the scroll position
      // and restoring it when a new Collection opens
      resultsManager.scrollToTop();

      resultsManager.clear();
      self.clearBackground();

      self.toggleEditMode(false);

      window.mozRequestAnimationFrame(function() {
        el.classList.remove('visible');
        Evme.EventHandler.trigger(NAME, 'hide');
      });

      return true;
    };

    this.isOpen = function isOpen() {
        return currentSettings !== null;
    };

    this.setTitle = function setTitle(newTitle) {
      title = newTitle;

      elTitle.innerHTML = '<em></em>' + '<span>' + title + '</span>' + ' ' +
        '<span ' + Evme.Utils.l10nAttr(NAME, 'title-suffix') + '/>';
    };

    this.setBackground = function setBackground(newBg) {
      if (!currentSettings) return;

      self.clearBackground();

      elImage.style.backgroundImage = 'url(' + newBg.image + ')';

      elImageFullscreen = Evme.BackgroundImage.getFullscreenElement(newBg, self.hideFullscreen);
      el.appendChild(elImageFullscreen);

      Evme.CollectionStorage.update(currentSettings, {bg: newBg});

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
    };

    this.addApps = function addApps(newApps, collectionSettings) {
      if (!Array.isArray(newApps)) {
        newApps = [newApps];
      }

      var settings = collectionSettings || currentSettings;
      if (newApps && newApps.length) {
        var allApps = settings.apps.concat(newApps);
        setStaticApps(allApps, settings);
      }
    };

    this.removeResult = function removeResult(data) {
      var id = data.id; // the id of the app to remove

      var newApps = currentSettings.apps.filter(function filterApp(app) {
        return app.id !== id;
      });

      if (newApps.length < currentSettings.apps.length) {
        // remove the app
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
        document.addEventListener('mozvisibilitychange', onVisibilityChange);
      } else {
        delete el.dataset.mode;
        document.removeEventListener('mozvisibilitychange', onVisibilityChange);
      }

      return true;
    };

    this.updateIcons = function updateIcons(collectionSettings, icons, merge) {
      if (collectionSettings && icons && icons.length) {
        if (merge) {
          icons = mergeAppIcons(collectionSettings.apps, icons);
        }

        Evme.CollectionStorage.update(collectionSettings, {'icons': icons});
        addCollectionToHomescreen(collectionSettings);
      }
    };

    function onVisibilityChange() {
      if (document.mozHidden) {
        self.toggleEditMode(false);
      }
    }

    function setStaticApps(apps, collectionSettings) {
      var settings = collectionSettings || currentSettings,
        uniqueApps = Evme.Utils.unique(apps, 'id'),
        icons = mergeAppIcons(apps, settings.icons);

      Evme.CollectionStorage.update(settings, {
        'apps': uniqueApps,
        'icons': icons
      }, function onUpdate(updatedSettings) {
        resultsManager.renderStaticApps(updatedSettings.apps);
        addCollectionToHomescreen(updatedSettings);
      });
    }

    function collectionActionClick(e) {
      e.preventDefault();
      e.stopPropagation();
      switch (this.dataset.action) {
        case 'addApp':
          Evme.EventHandler.trigger(NAME, 'actionAddApp', {
            'staticApps': currentSettings.apps
          });
          break;

        case 'rename':
          var newTitle = prompt(Evme.Utils.l10n(NAME, 'prompt-rename'), title);
          if (newTitle && newTitle !== title) {
            Evme.CollectionStorage.update(currentSettings, {
              'experienceId': null,
              'query': newTitle,
              'name': newTitle
            }, function onUpdate(updatedSettings) {
              self.setTitle(newTitle);
              addCollectionToHomescreen(updatedSettings);
              Evme.EventHandler.trigger(NAME, 'rename', {
                'id': currentSettings.id,
                'newName': newTitle
              });
            });
          }
          break;

      }
      elActions.classList.remove('show');
    }

    function initPreinstalled() {
      var cacheKey = 'createdInitialShortcuts';

      Evme.Storage.get(cacheKey, function onCacheValue(didInitShortcuts) {
        if (didInitShortcuts) {
          return;
        }

        var defaultShortcuts = Evme.__config['_localShortcuts'],
          defaultIcons = Evme.__config['_localShortcutsIcons'];

        for (var i = 0; i < defaultShortcuts.length; i++) {
          var shortcut = defaultShortcuts[i],
            gridPosition = {
              'page': (i < NUM_COLLECTIONS_FIRST_PAGE) ? 0 : 1,
              'index': (i < NUM_COLLECTIONS_FIRST_PAGE) ? i : (i % NUM_COLLECTIONS_FIRST_PAGE)
            };

          var shortcutIcons = shortcut.appIds.map(function addIcon(appId) {
            return defaultIcons[appId];
          });

          (function initCollection(experienceId, shortcutIcons, gridPosition) {
            Evme.Utils.getRoundIcons({'sources': shortcutIcons }, function onRoundIcons(roundIcons) {
              createPreinstalledCollection(experienceId, roundIcons, gridPosition);
            });
          })(shortcut.experienceId, shortcutIcons, gridPosition);
        }

        Evme.Storage.set(cacheKey, true);
      });

      // create the icon, create the collection, add it to homescreen
      function createPreinstalledCollection(experienceId, icons, position) {
        var l10nkey = 'id-' + Evme.Utils.shortcutIdToKey(experienceId),
          query = Evme.Utils.l10n('shortcut', l10nkey);

        var apps = Evme.InstalledAppsService.getMatchingApps({
          'query': query
        });

        icons = mergeAppIcons(apps, icons);

        var collectionSettings = new Evme.CollectionSettings({
          id: Evme.Utils.uuid(),
          experienceId: experienceId,
          query: query,
          icons: icons,
          apps: apps
        });

        saveSettings(collectionSettings, function onSettingsSaved(collectionSettings) {
          addCollectionToHomescreen(collectionSettings, position);
          populateCollection(collectionSettings);
        });
      };
    }
  };


  /**
   * The data required for displaying a collection
   * @param {Object} args
   */
  Evme.CollectionSettings = function Evme_CollectionSettings(args) {
    this.id = args.id;
    this.name = args.name || args.query;
    this.bg = args.bg || null;  // object containing backgound information (image, query, source, setByUser)

    // collection performs search by query or by experience
    this.query = args.query || args.name;
    this.experienceId = args.experienceId;

    this.apps = args.apps || [];
    this.icons = args.icons || []; // [3,5,"app://browser.gaiamobile.org/style/icon60.png"]
  };

  /**
   * Create a settings object from a query
   * @param  {String}   query
   * @param  {Object}   extra
   * @param  {Function} cb
   */
  Evme.CollectionSettings.createByQuery = function createByQuery(query, extra, cb) {
    if (extra instanceof Function) {
      (cb = extra) && (extra = {});
    }

    var installedApps = Evme.InstalledAppsService.getMatchingApps({
      'query': query
    });

    var installedIcons = Evme.Utils.pluck(installedApps, 'icon');

    var settings = new Evme.CollectionSettings({
      id: Evme.Utils.uuid(),
      query: query,
      icons: installedIcons.concat(extra.icons || []),
      apps: installedApps
    });

    saveSettings(settings, cb);
  };

  Evme.CollectionSettings.updateAll = function updateAll() {
    var ids = Evme.CollectionStorage.getAllIds();

    for (var i = 0, id; id = ids[i++];) {
      Evme.CollectionStorage.get(id, populateCollection);
    }
  };

  // save collection settings in storage and run callback async.
  function saveSettings(settings, cb) {
    Evme.CollectionStorage.add(settings, function onStored() {
      cb && cb(settings);
    });
  }

  function populateCollection(settings) {
    var existingIds = Evme.Utils.pluck(settings.apps, 'id');

    var newApps = Evme.InstalledAppsService.getMatchingApps({
      'query': settings.query
    });

    newApps = newApps.filter(function isNew(app) {
      return existingIds.indexOf(app.id) === -1;
    });

    if (!newApps.length) return;

    var apps = settings.apps.concat(newApps),
        icons = mergeAppIcons(apps, settings.icons);

    Evme.CollectionStorage.update(settings, {'apps': apps, 'icons': icons}, addCollectionToHomescreen);
  };

  /**
   * Add a new collection to the homescreen.
   * If collection exists will update the icon.
   */
  function addCollectionToHomescreen(settings, gridPosition, extra) {
    var homescreenIcons = (settings.icons.length) ?
        settings.icons : Evme.Utils.pluck(settings.apps, 'icon');

    Evme.IconGroup.get(homescreenIcons, function onIconCreated(canvas) {
      EvmeManager.addGridItem({
        'id': settings.id,
        'originUrl': settings.id,
        'title': settings.name,
        'icon': canvas.toDataURL(),
        'isCollection': true,
        'isEmpty': !(homescreenIcons.length),
        'gridPosition': gridPosition
      }, extra);
    });
  }

  function mergeAppIcons(apps, icons) {
    if (!apps || !apps.length) return icons;
    return Evme.Utils.pluck(apps, 'icon').concat(icons).slice(0, Evme.Config.numberOfAppInCollectionIcon);
  }


  /**
   * CollectionStorage
   * Persists settings to local storage
   */
  Evme.CollectionStorage = new function Evme_CollectionStorage() {
    var NAME = 'CollectionStorage',
        IDS_STORAGE_KEY = 'evmeCollection',
        PREFIX = 'collectionsettings_',
        self = this,
        ids = null,
        locked = false;  // locks the ids list

    this.init = function init() {
      Evme.Storage.get(IDS_STORAGE_KEY, function onGet(storedIds) {
        ids = storedIds || [];
      });

      window.addEventListener('collectionUninstalled', onCollectionUninstalled);
    };

    this.remove = function remove(collectionId) {
      removeId(collectionId);
    };

    this.add = function add(settings, cb) {
      if (!settings.id) return;

      Evme.Storage.set(PREFIX + settings.id, settings, function onSet() {
        addId(settings.id);
        cb instanceof Function && cb(settings);
      });
    };

    this.update = function update(settings, data, cb) {
      for (var prop in data) {
        settings[prop] = data[prop];
      }
      self.add(settings, cb);
    };

    this.get = function get(settingsId, cb) {
      Evme.Storage.get(PREFIX + settingsId, function onGet(storedSettings) {
        if (cb && storedSettings !== null) {
          var settings = new Evme.CollectionSettings(storedSettings);
          cb instanceof Function && cb(settings);
        }
      });
    };

    this.getAllIds = function getAllIds() {
      return ids;
    };

    this.getAllCollections = function getAllCollections(callback) {
      var ids = self.getAllIds(),
          collections = [];

      for (var i = 0, id; id = ids[i++];) {
        self.get(id, onGotCollectionSettings);
      }

      function onGotCollectionSettings(settings) {
        collections.push(settings);
        if (collections.length === ids.length) {
          callback(collections);
        }
      }
    };

    function onCollectionUninstalled(e) {
      self.removeId(e.detail.collection.id);
    }

    function addId(id) {
      if (ids && ids.indexOf(id) > -1) return;

      if (ids === null || locked) {
        setTimeout(function retry() {addId(id); }, 100);
        return;
      }

      try {
        lock();
        ids.push(id);
        Evme.Storage.set(IDS_STORAGE_KEY, ids, unlock);
      } catch (ex) {
        unlock();
      }
    }

    function removeId(id) {
      if (ids === null || locked) {
        setTimeout(function retry() {removeId(id); }, 100);
        return;
      }

      try {
        lock();
        ids = ids.filter(function neqId(storedId) {return storedId !== id });
        Evme.CollectionStorage.set(IDS_STORAGE_KEY, ids, function onRemoved() {
          unlock();
          Evme.Storage.remove(PREFIX + collectionId);
        });
      } catch (ex) {
        unlock();
      }
    }

    function lock() {
      locked = true;
    }

    function unlock() {
      locked = false;
    }
  };

}();

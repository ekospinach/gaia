
'use strict';

var Homescreen = (function() {
  var mode = 'normal';
  var origin = document.location.protocol + '//homescreen.' +
    document.location.host.replace(/(^[\w\d]+.)?([\w\d]+.[a-z]+)/, '$2');
  var _ = navigator.mozL10n.get;
  setLocale();
  navigator.mozL10n.ready(function localize() {
    setLocale();
    GridManager.localize();
  });

  var initialized = false, landingPage;
  onConnectionChange(navigator.onLine);

  function initialize(lPage, onInit) {
    if (initialized) {
      return;
    }

    PaginationBar.init('.paginationScroller');

    initialized = true;
    landingPage = lPage;

    var swipeSection = Configurator.getSection('swipe');
    var options = {
      gridSelector: '.apps',
      dockSelector: '.dockWrapper',
      tapThreshold: Configurator.getSection('tap_threshold'),
      moveCollectionThreshold:
                        Configurator.getSection('move_collection_threshold'),
      // It defines the threshold to consider a gesture like a swipe. Number
      // in the range 0.0 to 1.0, both included, representing the screen width
      swipeThreshold: swipeSection.threshold,
      swipeFriction: swipeSection.friction,
      swipeTransitionDuration: swipeSection.transition_duration
    };

    GridManager.init(options, function gm_init() {
      window.addEventListener('hashchange', function onHashChange() {
        if (!window.location.hash.replace('#', '')) {
          return;
        }

        // this happens when the user presses the 'home' button
        if (Homescreen.didEvmePreventHomeButton()) {
          // nothing to do here, just prevent any other actions
        } else if (Homescreen.isInEditMode()) {
          exitFromEditMode();
        } else {
          GridManager.goToPage(landingPage);
        }

        GridManager.ensurePanning();
      });

      PaginationBar.show();
      if (document.location.hash === '#root') {
        // Switch to the first page only if the user has not already
        // start to pan while home is loading
        GridManager.goToPage(landingPage);
      }
      DragDropManager.init(options);

      // add tap-and-hold menu
      GridManager.container.addEventListener('contextmenu', onTapAndHold);

      if (onInit instanceof Function) {
        onInit();
      }
    });
  }

  function onTapAndHold(e) {
    e.preventDefault();

    var elDialog = document.createElement('form');
    elDialog.onsubmit = function() { return false; };
    elDialog.setAttribute('role', 'dialog');
    elDialog.setAttribute('data-type', 'action');
    elDialog.style.zIndex = '10005'; // to be on top of dock
    elDialog.innerHTML = '<menu>' +
      ('Wallpaper' in window ?
      '<button id="buttonWallpaper">Change Wallpaper...</button>' : '') +
      ('EverythingME' in window ?
      '<button id="buttonAddCollections">Add Collections</button>' +
      '<button id="buttonCustomCollection">Custom Collection</button>' : '') +
      '<button id="btnCancel">Cancel</button>' +
    '</menu>' +
  '</form>';

    document.body.appendChild(elDialog);

    attachEvents();

    function attachEvents() {
      attachEvent('buttonWallpaper', onClickWallpaper);
      attachEvent('buttonAddCollections', onClickAdd);
      attachEvent('buttonCustomCollection', onClickCustom);
      attachEvent('btnCancel', onClickCancel);
    }

    function removeEvents() {
      removeEvent('buttonWallpaper', onClickWallpaper);
      removeEvent('buttonAddCollections', onClickAdd);
      removeEvent('buttonCustomCollection', onClickCustom);
      removeEvent('btnCancel', onClickCancel);
    }

    function attachEvent(id, listener) {
      var el = elDialog.querySelector('#' + id);
      el && el.addEventListener('click', listener);
    }
    function removeEvent(id, listener) {
      var el = elDialog.querySelector('#' + id);
      el && el.removeEventListener('click', listener);
    }

    function onClickWallpaper() {
      Wallpaper.select();
      window.setTimeout(hide, 50);
    }
    function onClickAdd() {
      EverythingME.Collection.suggest();
      hide();
    }
    function onClickCustom() {
      EverythingME.Collection.custom();
      hide();
    }
    function onClickCancel() {
      hide();
    }

    function hide() {
      removeEvents();
      elDialog.parentNode.removeChild(elDialog);
    }
  }

  function exitFromEditMode() {
    Homescreen.setMode('normal');
    ConfirmDialog.hide();
    GridManager.exitFromEditMode();
  }

  document.addEventListener('visibilitychange', function mozVisChange() {
    if (document.hidden && Homescreen.isInEditMode()) {
      exitFromEditMode();
    }

    if (document.hidden == false) {
      setTimeout(function forceRepaint() {
        var helper = document.getElementById('repaint-helper');
        helper.classList.toggle('displayed');
      });
    }
  });

  window.addEventListener('message', function hs_onMessage(event) {
    if (event.origin === origin) {
      var message = event.data;
      switch (message.type) {
        case Message.Type.ADD_BOOKMARK:
          var app = new Bookmark(message.data);
          GridManager.install(app);
          break;
      }
    }
  });

  function setLocale() {
    // set the 'lang' and 'dir' attributes to <html> when the page is translated
    document.documentElement.lang = navigator.mozL10n.language.code;
    document.documentElement.dir = navigator.mozL10n.language.direction;
  }

  function onConnectionChange(isOnline) {
    var mode = isOnline ? 'online' : 'offline';
    document.body.dataset.online = mode;
  }

  window.addEventListener('online', function onOnline(evt) {
    onConnectionChange(true);
  });

  window.addEventListener('offline', function onOnline(evt) {
    onConnectionChange(false);
  });

  return {
    /*
     * Displays the contextual menu given an app.
     *
     * @param {Application} app
     *                      The application object.
     * @param {Object} extra
     *                      Extra callbacks and data.
     */
    showAppDialog: function h_showAppDialog(app, extra) {
      extra = extra || {};

      var title, body;
      var cancel = {
        title: _('cancel'),
        callback: function onCancel() {
          if (extra.onCancel)
            extra.onCancel();

          ConfirmDialog.hide();
        }
      };

      var confirm = {
        callback: function onAccept() {
          ConfirmDialog.hide();
          if (app.type === GridItemsFactory.TYPE.COLLECTION ||
              app.type === GridItemsFactory.TYPE.BOOKMARK) {
            app.uninstall();
          } else {
            navigator.mozApps.mgmt.uninstall(app);
          }

          if (extra.onConfirm)
            extra.onConfirm();
        },
        applyClass: 'danger'
      };

      // Show a different prompt if the user is trying to remove
      // a bookmark shortcut instead of an app.
      var manifest = app.manifest || app.updateManifest;
      if (app.type === GridItemsFactory.TYPE.COLLECTION ||
          app.type === GridItemsFactory.TYPE.BOOKMARK) {
        title = _('remove-title-2', { name: manifest.name });
        body = _('remove-body', { name: manifest.name });
        confirm.title = _('remove');
      } else {
        // Make sure to get the localized name
        manifest = new ManifestHelper(manifest);
        title = _('delete-title', { name: manifest.name });
        body = _('delete-body', { name: manifest.name });
        confirm.title = _('delete');
      }

      ConfirmDialog.show(title, body, cancel, confirm);
    },

    isInEditMode: function() {
      return mode === 'edit';
    },

    didEvmePreventHomeButton: function() {
      var evme = window.EvmeFacade;
      return evme && evme.onHomeButtonPress && evme.onHomeButtonPress();
    },

    init: initialize,

    setMode: function(newMode) {
      mode = document.body.dataset.mode = newMode;
    }
  };
})();

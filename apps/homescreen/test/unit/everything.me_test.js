'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireApp('homescreen/test/unit/mock_asyncStorage.js');
requireApp('homescreen/test/unit/mock_l10n.js');

// homescreen files evme depends on
require('/shared/js/screen_layout.js');

requireApp('homescreen/js/message.js');
requireApp('homescreen/js/request.js');
requireApp('homescreen/js/grid_components.js');
requireApp('homescreen/js/bookmark.js');
requireApp('homescreen/js/state.js');
requireApp('homescreen/js/icon_retriever.js');
requireApp('homescreen/js/page.js');
requireApp('homescreen/js/pagbar.js');
requireApp('homescreen/js/dock.js');
requireApp('homescreen/js/grid.js');
requireApp('homescreen/js/dragdrop.js');
requireApp('homescreen/js/homescreen.js');
requireApp('homescreen/js/configurator.js');
requireApp('homescreen/js/wallpaper.js');

// main evme file
requireApp('homescreen/everything.me/js/everything.me.js');

if (!this.asyncStorage) {
  this.asyncStorage = null;
}

suite('everything.me.js >', function() {
  var wrapperNode,
      realAsyncStorage;

  suiteSetup(function(done) {
    this.timeout(10000);

    realAsyncStorage = window.asyncStorage;
    window.asyncStorage = MockasyncStorage;

    wrapperNode = document.createElement('section');
    wrapperNode.innerHTML = MockEverythingMeHtml;
    document.body.appendChild(wrapperNode);

    EverythingME.init();

    window.addEventListener('evme.load', function onEvmeLoad() {
      done();
    });
  });

  suiteTeardown(function() {
    window.asyncStorage = realAsyncStorage;

    document.body.removeChild(wrapperNode);
  });

  suite('Everything.me starts initialization correctly >', function() {
    test('Ev.me page is loading >', function() {
      assert.isTrue(document.body.classList.contains('evme-loading'));
    });
  });

  test('Everything.me migration successful >', function(done) {
    // save localStorge values to restore after the test is complete
    var originalHistory = localStorage['userHistory'],
        originalShortcuts = localStorage['localShortcuts'],
        originalIcons = localStorage['localShortcutsIcons'];

    localStorage['userHistory'] = 'no json, should give error but continue';
    localStorage['localShortcuts'] = '{"_v": "shortcuts json with value"}';
    localStorage['localShortcutsIcons'] = '{"_v": "icons json with value"}';

    EverythingME.migrateStorage(function migrationDone() {
      // first test that the localStorage items were removed
      assert.isTrue(!localStorage['userHistory'] &&
                    !localStorage['localShortcuts'] &&
                    !localStorage['localShortcutsIcons']);

      // restore original localStorage values
      localStorage['userHistory'] = originalHistory;
      localStorage['localShortcuts'] = originalShortcuts;
      localStorage['localShortcutsIcons'] = originalIcons;

      window.asyncStorage.getItem('evme-localShortcuts', function got(val) {
        // then that they were actually copied to the IndexedDB
        assert.isTrue(!!(val && val.value));

        done();
      });
    }, true); // force migration even if already done by EverythingME.init()
  });

  suite('Everything.me will be destroyed >', function() {

    test('All e.me css/script should be deleted from the DOM >', function() {
      EverythingME.destroy();
      assert.equal(document.querySelectorAll('head > [href*="everything.me"]').
                   length, 0);
    });

  });

});

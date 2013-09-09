'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireApp('homescreen/test/unit/mock_l10n.js');

requireApp('homescreen/test/unit/mock_evme.js');

var mocksHelperForEvme = new MocksHelper([
  'Evme'
]);

mocksHelperForEvme.init();

// do this after the mocks init cause we need the Evme object
requireApp('homescreen/everything.me/modules/Banner/Banner.js');

suite('Evme.Banner >', function() {
  var elMockBanner = document.getElementById('#homescreenStatus');

  suiteSetup(function() {
    mocksHelperForEvme.suiteSetup();

    Evme.Banner.init({
      el: elMockBanner
    });
  });

  suiteTeardown(function() {
  });

  test('Banner init successfully', function() {
    assert.isTrue(Evme.EventHandler.fired('Banner.show'));
  });
});

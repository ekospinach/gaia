'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireApp('homescreen/test/unit/mock_evme.js');
requireApp('homescreen/test/unit/mock_evme_location.js');

requireApp('homescreen/everything.me/modules/Location/Location.js');

suite('Evme.Location >', function() {
  var TEST_LAT = '1',
      TEST_LON = '2';

  suiteSetup(function() {
    Evme.suiteSetup();
    MockLocation.suiteSetup(TEST_LAT, TEST_LON);

    Evme.Location.init({
      refreshInterval: 0,
      requestTimeout: 50
    });
  });

  suiteTeardown(function() {
    Evme.suiteTeardown();
    MockLocation.suiteTeardown();
  });

  test('init', function() {
    assert.isTrue(Evme.EventHandler.fired('Location', 'init'));
  });

  test('get user location (allow)', function(done) {
    // since the location only fires the request after 2 seconds
    // we need to set the timeout higher
    this.timeout(2500);

    Evme.Location.requestUserLocation();

    window.addEventListener('Location.success', onLocationSuccess);
    window.addEventListener('Location.error', onLocationError);

    window.addEventListener('Location.request', function location(data) {
      window.removeEventListener('Location.request', location);
      assert.isTrue(true);
    });

    function onLocationSuccess(data) {
      window.removeEventListener('Location.success', onLocationSuccess);
      window.removeEventListener('Location.error', onLocationError);

      var coords = data.detail.position.coords;

      assert.equal(coords.latitude, TEST_LAT);
      assert.equal(coords.longitude, TEST_LON);

      done();
    }

    function onLocationError(data) {
      window.removeEventListener('Location.success', onLocationSuccess);
      window.removeEventListener('Location.error', onLocationError);

      assert.isTrue(false);

      done();
    }
  });
});

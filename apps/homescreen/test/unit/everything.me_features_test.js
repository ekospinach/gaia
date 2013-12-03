'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireApp('homescreen/test/unit/mock_evme.js');

requireApp('homescreen/everything.me/modules/Features/Features.js');

suite('Evme.Features >', function() {
  var MOCK_CONFIG = {
    iconQuality: {
      disableAfter: 1000,
      bringBack: 600
    },
    typingImage: {
      disableAfter: 1200,
      bringBack: 800
    },
    typingApps: {
      disableAfter: 1600,
      bringBack: 800
    }
  };

  suiteSetup(function() {
    Evme.suiteSetup();

    Evme.Features.init({
      featureStateByConnection: MOCK_CONFIG
    });
  });

  suiteTeardown(function() {
    Evme.suiteTeardown();
  });

  test('init', function() {
    assert.isTrue(Evme.EventHandler.fired('Features', 'init'));

    // verify all features started enabled
    for (var featureName in MOCK_CONFIG) {
      assert.isTrue(Evme.Features.isOn(featureName));
    }
  });

  test('disable feature - manual', function() {
    var dataToTest = {
      featureName: 'iconQuality',
      oldValue: true,
      newValue: false
    };

    // disable and make sure we get the event
    Evme.Features.disable(dataToTest.featureName);
    assert.isTrue(Evme.EventHandler.fired('Features', 'set', dataToTest));

    // try and disable again - this time we SHOULDN'T get the event
    Evme.Features.disable(dataToTest.featureName);
    assert.isFalse(Evme.EventHandler.fired('Features', 'set', dataToTest));
  });

  test('enable feature - manual', function() {
    var dataToTest = {
      featureName: 'typingImage',
      oldValue: false,
      newValue: true
    };

    // first we disable it to make sure we can re-enable it later
    Evme.Features.disable(dataToTest.featureName);

    // try and enable now
    Evme.Features.enable(dataToTest.featureName);
    assert.isTrue(Evme.EventHandler.fired('Features', 'set', dataToTest));

    // try and enable again, this time we SHOULDN'T get the event
    Evme.Features.enable(dataToTest.featureName);
    assert.isFalse(Evme.EventHandler.fired('Features', 'set', dataToTest));
  });

  test('disable feature - automatic', function(done) {
    var dataToTest = {
      featureName: 'typingImage',
      oldValue: true,
      newValue: false
    };

    // first we make sure it's enabled
    Evme.Features.enable(dataToTest.featureName);

    window.addEventListener('Features.set', function disable() {
      window.removeEventListener('Features.set', disable);
      assert.isTrue(Evme.EventHandler.fired('Features', 'set', dataToTest));

      done();
    });

    Evme.Features.startTimingFeature(dataToTest.featureName, false);
  });

  test('enable feature - automatic', function(done) {
    var dataToTest = {
      featureName: 'typingApps',
      oldValue: false,
      newValue: true
    };

    // first we make sure it's disabled
    Evme.Features.disable(dataToTest.featureName);

    window.addEventListener('Features.set', function enable() {
      window.removeEventListener('Features.set', enable);
      assert.isTrue(Evme.EventHandler.fired('Features', 'set', dataToTest));

      done();
    });

    Evme.Features.startTimingFeature(dataToTest.featureName, true);

    // simulate time passed, and tell the module it can stop timing
    window.setTimeout(function timeout() {
      Evme.Features.stopTimingFeature(dataToTest.featureName, true);
    }, 200);
  });
});

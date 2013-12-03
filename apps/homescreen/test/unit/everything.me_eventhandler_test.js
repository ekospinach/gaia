'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireApp('homescreen/test/unit/mock_evme.js');

requireApp('homescreen/everything.me/js/helpers/EventHandler.js');

suite('Evme.EventHandler >', function() {
  suiteSetup(function() {
    Evme.suiteSetup({
      eventHandler: false
    });
  });

  suiteTeardown(function() {
    Evme.suiteTeardown();
  });

  test('bind and trigger', function(done) {
    var CLASS_NAME = 'mock',
        EVENT_NAME = 'test',
        EVENT_DATA = {
      test: 'data'
    };

    Evme.EventHandler.bind(function callback(className, eventName, eventData) {
      Evme.EventHandler.unbind(callback);

      assert.equal(className, CLASS_NAME);
      assert.equal(eventName, EVENT_NAME);
      assert.deepEqual(eventData, EVENT_DATA);

      done();
    });

    Evme.EventHandler.trigger(CLASS_NAME, EVENT_NAME, EVENT_DATA);
  });

  test('unbind', function() {
    // if that gets called the test FAILED, since we're doing "unbind"
    Evme.EventHandler.bind(callback);

    Evme.EventHandler.unbind(callback);

    Evme.EventHandler.trigger('class', 'event');

    assert.isTrue(true);

    function callback(className, eventName, eventData) {
      assert.isTrue(false);
    }
  });
});

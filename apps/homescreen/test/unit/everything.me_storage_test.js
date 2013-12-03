'use strict';

requireApp('homescreen/test/unit/mock_evme.js');
requireApp('homescreen/test/unit/mock_asyncStorage.js');

requireApp('homescreen/everything.me/js/helpers/Storage.js');

var mockStorage = new MocksHelper([
  'asyncStorage'
]);

mockStorage.init();

suite('Storage >', function() {
  suiteSetup(function() {
    mockStorage.suiteSetup();
  });

  suiteTeardown(function() {
    mockStorage.suiteTeardown();
  });

  test('set', function(done) {
    var TEST_KEY = 'mock_key',
        TEST_VALUE = 'mock_value';

    Evme.Storage.set(TEST_KEY, TEST_VALUE, function added() {
      assert.isTrue(true);

      done();
    });
  });

  test('get', function(done) {
    var TEST_KEY = 'mock_key_2',
        TEST_VALUE = 'mock_value_2';

    Evme.Storage.set(TEST_KEY, TEST_VALUE, function added() {
      Evme.Storage.get(TEST_KEY, function got(valueFromCache) {
        assert.equal(valueFromCache, TEST_VALUE);

        done();
      });
    });
  });

  test('remove', function(done) {
    var TEST_KEY = 'mock_key_2',
        TEST_VALUE = 'mock_value_2';

    // add the value
    Evme.Storage.set(TEST_KEY, TEST_VALUE, function added() {
      // get and make sure it was added
      Evme.Storage.get(TEST_KEY, function got(valueFromCache) {
        assert.equal(valueFromCache, TEST_VALUE);

        // remove it
        Evme.Storage.remove(TEST_KEY, function removed() {
          // get again and make sure this time it's removed
          Evme.Storage.get(TEST_KEY, function got(valueFromCache) {
            assert.equal(valueFromCache, null);

            done();
          });
        });
      });
    });
  });

  test('verify prefix addition', function(done) {
    var TEST_KEY = 'mock_key_3',
        TEST_VALUE = 'mock_value_3';

    Evme.Storage.set(TEST_KEY, TEST_VALUE, function added() {
      asyncStorage.getItem('evme-' + TEST_KEY, function got(valueFromCache) {
        assert.equal(valueFromCache && valueFromCache.value, TEST_VALUE);

        done();
      });
    });
  });

  test('expiration', function(done) {
    var TEST_KEY = 'mock_key_4',
        TEST_VALUE = 'mock_value_4',
        // padding 0.05 since the object expects the value in seconds
        TEST_EXPIRATION = 0.05;

    Evme.Storage.set(TEST_KEY, TEST_VALUE, TEST_EXPIRATION, function added() {
      // first make sure the value is ok, even though we passed expiration
      Evme.Storage.get(TEST_KEY, function got(valueFromCache) {
        assert.equal(valueFromCache, TEST_VALUE);

        done();
      });

      // then we wait for timeout to expire and make sure it's gone
      window.setTimeout(function() {
        Evme.Storage.get(TEST_KEY, function got(valueFromCache) {
          assert.equal(valueFromCache, null);

          // we made sure Evme.Storage returns "null", but let's also
          // make sure the item was removed from the device storage
          asyncStorage.getItem('evme-' + TEST_KEY, function got(value) {
            assert.equal(value, null);

            done();
          });
        });
      }, (TEST_EXPIRATION + 0.05) * 1000);
    });
  });
});

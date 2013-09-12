'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireApp('homescreen/test/unit/mock_evme.js');

requireApp('homescreen/everything.me/js/external/uuid.js');

suite('Evme.uuid >', function() {
  var elMockBanner;

  suiteSetup(function() {
    Evme.suiteSetup();
  });

  suiteTeardown(function() {
    Evme.suiteTeardown();
  });

  test('main', function() {
    assert.ok(Evme.uuid);
    assert.ok(Evme.uuid());
    assert.equal(Evme.uuid().length, 36);
    assert.notEqual(Evme.uuid(), Evme.uuid());
  });
});

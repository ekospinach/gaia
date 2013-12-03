'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireApp('homescreen/test/unit/mock_evme.js');
requireApp('homescreen/test/unit/mock_evme_storage.js');

requireApp('homescreen/everything.me/modules/SearchHistory/SearchHistory.js');

suite('Evme.SearchHistory >', function() {
  var MAX_ENTRIES = 3,
      PREINIT_QUERY = 'preinit query';

  suiteSetup(function() {
    Evme.suiteSetup();

    // add directly to the storage, to verify the class reads it on init
    Evme.Storage.set('userHistory', JSON.stringify([{ query: PREINIT_QUERY}]));

    Evme.SearchHistory.init({
      maxEntries: MAX_ENTRIES
    });
  });

  suiteTeardown(function() {
    Evme.suiteTeardown();
  });

  test('init', function() {
    assert.isTrue(Evme.EventHandler.fired('SearchHistory', 'init'));
    assert.isTrue(Evme.EventHandler.fired('SearchHistory', 'populate'));

    // make sure that the class reads from the storage upon init
    var queries = Evme.SearchHistory.get();
    assert.equal(queries.length, 1);
    assert.equal(queries[0].query, PREINIT_QUERY);
  });

  test('save query', function() {
    Evme.SearchHistory.clear();

    var query = 'mockup_query';

    Evme.SearchHistory.save(query);

    var queries = Evme.SearchHistory.get();
    assert.equal(queries.length, 1);
    assert.equal(queries[0].query, query);
  });

  test('clear history', function() {
    var query = 'mockup_query';
    Evme.SearchHistory.save(query);

    Evme.SearchHistory.clear();

    var queries = Evme.SearchHistory.get();
    assert.equal(queries.length, 0);
  });

  test('max items', function() {
    Evme.SearchHistory.clear();

    // save more than the max allowed, to make sure it deletes the overflow
    for (var i = 0; i < MAX_ENTRIES + 1; i++) {
      Evme.SearchHistory.save('mock_query_' + i);
    }

    // test that the items number is what we defined
    // and test that the first is actually the SECOND one (query_1 and not _0)
    var queries = Evme.SearchHistory.get();
    assert.equal(queries.length, MAX_ENTRIES);
    assert.equal(queries[queries.length - 1].query, 'mock_query_1');
  });
});

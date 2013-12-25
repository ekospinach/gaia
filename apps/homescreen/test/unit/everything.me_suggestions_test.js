'use strict';

requireApp('homescreen/everything.me/js/search/suggestion.js');

suite('Evme.Suggestions >', function() {
  suiteSetup(function() {
    window.Evme = {};
  });

  suiteTeardown(function() {
    window.Evme = null;
  });

  test('deannotateTest', function() {
    var testcases = [
      ['[a]', 'a'],
      ['[ab]', 'ab'],
      ['[a] [b]', 'a b'],
      ['a[b]c d[e]', 'abc de']
    ];

    testcases.forEach(function run(testcase) {
      var suggestion = new Evme.SearchSuggestion({
        'query': '',
        'annotated': testcase[0]
      });

      assert.isTrue(suggestion.text === testcase[1]);
    });
  });
});

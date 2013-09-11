'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireApp('homescreen/test/unit/mock_evme.js');

requireApp('homescreen/everything.me/modules/Helper/Helper.js');

suite('Evme.Helper >', function() {
  var elMockHelper,
      elMockHelperList,
      elMockTitle;

  suiteSetup(function() {
    Evme.suiteSetup();

    elMockHelper = document.getElementById('helper');
    elMockHelperList = elMockHelper.querySelector('ul');
    elMockTitle = document.getElementById('search-title');

    Evme.Helper.init({
      el: elMockHelper,
      elTitle: elMockTitle,
      elTip: document.getElementById('helper-tip')
    });
  });

  suiteTeardown(function() {
    Evme.suiteTeardown();
  });

  test('init', function() {
    assert.isTrue(Evme.EventHandler.fired('Helper', 'init'));

    // make sure we set the right elements
    assert.equal(Evme.Helper.getElement(), elMockHelper);
    assert.equal(Evme.Helper.getList(), elMockHelperList);

    // also make sure the Scroller was inited
    assert.isTrue(Evme.EventHandler.fired('Scroll', 'init'));
  });

  test('empty', function() {
    Evme.Helper.empty();

    // also make sure the Scroller was inited
    assert.isFalse(elMockHelperList.classList.contains('default'));

    var children = elMockHelperList.children;
    assert.equal(children.length, 1);
    assert.equal(children[0].innerHTML, '');
  });

  test('clear', function() {
    Evme.Helper.clear();
    assert.isTrue(Evme.EventHandler.fired('Helper', 'clear'));
  });

  test('enable animation', function() {
    Evme.Helper.enableCloseAnimation();
    assert.isTrue(elMockHelper.parentNode.classList.contains('animate'));
  });

  test('disable animation', function() {
    Evme.Helper.disableCloseAnimation();
    assert.isFalse(elMockHelper.parentNode.classList.contains('animate'));
  });

  test('load', function() {
    var MOCK_QUERY = 'test',
        MOCK_PARSED_QUERY = 'Test',
        MOCK_SUGGESTIONS = [],
        MOCK_SPELLING = [],
        MOCK_TYPES = [],

        dataToTest = {
          suggestions: MOCK_SUGGESTIONS,
          spelling: MOCK_SPELLING,
          types: MOCK_TYPES,
          query: MOCK_QUERY
        };

    Evme.Helper.load(MOCK_QUERY, MOCK_PARSED_QUERY,
                     MOCK_SUGGESTIONS, MOCK_SPELLING, MOCK_TYPES);

    assert.isTrue(Evme.EventHandler.fired('Helper', 'load', dataToTest));
  });

  test('set title (no type)', function() {
    var MOCK_TITLE = 'test-title';

    Evme.Helper.setTitle(MOCK_TITLE);

    assert.equal(elMockTitle.textContent.indexOf(MOCK_TITLE), 0);
    assert.isTrue(elMockTitle.classList.contains('notype'));
  });

  test('set title (with type)', function() {
    var MOCK_TITLE = 'test-title',
        MOCK_TYPE = 'type';

    Evme.Helper.setTitle(MOCK_TITLE, MOCK_TYPE);

    assert.equal(elMockTitle.textContent, MOCK_TITLE + '(' + MOCK_TYPE + ')');
    assert.isFalse(elMockTitle.classList.contains('notype'));
  });

  test('title - show', function() {
    Evme.Helper.hideTitle();

    Evme.Helper.showTitle();

    assert.isFalse(elMockTitle.classList.contains('close'));
  });

  test('title - hide', function() {
    Evme.Helper.showTitle();

    Evme.Helper.hideTitle();

    assert.isTrue(elMockTitle.classList.contains('close'));
  });


  test('show - suggestions', function() {
    Evme.Helper.showSuggestions();

    assert.isTrue(Evme.EventHandler.fired('Helper', 'showSuggestions'));
  });

  test('show - history', function() {
    Evme.Helper.showHistory();

    assert.isTrue(Evme.EventHandler.fired('Helper', 'showHistory'));
    assert.isTrue(elMockHelperList.classList.contains('history'));
  });

  test('show - spelling', function() {
    Evme.Helper.showSpelling();

    assert.isTrue(Evme.EventHandler.fired('Helper', 'showSpelling'));
    assert.isTrue(elMockHelperList.classList.contains('didyoumean'));
  });

  test('show - refine', function() {
    Evme.Helper.showRefinement();

    assert.isTrue(Evme.EventHandler.fired('Helper', 'showRefinement'));
    assert.isTrue(elMockHelperList.classList.contains('refine'));
  });

  test('load - suggestions', function() {
    var MOCK_VALUE = 'mock-suggestion';

    Evme.Helper.loadSuggestions([MOCK_VALUE]);
    Evme.Helper.showSuggestions();
    
    var children = elMockHelperList.children;
    assert.equal(children.length, 1);
    assert.equal(children[0].textContent, MOCK_VALUE);
  });

  test('load - history', function() {
    var MOCK_VALUE = 'mock-history';

    Evme.Helper.loadHistory([MOCK_VALUE]);
    Evme.Helper.showHistory();
    
    var children = elMockHelperList.children;
    assert.equal(children.length, 1);
    assert.equal(children[0].textContent, MOCK_VALUE);
  });
  
  test('load - refine', function() {
    var MOCK_VALUE = 'mock-type';

    Evme.Helper.loadRefinement([MOCK_VALUE]);
    Evme.Helper.showRefinement();
    
    var children = elMockHelperList.children;
    assert.equal(children.length, 1);
    assert.equal(children[0].textContent, MOCK_VALUE);
  });
  
  test('clicking an item', function() {
    var MOCK_VALUE = 'mock-item',
        dataToTest = {
          value: MOCK_VALUE,
          index: '0'
        };

    Evme.Helper.loadSuggestions([MOCK_VALUE]);
    Evme.Helper.showSuggestions();

    Evme.Helper.selectItem(0);

    assert.isTrue(Evme.EventHandler.fired('Helper', 'click', dataToTest));
  });
});

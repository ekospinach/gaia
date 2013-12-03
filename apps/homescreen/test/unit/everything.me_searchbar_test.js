'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireElements('homescreen/elements/search_page.html');
requireApp('homescreen/test/unit/mock_evme.js');

requireApp('homescreen/everything.me/modules/Searchbar/Searchbar.js');

suite('Evme.Searchbar >', function() {
  suiteTemplate('search-page', {
    id: 'search-page'
  });

  var elSearchbar;

  suiteSetup(function() {
    Evme.suiteSetup();
  });

  suiteTeardown(function() {
    Evme.suiteTeardown();
  });

  test('init', function() {
    elSearchbar = Evme.$('#search-q');

    Evme.Searchbar.init({
      el: elSearchbar,
      elForm: document.getElementById('search-rapper')
    });

    assert.isTrue(Evme.EventHandler.fired('Searchbar', 'init'));
    assert.equal(Evme.Searchbar.getElement(), elSearchbar);
  });

  test('contextmenu disabled', function(done) {
    var didEventPropagate = false;

    document.body.addEventListener('contextmenu', function oncontext() {
      didEventPropagate = true;
    });

    var e = new CustomEvent('contextmenu', {
      bubbles: true
    });
    elSearchbar.dispatchEvent(e);

    // setting timeout since we need to check if the event propagated or not
    // if it DIDN'T propagate, like it should, it won't go into the listener
    // and we won't call the "done" method
    window.setTimeout(function() {
      assert.isFalse(didEventPropagate);
      done();
    }, 100);
  });

  test('value change', function() {
    var val = 'e';

    // send "keyToSend" to the searchbar and trigger the keyup event
    elSearchbar.value = val;
    elSearchbar.dispatchEvent(new CustomEvent('input'));

    assert.isTrue(
      Evme.EventHandler.fired('Searchbar', 'valueChanged', {value: val}));
  });

  test('get value', function() {
    var val = 'mock_value';

    Evme.Searchbar.setValue(val);
    assert.equal(Evme.Searchbar.getValue(), val);
    assert.equal(elSearchbar.value, val);
  });

  test('clear button - show', function(done) {
    window.addEventListener('Searchbar.valueChanged', function value() {
      window.removeEventListener('Searchbar.valueChanged', value);

      var elHeader = document.getElementById('search-header');
      assert.isTrue(elHeader.classList.contains('clear-visible'));

      done();
    });

    elSearchbar.value = 'test-value';
    elSearchbar.dispatchEvent(new CustomEvent('input'));
  });

  test('clear button - hide', function() {
    window.addEventListener('Searchbar.valueChanged', function value() {
      window.removeEventListener('Searchbar.valueChanged', value);

      var elHeader = document.getElementById('search-header');
      assert.isFalse(elHeader.classList.contains('clear-visible'));

      done();
    });

    elSearchbar.value = '';
    elSearchbar.dispatchEvent(new CustomEvent('input'));
  });

  test('focus events', function() {
    Evme.Brain = {
      Searchbar: {
        onblur: function onblur() {
        },
        onfocus: function onfocus() {
          eventFired = true;
        }
      }
    };

    var eventFired = false;

    Evme.Searchbar.focus();
    assert.isTrue(eventFired);
    assert.isTrue(Evme.Searchbar.isFocused());

    // reset and run again to make sure it's NOT called twice
    eventFired = false;
    assert.isFalse(eventFired);
  });

  test('blur events', function() {
    Evme.Brain = {
      Searchbar: {
        onblur: function onblur() {
          eventFired = true;
        },
        onfocus: function onfocus() {
        }
      }
    };

    var eventFired = false;

    // make sure we're starting blurred
    Evme.Searchbar.blur();

    // since we start blurred, first event shouldn't fire
    eventFired = false;
    Evme.Searchbar.blur();
    assert.isFalse(eventFired);

    // reset and focus, to make sure the event IS called this time
    eventFired = false;
    Evme.Searchbar.focus();
    Evme.Searchbar.blur();
    assert.isTrue(eventFired);
  });

  test('clear', function() {
    window.addEventListener('Searchbar.valueChanged', function value() {
      window.removeEventListener('Searchbar.valueChanged', value);

      assert.isTrue(Evme.Searchbar.clearIfHasQuery());
      assert.equal(elSearchbar.value, '');
    });

    elSearchbar.value = 'mock_value';
    elSearchbar.dispatchEvent(new CustomEvent('input'));
  });
});

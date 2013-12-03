'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireElements('homescreen/elements/search_page.html');
requireApp('homescreen/test/unit/mock_evme.js');

requireApp('homescreen/everything.me/modules/BackgroundImage/BackgroundImage.js');

suite('Evme.BackgroundImage >', function() {
  suiteTemplate('search-page', {
    id: 'search-page'
  });

  var elMockImage,
      elMockParent,
      elMockElementsToFade;

  suiteSetup(function() {
    Evme.suiteSetup();
  });

  suiteTeardown(function() {
    Evme.suiteTeardown();
  });

  test('init', function() {
    elMockParent = document.getElementById('evmeOverlay');
    elMockImage = document.getElementById('search-overlay');
    elMockElementsToFade =
      document.querySelectorAll('*[data-opacity-on-swipe = true]');

    Evme.BackgroundImage.init({
      el: elMockImage,
      elFullScreenParent: elMockParent
    });

    assert.isTrue(Evme.EventHandler.fired('BackgroundImage', 'init'));
    assert.isTrue(elMockElementsToFade.length > 0);
  });

  test('set image (url)', function(done) {
    var src = 'MOCK_SRC_TO_TEST',
        outputExpected = {
          image: {
            image: src,
            source: '',
            query: ''
          }
        };

    window.addEventListener('BackgroundImage.show', function show() {
      window.removeEventListener('BackgroundImage.show', show);

      var elActualImage = elMockImage.querySelector('.img.visible');

      // the image has been created
      assert.isTrue(!!elActualImage);

      // the is not defiend as default anymore
      assert.isFalse(elMockImage.classList.contains('default'));

      // the image is set according to the URL passed
      assert.equal(elActualImage.style.backgroundImage, 'url("' + src + '")');

      done();
    });

    Evme.BackgroundImage.update(src);

    assert.isTrue(
      Evme.EventHandler.fired('BackgroundImage', 'updated', outputExpected));
  });

  test('set image (object)', function(done) {
    var src = {
          image: 'MOCK_SRC_TO_TEST_2',
          source: 'MOCK_SOURCE',
          query: 'MOCK_QUERY'
        },
        outputExpected = {
          'image': src
        };

    Evme.BackgroundImage.update(src);

    assert.isTrue(
      Evme.EventHandler.fired('BackgroundImage', 'updated', outputExpected));

    window.addEventListener('BackgroundImage.show', function show() {
      window.removeEventListener('BackgroundImage.show', show);

      var elActualImage = elMockImage.querySelector('.img.visible');

      // the image has been created
      assert.isTrue(!!elActualImage);

      // the is not defiend as default anymore
      assert.isFalse(elMockImage.classList.contains('default'));

      // the image is set according to the URL passed
      assert.equal(
        elActualImage.style.backgroundImage, 'url("' + src.image + '")');

      done();
    });
  });

  test('set default image', function() {
    Evme.BackgroundImage.loadDefault();

    // isFalse because setting the default image should NOT trigger an event
    assert.isFalse(Evme.EventHandler.fired('BackgroundImage', 'updated'));
    assert.isTrue(elMockImage.classList.contains('default'));
  });

  test('manual fade to full screen', function() {
    Evme.BackgroundImage.fadeFullScreen(0.5);

    for (var i = 0, el; el = elMockElementsToFade[i++];) {
      assert.equal(el.style.opacity, 0.5);
    }
  });

  test('full fade to full screen', function() {
    Evme.BackgroundImage.update('');
    Evme.BackgroundImage.showFullScreen();

    var elFullScreen = elMockParent.querySelector('#bgimage-overlay');
    // first verify the fullscreen element was added
    assert.ok(elFullScreen);
    assert.isTrue(Evme.EventHandler.fired('BackgroundImage', 'showFullScreen'));

    // since we pass a URL, there should be no Source to the image
    assert.isTrue(elFullScreen.classList.contains('nosource'));

    window.addEventListener('BackgroundImage.elementsHidden', function hide() {
      window.removeEventListener('BackgroundImage.elementsHidden', hide);

      // make sure all the other elements were faded out
      for (var i = 0, el; el = elMockElementsToFade[i++];) {
        assert.equal(el.style.opacity, 0);
      }

      done();
    });
  });

  test('hide full screen', function(done) {
    // show the fullscreen so we can check its removal
    Evme.BackgroundImage.showFullScreen();

    // closeFullScreen should return TRUE since we ran "showFullScreen" before
    assert.isTrue(Evme.BackgroundImage.closeFullScreen());

    assert.isTrue(Evme.EventHandler.fired('BackgroundImage', 'hideFullScreen'));

    window.addEventListener('BackgroundImage.fullScreenRemoved',
      function hide() {
        window.removeEventListener('BackgroundImage.fullScreenRemoved', hide);

        assert.isNull(document.getElementById('bgimage-overlay'));

        done();
      }
    );
  });
});

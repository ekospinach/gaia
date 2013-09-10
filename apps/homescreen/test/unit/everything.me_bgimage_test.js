'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireApp('homescreen/test/unit/mock_evme.js');

requireApp('homescreen/everything.me/modules/BackgroundImage/BackgroundImage.js');

suite('Evme.BackgroundImage >', function() {
  var elMockImage,
      elMockElementsToFade;

  suiteSetup(function() {
    Evme.suiteSetup();

    elMockImage = document.getElementById('search-overlay');
    elMockElementsToFade =
      document.querySelectorAll('*[data-opacity-on-swipe = true]');

    Evme.BackgroundImage.init({
      el: elMockImage
    });
  });

  suiteTeardown(function() {
    Evme.tearDown();
  });

  test('init', function() {
    assert.isTrue(Evme.EventHandler.fired('BackgroundImage', 'init'));
    assert.isTrue(elMockElementsToFade.length !== 0);
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

    Evme.BackgroundImage.update(src);

    assert.isTrue(
      Evme.EventHandler.fired('BackgroundImage', 'updated', outputExpected));
    assert.isFalse(elMockImage.classList.contains('default'));

    window.setTimeout(function() {
      var elActualImage = elMockImage.querySelector('.img.visible');

      // the image has been created
      assert.isTrue(!!elActualImage);

      // the image is set according to the URL passed
      assert.equal(elActualImage.style.backgroundImage, 'url("' + src + '")');

      done();
    }, 50);
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
    assert.isFalse(elMockImage.classList.contains('default'));

    window.setTimeout(function() {
      var elActualImage = elMockImage.querySelector('.img.visible');

      // the image has been created
      assert.isTrue(!!elActualImage);

      // the image is set according to the URL passed
      assert.equal(
        elActualImage.style.backgroundImage, 'url("' + src.image + '")');

      done();
    }, 50);
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

  test('full fade to full screen', function(done) {
    Evme.BackgroundImage.update('');
    Evme.BackgroundImage.showFullScreen();

    var elFullScreen = document.getElementById('bgimage-overlay');
    // first verify the fullscreen element was added
    assert.ok(elFullScreen);
    assert.isTrue(Evme.EventHandler.fired('BackgroundImage', 'showFullScreen'));

    // since we pass a URL, there should be no Source to the image
    assert.isTrue(elFullScreen.classList.contains('nosource'));

    window.setTimeout(function() {
      // make sure all the other elements were faded out
      for (var i = 0, el; el = elMockElementsToFade[i++];) {
        assert.equal(el.style.opacity, 0);
      }

      done();
    }, 100);
  });

  test('hide full screen', function(done) {
    // closeFullScreen should return TRUE since we ran "showFullScreen" before
    assert.isTrue(Evme.BackgroundImage.closeFullScreen());

    assert.isTrue(Evme.EventHandler.fired('BackgroundImage', 'hideFullScreen'));

    window.setTimeout(function() {
      assert.isNull(document.getElementById('bgimage-overlay'));

      done();
    }, 1000);
  });
});

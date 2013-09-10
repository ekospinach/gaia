'use strict';

requireApp('homescreen/test/unit/mock_everything.me.html.js');
requireApp('homescreen/test/unit/mock_evme.js');

requireApp('homescreen/everything.me/modules/Banner/Banner.js');

suite('Evme.Banner >', function() {
  var elMockBanner;

  suiteSetup(function() {
    var wrapperNode = document.createElement('section');
    wrapperNode.innerHTML = MockEverythingMeHtml;
    document.body.appendChild(wrapperNode);

    elMockBanner = document.getElementById('homescreenStatus');

    Evme.Banner.init({
      el: elMockBanner
    });
  });

  suiteTeardown(function() {
    Evme.tearDown();
  });

  test('Banner init', function() {
    assert.isTrue(Evme.EventHandler.fired('Banner', 'init'));
  });

  test('Banner show', function() {
    Evme.Banner.show('dummy-l10n-key');

    // event was fired
    assert.isTrue(Evme.EventHandler.fired('Banner', 'show'));
    // the element is indeed visible
    assert.isTrue(elMockBanner.classList.contains('visible'));
    // the content was set according to the l10n key passed
    assert.equal(elMockBanner.textContent, 'Banner.dummy-l10n-key');
  });

  test('Banner hide', function(done) {
    // banner is supposed to hide itself automatically after 5s - let's verify
    this.timeout(5500);
    window.setTimeout(function onBannerHide() {
        // event was fired
        assert.isTrue(Evme.EventHandler.fired('Banner', 'hide'));
        // banner is not visible
        assert.isFalse(elMockBanner.classList.contains('visible'));
        done();
    }, 5000);
  });
});

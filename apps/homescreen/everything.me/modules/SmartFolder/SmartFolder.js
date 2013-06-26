Evme.SmartFolder = function Evme_SmartFolder(_options) {
  var self = this,
    NAME = "SmartFolder",
    experienceId = '',
    query = '',
    image = '',
    bgImage = null,
    el = null,
    elScreen = null,
    elTitle = null,
    elClose = null,
    elAppsContainer = null,
    elApps = null,
    elImage = null,
    elImageFullscreen = null,
    resultsManager = null,

    SCROLL_BOTTOM_THRESHOLD = 5,
    CLASS_WHEN_LOADING = 'show-loading-apps',
    CLASS_WHEN_VISIBLE = 'visible',
    CLASS_WHEN_IMAGE_FULLSCREEN = 'full-image',
    CLASS_WHEN_ANIMATING = 'animate',
    SCROLL_TO_SHOW_IMAGE = 80,
    TRANSITION_DURATION = 400,
    LOAD_MORE_SCROLL_THRESHOLD = -30,
    MAX_SCROLL_FADE = 200,
    FULLSCREEN_THRESHOLD = 0.8;

  this.init = function init(options) {
    !options && (options = {});

    resultsManager = options.resultsManager;

    elScreen = Evme.$(".smart-folder-screen")[0];

    el = Evme.$(".smart-folder")[0];

    elAppsContainer = resultsManager.getElement();
    elApps = Evme.$('div', elAppsContainer)[0];

    elTitle = Evme.$(".title", el)[0];
    elImage = Evme.$(".image", el)[0];
    elClose = Evme.$('.close', el)[0];

    elClose.addEventListener("click", self.close);
    elAppsContainer.dataset.scrollOffset = 0;

    // TODO use options.setStaticApps
    resultsManager.renderStaticApps([{
        name: 'static1',
        icon: null
      }, {
        name: 'static2',
        icon: null
      }
    ]);
    

    // query
    options.query && self.setQuery(options.query);
    resultsManager.onNewQuery({
      "query": options.name
    });
    options.experienceId && self.setExperience(options.experienceId);

    Evme.EventHandler.trigger(NAME, "init");

    return self;
  };

  this.show = function show() {
    window.setTimeout(function onTimeout() {
      el.classList.add(CLASS_WHEN_VISIBLE);
      elScreen.classList.add(CLASS_WHEN_VISIBLE);
    }, 0);

    Evme.EventHandler.trigger(NAME, "show", {
      "folder": self
    });

    return self;
  };

  this.hide = function hide() {
    el.classList.remove(CLASS_WHEN_VISIBLE);
    elScreen.classList.remove(CLASS_WHEN_VISIBLE);

    resultsManager.clear();
    self.clearImage();

    Evme.EventHandler.trigger(NAME, "hide", {
      "folder": self
    });

    return self;
  };

  this.close = function close(e) {
    // hack for preventing the browser from saving the scroll position
    // and restoring it when a new SmartFolder opens
    resultsManager.scrollToTop();

    e && e.preventDefault();
    e && e.stopPropagation();

    self.hide();

    Evme.EventHandler.trigger(NAME, "close", {
      "folder": self
    });

    return self;
  };

  this.appendTo = function appendTo(elParent) {
    elParent.appendChild(el);
    elParent.appendChild(elScreen);

    return self;
  };

  this.setExperience = function setExperience(newExperienceId) {
    if (!newExperienceId || newExperienceId === experienceId) {
      return self;
    }

    experienceId = newExperienceId;

    Evme.Utils.log('Folder :: experienceId: ' + experienceId);

    var l10nkey = 'id-' + Evme.Utils.shortcutIdToKey(experienceId),
      queryById = Evme.Utils.l10n('shortcut', l10nkey);

    Evme.Utils.log('Folder :: queryById: ' + queryById);
    elTitle.innerHTML = '<em></em>' +
      '<b ' + Evme.Utils.l10nAttr(NAME, 'title-prefix') + '></b> ' +
      '<span ' + Evme.Utils.l10nAttr('shortcut', l10nkey) + '></span>';

    if (queryById) {
      self.setQuery(queryById);
    } else if (query) {
      Evme.$('span', elTitle)[0].textContent = query;
    }

    return self;
  };

  this.setQuery = function setQuery(newQuery) {
    if (!newQuery || newQuery === query) {
      return self;
    }

    query = newQuery;

    elTitle.innerHTML = '<em></em>' +
      '<b ' + Evme.Utils.l10nAttr(NAME, 'title-prefix') + '></b> ' +
      '<span>' + query + '</span>';

    return self;
  };

  this.setImage = function setImage(newImage) {
    if (!newImage || newImage === image) {
      return self;
    }

    image = newImage;

    elImage.style.backgroundImage = 'url(' + image.image + ')';

    elImageFullscreen = Evme.BackgroundImage.getFullscreenElement(image, self.hideFullscreen);
    el.appendChild(elImageFullscreen);

    resultsManager.changeFadeOnScroll(true);

    return self;
  };

  this.setBgImage = function setBgImage(newBgImage) {
    if (!newBgImage || newBgImage === bgImage) {
      return self;
    }

    bgImage = newBgImage;

    el.style.backgroundImage = 'url(' + bgImage + ')';

    return self;
  };

  this.clearImage = function clearImage() {
    image = null;
    el.style.backgroundImage = 'none';

    bgImage = null
    elImage.style.backgroundImage = 'none';

    Evme.$remove(elImageFullscreen);

    resultsManager.changeFadeOnScroll(false);
  };

  this.showFullscreen = function showFullScreen(e) {
    e && e.preventDefault();
    e && e.stopPropagation();

    el.classList.add(CLASS_WHEN_ANIMATING);
    window.setTimeout(function onTimeout() {
      self.fadeImage(0);
      el.classList.add(CLASS_WHEN_IMAGE_FULLSCREEN);

    }, 10);
  };

  this.hideFullscreen = function hideFullscreen(e) {
    e && e.preventDefault();
    e && e.stopPropagation();

    el.classList.add(CLASS_WHEN_ANIMATING);
    window.setTimeout(function onTimeout() {
      self.fadeImage(1);
      el.classList.remove(CLASS_WHEN_IMAGE_FULLSCREEN);

      window.setTimeout(function onTimeout() {
        el.classList.remove(CLASS_WHEN_ANIMATING);
      }, TRANSITION_DURATION);
    }, 10);
  };

  this.fadeImage = function fadeImage(howMuch) {
    elAppsContainer.style.opacity = howMuch;
  };

  this.getElement = function getElement() {
    return el;
  };
  this.getExperience = function getExperience() {
    return experienceId;
  };
  this.getQuery = function getQuery() {
    return query;
  };
  this.getImage = function getImage() {
    return image;
  };

  self.init(_options);
};
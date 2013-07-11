Evme.PROVIDER_TYPES = {
  STATIC: 'static',
  INSTALLED: 'installed',
  MARKETAPPS: 'marketapps',
  MARKETSEARCH: 'marketsearch',
  CLOUD: 'cloud',
};

Evme.ResultManager = function Evme_ResultsManager() {

  var NAME = "NOT_SET", // SearchResults or SmartfolderResults
    self = this,
    progressIndicator,
    DEFAULT_NUMBER_OF_APPS_TO_LOAD = Evme.Config.numberOfAppsToLoad,
    SELECTOR_PROGRESS_INDICATOR = '[role="notification"].loading-more',
    TIMEOUT_BEFORE_SHOWING_PROGRESS_INDICATOR = 10,
    providers = {},

    el = null,
    elHeight = null,
    scrollableEl = null,
    appsArray = {}, appsDataArray = [],
    numberOfApps = 0,
    scroll = null,
    reportedScrollMove = false,
    shouldFadeBG = false,
    isSwiping = false,

    fadeBy = 0,
    showingFullScreen = false,
    apiHasMoreCloudApps = false,
    
    // for convenience
    STATIC = Evme.PROVIDER_TYPES.STATIC,
    INSTALLED = Evme.PROVIDER_TYPES.INSTALLED,
    MARKETAPPS = Evme.PROVIDER_TYPES.MARKETAPPS,
    MARKETSEARCH = Evme.PROVIDER_TYPES.MARKETSEARCH,
    CLOUD = Evme.PROVIDER_TYPES.CLOUD,

    SELECTOR_CLOUD_RESULTS = 'ul.cloud>li',
    SELECTOR_ALL_RESULTS = 'div>ul>li',

    SCROLL_BOTTOM_THRESHOLD = 5,
    MAX_SCROLL_FADE = 200,
    FULLSCREEN_THRESHOLD = 0.8,
    MAX_APPS_CLASSES = 150,
    APPS_PER_ROW = "FROM CONFIG",
    ICONS_STYLE_ID = "apps-icons",
    DEFAULT_ICON_URL = "FROM CONFIG",
    TIMEOUT_BEFORE_REPORTING_APP_HOLD = 800,
    SLUG_PREFIX = 'store://',
    CLASS_HAS_MORE_APPS = "has-more",
    ftr = {
      'fadeOnScroll': false
    };

  MAX_SCROLL_FADE *= Evme.Utils.devicePixelRatio;


  this.init = function init(options) {
    !options && (options = {});

    for (var k in options.features) {
      ftr[k] = options.features[k]
    }

    NAME = options.NAME;
    APPS_PER_ROW = options.appsPerRow;

    el = options.el;
    scrollableEl = Evme.$('div', el)[0];

    options.providers.forEach(function registerProviders(provider){
      registerProvider(provider.type, provider.config);
    });

    progressIndicator = new Evme.ResultsProgressIndicator();
    progressIndicator.init({
      "el": Evme.$(SELECTOR_PROGRESS_INDICATOR, el)[0],
      "waitTime": TIMEOUT_BEFORE_SHOWING_PROGRESS_INDICATOR
    });

    scrollableEl.addEventListener("touchend", function onTouchEnd() {
      self.timeoutHold && window.clearTimeout(self.timeoutHold);
    });

    scroll = new Scroll(el, {
      "onTouchStart": touchStart,
      "onTouchMove": touchMove,
      "onTouchEnd": touchEnd,
      "onScrollEnd": scrollEnd
    });

    Evme.EventHandler.trigger(NAME, "init");
  };

  this.clear = function clear() {
    self.scrollToTop();

    forEachProvider(function() {
      this.clear();
    });

    numberOfApps = 0;

    progressIndicator.hide();
    el.classList.remove(CLASS_HAS_MORE_APPS);

    return true;
  };

  this.renderStaticApps = function renderStaticApps(apps) {
    STATIC in providers && providers[STATIC].render(apps);
  };

  this.onNewQuery = function onNewQuery(data) {
    data.staticApps && self.renderStaticApps(data.staticApps);
    INSTALLED in providers && providers[INSTALLED].render(data);
  };

  this.APIData = {
    onRequestSent: function APIData_onRequest() {
      Evme.Utils.isOnline(function isOnlineCallback(isOnline) {
        isOnline && progressIndicator.wait();
      });
    },

    onRequestCanceled: function APIData_onRequestCancel() {
      progressIndicator.hide();
    },

    onResponseRecieved: function APIData_onResponse(response) {
      progressIndicator.hide();

      handleAPIHasMoreCloudApps(response.paging);

      var cloudApps = [],
        marketApps = [],
        installedSlugs = Evme.InstalledAppsService.getSlugs(),
        pageNum = response.paging.first;

      // separate cloud from marketplace apps
      response.apps.forEach(function(app) {
        Evme.Utils.log("App '" + app.name + "' [" + app.type + "]");

        if (app.type === Evme.RESULT_TYPE.MARKET) {
          app.slug = getSlug(app);
          // Not if app is already installed
          if (installedSlugs.indexOf(app.slug) === -1) {
            marketApps.push(app);
          }
        } else if (app.type === Evme.RESULT_TYPE.CLOUD || app.type === Evme.RESULT_TYPE.WEBLINK) {
          cloudApps.push(app);
        }
      });

      // first results page
      // render market apps and result for launching market search
      if (!pageNum) {
        self.scrollToTop();
        MARKETAPPS in providers && providers[MARKETAPPS].render(marketApps, pageNum);
        response.nativeAppsHint && MARKETSEARCH in providers && providers[MARKETSEARCH].render();

        // TODO: DEMO MODE - always render web search
        CLOUD in providers && providers[CLOUD].renderWebSearch(response.query);
      }

      CLOUD in providers && providers[CLOUD].render(cloudApps, pageNum, requestMissingIcons, response.query);
    }
  };

  this.getElement = function getElement() {
    return el;
  };

  this.getAppTapAndHoldTime = function getAppTapAndHoldTime() {
    return TIMEOUT_BEFORE_REPORTING_APP_HOLD;
  };

  this.disableScroll = function disableScroll() {
    scroll.disable();
  };
  this.enableScroll = function enableScroll() {
    scroll.enable();
  };

  /* Not called. Do we need it? */
  this.setAppsClasses = function setAppsClasses(iFrom, bAnimate) {
    (!iFrom || !bAnimate) && (iFrom = 0);

    var elApps = elList.childNodes,
      index = 0;

    for (var i = iFrom, elApp = elApps[i]; elApp; elApp = elApps[++i]) {
      if (bAnimate) {
        elApp.style.cssText += "; -moz-transition-duration: " + (200 - ((iFrom - i) * 20)) + 'ms';
      }

      var cls = elApp.className;
      if (elApp.id.indexOf("app_") !== -1) {
        cls = cls.replace(/pos\d+/g, "");
        elApp.className = cls + " pos" + index;
        index++;
      }
    }
  };

  this.getScrollPosition = function getScrollPosition() {
    return scroll.y;
  };

  this.getResultGridData = function getCurrentRowsCols(clickedResult) {
    var data = {},
      numBelow = 0, // num of results above the separator
      numAbove = 0; // num of results above the separator

    // get total rows cols
    forEachProvider(function(providerName) {
      var count = this.getResultCount();
      if (providerName === CLOUD) {
        numBelow += count;
      } else {
        numAbove += count;
      }
    });

    var maxResults = Math.max(numAbove, numBelow),
      cols = Math.min(maxResults, APPS_PER_ROW),
      rowsAbove = Math.ceil(numAbove / APPS_PER_ROW),
      rowsBelow = Math.ceil(numBelow / APPS_PER_ROW);

    // get clicked result index
    var itemSelector = (clickedResult.type === Evme.RESULT_TYPE.CLOUD) ? SELECTOR_CLOUD_RESULTS : SELECTOR_ALL_RESULTS;
    var nodeList = Array.prototype.slice.call(Evme.$(itemSelector, scrollableEl));
    var resultIndex = nodeList.indexOf(clickedResult.getElement());

    // calculate result row col
    var col = (resultIndex % APPS_PER_ROW) + 1;
    var row = Math.floor(resultIndex / APPS_PER_ROW) + 1;
    if (clickedResult.type === Evme.RESULT_TYPE.CLOUD) {
      row += rowsAbove;
    }

    return {
      "cols": cols,
      "rows": rowsAbove + rowsBelow,
      "rowIndex": row,
      "colIndex": col
    }
  };

  this.hasResults = function hasResults() {
    forEachProvider(function() {
      if (this.getResultCount()) {
        return true;
      }
    });
    return false;
  };

  this.changeFadeOnScroll = function changeFadeOnScroll(newValue) {
    ftr.fadeOnScroll = newValue;
  };

  function forEachProvider(callback) {
    for (var k in providers) {
      callback.call(providers[k], k);
    }
  }

  function registerProvider(key, cfg) {
    providers[key] = new cfg.renderer();
    providers[key].init(cfg);
  }

  // extract slug from API result (marketplace app)
  function getSlug(app) {
    if (app.appUrl) {
      var split = app.appUrl.split(SLUG_PREFIX);
      if (split.length) {
        return split[1];
      }
    }
  }

  function getAppIndex(elApp) {
    var elApps = elList.childNodes;
    for (var i = 0, el = elApps[i]; el; el = elApps[++i]) {
      if (el[i] === elApp) {
        return i;
      }
    }

    return 0;
  }

  function requestMissingIcons(ids) {
    Evme.Utils.log("requestMissingIcons: requesting " + ids.length + " icons");
    Evme.EventHandler.trigger("ResultManager", "requestMissingIcons", ids);
  }

  this.cbMissingIcons = function cbMissingIcons(data) {
    providers[CLOUD].updateIcons(data);
  }

  function touchStart(e) {
    if (ftr.fadeOnScroll) {
      shouldFadeBG = scroll.y === 0;
    } else {
      shouldFadeBG = false;
    }
    fadeBy = 0;
    reportedScrollMove = false;
  }

  function touchMove(e) {
    var y = scroll.y;
    if (shouldFadeBG) {
      var _fadeBy = scroll.distY / MAX_SCROLL_FADE;

      if (_fadeBy < fadeBy) {
        _fadeBy = 0;
        shouldFadeBG = false;
      }

      fadeBy = _fadeBy;
      Evme.BackgroundImage.fadeFullScreen(fadeBy);
    } else {
      Evme.BackgroundImage.fadeFullScreen(0);
    }
  }

  function touchEnd(data) {
    if (shouldFadeBG && scroll.distY >= FULLSCREEN_THRESHOLD * MAX_SCROLL_FADE) {
      showingFullScreen = true;
      cbScrolledToTop();
      window.setTimeout(function onTimeout() {
        showingFullScreen = false;
      }, 1000);
    } else {
      !showingFullScreen && Evme.BackgroundImage.cancelFullScreenFade();
    }
  }

  function scrollEnd() {
    if (apiHasMoreCloudApps) {

      // kept separate for performance reasons
      var reachedBottom = scrollableEl.offsetHeight - el.offsetHeight <= scroll.y;
      if (reachedBottom) {
        cbScrolledToEnd();
      }
    }
  }

  function cbLoadComplete(data, missingIcons) {
    Evme.EventHandler.trigger(NAME, "loadComplete", {
      "data": data,
      "icons": missingIcons
    });
  }

  this.scrollToTop = function scrollToTop() {
    scroll.scrollTo(0, 0);
  }

  function cbScrolledToTop() {
    Evme.EventHandler.trigger(NAME, "scrollTop");
  }

  function cbScrolledToEnd() {
    Evme.EventHandler.trigger(NAME, "scrollBottom");
  }

  function handleAPIHasMoreCloudApps(data) {
    // if got less apps then requested, assume no more apps
    if (data.limit < DEFAULT_NUMBER_OF_APPS_TO_LOAD) {
      apiHasMoreCloudApps = false;
    } else {
      apiHasMoreCloudApps = data ? data.limit + data.first < data.max : false;
    }

    if (apiHasMoreCloudApps) {
      el.classList.add(CLASS_HAS_MORE_APPS);
    } else {
      el.classList.remove(CLASS_HAS_MORE_APPS);
    }
  }
}

Evme.ResultsProgressIndicator = function Evme_ResultsProgressIndicator() {
  var self = this,
    el, timer, waitTime;

  this.init = function init(cfg) {
    el = cfg.el;
    waitTime = cfg.waitTime;
  };

  this.wait = function wait() {
    clearTimeout(timer);
    timer = setTimeout(self.show, waitTime);
  };

  this.show = function show() {
    clearTimeout(timer);
    el.classList.add('show');
  };

  this.hide = function hide() {
    clearTimeout(timer);
    el.classList.remove('show');
  };
}
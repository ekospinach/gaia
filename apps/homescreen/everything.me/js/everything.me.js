var EverythingME = {
  init: function EverythingME_init() {
    var footer = document.querySelector('#footer');
    if (footer) {
      footer.style.MozTransition = '-moz-transform .3s ease';
    }
    
    var self = this,
        page = document.getElementById('evmePage'),
        gridPage = document.querySelector('#icongrid > div:first-child');

    // TODO
    // We need to re-think how to lazy-load E.me
    // it is required for interacting with Collections:
    // create initial collections, open collections, create collections etc.
    self.activate();

    gridPage.addEventListener('gridpageshowend', function onPageShow() {
      EvmeFacade.onShow();
    });
    gridPage.addEventListener('gridpagehideend', function onPageHide() {
      EvmeFacade.onHide();
    });

    // add evme into the first grid page
    gridPage.classList.add('evmePage');
    gridPage.appendChild(page.parentNode.removeChild(page));  
  },
  
  activate: function EverythingME_activate(e) {
    document.body.classList.add('evme-loading');

    this.load();
  },

  load: function EverythingME_load() {
    var CB = !('ontouchstart' in window),
        js_files = [
          'js/Core.js',
          'js/etmmanager.js',

          'config/config.js',
          'config/shortcuts.js',
          'js/developer/utils.1.3.js',
          'js/helpers/Utils.js',
          'js/helpers/Storage.js',
          'js/helpers/IconManager.js',
          'js/plugins/Scroll.js',
          'js/plugins/SelectBox.js',
          'js/external/uuid.js',
          'js/external/md5.js',
          'js/api/apiv2.js',
          'js/api/DoATAPI.js',
          'js/helpers/EventHandler.js',
          'js/helpers/Idle.js',
          'js/plugins/Analytics.js',
          'js/plugins/APIStatsEvents.js',
          'js/Brain.js',
          'modules/BackgroundImage/BackgroundImage.js',
          'modules/Banner/Banner.js',
          'modules/ConnectionMessage/ConnectionMessage.js',
          'modules/Features/Features.js',
          'modules/Helper/Helper.js',
          'modules/Location/Location.js',
          'modules/Results/Result.js',
          'modules/Results/providers/CloudApps.js',
          'modules/Results/providers/ContactSearch.js',
          'modules/Results/providers/InstalledApps.js',
          'modules/Results/providers/MarketApps.js',
          'modules/Results/providers/MarketSearch.js',
          'modules/Results/providers/StaticApps.js',
          'modules/Results/ResultManager.js',
          'modules/Searchbar/Searchbar.js',
          'modules/SearchHistory/SearchHistory.js',
          'modules/CollectionsSuggest/CollectionsSuggest.js',
          'modules/Collection/Collection.js',
          'modules/Tasker/Tasker.js'
        ],
        css_files = [
          'css/common.css',
          'modules/BackgroundImage/BackgroundImage.css',
          'modules/Banner/Banner.css',
          'modules/ConnectionMessage/ConnectionMessage.css',
          'modules/Helper/Helper.css',
          'modules/Results/Results.css',
          'modules/Searchbar/Searchbar.css',
          'modules/CollectionsSuggest/CollectionsSuggest.css',
          'modules/Collection/Collection.css'
        ];

    var head = document.head;

    var scriptLoadCount = 0;
    var cssLoadCount = 0;

    function onScriptLoad(event) {
      event.target.removeEventListener('load', onScriptLoad);
      if (++scriptLoadCount == js_files.length) {
        EverythingME.start();
      } else {
        loadScript(js_files[scriptLoadCount]);
      }
    }

    function onCSSLoad(event) {
      event.target.removeEventListener('load', onCSSLoad);
      if (++cssLoadCount === css_files.length) {
        loadScript(js_files[scriptLoadCount]);
      } else {
        loadCSS(css_files[cssLoadCount]);
      }
    }

    function loadCSS(file) {
      var link = document.createElement('link');
      link.type = 'text/css';
      link.rel = 'stylesheet';
      link.href = 'everything.me/' + file + (CB ? '?' + Date.now() : '');
      link.addEventListener('load', onCSSLoad);
      window.setTimeout(function load() {
        head.appendChild(link);
      }, 0);
    }

    function loadScript(file) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'everything.me/' + file + (CB ? '?' + Date.now() : '');
      script.defer = true;
      script.addEventListener('load', onScriptLoad);
      window.setTimeout(function load() {
        head.appendChild(script);
      }, 0);
    }

    loadCSS(css_files[0]);
  },

  start: function EverythingME_start() {
    if (document.readyState === 'complete') {
      EverythingME.initEvme();
    } else {
      window.addEventListener('load', function onload() {
        window.removeEventListener('load', onload);
        EverythingME.initEvme();
      });
    }
  },

  initEvme: function EverythingME_initEvme() {
    Evme.init(EverythingME.onEvmeLoaded);
    EvmeFacade = Evme;
  },

  onEvmeLoaded: function onEvmeLoaded() {
    var page = document.getElementById('evmeContainer');
    EvmeFacade.onShow();
    document.body.classList.remove('evme-loading');
  },

  destroy: function EverythingME_destroy() {
    // Deleting all resources of everything.me from DOM
    var list = document.querySelectorAll('head > [href*="everything.me"]');
    for (var i = 0; i < list.length; i++) {
      var resource = list[i];
      resource.parentNode.removeChild(resource);
    }
  },

  Collection: {
    suggest: function EverythingME_Collection_suggest() {
      EvmeFacade.onCollectionSuggest();
    },
    custom: function EverythingME_Collection_custom() {
      EvmeFacade.onCollectionCustom();
    }
  }
};

var EvmeFacade = {
  onShow: function onShow() {
    return false;
  },
  onHide: function onHide() {
    return false;
  }
};

var EverythingME = {
  pageHideBySwipe: false,

  init: function EverythingME_init() {
    var footerStyle = document.querySelector('#footer').style;
    footerStyle.MozTransition = '-moz-transform .3s ease';
    
    var page = document.getElementById('evmePage');

    // add evme into the first grid page */
    var gridPage = document.querySelector("#icongrid > div:first-child");
    gridPage.classList.add('evmePage');
    gridPage.appendChild(page.parentNode.removeChild(page));
    
    EverythingME.load(function success() {
      EvmeFacade.onShow();
      page.style.display = 'block';
    });

    gridPage.addEventListener('gridpageshowstart', function onPageShowStart(){
      EvmeFacade.onShow();
    });
    gridPage.addEventListener('gridpagehideend', function onPageHideEnd() {
      EvmeFacade.onHide();
    });
  },

  load: function EverythingME_load(success) {

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
          'modules/Results/providers/BrowserResult.js',
          'modules/Results/providers/CloudApps.js',
          'modules/Results/providers/ContactSearch.js',
          'modules/Results/providers/InstalledApps.js',
          'modules/Results/providers/MarketApps.js',
          'modules/Results/providers/MarketSearch.js',
          'modules/Results/providers/StaticApps.js',
          'modules/Results/ResultManager.js',
          'modules/Searchbar/Searchbar.js',
          'modules/SearchHistory/SearchHistory.js',
          'modules/SmartFolderSuggest/SmartFolderSuggest.js',
          'modules/SmartFolder/SmartFolder.js',
          'modules/Tasker/Tasker.js'
      ];
    var css_files = [
        'css/common.css',
        'modules/BackgroundImage/BackgroundImage.css',
        'modules/Banner/Banner.css',
        'modules/ConnectionMessage/ConnectionMessage.css',
        'modules/Helper/Helper.css',
        'modules/Results/Results.css',
        'modules/Searchbar/Searchbar.css',
        'modules/SmartFolderSuggest/SmartFolderSuggest.css',
        'modules/SmartFolder/SmartFolder.css'
    ];

    var head = document.head,
        filesToLoad = js_files.length + css_files.length,
        filesLoaded = 0;

    function onFileLoaded() {
      filesLoaded++;
      if (filesLoaded >= filesToLoad) {
        EverythingME.start(success);
      }
    }

    function loadAllFiles() {
      // substract one since we load the first JS as a blocker to everything else
      filesToLoad -= 1;

      // load the first one, and after it load everything together
      loadScript(js_files[0], function onCoreLoaded() {
        for (var i=1,js; js=js_files[i++];) {
          loadScript(js);
        }
        for (var i=0,css; css=css_files[i++];) {
          loadCSS(css);
        }
      });
    }

    function loadCSS(file, onLoad) {
      var link = document.createElement('link');
      link.type = 'text/css';
      link.rel = 'stylesheet';
      link.href = 'everything.me/' + file + (CB ? '?' + Date.now() : '');
      link.addEventListener('load', onLoad || onFileLoaded);
      window.setTimeout(function load() {
        head.appendChild(link);
      }, 0);
    }

    function loadScript(file, onLoad) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'everything.me/' + file + (CB ? '?' + Date.now() : '');
      script.defer = true;
      script.addEventListener('load', onLoad || onFileLoaded);
      window.setTimeout(function load() {
        head.appendChild(script);
      }, 0);
    }

    loadAllFiles();
  },

  initEvme: function EverythingME_initEvme(success) {
    Evme.init();
    EvmeFacade = Evme;
    success && success();
  },

  start: function EverythingME_start(success) {
    if (document.readyState === 'complete') {
      EverythingME.initEvme(success);
    } else {
      window.addEventListener('load', function onload() {
        window.removeEventListener('load', onload);
        EverythingME.initEvme(success);
      });
    }
  },

  destroy: function EverythingME_destroy() {
    // Deleting all resources of everything.me from DOM
    var list = document.querySelectorAll('head > [href*="everything.me"]');
    for (var i = 0; i < list.length; i++) {
      var resource = list[i];
      resource.parentNode.removeChild(resource);
    }
  },

  SmartFolder: {
    suggest: function EverythingME_SmartFolder_suggest() {
      EvmeFacade.onSmartfolderSuggest();
    },
    custom: function EverythingME_SmartFolder_custom() {
      EvmeFacade.onSmartfolderCustom();
    }
  }
};

var EvmeFacade = {
  onHideStart: function onHideStart() {
    return false;
  }
};

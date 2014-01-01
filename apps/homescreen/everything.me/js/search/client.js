(function() {
  'use strict';

  var APPS_LIMIT = 10;
  var SUGGESTIONS_LIMIT = 5;

  var extend = Evme.Utils.aug;
  var iconFormat = Evme.Utils.getIconsFormat();

  var features = {
    'more': 'more',
    'rtrn': 'rtrn',
    'sugg': 'sugg',
    'fldr': 'fldr'
  };

  function SearchConfig(options) {
    var config = {
      'exact': null,
      'feature': null,
      'first': null,
      'iconFormat': iconFormat,
      'limit': null,
      'maxNativeSuggestions': null,
      'nativeSuggestions': false,
      'prevQuery': null,
      'query': null,
      'spellcheck': null,
      'suggest': null
    };

    return extend(config, options);
  }

  function SuggestConfig(options) {
    var config = {
      'query': null,
      'limit': null
    };

    return extend(config, options);
  }

  function EvmeClient(config) {
    this.prevQuery = '';
    this.appsLimit = config.appsLimit || APPS_LIMIT;
    this.suggestionsLimit = config.suggestionsLimit || SUGGESTIONS_LIMIT;

    // paging index
    this.page = 0;
  }

  EvmeClient.prototype = {

    getApps: function getApps(options) {
      // reset paging
      this.page = 0;

      return this.search(options);
    },

    getAppsForCollection: function getAppsForCollection(options) {
      extend(options, {
        'feature': features.fldr
      });

      return this.search(options);
    },

    getAppsForSuggestion: function getAppsForSuggestion(options) {
      extend(options, {
        'feature': features.sugg
      });

      return this.search(options);
    },

    getMoreApps: function getMoreApps(options) {
      // increment paging
      this.first += this.appsLimit;

      extend(options, {
        'first': this.first,
        'feature': features.more
      });

      return this.search(options);
    },

    getSuggestions: function getSuggestions(options) {
      return this.suggestions(options);
    },


/****************************** DoatAPI wrappers ******************************/
/******************************        ~~        ******************************/

    // Search/apps
    search: function search(options) {

      extend(options, {
        'limit': this.appsLimit,
        'prevQuery': this.prevQuery
      });

      this.prevQuery = options.query;

      var config = new SearchConfig(options);

      var searchPromise = new window.Promise(function done(resolve, reject) {
        Evme.DoATAPI.search(config, function success(apiData) {
          var response = apiData.response;
          var query = response.query;
          var apps = response.apps;
          var pending = apps.length;

          // results ready with icon
          var resultsReady = [];

          // results without icon (not ready)
          var resultsMissing = [];

          apps.forEach(function(app) {
            var result = new Evme.SearchResult({
              'title': app.name,
              'url': app.appUrl,
              'iconData': app.icon,
              'appId': app.id
            });

            if (app.icon) {
              // cache the icon
              Evme.IconManager.add(app.id, app.icon, iconFormat);
            }

            result.getIcon().then(
              function resolve(result) {
                addResult(result);
                if (--pending === 0) {
                  getMissingIcons.bind(this)();
                }
              },
              function reject(result) {
                resultsMissing.push(result);
                if (--pending === 0) {
                  getMissingIcons.bind(this)();
                }
              });
          });

          function addResult(result) {
            resultsReady.push(result);

            if (resultsReady.length === apps.length) {
              resolve(resultsReady);
            }
          }

          function getMissingIcons() {
            var ids = Evme.Utils.pluck(resultsMissing, 'appId');

            if (!ids.length) {
              return;
            }

            this.requestIcons(ids).then(
              function resolve(icons) {
                resultsMissing.forEach(function addIcon(resultMissing) {
                  resultMissing.setIconData(icons[resultMissing.appId]);
                  addResult(resultMissing);
                });
              },
              function reject(reason) {
                resultsMissing.forEach(function each(resultMissing) {
                  resultMissing.setDefaultIcon();
                  addResult(resultMissing);
                });
              });
          }
        });
      });

      return searchPromise;

    },

    // Search/suggestions
    suggestions: function suggestions(options) {
      extend(options, {
        'limit': this.suggestionsLimit
      });

      var query = options.query;
      var config = new SuggestConfig(options);

      var suggestPromise = new window.Promise(function done(resolve, reject) {
        Evme.DoATAPI.suggestions(config, function success(data) {
          var items = data.response || [];
          if (items.length) {
            var suggestions = items.map(function each(item) {
              return new Evme.SearchSuggestion({
                'query': query,
                'annotated': item
              });
            });
            resolve(suggestions);
          } else {
            reject('no suggestions');
          }
        });
      });

      return suggestPromise;
    },

    // App/icons
    requestIcons: function requestIcons(ids) {
      var iconsPromise = new window.Promise(function done(resolve, reject) {
        Evme.DoATAPI.icons({
          'ids': ids.join(','),
          'iconFormat': iconFormat
        }, function onSuccess(data) {
          var icons = data.response || [];
          if (icons.length) {
            resolve(icons);
            Evme.IconManager.addIcons(icons, iconFormat);
          } else {
            reject('missingIcons failed');
          }
        });
      });

      return iconsPromise;
    }


  }; // prototype

  Evme.Client = EvmeClient;

})();

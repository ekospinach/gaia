(function() {
  'use strict';

  // timeout before notifying providers
  var SEARCH_DELAY = 600;
  var timeoutSearchWhileTyping = null;
  var CONTAINERS = {
    'EverythingMe': 'web',
    'Contacts': 'contacts',
    'LocalApps': 'localapps'
  };

  window.Search = {
    _port: null,
    terms: document.getElementById('search-terms'),

    providers: {},

    init: function() {
      // Initialize the parent port connection
      var self = this;
      navigator.mozApps.getSelf().onsuccess = function() {
        var app = this.result;
        app.connect('search-results').then(
          function onConnectionAccepted(ports) {
            ports.forEach(function(port) {
              self._port = port;
            });

            setConnectionHandler();
          },
          function onConnectionRejected(reason) {
            dump('Error connecting: ' + reason + '\n');
          }
        );
      };

      function setConnectionHandler() {
        navigator.mozSetMessageHandler('connection',
          function(connectionRequest) {
            var keyword = connectionRequest.keyword;
            var port = connectionRequest.port;
            if (keyword === 'eme-client') {
              port.onmessage = self.providers.EverythingMe.onmessage
                .bind(self.providers.EverythingMe);
              port.start();
            } else if (keyword === 'search') {
              port.onmessage = self.onSearchInput.bind(self);
              port.start();
            }
          });
        initializeProviders();
      }

      function initializeProviders() {
        var template = 'section#{name}';
        for (var i in self.providers) {
          var selector = template.replace('{name}',
                                            CONTAINERS[self.providers[i].name]);
          console.log(selector);
          self.providers[i].init({
            container: document.querySelector(selector)
          });
        }
      }
    },

    /**
     * Adds a search provider
     */
    provider: function(provider) {
      this.providers[provider.name] = provider;
    },

    onSearchInput: function(msg) {
      clearTimeout(timeoutSearchWhileTyping);

      var input = msg.data.input;
      var type = msg.data.type;
      var providers = this.providers;

      // update title
      this.terms.innerHTML = input;

      timeoutSearchWhileTyping = setTimeout(function doSearch() {
        for (var i in providers) {
          providers[i].search(input, type);
        }
      }, SEARCH_DELAY);
    },

    /**
     * Messages the parent container to close
     */
    close: function() {
      this._port.postMessage({'action': 'hide'});
    }
  };

  window.addEventListener('load', Search.init.bind(Search));

})();

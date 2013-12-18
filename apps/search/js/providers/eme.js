(function() {

  'use strict';

  function EverythingMe() {
    this.name = 'EverythingMe';
  }

  EverythingMe.prototype = {

    init: function(config) {
      var self = this;

      this.container = config.container;
      this.container.addEventListener('click', this.click);

      // Broadcast to eme-api channel
      navigator.mozApps.getSelf().onsuccess = function() {
        var app = this.result;
        app.connect('eme-api').then(
          function onConnectionAccepted(ports) {
            ports.forEach(function(port) {
              self.port = port;
            });
          },
          function onConnectionRejected(reason) {
            dump('Error connecting: ' + reason + '\n');
          }
        );
      };
    },

    click: function(e) {
      var url = e.target && e.target.dataset.url;
      if (url) {
        // This actually doesn't work yet
        // Will be implemented by E.me in the homescreen
        window.open(url);

        Search.close();
      }
    },

    search: function(input, type) {
      this.clear();

      setTimeout(function nextTick() {
        this.port.postMessage({
          input: input,
          type: type
        });
      }.bind(this));
    },

    clear: function() {
      this.container.innerHTML = '';
    },

    onmessage: function(msg) {
      var data = msg.data;

      if (data.result) {
        this.renderResult(data.result, data.icon);
      }
    },

    renderResult: function(data, icon) {
      var el = document.createElement('div');
      el.dataset.url = data.url;

      var img = document.createElement('img');
      img.src = icon;
      el.appendChild(img);

      var title = document.createTextNode(data.title);
      el.appendChild(title);

      this.container.appendChild(el);
    }

  };

  Search.provider(new EverythingMe());

}());

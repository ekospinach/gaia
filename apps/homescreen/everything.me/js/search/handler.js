(function() {
  'use strict';

  function SearchHandler() {
    var searchPort = null;
    var query;

    navigator.mozApps.getSelf().onsuccess = function() {
      var app = this.result;
      app.connect('eme-client').then(
        function onConnectionAccepted(ports) {
          ports.forEach(function(port) {
            searchPort = port;
          });
        },
        function onConnectionRejected(reason) {
          dump('Error connecting: ' + reason + '\n');
        }
      );
    };

    this.onMessage = function onMessage(msg) {
      var newQuery = msg.data.input;
      if (newQuery && newQuery !== query) {
        query = newQuery;
        Evme.SearchClient.search({'query': query });
      }
    };

    this.onSearchResult = function onSearchResult(resultQuery, searchResult) {
      // only if results still relevant
      if (resultQuery === query) {
        sendResult(searchResult);
      }
    };

    function sendResult(searchResult) {
      renderIcon(searchResult, function iconReady(blob) {
        searchPort.postMessage({
          'result': searchResult,
          'icon': blob
        });
      });
    }

    // leaving this async for now
    // we should use blobs instead of base64
    // see bugs 951246,951249
    function renderIcon(searchResult, cb) {
      var iconData = searchResult.iconData;
      var src = 'data:' + iconData.MIMEType + ';base64,' + iconData.data;

      var img = document.createElement('img');

      img.onload = function onload() {
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        context.drawImage(img, 0, 0);

        canvas.toBlob(function(blob) {
          cb(blob);
        });
      };

      img.src = src;
    }
  }

  Evme.SearchHandler = new SearchHandler();

})();

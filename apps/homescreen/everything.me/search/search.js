(function() {
  'use strict';

  var _port;

  function EvmeSearch() {}

  function onMessage(msg) {
    var data = msg.data;
    console.log('evme', 'onMessage', JSON.stringify(data));
    // XXX window.Evme is not defined
    // even after is loaded in homescreen app
    console.log('evme', 'evme?', Evme);
  }

  EvmeSearch.prototype.init = function init() {

    console.log('evme', 'EvmeSearch', 'init');

    navigator.mozSetMessageHandler('connection',
      function(connectionRequest) {
        var keyword = connectionRequest.keyword;
        if (keyword != 'search-evme') {
          return;
        }

        var port = connectionRequest.port;
        port.onmessage = onMessage;
        port.start();
      });
  };

  window.EvmeSearch = new EvmeSearch();
  window.EvmeSearch.init();
})();

(function() {

  'use strict';

  function EvmeConn() {
    var self = this;

    this.port = null;

    console.log('evme', 'EvmeConn init...');

    // Broadcast to eme-api channel
    navigator.mozApps.getSelf().onsuccess = function() {
      var app = this.result;
      app.connect('eme-api').then(
        function onConnectionAccepted(ports) {
          ports.forEach(function(port) {
            self.port = port;
          });
          console.log('evme', 'EvmeConn port ready=', self.port, ports.length);
        },
        function onConnectionRejected(reason) {
          dump('Error connecting: ' + reason + '\n');
        }
      );
    };

  }

  window.EvmeConn = new EvmeConn();

}());

'use strict';

window.MockLocation = {
  realMethod: null,
  lat: null,
  lon: null,

  suiteSetup: function suiteSetup(lat, lon) {
    this.realMethod = navigator.geolocation.getCurrentPosition;
    navigator.geolocation.getCurrentPosition =
      this.getCurrentPosition.bind(this);

    this.setCoords(lat, lon);
  },

  suiteTeardown: function suiteTeardown() {
    navigator.geolocation.getCurrentPosition = this.realMethod;
  },

  getCurrentPosition: function getCurrentPosition(onSuccess, onError, options) {
    onSuccess({
      coords: {
        latitude: this.lat,
        longitude: this.lon
      }
    });
  },

  setCoords: function setCoords(lat, lon) {
    this.lat = lat;
    this.lon = lon;
  }
};

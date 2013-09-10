'use strict';

if (!window.Evme) {
  window.Evme = {};
}

window.Evme.Storage = {
  data: {},
  get: function get(key, callback) {
    callback && callback(this.data[key]);
  },
  set: function get(key, value, callback) {
    this.data[key] = value;
    callback && callback();
  },
  remove: function get(key, callback) {
    this.data[key] = null;
    delete this.data[key];
    callback && callback();
  }
};

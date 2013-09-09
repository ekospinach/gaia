'use strict';

window.Evme = {
  Utils: {
    l10n: function l10n(module, key, args) {
      return module + '.' + key;
    }
  },

  EventHandler: {
    _fired: {},

    fired: function fired(className, eventName) {
      return (className + '.' + eventName) in this._fired;
    },

    // save the event locally, so we can later check it
    trigger: function trigger(className, eventName, data) {
      this._fired[className + '.' + eventName] = data;
    }
  }
};

'use strict';

window.realEvme = window.Evme;

window.Evme = {
  suiteSetup: function suiteSetup() {
    if (!document.getElementById('mock-evme-html')) {
      var wrapperNode = document.createElement('section');
      wrapperNode.id = 'mock-evme-html';
      wrapperNode.innerHTML = MockEverythingMeHtml;
      document.body.appendChild(wrapperNode);
    }

    // reset the events to not have leftover between tests
    this.EventHandler._fired = {};
  },

  tearDown: function tearDown() {
    if (window.realEvme) {
      window.Evme = window.realEvme;
    }
  },

  Utils: {
    l10n: function l10n(module, key, args) {
      return module + '.' + key;
    }
  },

  $create: function Evme_$create(tagName, attributes, html) {
    var el = document.createElement(tagName);
    if (attributes) {
      for (var key in attributes) {
        el.setAttribute(key, attributes[key]);
      }
    }
    if (html) {
      el.innerHTML = html;
    }
    return el;
  },
  $remove: function Evme_$remove(sSelector, scope) {
    if (typeof sSelector === 'object') {
      if (sSelector && sSelector.parentNode) {
        sSelector.parentNode.removeChild(sSelector);
      }
    } else {
      Evme.$(sSelector, null, function itemIteration(el) {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    }
  },
  $: function Evme_$(sSelector, elScope, iterationFunction) {
    var isById = sSelector.charAt(0) === '#',
        els;

    if (isById) {
      els = [document.getElementById(sSelector.replace('#', ''))];
    } else {
      els = (elScope || document.body).querySelectorAll(sSelector);
    }

    if (iterationFunction !== undefined) {
      for (var i = 0, el; el = els[++i];) {
        iterationFunction.call(el, el);
      }
    }

    return isById ? els[0] : els;
  },

  EventHandler: {
    _fired: {},

    fired: function fired(className, eventName, args) {
      var eventName = className + '.' + eventName,
          eventArgs = this._fired[eventName],
          isFired = eventArgs !== undefined;

      if (isFired && args) {
        isFired = (JSON.stringify(args) === JSON.stringify(eventArgs));
      }

      // delete it so if we check the same event in two tests
      // it won't be levtover
      delete this._fired[eventName];

      return isFired;
    },

    // save the event locally, so we can later check it
    trigger: function trigger(className, eventName, data) {
      this._fired[className + '.' + eventName] = (data || null);
    }
  }
};

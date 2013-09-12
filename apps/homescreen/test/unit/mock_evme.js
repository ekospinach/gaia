'use strict';

window.realEvme = window.Evme;

window.Evme = {
  wrapperNode: null,

  suiteSetup: function suiteSetup() {
    this.wrapperNode = document.createElement('section');
    this.wrapperNode.id = 'mock-evme-html';
    this.wrapperNode.innerHTML = MockEverythingMeHtml;
    document.body.appendChild(this.wrapperNode);

    // reset the events to not have leftover between tests
    this.EventHandler._fired = {};
  },

  suiteTeardown: function tearDown() {
    if (window.realScroll) {
      window.Scroll = window.realScroll;
    }

    this.wrapperNode.parentNode.removeChild(this.wrapperNode);

    if (window.realEvme) {
      window.Evme = window.realEvme;
    }
  },

  Utils: {
    log: function log() {

    },
    l10n: function l10n(module, key, args) {
      return module + '.' + key;
    },
    l10nAttr: function l10nAttr(module, key, args) {
      return '';
    },
    l10nKey: function l10nKey(module, key) {
      return ('evme-' + module + '-' + key).toLowerCase();
    },
    l10nParseConfig: function l10nParseConfig(text) {
      return '';
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

  html: function html(text) {
    return text;
  },

  EventHandler: {
    _fired: {},

    fired: function fired(className, eventName, args) {
      var eventName = className + '.' + eventName,
          eventArgs = this._fired[eventName],
          isFired = eventArgs !== undefined;

      if (isFired && args) {
        for (var k in args) {
          if (args[k] !== eventArgs[k]) {
            isFired = false;
            break;
          }
        }
      }

      // delete it so if we check the same event in two tests
      // it won't be levtover
      delete this._fired[eventName];

      return isFired;
    },

    // save the event locally, so we can later check it
    trigger: function trigger(className, eventName, data) {
      var eventName = className + '.' + eventName,
          args = data || null;

      this._fired[eventName] = (args);

      window.dispatchEvent(new CustomEvent(eventName, {
        detail: args
      }));
    }
  }
};


window.realScroll = window.Scroll;
window.Scroll = function() {
  Evme.EventHandler.trigger('Scroll', 'init');

  this.scrollTo = function scrollTo() {};
};

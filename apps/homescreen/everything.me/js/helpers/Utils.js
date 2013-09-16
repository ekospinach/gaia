Evme.Utils = new function Evme_Utils() {
    var self = this,
        userAgent = "", connection = null, cssPrefix = "", iconsFormat = null,
        newUser = false, isTouch = false,
        parsedQuery = parseQuery(),
        elContainer = null,
	headEl = document.querySelector('html>head'),
	filterSelectorTemplate = '.evme-apps ul:not({0}) li[{1}="{2}"]',

	CONTAINER_ID = "evmeContainer", // main E.me container
	SCOPE_CLASS = "evmeScope",      // elements with E.me content

        COOKIE_NAME_CREDENTIALS = "credentials",

	CLASS_WHEN_KEYBOARD_IS_VISIBLE = 'evme-keyboard-visible',

	// all the installed apps (installed, clouds, marketplace) should be the same size
	// however when creating icons in the same size there's still a noticable difference
	// this is because the OS' native icons have a transparent padding around them
	// so to make our icons look the same we add this padding artificially
	INSTALLED_CLOUDS_APPS_ICONS_PADDING = 2,

        OSMessages = this.OSMessages = {
          "APP_INSTALL": "add-bookmark",
          "OPEN_URL": "open-url",
          "SHOW_MENU": "show-menu",
          "HIDE_MENU": "hide-menu",
          "MENU_HEIGHT": "menu-height",
          "EVME_OPEN": "evme-open",
          "GET_ICON_SIZE": "get-icon-size"
        },

        host = document.location.host,
        domain = host.replace(/(^[\w\d]+\.)?([\w\d]+\.[a-z]+)/, '$2'),
        protocol = document.location.protocol,
        homescreenOrigin = protocol + '//homescreen.' + domain;

    this.PIXEL_RATIO_NAMES = {
      NORMAL: 'normal',
      HIGH: 'high'
    };

    this.ICONS_FORMATS = {
      "Small": 10,
      "Large": 20
    };

    this.REGEXP = {
	URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
    };

    this.devicePixelRatio =  window.innerWidth / 320;

    this.isKeyboardVisible = false;

    this.EMPTY_IMAGE = "../../images/empty.gif";

    this.EMPTY_APPS_SIGNATURE = '';

    this.APPS_FONT_SIZE = 12 * self.devicePixelRatio;

    this.PIXEL_RATIO_NAME = (this.devicePixelRatio > 1) ? this.PIXEL_RATIO_NAMES.HIGH : this.PIXEL_RATIO_NAMES.NORMAL;

    this.NOOP = function(){};

    this.currentResultsManager = null;

    this.init = function init() {
        userAgent = navigator.userAgent;
        cssPrefix = getCSSPrefix();
        connection = Connection.get();
        isTouch = window.hasOwnProperty("ontouchstart");

        elContainer = document.getElementById(CONTAINER_ID);
    };

    this.logger = function logger(level) {
	return function Evme_logger() {
	    var t = new Date(),
		h = t.getHours(),
		m = t.getMinutes(),
		s = t.getSeconds(),
		ms = t.getMilliseconds();

	    h < 10 && (h = '0' + h);
	    m < 10 && (m = '0' + m);
	    s < 10 && (s = '0' + s);
	    ms < 10 && (ms = '00' + ms) ||
		ms < 100 && (ms = '0' + ms);

	    console[level]("[%s EVME]: %s", [h, m, s, ms].join(':'), Array.prototype.slice.call(arguments));
	}
    };

    this.log = this.logger("log");
    this.warn = this.logger("warn");
    this.error = this.logger("error");

    this.l10n = function l10n(module, key, args) {
        return navigator.mozL10n.get(Evme.Utils.l10nKey(module, key), args);
    };
    this.l10nAttr = function l10nAttr(module, key, args) {
        var attr = 'data-l10n-id="' + Evme.Utils.l10nKey(module, key) + '"';

        if (args) {
            try {
                attr += ' data-l10n-args="' + JSON.stringify(args).replace(/"/g, '&quot;') + '"';
            } catch(ex) {

            }
        }

        return attr;
    };
    this.l10nKey = function l10nKey(module, key) {
        return ('evme-' + module + '-' + key).toLowerCase();
    };
    this.l10nParseConfig = function l10nParseConfig(text) {
        if (typeof text === "string") {
            return text;
        }

        var firstLanguage = Object.keys(text)[0],
            currentLang = navigator.mozL10n.language.code || firstLanguage,
            translation = text[currentLang] || text[firstLanguage] || '';

        return translation;
    };

    this.shortcutIdToKey = function l10nShortcutKey(experienceId) {
        var map = Evme.__config.shortcutIdsToL10nKeys || {};
        return map[experienceId.toString()] || experienceId;
    };

    this.uuid = function generateUUID() {
        return Evme.uuid();
    };

    this.sendToOS = function sendToOS(type, data) {
        switch (type) {
            case OSMessages.APP_INSTALL:
		return EvmeManager.addGridItem(data);
            case OSMessages.OPEN_URL:
                return EvmeManager.openUrl(data.url);
            case OSMessages.SHOW_MENU:
                return EvmeManager.menuShow();
            case OSMessages.HIDE_MENU:
                return EvmeManager.menuHide();
            case OSMessages.MENU_HEIGHT:
                return EvmeManager.getMenuHeight();
            case OSMessages.GET_ICON_SIZE:
                return EvmeManager.getIconSize();
            case OSMessages.EVME_OPEN:
                EvmeManager.isEvmeVisible(data.isVisible);
                break;
        }
    };

    this.getID = function getID() {
        return CONTAINER_ID;
    };

    this.getContainer = function getContainer() {
        return elContainer;
    };

    this.getScopeElements = function getScopeElements() {
	return document.querySelectorAll("." + SCOPE_CLASS);
    };

    this.cloneObject = function cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    };

    this.valuesOf = function values(obj) {
	return Object.keys(obj).map(function getValue(key) {
	  return obj[key];
	});
    };

    // remove installed apps from clouds apps
    this.dedupInstalledApps = function dedupInstalledApps(apps, installedApps) {
      var dedupCloudAppsBy = [];

      // first construct the data to filter by (an array of objects)
      // currently only the URL is relevant
      for (var i=0, appData; appData=installedApps[i++];) {
        dedupCloudAppsBy.push({
          'favUrl': appData.favUrl,
          'appUrl': appData.favUrl
        });
      }

      return self.dedup(apps, dedupCloudAppsBy);
    };

    // remove from arrayOrigin according to rulesToRemove
    // both arguments are arrays of objects
    this.dedup = function dedup(arrayOrigin, rulesToRemove) {
      for (var i=0,item; item=arrayOrigin[i++];) {
        for (var j=0,rule; rule=rulesToRemove[j++];) {
          for (var property in rule) {
            // if one of the conditions was met,
            // remove the item and continue to next item
            if (item[property] === rule[property]) {
              arrayOrigin.splice(i-1, 1);
              j = rulesToRemove.length;
              break;
            }
          }
        }
      }

      return arrayOrigin;
    };

    this.getRoundIcon = function getRoundIcon(options, callback) {
        var size = self.sendToOS(self.OSMessages.GET_ICON_SIZE) - 2,
	    padding = options.padding ? INSTALLED_CLOUDS_APPS_ICONS_PADDING : 0,
	    actualIconSize = size - padding*2,
            img = new Image();

        img.onload = function() {
            var canvas = document.createElement("canvas"),
                ctx = canvas.getContext("2d");

            canvas.width = size;
            canvas.height = size;

            ctx.beginPath();
	    ctx.arc(size/2, size/2, actualIconSize/2, 2 * Math.PI, false);
            ctx.clip();

	    ctx.drawImage(img, padding, padding, actualIconSize, actualIconSize);

            callback(canvas.toDataURL());
        };
	img.src = self.formatImageData(options.src);
    };

    /**
     * Round all icons in an icon map object
     * @param  {Object}   {1: src1, 2: src2 ...}
     * @param  {Function} Function to call when done
     *
     * @return {Object}   {1: round1, 2: round2 ...}
     */
    this.roundIconsMap = function roundIconsMap(iconsMap, callback) {
      var total = Object.keys(iconsMap).length,
	  roundedIconsMap = {},
	  processed = 0;

      for (var id in iconsMap) {
	var src = Evme.Utils.formatImageData(iconsMap[id]);

	(function roundIcon(id, src){
	  Evme.Utils.getRoundIcon({
	    "src": src
	  }, function onRoundIcon(roundIcon) {
	    roundedIconsMap[id] = roundIcon;

	    if (++processed === total) {
	      callback(roundedIconsMap);
	    }
	  });
	})(id, src);
      };
    };

    this.writeTextToCanvas = function writeTextToCanvas(options) {
      var context = options.context,
          text = options.text ? options.text.split(' ') : [],
          offset = options.offset || 0,
          lineWidth = 0,
          currentLine = 0,
          textToDraw = [],

          WIDTH = context.canvas.width,
	  FONT_SIZE = options.fontSize || self.APPS_FONT_SIZE,
          LINE_HEIGHT = FONT_SIZE + 1 * self.devicePixelRatio;

      if (!context || !text) {
        return false;
      }

      context.save();

      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillStyle = 'rgba(255,255,255,1)';
      context.shadowOffsetX = 1;
      context.shadowOffsetY = 1;
      context.shadowBlur = 3;
      context.shadowColor = 'rgba(0, 0, 0, 0.6)';
      context.font = '600 ' + FONT_SIZE + 'px sans-serif';

      for (var i=0,word; word=text[i++];) {
        // add 1 to the word with because of the space between words
        var size = context.measureText(word).width + 1,
            draw = false,
            pushed = false;

        if (lineWidth + size >= WIDTH) {
          draw = true;
          if (textToDraw.length === 0) {
            textToDraw.push(word);
            pushed = true;
          }
        }

        if (draw) {
          drawText(textToDraw, WIDTH/2, offset + currentLine*LINE_HEIGHT);
          currentLine++;
          textToDraw = [];
          lineWidth = 0;
        }

        if (!pushed) {
          textToDraw.push(word);
          lineWidth += size;
        }
      }

      if (textToDraw.length > 0) {
        drawText(textToDraw, WIDTH/2, offset + currentLine*LINE_HEIGHT);
      }

      function drawText(text, x, y) {
	var isSingleWord, size;

	isSingleWord = text.length === 1;
	text = text.join(' ');
	size = context.measureText(text).width;

        if (isSingleWord && size >= WIDTH) {
          while (size >= WIDTH) {
            text = text.substring(0, text.length-1);
            size = context.measureText(text + '…').width;
          }

          text += '…';
        }

        context.fillText(text, x, y);
      }

      context.restore();

      return true;
    };

    this.isNewUser = function isNewUser() {
        if (newUser === undefined) {
            Evme.Storage.get("counter-ALLTIME", function storageGot(value) {
                newUser = !value;
            });
        }
        return newUser;
    };

    this.formatImageData = function formatImageData(image) {
      if (!image || typeof image !== "object") {
	return image;
      }
      if (image.MIMEType === "image/url") {
	return image.data;
      }
      if (!image.MIMEType || image.data.length < 10) {
	return null;
      }
      if (self.isBlob(image)) {
	return self.EMPTY_IMAGE;
      }

      return "data:" + image.MIMEType + ";base64," + image.data;
    };

    this.getDefaultAppIcon = function getDefaultAppIcon() {
	return Evme.Config.design.apps.defaultAppIcon[this.PIXEL_RATIO_NAME];
    };

    this.getEmptyCollectionIcon = function getEmptyCollectionIcon(){
	return Evme.__config.emptyCollectionIcon;
    };

    this.getIconGroup = function getIconGroup(numIcons) {
	// valid values are 1,2,3
	numIcons = Math.max(numIcons, 1);
	numIcons = Math.min(numIcons, 3);
	return self.cloneObject(Evme.__config.iconsGroupSettings[numIcons]);
    };

    this.getIconsFormat = function getIconsFormat() {
        return iconsFormat || _getIconsFormat();
    };

    this.isBlob = function isBlob(arg) {
        return arg instanceof Blob;
    };

    this.blobToDataURI = function blobToDataURI(blob, cbSuccess, cbError) {
        if (!self.isBlob(blob)) {
            cbError && cbError();
            return;
        }

        var reader = new FileReader();
        reader.onload = function() {
            cbSuccess(reader.result);
        };
        reader.onerror = function() {
            cbError && cbError();
        };

        reader.readAsDataURL(blob);
    };

    /**
     * Append or overrite a url string with query parameter key=value.
     * insertParam('app://homescreen.gaiamobile.org:8080', 'appId', 123) =>
     *   app://homescreen.gaiamobile.org:8080?appId=123
     *
     * adopted from http://stackoverflow.com/a/487049/1559840
     */
    this.insertParam = function insertParam(url, key, value) {
      key = encodeURI(key);
      value = encodeURI(value);

      var parts = url.split("?");
      var domain = parts[0];
      var search = parts[1] || '';
      var kvp = search.split('&');

      var i = kvp.length;
      var x;
      while (i--) {
	x = kvp[i].split('=');

	if (x[0] == key) {
	  x[1] = value;
	  kvp[i] = x.join('=');
	  break;
	}
      }

      if (i < 0) {
	kvp[kvp.length] = [key, value].join('=');
      }

      return domain + "?" + kvp.filter(function isEmpty(pair) {
	return pair !== '';
      }).join('&');
    };

    /**
     * Get a query parameter value from a url
     * extractParam('app://homescreen.gaiamobile.org:8080?appId=123', appId) => 123
     */
    this.extractParam = function extractParam(url, key) {
      var search = url.split('?')[1];
      if (search) {
	var kvp = search.split('&');
	for (var i = 0; i < kvp.length; i++) {
	  var pair = kvp[i];
	  if (key === pair.split('=')[0]) {
	    return pair.split('=')[1];
	  }
	}
      }
      return undefined;
    };

    this.setKeyboardVisibility = function setKeyboardVisibility(value){
      if (self.isKeyboardVisible === value) return;

        self.isKeyboardVisible = value;

        if (self.isKeyboardVisible) {
	    document.body.classList.add(CLASS_WHEN_KEYBOARD_IS_VISIBLE);
        } else {
	    document.body.classList.remove(CLASS_WHEN_KEYBOARD_IS_VISIBLE);
        }
    };

    this.systemXHR = function systemXHR(options) {
      var url = options.url,
	  responseType = options.responseType || "",
	  onSuccess = options.onSuccess || self.NOOP,
	  onError = options.onError || self.NOOP;

      var xhr = new XMLHttpRequest({
	mozAnon: true,
	mozSystem: true
      });

      xhr.open('GET', url, true);
      xhr.responseType = responseType;

      try {
	xhr.send(null);
      } catch (e) {
	onError(e);
	return;
      }

      xhr.onerror = onError;

      xhr.onload = function onload() {
	var status = xhr.status;
	if (status !== 0 && status !== 200) {
	    onError();
	} else {
	    onSuccess(xhr.response);
	}
      };
    };

    this.connection = function _connection(){
        return connection;
    };

    this.isOnline = function isOnline(callback) {
       Connection.online(callback);
    };

    this.getUrlParam = function getUrlParam(key) {
        return parsedQuery[key]
    };

    this.cssPrefix = function _cssPrefix() {
        return cssPrefix;
    };

    this.convertIconsToAPIFormat = function convertIconsToAPIFormat(icons) {
        var aIcons = [];
        if (icons instanceof Array) {
            for (var i=0; i<icons.length; i++) {
                aIcons.push(f(icons[i]));
            }
        } else {
            for (var i in icons) {
                aIcons.push(f(icons[i]));
            }
        }
        aIcons = aIcons.join(",");
        return aIcons;

        function f(icon) {
            return (icon && icon.id && icon.revision && icon.format)? icon.id + ":" + icon.revision + ":" + icon.format : "";
        }
    }

    this.hasFixedPositioning = function hasFixedPositioning(){
        return false;
    };

    this.isVersionOrHigher = function isVersionOrHigher(v1, v2) {
        if (!v2){ v2 = v1; v1 = Evme.Utils.getOS().version; };
        if (!v1){ return undefined; }

        var v1parts = v1.split('.');
        var v2parts = v2.split('.');

        for (var i = 0; i < v1parts.length; ++i) {
            if (v2parts.length == i) {
                return true;
            }

            if (v1parts[i] == v2parts[i]) {
                continue;
            } else if (parseInt(v1parts[i], 10) > parseInt(v2parts[i], 10)) {
                return true;
            } else {
                return false;
            }
        }

        if (v1parts.length != v2parts.length) {
            return false;
        }

        return true;
    };

    this.User = new function User() {
        this.creds = function creds() {
            var credsFromCookie = Evme.Utils.Cookies.get(COOKIE_NAME_CREDENTIALS);
            return credsFromCookie;
        };
    };

    this.Cookies = new function Cookies() {
        this.set = function set(name, value, expMinutes, _domain) {
            var expiration = "",
                path = norm("path","/"),
                domain = norm("domain", _domain);

            if (expMinutes) {
                expiration = new Date();
                expiration.setMinutes(expiration.getMinutes() + expMinutes);
                expiration = expiration.toGMTString();
            }
            expiration = norm("expires", expiration);

            var s = name + "=" + escape(value) + expiration + path + domain;

            try {
                document.cookie = s;
            } catch(ex) {}

            return s;
        };

        this.get = function get(name) {
            var results = null;

            try {
                results = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
            } catch(ex) {}

            return (results)? unescape(results[2]) : null;
        };

        this.remove = function remove(name) {
            Evme.Utils.Cookies.set(name, "", "Thu, 24-Jun-1999 12:34:56 GMT");
        };

        function norm(k, v) {
            return k && v ? "; "+k+"="+v : "";
        }
    };

    // check that cookies are enabled by setting and getting a temp cookie
    this.bCookiesEnabled = function bCookiesEnabled(){
        var key = "cookiesEnabled",
            value = "true";

        // set
        self.Cookies.set(key, value, 10);

        // get and check
        if (self.Cookies.get(key) === value){
            self.Cookies.remove(key);
            return true;
        }
    };

    // check that localStorage is enabled by setting and getting a temp value
    this.bLocalStorageEnabled = function bLocalStorageEnabled(){
        return Evme.Storage.enabled();
    };

    /**
     * Escape special characters in `s` so it can be used for creating a RegExp
     * source: http://stackoverflow.com/a/3561711/1559840
     */
    this.escapeRegexp = function escapeRegexp(s) {
	return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };

    // retrieves the value of a specified property from all elements in the `collection`.
    this.pluck = function pluck(collection, property) {
	if (Array.isArray(collection)) {
	    return collection.map(function(item) {
		return item[property];
	    });
	} else {
	    return [];
	}
    };

    // Creates a duplicate-value-free version of the `array`
    this.unique = function unique(array, property) {
      // array of objects, unique by `property` of the objects
      if (property){
	var values = Evme.Utils.pluck(array, property);
	return array.filter(function(item, pos) { return uniqueFilter(item[property], pos, values) } );
      }

      // array of literals
      else {
	return array.filter(uniqueFilter);
      }
    };

    function uniqueFilter(elem, pos, self) {
	// if first appearance of `elem` is `pos` then it is unique
	return self.indexOf(elem) === pos;
    }

    function _getIconsFormat() {
        return self.ICONS_FORMATS.Large;
    }

    function getCSSPrefix() {
        return (/webkit/i).test(navigator.appVersion) ? '-webkit-' :
                (/firefox/i).test(navigator.userAgent) ? '-moz-' :
                (/msie/i).test(navigator.userAgent) ? '-ms-' :
                'opera' in window ? '-o-' : '';
    }

    this.getCurrentSearchQuery = function getCurrentSearchQuery(){
        return Evme.Brain.Searcher.getDisplayedQuery();
    };

    this.getAppsSignature = function getAppsSignature(apps) {
	// prepend with number of apps for quick comparison (fail early)
	var key = '' + apps.length;
	for (var i=0, app; app=apps[i++];) {
	    key += app.id + ':' + app.appUrl + ',';
	}
	return key || this.EMPTY_APPS_SIGNATURE;
    };

    var Connection = new function Connection(){
        var self = this,
            currentIndex,
            consts = {
                SPEED_UNKNOWN: 100,
                SPEED_HIGH: 30,
                SPEED_MED: 20,
                SPEED_LOW: 10
            },
            types = [
                {
                    "name": undefined,
                    "speed": consts.SPEED_UNKNOWN
                },
                {
                    "name": "etherenet",
                    "speed": consts.SPEED_HIGH
                },
                {
                    "name": "wifi",
                    "speed": consts.SPEED_HIGH
                },
                {
                    "name": "2g",
                    "speed": consts.SPEED_LOW
                },
                {
                    "name": "3g",
                    "speed": consts.SPEED_MED
                }
            ];

        this.init = function init() {
            window.addEventListener("online", self.setOnline);
            window.addEventListener("offline", self.setOffline);

            self.set();
        };

        this.setOnline = function setOnline() {
            Evme.EventHandler.trigger("Connection", "online");
        };
        this.setOffline = function setOffline() {
            Evme.EventHandler.trigger("Connection", "offline");
        };

        this.online = function online(callback) {
            callback(window.location.href.match(/_offline=true/)? false : navigator.onLine);
        };

        this.get = function get(){
            return getCurrent();
        };

        this.set = function set(index){
             currentIndex = index || (navigator.connection && navigator.connection.type) || 0;
             return getCurrent();
        };

        function getCurrent(){
            return aug({}, consts, types[currentIndex]);
        }

        function aug(){
            var main = arguments[0];
            for (var i=1, len=arguments.length; i<len; i++){
                for (var k in arguments[i]){ main[k] = arguments[i][k] }
            };
            return main;
        }

        // init
        self.init();
    };
    this.Connection = Connection;

    this.init();
};

/*
 * Acts as event manager. Provides bind and trigger functions.
 */
Evme.EventHandler = new function Evme_EventHandler(){
    var arr = {},
      MAIN_EVENT = "DoATEvent";
    
    function bind(eventNamesArr, cb){
        !(eventNamesArr instanceof Array) && (eventNamesArr = [eventNamesArr]);
        for (var idx in eventNamesArr){
            var eventName=eventNamesArr[idx];
            !(eventName in arr) && (arr[eventName] = []);
            arr[eventName].push(cb);
        }
    }

    function unbind(eventName, cb){
        if (!cb){
            arr[eventName] = {};
        } else {
            for (var a=arr[eventName], i=a?a.length-1:-1; i>=0; --i) {
                if (a[i]===cb) {
                    a.splice(i, 1);
                    return;
                }
            }
        }        
    }

    function trigger(eventName, data){
        if (eventName && eventName in arr){
            for (var i=0, a=arr[eventName], len=a.length; i<len; i++) {
                data = Array.prototype.slice.apply(data);
                a[i].apply(this, data);
            }
        }
    }
    
    this.bind = function _bind(cb){
        bind(MAIN_EVENT, cb)
    };
    
    this.unbind = function _unbind(cb){
        unbind(MAIN_EVENT, cb)
    };
    
    this.trigger = function _trigger(){
        trigger(MAIN_EVENT, arguments);
    };
};

/*
 * Proxy to underlying storage provider, to allow easy replacing
 * of the provider and leaving our API the same
 */
Evme.Storage = new function Evme_Storage() {
    var self = this,
        KEY_PREFIX = 'evme-';
        
    this.set = function set(key, val, ttl, callback) {
      val = {
        "value": val
      };
      
      if (ttl) {
        if (ttl instanceof Function) {
          callback = ttl;
        } else {
          val.expires = Date.now() + ttl*1000;
        }
      }
      
      asyncStorage.setItem(KEY_PREFIX + key, val, callback);
    };
    
    this.get = function get(key, callback) {
      asyncStorage.getItem(KEY_PREFIX + key, function onItemGot(value) {
        if (value && value.expires && value.expires < Date.now()) {
          self.remove(key);
          value = null;
        }
        
        // value.value since the value is an object {"value": , "expires": }
        value = value && value.value;
        
        callback && callback(value);
      });
    };
    
    this.remove = function remove(key, callback) {
      asyncStorage.removeItem(KEY_PREFIX + key, callback);
    };
    
    // legacy compatibility from localStorage
    this.enabled = function enabled() {
      return true;
    };
};

/*
 * Idle class
 * Triggers a callback after a specified amout of time gone idle
 */
Evme.Idle = function Evme_Idle(){
    var self = this,
        timer, delay, callback;
    
    this.isIdle = true;
    
    // init
    this.init = function init(options){
        // set params
        delay = options.delay;
        callback = options.callback;
        
        // start timer
        self.reset();
    };
    
    // reset timer
    this.reset = function reset(_delay){
        // set timeout delay value
        if (_delay === undefined){
            _delay = delay;
        }
        
        self.isIdle = false;
        
        // stop previous timer
        clearTimeout(timer);
        
        // start a new timer
        timer = setTimeout(onIdle, _delay);
    };
    
    this.advanceBy = function advanceBy(ms){
        self.reset(delay-ms);
    };
    
    this.flush = function flush(){
        self.reset(0);
    };
    
    function onIdle(){
        self.isIdle = true;
        
        // call callback
        callback();
    }
};

Evme.$ = function Evme_$(sSelector, elScope, iterationFunction) {
    var isById = sSelector.charAt(0) === '#',
        els = null;

    if (isById) {
        els = [document.getElementById(sSelector.replace('#', ''))];
    } else {
        els = (elScope || Evme.Utils.getContainer()).querySelectorAll(sSelector);
    }

    if (iterationFunction !== undefined) {
        for (var i=0, el=els[i]; el; el=els[++i]) {
            iterationFunction.call(el, el);
        }
    }

    return isById? els[0] : els;
};

Evme.$remove = function Evme_$remove(sSelector, scope) {
    if (typeof sSelector === "object") {
        if (sSelector && sSelector.parentNode) {
            sSelector.parentNode.removeChild(sSelector);
        }
    } else {
        Evme.$(sSelector, scope, function itemIteration(el) {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
    }
};


Evme.$create = function Evme_$create(tagName, attributes, html) {
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
};

Evme.$isVisible = function Evme_$isVisible(el){
    return !!el.offsetWidth && getComputedStyle(el).visibility === "visible";
};

Evme.htmlRegex = /</g;
Evme.html = function Evme_html(html) {
  return (html || '').replace(Evme.htmlRegex, '&lt;');
};


//     node-uuid/uuid.js
//
//     Copyright (c) 2010 Robert Kieffer
//     Dual licensed under the MIT and GPL licenses.
//     Documentation and details at https://github.com/broofa/node-uuid
(function(_global) {
  // Unique ID creation requires a high quality random # generator, but
  // Math.random() does not guarantee "cryptographic quality".  So we feature
  // detect for more robust APIs, normalizing each method to return 128-bits
  // (16 bytes) of random data.
  var mathRNG, nodeRNG, whatwgRNG;

  // Math.random()-based RNG.  All platforms, very fast, unknown quality
  var _rndBytes = new Array(16);
  mathRNG = function() {
    var r, b = _rndBytes, i = 0;

    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      b[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return b;
  }

  // Node.js crypto-based RNG - http://nodejs.org/docs/v0.6.2/api/crypto.html
  // Node.js only, moderately fast, high quality
  try {
    var _rb = require('crypto').randomBytes;
    nodeRNG = _rb && function() {
      return _rb(16);
    };
  } catch (e) {}

  // Select RNG with best quality
  var _rng = nodeRNG || whatwgRNG || mathRNG;

  // Buffer class to use
  var BufferClass = typeof(Buffer) == 'function' ? Buffer : Array;

  // Maps for number <-> hex string conversion
  var _byteToHex = [];
  var _hexToByte = {};
  for (var i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
  }

  // **`parse()` - Parse a UUID into it's component bytes**
  function parse(s, buf, offset) {
    var i = (buf && offset) || 0, ii = 0;

    buf = buf || [];
    s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
      if (ii < 16) { // Don't overflow!
        buf[i + ii++] = _hexToByte[oct];
      }
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
      buf[i + ii++] = 0;
    }

    return buf;
  }

  // **`unparse()` - Convert UUID byte array (ala parse()) into a string**
  function unparse(buf, offset) {
    var i = offset || 0, bth = _byteToHex;
    return  bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]];
  }

  // **`v1()` - Generate time-based UUID**
  //
  // Inspired by https://github.com/LiosK/UUID.js
  // and http://docs.python.org/library/uuid.html

  // random #'s we need to init node and clockseq
  var _seedBytes = _rng();

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  var _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  var _lastMSecs = 0, _lastNSecs = 0;

  // See https://github.com/broofa/node-uuid for API details
  function v1(options, buf, offset) {
    var i = buf && offset || 0;
    var b = buf || [];

    options = options || {};

    var clockseq = options.clockseq != null ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    var msecs = options.msecs != null ? options.msecs : new Date().getTime();

    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    var nsecs = options.nsecs != null ? options.nsecs : _lastNSecs + 1;

    // Time since last uuid creation (in msecs)
    var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

    // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq == null) {
      clockseq = clockseq + 1 & 0x3fff;
    }

    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs == null) {
      nsecs = 0;
    }

    // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
      throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;

    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;

    // `time_low`
    var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;

    // `time_mid`
    var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;

    // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;

    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // `clock_seq_low`
    b[i++] = clockseq & 0xff;

    // `node`
    var node = options.node || _nodeId;
    for (var n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : unparse(b);
  }

  // **`v4()` - Generate random UUID**

  // See https://github.com/broofa/node-uuid for API details
  function v4(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    var i = buf && offset || 0;

    if (typeof(options) == 'string') {
      buf = options == 'binary' ? new BufferClass(16) : null;
      options = null;
    }
    options = options || {};

    var rnds = options.random || (options.rng || _rng)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || unparse(rnds);
  }

  // Export public API
  var uuid = v4;
  uuid.v1 = v1;
  uuid.v4 = v4;
  uuid.parse = parse;
  uuid.unparse = unparse;
  uuid.BufferClass = BufferClass;

  // Export RNG options
  uuid.mathRNG = mathRNG;
  uuid.nodeRNG = nodeRNG;
  uuid.whatwgRNG = whatwgRNG;

  if (typeof(module) != 'undefined') {
    // Play nice with node.js
    module.exports = uuid;
  } else {
    // Play nice with browsers
    var _previousRoot = _global.uuid;

    // **`noConflict()` - (browser only) to reset global 'uuid' var**
    uuid.noConflict = function() {
      _global.uuid = _previousRoot;
      return uuid;
    }
    _global.uuid = uuid;
  }
}(Evme));
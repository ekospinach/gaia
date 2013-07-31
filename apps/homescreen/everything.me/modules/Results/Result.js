Evme.RESULT_TYPE = {
  CONTACT: 'contact',
  INSTALLED: 'installed',
  MARKET: 'native_download',
  MARKET_SEARCH: 'market_search',
  CLOUD: 'app',
  WEBLINK: 'weblink'
};

Evme.Result = function Evme_Result(__cfg, __index, __isMore) {
	var NAME = "Result",
		self = this,
		cfg = {}, el = null,
		index = __index,
		isMore = __isMore,
		timeTouchStart = 0,
		touchStartPos = null,
		firedHold = false,
		tapIgnored = false,
		timeoutHold,

		DISTANCE_TO_IGNORE_AS_MOVE = 3,

		TEXT_HEIGHT = Evme.Utils.APPS_FONT_SIZE * 3,
		TEXT_WIDTH = 72 * Evme.Utils.devicePixelRatio,
		TEXT_MARGIN = 6 * Evme.Utils.devicePixelRatio,

		image = new Image();

	this.type = 'NOT_SET';
	
	this.app = null;
	this.canvas = null;
	this.context = null;

	this.init = function init(app, extra) {

		cfg = app;
		extra = extra || {"animate": true};

		this.app = app;

		el = Evme.$create('li', {
			'class': extra.animate ? 'new' : '',
			'id': 'app_' + cfg.id,
			'data-name': cfg.name
		}, '<canvas></canvas>');

		this.canvas = Evme.$('canvas', el)[0];
		this.context = this.canvas.getContext('2d');

		// remove button
		if (app.isRemovable) {
			var removeButton = Evme.$create('span', {
				'class': 'remove' 
			});
			removeButton.addEventListener('click', cbRemoveClick);
			removeButton.addEventListener('touchstart', stopPropagation);
			removeButton.addEventListener('touchend', stopPropagation);
			el.appendChild(removeButton);
		}

		if ("ontouchstart" in window) {
			el.addEventListener("touchstart", touchstart);
			el.addEventListener("touchmove", touchmove);
			el.addEventListener("touchend", touchend);
		} else {
			el.addEventListener("click", function onClick(e) {
				firedHold = tapIgnored = false;
				touchend(e);
			});
		}

		return el;
	};

	this.draw = function draw(iconObj) {
		cfg.icon = iconObj;
		
		if (el) {
			el.setAttribute('data-name', cfg.name);

			if (Evme.Utils.isBlob(iconObj)) {
				Evme.Utils.blobToDataURI(iconObj, function onDataReady(src) {
					setImageSrc(src);
				});

			} else {
				var src  = Evme.Utils.formatImageData(iconObj);
				setImageSrc(src);
			}
		}

		function setImageSrc(src) {		
			image.onload = self.onAppIconLoad;
			image.src = src;

			// save reference to the raw, unmaniputaled icon
			// used when closing a folder to update it's homescreen icon
			el.dataset.iconSrc = src;
		}
	};

	this.onAppIconLoad = function onAppIconLoad() {
		// deafult implementation: use OS icon rendering
		var iconCanvas = Icon.prototype.createCanvas(image),
				canvasSize = iconCanvas.width;

		self.initIcon(canvasSize, canvasSize);
		self.context.drawImage(iconCanvas, (TEXT_WIDTH - canvasSize) / 2, 0);
		self.iconPostRendering(iconCanvas);
		self.finalizeIcon();
	};

	this.initIcon = function initIcon(baseHeight, textOffset) {
		this.canvas.width = TEXT_WIDTH;
		this.canvas.height = baseHeight + TEXT_MARGIN + TEXT_HEIGHT - 1;

		Evme.Utils.writeTextToCanvas({
			"text": cfg.name,
			"context": this.context,
			"offset": textOffset + TEXT_MARGIN
		});
	};

	this.iconPostRendering = function iconPostRendering(iconCanvas) {
		// default: do nothing
	};

	this.finalizeIcon = function finalizeIcon() {
		el.classList.remove('new');
	};

	this.remove = function remove() {
		Evme.$remove(el);
	};

	this.isExternal = function isExternal() {
		return cfg.isWeblink;
	};

	this.getLink = function getLink() {
		return cfg.appUrl;
	};

	this.getIconCanvas = function getIconData() {
		return Evme.$('canvas', el)[0];
	};

	this.getElement = function getElement() {
		return el;
	};

	this.getId = function getId() {
		return cfg.id;
	};

	this.getLink = function getLink() {
		return cfg.appUrl;
	};

	this.getFavLink = function getFavLink() {
		return cfg.favUrl != "@" && cfg.favUrl || cfg.appUrl;
	};

	this.getIcon = function getIcon() {
		return cfg.icon;
	};

	this.getCfg = function getCfg() {
		return cfg;
	};

	this.goTo = function goTo() {
		cbClick();
	};

	function touchstart(e) {
		firedHold = tapIgnored = false;
		timeTouchStart = new Date().getTime();
		timeoutHold = window.setTimeout(cbHold, Evme.SearchResults.getAppTapAndHoldTime());
		touchStartPos = getEventPoint(e);
	}

	function touchmove(e) {
		if (!touchStartPos) {
			return;
		}

		var point = getEventPoint(e),
			distance = [point[0] - touchStartPos[0], point[1] - touchStartPos[1]];

		if (Math.abs(distance[0]) > DISTANCE_TO_IGNORE_AS_MOVE ||
			Math.abs(distance[1]) > DISTANCE_TO_IGNORE_AS_MOVE) {
			window.clearTimeout(timeoutHold);
			tapIgnored = true;
		}
	}

	function touchend(e) {
		if (firedHold || tapIgnored) {
			return;
		}

		window.clearTimeout(timeoutHold);
		e.preventDefault();
		e.stopPropagation();

		cbClick(e);
	}

	function getEventPoint(e) {
		var touch = e.touches && e.touches[0] ? e.touches[0] : e,
			point = touch && [touch.pageX || touch.clientX, touch.pageY || touch.clientY];

		return point;
	}

	function cbClick(e) {
		Evme.EventHandler.trigger(NAME, "click", {
			"app": self,
			"appId": cfg.id,
			"el": el,
			"data": cfg,
			"index": index,
			"isMore": isMore,
			"e": e
		});
	}

	function cbHold() {
		firedHold = true;

		Evme.EventHandler.trigger(NAME, "hold", {
			"app": self,
			"appId": cfg.id,
			"el": el,
			"data": cfg,
			"index": index,
			"isMore": isMore
		});
	}

	// prevent app click from being triggered
	function stopPropagation(e) {
		e.stopPropagation();
	}

	function cbRemoveClick() {
		Evme.EventHandler.trigger(NAME, "remove", {
			"id": cfg.id
		});
	}
}
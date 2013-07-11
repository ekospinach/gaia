Evme.CloudAppResult = function Evme_CloudAppsResult() {
	Evme.Result.call(this);

	this.type = Evme.RESULT_TYPE.CLOUD;

	var self = this,
			SHADOW_OFFSET = 2 * Evme.Utils.devicePixelRatio,
			SHADOW_BLUR = 2 * Evme.Utils.devicePixelRatio,
			SIZE = 52 * Evme.Utils.devicePixelRatio,
			FULL_SIZE = SIZE + SHADOW_OFFSET + SHADOW_BLUR;

	// manipulate the icon (clipping, shadow, resize)
	this.onAppIconLoad = function CloudResult_onAppIconLoad() {
		self.initIcon(FULL_SIZE, SIZE);

		var elImageCanvas = document.createElement('canvas'),
		    imageContext = elImageCanvas.getContext('2d'),
		    fixedImage = new Image();

		elImageCanvas.width = elImageCanvas.height = FULL_SIZE;

		imageContext.beginPath();
		imageContext.arc(FULL_SIZE / 2, FULL_SIZE / 2, SIZE / 2, 0, Math.PI * 2, false);
		imageContext.closePath();
		imageContext.clip();

		// first we draw the image resized and clipped (to be rounded)
		imageContext.drawImage(this, (FULL_SIZE - SIZE) / 2, (FULL_SIZE - SIZE) / 2, SIZE, SIZE);

		fixedImage.onload = function onImageLoad() {
		    // shadow
			self.context.shadowOffsetX = 0;
			self.context.shadowOffsetY = SHADOW_OFFSET;
			self.context.shadowBlur = SHADOW_BLUR;
			self.context.shadowColor = 'rgba(0, 0, 0, 0.6)';
		    self.context.drawImage(fixedImage, (self.canvas.width - FULL_SIZE) / 2, 0);
		    self.finalizeIcon();
		};

		fixedImage.src = elImageCanvas.toDataURL('image/png');
	};
};

Evme.CloudAppResult.prototype = Object.create(Evme.Result.prototype);
Evme.CloudAppResult.prototype.constructor = Evme.CloudAppResult;


Evme.CloudAppsRenderer = function Evme_CloudAppsRenderer() {
	var NAME = 'CloudAppsRenderer',
		self = this,
		containerEl,
		lastRenderedResults = {}, // app.id -> Result instance
		lastSignature = Evme.Utils.EMPTY_APPS_SIGNATURE,
		iconFormat = Evme.Utils.getIconsFormat(),	
		defaultIconIndex = 0,

		DEFAULT_ICON_URLS = Evme.Config.design.apps.defaultIconUrl[Evme.Utils.ICONS_FORMATS.Large];


	this.init = function init(cfg) {
		containerEl = cfg.containerEl;
	};

	this.renderWebSearch = function render(query) {
		var icon = {
			"MIMEType": "image/png",
			"data": "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"
		},
		result = new Evme.CloudAppResult(),
		el = result.init({
			"name": "Top Websites",
			"icon": icon,
			"appUrl": "http://www.google.com/search?q=" + query
		}, {"animate": false});
		result.draw(icon);

		containerEl.appendChild(el);

	}

	this.render = function render(apps, pageNum, missingIconsCb, query) {
		if (!apps.length) return;

		var	newSignature = Evme.Utils.getAppsSignature(apps);

		// if same apps as last - do nothing
		if (lastSignature === newSignature) {
			Evme.Utils.log("CloudAppsRenderer: nothing to render (signature match)");
			return;
		}
		lastSignature = newSignature;

		// if not "loaded more", clear current results
		if (pageNum === 0) {
			self.clear();
			self.renderWebSearch(query);
		}

		_render(apps, missingIconsCb);
	};

	this.clear = function clear() {
		containerEl.innerHTML = '';
    lastRenderedResults = {};
    lastSignature = Evme.Utils.EMPTY_APPS_SIGNATURE;
		defaultIconIndex = 0;
	};

	/*
		data = [{ id: id, icon: {} }, ... ]
	*/
	this.updateIcons = function updateIcons(data) {
		for (var i=0, entry; entry=data[i++];){
		  var result = lastRenderedResults[entry.id];
		  result && result.draw(entry.icon);
		}
	};

	this.getResultCount = function getResultCount() {
		return containerEl.childElementCount;
	};

	function _render(apps, missingIconsCb){
		var docFrag = document.createDocumentFragment(),
			noIconAppIds = [];  // ids of apps received without an icon

		for (var i = 0, app; app = apps[i++];) {
			var result = new Evme.CloudAppResult(),
					el = result.init(app);

			if (app.icon) {  // app with icon url from API response
				result.draw(app.icon);
				Evme.IconManager.add(app.id, app.icon, iconFormat);

			} else if (isWebLink(app)) {  // generate id
				app.id = 'app-' + Evme.Utils.uuid();
				app.icon = getDefaultIcon();
				result.draw(app.icon);

			} else {  // icon will be drawn from cache (or requested if missing)
				noIconAppIds.push(app.id);
			}

			lastRenderedResults[app.id] = result;

			docFrag.appendChild(el);
		}

		containerEl.appendChild(docFrag);

		noIconAppIds.length && getCachedIconsAsync(noIconAppIds, missingIconsCb);
	}

	function getCachedIconsAsync(appIds, missingIconsCb) {
		var idsMissing = [], // ids of apps which have no cached icon
			pendingRequests = appIds.length;

		for (var i=0, appId; appId=appIds[i++];) {
			_getCachedIcon(appId);
		}

		// wrapped in function to create new scope (with correct value of appId)
		function _getCachedIcon(appId) {
			Evme.IconManager.get(appId, function onIconFromCache(iconFromCache) {
				// make sure app still appears in results
				var app = lastRenderedResults[appId];
				if (!app) { return }

				if (iconFromCache) {
					app.icon = iconFromCache;
					app.draw(iconFromCache);
				} else {
					idsMissing.push(appId);
					app.draw(getDefaultIcon());
				}

				pendingRequests--;

				// all cache requests returned - request missing icons
				if (pendingRequests === 0) {
					idsMissing.length && missingIconsCb(idsMissing);
				}
			});
		}

	}

	function isWebLink(app){
		// apps that are not indexed by E.me (web links)
		// or missing id for some reason
		return app.isWebLink || app.type === Evme.RESULT_TYPE.WEBLINK || !app.id;
	}

	function getDefaultIcon() {
		var defaultIcon = DEFAULT_ICON_URLS[defaultIconIndex];
		defaultIconIndex = (defaultIconIndex + 1) % DEFAULT_ICON_URLS.length;
		return defaultIcon;
	}
};
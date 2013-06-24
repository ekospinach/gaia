MARKET_BADGE_ICON = (Evme.Utils.devicePixelRatio > 1)? "/everything.me/images/market/badge@2x.png" : "/everything.me/images/market/badge.png";

Evme.MarketResult = function Evme_MarketResult(slug) {
	Evme.Result.call(this);

	var self = this;

	this.type = Evme.RESULT_TYPE.MARKET;
	this.slug = slug;

	// add market badge
	this.iconPostRendering = function MarketResult_iconPostRendering(iconCanvas){
		this.context.drawImage(this.marketBadge, 0, iconCanvas.height - this.marketBadge.height);
	}
}
Evme.MarketResult.prototype = Object.create(Evme.Result.prototype);
Evme.MarketResult.prototype.constructor = Evme.Evme_MarketResult;

Evme.MarketResult.prototype.marketBadge = new Image();
Evme.MarketResult.prototype.marketBadge.src = MARKET_BADGE_ICON;


Evme.MarketAppsRenderer = function Evme_MarketAppsRenderer() {
	var NAME = 'MarketAppsRenderer',
		DEFAULT_ICON = Evme.Utils.getDefaultAppIcon,

		lastSignature = Evme.Utils.EMPTY_APPS_SIGNATURE,
		self = this,
		containerEl;


	this.init = function init(cfg) {
		// container in which to render apps in
		containerEl = cfg.containerEl;
	};

	this.render = function render(apps, pageNum) {
		if (!apps.length) {
			this.clear();
			return;
		}

		var newSignature = Evme.Utils.getAppsSignature(apps);
		if (lastSignature === newSignature) {
			Evme.Utils.log("MarketAppsRenderer: nothing to render (signature match)");
			return;
		}
		lastSignature = newSignature;

		// always renders the first page - clear previous results
		self.clear();

		_render(apps);
	};

	this.clear = function clear() {
		containerEl.innerHTML = '';
		lastSignature = Evme.Utils.EMPTY_APPS_SIGNATURE;
	};

	this.getResultCount = function getResultCount() {
		return containerEl.childElementCount;
	};

	function _render(apps) {
		var docFrag = document.createDocumentFragment();

		for (var i = 0, app; app = apps[i++];) {
			var result = new Evme.MarketResult(app.slug),
				el = result.init(app);

			app.icon = app.icon || DEFAULT_ICON;
			result.draw(app.icon);

			docFrag.appendChild(el);
		}

		containerEl.appendChild(docFrag);
	}
};
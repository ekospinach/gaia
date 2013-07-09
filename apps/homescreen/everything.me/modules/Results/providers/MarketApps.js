Evme.MarketResult = function Evme_MarketResult(slug) {
	Evme.Result.call(this);

	var self = this,
		TEXT_HEIGHT = Evme.Utils.APPS_FONT_SIZE * 3,
		TEXT_WIDTH = 72 * Evme.Utils.devicePixelRatio,
		TEXT_MARGIN = 6 * Evme.Utils.devicePixelRatio,

		FONT_SIZE = 11 * Evme.Utils.devicePixelRatio;

	this.type = Evme.RESULT_TYPE.MARKET;
	this.slug = slug;

	// @override
	this.initIcon = function initIcon(baseHeight, textOffset) {
		this.canvas.width = TEXT_WIDTH;
		this.canvas.height = baseHeight + TEXT_MARGIN + (2 * TEXT_HEIGHT) - 1;
		Evme.Utils.writeTextToCanvas({
			"text": "Download",
			"context": this.context,
			"offset": textOffset + TEXT_MARGIN,
			"fontSize": FONT_SIZE
		});

		Evme.Utils.writeTextToCanvas({
			"text": this.app.name,
			"context": this.context,
			"offset": textOffset + TEXT_MARGIN + FONT_SIZE + 1 * Evme.Utils.devicePixelRatio
		});
	};
}

Evme.MarketResult.prototype = Object.create(Evme.Result.prototype);
Evme.MarketResult.prototype.constructor = Evme.Evme_MarketResult;

Evme.MarketResult.prototype.marketBadge = new Image();
Evme.MarketResult.prototype.marketBadge.src = Evme.Utils.getMarketBadgeIcon();


Evme.MarketAppsRenderer = function Evme_MarketAppsRenderer() {
	var NAME = 'MarketAppsRenderer',
		DEFAULT_ICON = Evme.Utils.getDefaultAppIcon(),

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
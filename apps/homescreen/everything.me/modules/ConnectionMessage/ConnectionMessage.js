Evme.ConnectionMessage = new function Evme_ConnectionMessage() {
    var NAME = "ConnectionMessage",
	self = this,
	elParent = null,

	CLASS_NO_CONNECTION = "connection-error",
	SELECTOR_CONNECTION_MESSAGE = '[role="notification"].connection-message div span';

    this.init = function init(options) {
        !options && (options = {});
	elParent = options.elParent;
        Evme.EventHandler.trigger(NAME, "init");
    };

    this.show = function show(l10nKey, l10nArgs) {
	var elements = Evme.$(SELECTOR_CONNECTION_MESSAGE),
	    msg = Evme.Utils.l10n(NAME, l10nKey, l10nArgs);;

	for (var i = 0, el; el = elements[i++];) {
	    el.innerHTML = msg;
        }

	elParent.classList.add(CLASS_NO_CONNECTION);

	Evme.EventHandler.trigger(NAME, "show");
    };

    this.hide = function hide() {
	elParent.classList.remove(CLASS_NO_CONNECTION);

        Evme.EventHandler.trigger(NAME, "hide");
    };
};
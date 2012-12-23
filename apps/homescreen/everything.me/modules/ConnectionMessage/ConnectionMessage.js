Evme.ConnectionMessage = new function Evme_ConnectionMessage() {
    var NAME = "ConnectionMessage", self = this,
        
        CLASS_NO_CONNECTION = "connection-error",
        DEFAULT_MESSAGE = "FROM CONFIG";
    
    this.init = function init(options) {
        !options && (options = {});
        
        DEFAULT_MESSAGE = options.texts.defaultMessage;
        
        Evme.EventHandler.trigger(NAME, "init");
    };
    
    this.show = function show(message, elParent) {
        !message && (message = DEFAULT_MESSAGE);
        
        var el = Evme.$('.connection-message', elParent);
        if (el.length > 0) {
            el = el[0];
            el.innerHTML = message;
        } else {
            el = Evme.$create('div', {'class': "connection-message"}, message);
            elParent.appendChild(el);
        }
        
        el.style.cssText = "margin-top: " + (-el.offsetHeight/2) + "px";
        elParent.classList.add(CLASS_NO_CONNECTION);
        
        Evme.EventHandler.trigger(NAME, "show");
    };
    
    this.hide = function hide() {
        var elMessages = Evme.$('.connection-message');
        for (var i=0,el=elMessages[i]; el; el=elMessages[++i]) {
            el.parentNode.classList.remove(CLASS_NO_CONNECTION);
            Evme.$remove(el);
        }
        
        Evme.EventHandler.trigger(NAME, "hide");
    };
};
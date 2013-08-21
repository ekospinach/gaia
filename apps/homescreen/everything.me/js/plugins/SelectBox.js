(function(){
  "use strict";

    function SelectBox() {
        var self = this,
            elList, callback;

        this.init = function init(cfg) {
            callback = cfg.callback;

            ProgressIndicator.show();

            elList = Evme.$create('select', {'multiple': 'multiple'});
            elList.addEventListener('blur', onBlur);

            cfg.id && (elList.id = cfg.id);

            Evme.Utils.getContainer().appendChild(elList);
        };

        // expects an array of variables
        // or objects with text an return (can be an object)
        this.load = function load(arr) {
            var docFrag = document.createDocumentFragment();
            for (var i=0,item; item=arr[i++];) {
                var el = document.createElement("option");
                el.return = item.return || item.text || item;
                el.innerHTML = item.text || item;
                docFrag.appendChild(el);
            };
            elList.appendChild(docFrag);

            elList.focus();
            ProgressIndicator.hide();
        };

        var ProgressIndicator = new function ProgressIndicator() {
            var NAME = 'CollectionSuggest',
                active = false,
                el;

            this.show = function show() {
                if (active) return;

                el = Evme.$create('form',
                            {'role': 'dialog', 'data-type': 'confirm', 'class': 'evme-progress-dialog'},
                            '<section>' +
                                '<h1 ' + Evme.Utils.l10nAttr(NAME, 'loading') + '></h1>' +
                                '<p class="noreset">' +
                                    '<progress></progress>' +
                                '</p>' +
                            '</section>' +
                            '<menu>' +
                                '<button ' + Evme.Utils.l10nAttr(NAME, 'loading-cancel') + ' class="full"></button>' +
                            '</menu>');

                Evme.$("button", el, function onItem(elButton) {
                    elButton.addEventListener("click", cancel);
                });

                Evme.Utils.getContainer().appendChild(el);

                active = true;
            };

            this.hide = function loadingHide() {
                if (!active) return;

                Evme.$remove(el);
                active = false;
            };

            function cancel() {
                hide();
            };
        };

        function hide() {
            ProgressIndicator.hide();

            elList.blur();
            Evme.$remove(elList);

            window.focus();
        }

        function onBlur(e) {
            var selected = getSelected();
            hide();
            callback && callback(selected);
        }

        function getSelected() {
            var selectedItems = [],
                items = Evme.$('option', elList);

            for (var i=0, elItem; elItem=items[i++];) {
                if (elItem.selected) {
                    selectedItems.push(elItem.return);
                }
            }

            return selectedItems;
        }
    }

    Evme.SelectBox = SelectBox;

}());
(function() {

  'use strict';

  function Suggestions() {
    this.name = 'Suggestions';
  }

  Suggestions.prototype = {

    init: function(config) {
      var self = this;

      this.container = config.container;
      this.container.addEventListener('click', this.click);

      // uses connection opened by eme.js
    },

    click: function(e) {
      var suggestion = e.target && e.target.dataset.suggestion;
      if (suggestion) {
        Search.onSuggestionSelected(suggestion);
      }
    },

    search: function(input, type) {
      this.clear();
    },

    clear: function() {
      this.container.innerHTML = '';
    },

    onmessage: function(msg) {
      var data = msg.data;
      if (!data) {
        return;
      }

      var suggestions = data.suggestions;
      if (suggestions) {
        var ul = document.createElement('ul');

        suggestions.forEach(function render(searchSuggestion) {
          var li = document.createElement('li');
          li.dataset.suggestion = li.textContent = searchSuggestion.text;
          ul.appendChild(li);
        });

        this.container.appendChild(ul);
      }
    }

  };

  Search.provider(new Suggestions());

}());

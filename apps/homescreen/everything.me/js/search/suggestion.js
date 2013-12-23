(function() {
  'use strict';

  function SearchSuggestion(data) {
    this.query = data.query;
    this.annotated = data.annotated;
    this.text = this.annotated.replace('[' + this.query + ']', this.query);
  };

  SearchSuggestion.prototype = {

  };

  Evme.SearchSuggestion = SearchSuggestion;
})();

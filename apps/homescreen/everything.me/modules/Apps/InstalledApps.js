Evme.InstalledApps = new function() {
  var NAME = "InstalledApps",
      appIndex = {}, APP_INDEX_STORAGE_KEY = NAME+"-app-index",
      queryIndex = {}, QUERY_INDEX_STORAGE_KEY = NAME+"-query-index";

  this.init = function init() {
    // get appIndex
    Evme.Storage.get(APP_INDEX_STORAGE_KEY, function appIndexCb(appIndexFromStorage) {
      if (appIndexFromStorage) {
        appIndex = appIndexFromStorage;
        // get queryIndex
        Evme.Storage.get(QUERY_INDEX_STORAGE_KEY, function queryIndexCb(queryIndexFromStorage) {
          if (queryIndexFromStorage) {
            queryIndex = queryIndexFromStorage;
          } else {
            createQueryIndex();
          }
        });
      } else {
        createAppIndex();
        createQueryIndex();
      }
    });
  };

  this.addApp = function addApp(data) {

  };

  this.removeApp = function removeApp() {

  };

  this.search = function search(query) {
    var matchingApps = [];

    // search appIndex
    // search query within first letters of app name words
    var regex = new RegExp('\\b'+query, 'i');
    for (var id in appIndex) {
      var match = appIndex[i].name.test(regex);
      if (match) {
        matchingApps.push(appIndex[i]);
      }
    }

    // search query
    // search for only exact query match
    if (query in queryIndex) {
      var appIds = queryIndex[query];
      for (var i=0,len=appIds.length; i<len; i++) {
        var appId = appIds[i];
        if (matchingApps.indexOf(appId) === -1) {
          matchingApps.push(appId);
        }
      }
    }

    Evme.Utils.log(NAME, "search", matchingApps);

    return matchingApps;
  };

  this.createQueryIndex = function createQueryIndex(appsInfo) {
    queryIndex = {};

    for (var id in appsInfo) {
      // queries is a comprised of tags and experiences
      var data = appsInfo[id],
          queries = (data.tags || []).concat(data.experiences || []);
          // TODO: concat deduping

      // populate queryIndex
      for (var i=0,query; query=queries[i++];) {
        if (!(query in queryIndex)) {
          queryIndex[query] = [];
        }
        queryIndex[query].push(id);
      }
    }

    Evme.Storage.set(QUERY_INDEX_STORAGE_KEY, queryIndex);

    Evme.Utils.log(NAME, "onAppsInfo", queryIndex);
  };

  function requestAppsInfo() {
    Evme.EventHandler.trigger(NAME, "requestAppsInfo", {
      "appIndex": appIndex
    });
  }

  function createAppIndex() {
    // get all apps on grid
    var allApps = Evme.Utils.sendToOS(Evme.Utils.OSMessages.GET_ALL_APPS);

    appIndex = {};

    for (var i=0; i<allApps.length; i++) {
      var app = allApps[i];

      // no bookmarks, only packages/hosted
      if (app.isBookmark) { return; }

      var id = app.origin;
      appIndex[id] = {
        'name': Evme.Utils.sendToOS(Evme.Utils.OSMessages.GET_APP_NAME, app),
        'url': app.origin,
        'icon': Evme.Utils.sendToOS(Evme.Utils.OSMessages.GET_APP_ICON, app)
      };
    }

    Evme.Storage.set(APP_INDEX_STORAGE_KEY, appIndex);

    Evme.Utils.log(NAME, "populateAppIndex", appIndex);
  }
};
Evme.InstalledApps = new function() {
  var NAME = "InstalledApps",
      appIndex = {}, APP_INDEX_STORAGE_KEY = NAME+"-app-index",
      queryIndex = {}, QUERY_INDEX_STORAGE_KEY = NAME+"-query-index";

  this.init = function init() {
    window.addEventListener('onAppInstalled', onAppInstallChanged);
    window.addEventListener('onAppUninstalled', onAppInstallChanged);

    // get appIndex
    Evme.Storage.get(APP_INDEX_STORAGE_KEY, function appIndexCb(appIndexFromStorage) {
      if (appIndexFromStorage) {
        appIndex = appIndexFromStorage;
        // get queryIndex
        Evme.Storage.get(QUERY_INDEX_STORAGE_KEY, function queryIndexCb(queryIndexFromStorage) {
          if (queryIndexFromStorage) {
            queryIndex = queryIndexFromStorage;
          } else {
            requestAppsInfo();
          }
        });
      } else {
        createAppIndex();
        requestAppsInfo();
      }
    });
  };

  this.search = function search(query) {
    var matchingApps = [];

    // search appIndex
    // search query within first letters of app name words
    var regex = new RegExp('\\b'+query, 'i');
    for (var id in appIndex) {
      // if there's a match, add to matchingApps
      if (appIndex[i].name.test(regex)) {
        matchingApps.push(appIndex[i]);
      }
    }

    // search query
    // search for only exact query match
    if (query in queryIndex) {
      for (var i=0,appId; appId=queryIndex[query][i++];) {
        matchingApps.push(appIds[i]);
      }
    }

    matchingApps = Evme.Utils.unique(matchingApps);

    Evme.Utils.log(NAME, "search", matchingApps);

    return matchingApps;
  };

  this.createQueryIndex = function createQueryIndex(appsInfo) {
    queryIndex = {};

    for (var id in appsInfo) {
      // queries is a comprised of tags and experiences
      var data = appsInfo[id],
          queries = Evme.Utils.unique(data.tags, data.experiences);

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

  function onAppInstallChanged(e) {
    var app = e.data.application;
    if (app.isBookmark) { return; }

    // redo process
    createAppIndex();
    requestAppsInfo();
  }

  function requestAppsInfo() {
    Evme.EventHandler.trigger(NAME, "requestAppsInfo", {
      "appIndex": appIndex
    });
  }

  function createAppIndex() {
    // empty current index
    appIndex = {};

    // get all apps on grid
    var allApps = Evme.Utils.sendToOS(Evme.Utils.OSMessages.GET_ALL_APPS);

    for (var i=0,app; app=allApps[i++];) {

      // filter bookmarks
      if (app.isBookmark) { break; }
      
      var appInfo = Evme.Utils.sendToOS(Evme.Utils.OSMessages.GET_APP_INFO, app);
      if (appInfo.id) {
        appIndex[appInfo.id] = appInfo;  
      }
    }

    Evme.Storage.set(APP_INDEX_STORAGE_KEY, appIndex);

    Evme.Utils.log(NAME, "populateAppIndex", appIndex);
  }
};
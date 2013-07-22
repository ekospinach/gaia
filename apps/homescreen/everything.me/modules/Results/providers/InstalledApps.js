Evme.InstalledAppResult = function Evme_InstalledAppResult() {
  Evme.Result.call(this);
  this.type = Evme.RESULT_TYPE.INSTALLED;
}
Evme.InstalledAppResult.prototype = Object.create(Evme.Result.prototype);
Evme.InstalledAppResult.prototype.constructor = Evme.InstalledAppResult;

/*
  Renders installed apps
*/
Evme.InstalledAppsRenderer = function Evme_InstalledAppsRenderer() {
  var NAME = "InstalledAppsRenderer",
    DEFAULT_ICON = Evme.Utils.getDefaultAppIcon(),
    self = this,
    containerEl,
    appsSignature = Evme.Utils.EMPTY_APPS_SIGNATURE;

  this.init = function init(cfg) {
    containerEl = cfg.containerEl;
  };

  this.render = function render(data) {
    var apps = Evme.InstalledAppsService.getMatchingApps(data),
      newSignature = Evme.Utils.getAppsSignature(apps);

    if (!apps || !apps.length) {
      self.clear();
      return;
    }

    if (appsSignature === newSignature) {
      Evme.Utils.log("InstalledAppsRenderer: nothing new to render (signatures match)");

    } else {
      self.clear();
      renderDocFrag(apps);
      appsSignature = newSignature;
    }
  };

  this.clear = function clear() {
    containerEl.innerHTML = '';
    appsSignature = Evme.Utils.EMPTY_APPS_SIGNATURE;
  };

  this.getResultCount = function getResultCount() {
    return containerEl.childElementCount;
  };

  function renderDocFrag(apps) {
    var docFrag = document.createDocumentFragment();
    for (var i = 0, app; app = apps[i++];) {
      var result = new Evme.InstalledAppResult(),
        el = result.init(app);

      result.draw(app.icon || DEFAULT_ICON);
      docFrag.appendChild(el);
    }
    containerEl.appendChild(docFrag);
  }
};

/*
Responsible for maintaining app indexes

App index - list of apps installed on device, including apps and bookmarks but *excluding* folders
[
  {app id}: {
    "name": {display name},
    "icon": {HTML element},
    "appUrl": {app url}
  },
  ...
]

 Query index - a mapping from experience name to app ids (manifestURLs or bookmarkURLs)
{
  "music": ["manifestURL1", "bookmarkURL1"],
  "top apps": ["manifestURL2", "bookmarkURL2"],
  "radio": ["manifestURL3", "bookmarkURL3"],
  ...
}
*/
Evme.InstalledAppsService = new function Evme_InstalledAppsService() {
  var NAME = "InstalledAppsService",
    self = this,
    appIndex = {}, APP_INDEX_STORAGE_KEY = NAME + "-app-index",
    queryIndex = {}, QUERY_INDEX_STORAGE_KEY = NAME + "-query-index";

  // TODO: only for testing
  this._loadFixtures = function _loadFixtures() {
    appIndex = Evme.Fixtures.appIndex;
    self.requestAppsInfo();
  }
  this._getIndexes = function debug_getIndexes() {
    return {appIndex: appIndex, queryIndex: queryIndex}
  }

  this.init = function init() {
    // create indexes
    createAppIndex();
    createQueryIndex();

    // listeners
    window.addEventListener('appInstalled', onAppInstallChanged);
    window.addEventListener('appUninstalled', onAppInstallChanged);
  }

  this.requestAppsInfo = function requestAppsInfo() {
    Evme.EventHandler.trigger(NAME, "requestAppsInfo", {
      "appIndex": appIndex
    });
  };

  this.requestAppsInfoCb = function requestAppsInfoCb(appsInfoFromAPI) {
    queryIndex = {};

    for (var k in appsInfoFromAPI) {
      var appInfo = appsInfoFromAPI[k];

      // verify that the app info relates to an existing one in the appIndex
      var idInAppIndex = appInfo.guid;
      if (!(idInAppIndex in appIndex)) {
        continue;
      }

      // Store the marketplace api slug, in order to compare and dedup Marketplace app suggestions later on
      appIndex[idInAppIndex].slug = appInfo.nativeId;

      // queries is comprised of tags and experiences
      var tags = appInfo.tags || [],
        experiences = appInfo.experiences || [],
        queries = Evme.Utils.unique(tags.concat(experiences));

      // populate queryIndex
      for (var i = 0, query; query = queries[i++];) {
        query = normalizeQuery(query);
        if (!(query in queryIndex)) {
          queryIndex[query] = [];
        }
        queryIndex[query].push(idInAppIndex);
      }
    }

    Evme.Storage.set(QUERY_INDEX_STORAGE_KEY, queryIndex);
    Evme.EventHandler.trigger(NAME, "queryIndexUpdated");
  };

  this.getMatchingApps = function getMatchingApps(data) {
    if (!data || !data.query) {
      return [];
    }

    var matchingApps = [],
      query = normalizeQuery(data.query);

    // search appIndex
    // search query within first letters of app name words
    // TODO FIXME throws SyntaxError if query contains '/'
    var regex = new RegExp('\\b' + query, 'i');
    for (var appId in appIndex) {
      // if there's a match, add to matchingApps
      var app = appIndex[appId];
      if ("name" in app && regex.test(app.name)) {
        matchingApps.push(app);
      }
    }

    // search query
    // search for only exact query match
    if (query in queryIndex) {
      for (var i = 0, appId; appId = queryIndex[query][i++];) {
        if (appId in appIndex) {
          var app = appIndex[appId];
          matchingApps.push(app);
        }
      }
    }

    matchingApps = Evme.Utils.unique(matchingApps, 'id');

    return matchingApps;
  };

  this.getMatchingQueries = function getMatchingQueries(appId) {
    var queries = [];
    
    if (!appId) {
      return queries;
    }

    for (query in queryIndex) {
      (queryIndex[query].indexOf(appId) > -1) && queries.push(query);
    }

    return queries;
  };

  this.getAppById = function getAppById(appId) {
    return (appId in appIndex) && appIndex[appId];
  };

  this.getApps = function() {
    return appIndex;
  };

  this.getSlugs = function getAPIIds() {
    var ids = [];
    for (var id in appIndex) {
      var app = appIndex[id];
      app.slug && ids.push(app.slug);
    }
    return ids;
  };

  function onAppInstallChanged(e) {
    var app = e.detail.application;

    // redo process
    createAppIndex();
    self.requestAppsInfo();
  }

  function createAppIndex() {
    // empty current index and create a new one
    appIndex = {};

    var gridApps = Evme.Utils.sendToOS(Evme.Utils.OSMessages.GET_ALL_APPS);

    for (var i = 0, app; app = gridApps[i++];) {
      var appInfo = Evme.Utils.sendToOS(Evme.Utils.OSMessages.GET_APP_INFO, app);
      if (appInfo) {
        appIndex[appInfo.id] = appInfo;
      }
    }
  }

  function createQueryIndex() {
    Evme.Storage.get(QUERY_INDEX_STORAGE_KEY, function queryIndexCb(queryIndexFromStorage) {
      if (queryIndexFromStorage) {
        queryIndex = queryIndexFromStorage;
      } else {
        self.requestAppsInfo();
      }
    });
  }
  
  function normalizeQuery(query) {
    return query.toLowerCase();
  }
};
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
    DEFAULT_ICON = Evme.Utils.getDefaultAppIcon,
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

  // update does nothing
  this.update = Evme.Utils.NOOP;

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

App index - list of apps installed on device
[
  {app id}: {
    "name": {display name},
    "icon": {HTML element},
    "appUrl": {app url}
  },
  ...
]

 Query index - a mapping from experience name to apps
{
  "music": ["soundcloud", "mixcloud", "fm", "friends-music", ...],
  "top apps": ["soundcloud", "fm"],
  "radio": ["fm", "mixcloud"],
  ...
}
*/
Evme.InstalledAppsService = new function Evme_InstalledAppsService() {
  var NAME = "InstalledAppsService",
    self = this,
    appIndex = {}, APP_INDEX_STORAGE_KEY = NAME + "-app-index",
    queryIndex = {}, QUERY_INDEX_STORAGE_KEY = NAME + "-query-index";

  this.init = function init() {
    // create indexes
    createAppIndex();
    createQueryIndex();

    // listeners
    window.addEventListener('onAppInstalled', onAppInstallChanged);
    window.addEventListener('onAppUninstalled', onAppInstallChanged);
  }

  this.requestAppsInfoCb = function requestAppsInfoCb(appsInfoFromAPI) {
    queryIndex = {};

    for (var k in appsInfoFromAPI) {
      var appInfo = appsInfoFromAPI[k];

      // verify that the app info relates to an existing one in the appIndex
      var idInAppIndex = appInfo.guid;
      if (!(idInAppIndex in appIndex)) { continue; }

      // Store the marketplace api slug, in order to compare and dedup Marketplace app suggestions later on
      appIndex[idInAppIndex].slug = appInfo.nativeId;

      // queries is comprised of tags and experiences
      var queries = Evme.Utils.unique(appInfo.tags, appInfo.experiences);
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

    Evme.Utils.log(NAME, "requestAppsInfoCb", queryIndex);
  };

  this.getMatchingApps = function getMatchingApps(data) {
    if (!data || !data.query) { return []; }

    var matchingApps = [],
      query = normalizeQuery(data.query);

    // search appIndex
    // search query within first letters of app name words
    // TODO FIXME
    // throws 'SyntaxError: trailing \ in regular expression' if query contains '/'
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

    matchingApps = Evme.Utils.unique(matchingApps);

    return matchingApps;
  };

  this.requestAppsInfo = function requestAppsInfo() {
    Evme.EventHandler.trigger(NAME, "requestAppsInfo", {
      "appIndex": appIndex
    });
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
    if (app.isBookmark) { return; }

    // redo process
    createAppIndex();
    self.requestAppsInfo();
  }

  function createAppIndex() {
    // empty current index
    appIndex = {};

    // get all apps on grid
    var allApps = Evme.Utils.sendToOS(Evme.Utils.OSMessages.GET_ALL_APPS);

    for (var i = 0, app; app = allApps[i++];) {
      if (app.isBookmark) {
	continue; // skip bookmarks
      }

      var appInfo = Evme.Utils.sendToOS(Evme.Utils.OSMessages.GET_APP_INFO, app);
      if (!appInfo.id) {
	appInfo.id = Evme.Utils.uuid();
      }

      appInfo.id = cleanAppId(appInfo.id)

      appIndex[appInfo.id] = appInfo;
    }

    // TOOD: mock data - remove when done debugging
    if (!allApps.length) {
      Evme.Utils.log("AppIndex: using test data");
      appIndex = {"http://browser.gaiamobile.org:8080/manifest.webapp":{"id":"http://browser.gaiamobile.org:8080/manifest.webapp","name":"Browser","appUrl":"http://browser.gaiamobile.org:8080","icon":{}},"http://calendar.gaiamobile.org:8080/manifest.webapp":{"id":"http://calendar.gaiamobile.org:8080/manifest.webapp","name":"Calendar","appUrl":"http://calendar.gaiamobile.org:8080","icon":{}},"http://camera.gaiamobile.org:8080/manifest.webapp":{"id":"http://camera.gaiamobile.org:8080/manifest.webapp","name":"Camera","appUrl":"http://camera.gaiamobile.org:8080","icon":{}},"http://clock.gaiamobile.org:8080/manifest.webapp":{"id":"http://clock.gaiamobile.org:8080/manifest.webapp","name":"Clock","appUrl":"http://clock.gaiamobile.org:8080","icon":{}},"http://communications.gaiamobile.org:8080/manifest.webapp":{"id":"http://communications.gaiamobile.org:8080/manifest.webapp","name":"Communications","appUrl":"http://communications.gaiamobile.org:8080"},"http://costcontrol.gaiamobile.org:8080/manifest.webapp":{"id":"http://costcontrol.gaiamobile.org:8080/manifest.webapp","name":"Usage","appUrl":"http://costcontrol.gaiamobile.org:8080","icon":{}},"http://email.gaiamobile.org:8080/manifest.webapp":{"id":"http://email.gaiamobile.org:8080/manifest.webapp","name":"E-Mail","appUrl":"http://email.gaiamobile.org:8080","icon":{}},"http://fm.gaiamobile.org:8080/manifest.webapp":{"id":"http://fm.gaiamobile.org:8080/manifest.webapp","name":"FM Radio","appUrl":"http://fm.gaiamobile.org:8080","icon":{}},"http://gallery.gaiamobile.org:8080/manifest.webapp":{"id":"http://gallery.gaiamobile.org:8080/manifest.webapp","name":"Gallery","appUrl":"http://gallery.gaiamobile.org:8080","icon":{}},"http://music.gaiamobile.org:8080/manifest.webapp":{"id":"http://music.gaiamobile.org:8080/manifest.webapp","name":"Music","appUrl":"http://music.gaiamobile.org:8080","icon":{}},"http://settings.gaiamobile.org:8080/manifest.webapp":{"id":"http://settings.gaiamobile.org:8080/manifest.webapp","name":"Settings","appUrl":"http://settings.gaiamobile.org:8080","icon":{}},"http://sms.gaiamobile.org:8080/manifest.webapp":{"id":"http://sms.gaiamobile.org:8080/manifest.webapp","name":"Messages","appUrl":"http://sms.gaiamobile.org:8080","icon":{}},"http://video.gaiamobile.org:8080/manifest.webapp":{"id":"http://video.gaiamobile.org:8080/manifest.webapp","name":"Video","appUrl":"http://video.gaiamobile.org:8080","icon":{}},"http://ds-test.gaiamobile.org:8080/manifest.webapp":{"id":"http://ds-test.gaiamobile.org:8080/manifest.webapp","name":"Device Storage Test","appUrl":"http://ds-test.gaiamobile.org:8080","icon":{}},"http://geoloc.gaiamobile.org:8080/manifest.webapp":{"id":"http://geoloc.gaiamobile.org:8080/manifest.webapp","name":"Geoloc","appUrl":"http://geoloc.gaiamobile.org:8080","icon":{}},"http://image-uploader.gaiamobile.org:8080/manifest.webapp":{"id":"http://image-uploader.gaiamobile.org:8080/manifest.webapp","name":"Image Uploader","appUrl":"http://image-uploader.gaiamobile.org:8080","icon":{}},"http://membuster.gaiamobile.org:8080/manifest.webapp":{"id":"http://membuster.gaiamobile.org:8080/manifest.webapp","name":"Membuster","appUrl":"http://membuster.gaiamobile.org:8080","icon":{}},"http://share-receiver.gaiamobile.org:8080/manifest.webapp":{"id":"http://share-receiver.gaiamobile.org:8080/manifest.webapp","name":"Share Receiver","appUrl":"http://share-receiver.gaiamobile.org:8080","icon":{}},"http://template.gaiamobile.org:8080/manifest.webapp":{"id":"http://template.gaiamobile.org:8080/manifest.webapp","name":"Template","appUrl":"http://template.gaiamobile.org:8080","icon":{}},"http://test-agent.gaiamobile.org:8080/manifest.webapp":{"id":"http://test-agent.gaiamobile.org:8080/manifest.webapp","name":"Test Agent","appUrl":"http://test-agent.gaiamobile.org:8080","icon":{}},"http://test-container.gaiamobile.org:8080/manifest.webapp":{"id":"http://test-container.gaiamobile.org:8080/manifest.webapp","name":"Test Container","appUrl":"http://test-container.gaiamobile.org:8080","icon":{}},"http://test-receiver-1.gaiamobile.org:8080/manifest.webapp":{"id":"http://test-receiver-1.gaiamobile.org:8080/manifest.webapp","name":"Test receiver#1","appUrl":"http://test-receiver-1.gaiamobile.org:8080","icon":{}},"http://test-receiver-2.gaiamobile.org:8080/manifest.webapp":{"id":"http://test-receiver-2.gaiamobile.org:8080/manifest.webapp","name":"Test Receiver#2","appUrl":"http://test-receiver-2.gaiamobile.org:8080","icon":{}},"http://test-receiver-inline.gaiamobile.org:8080/manifest.webapp":{"id":"http://test-receiver-inline.gaiamobile.org:8080/manifest.webapp","name":"Test receiver (inline)","appUrl":"http://test-receiver-inline.gaiamobile.org:8080","icon":{}},"http://test-sensors.gaiamobile.org:8080/manifest.webapp":{"id":"http://test-sensors.gaiamobile.org:8080/manifest.webapp","name":"Test Sensors","appUrl":"http://test-sensors.gaiamobile.org:8080","icon":{}},"http://testpermission.gaiamobile.org:8080/manifest.webapp":{"id":"http://testpermission.gaiamobile.org:8080/manifest.webapp","name":"Permissions Test","appUrl":"http://testpermission.gaiamobile.org:8080","icon":{}},"http://uitest.gaiamobile.org:8080/manifest.webapp":{"id":"http://uitest.gaiamobile.org:8080/manifest.webapp","name":"UI tests","appUrl":"http://uitest.gaiamobile.org:8080","icon":{}},"http://crystalskull.gaiamobile.org:8080/manifest.webapp":{"id":"http://crystalskull.gaiamobile.org:8080/manifest.webapp","name":"CrystalSkull","appUrl":"http://crystalskull.gaiamobile.org:8080","icon":{}},"http://cubevid.gaiamobile.org:8080/manifest.webapp":{"id":"http://cubevid.gaiamobile.org:8080/manifest.webapp","name":"CubeVid","appUrl":"http://cubevid.gaiamobile.org:8080","icon":{}},"http://twittershare.gaiamobile.org:8080/manifest.webapp":{"id":"http://twittershare.gaiamobile.org:8080/manifest.webapp","name":"Twitter share","appUrl":"http://twittershare.gaiamobile.org:8080","icon":{}},"https://marketplace.firefox.com/app/7eccfd71-2765-458d-983f-078580b46a11/manifest.webapp":{"id":"https://marketplace.firefox.com/app/7eccfd71-2765-458d-983f-078580b46a11/manifest.webapp","name":"HERE Maps","appUrl":"app://m.here.com","icon":{}},"https://marketplace.firefox.com/packaged.webapp":{"id":"https://marketplace.firefox.com/packaged.webapp","name":"Marketplace","appUrl":"app://marketplace.firefox.com","icon":{}},"http://hoststubtest.mykzilla.org/manifest.webapp":{"id":"http://hoststubtest.mykzilla.org/manifest.webapp","name":"HostStubTest","appUrl":"http://hoststubtest.mykzilla.org","icon":{}},"http://mochi.test:8888/manifest.webapp":{"id":"http://mochi.test:8888/manifest.webapp","name":"Mochitest","appUrl":"http://mochi.test:8888","icon":{}},"https://marketplace.firefox.com/app/47f70abc-3a9f-492b-af61-49832b24244a/manifest.webapp":{"id":"https://marketplace.firefox.com/app/47f70abc-3a9f-492b-af61-49832b24244a/manifest.webapp","name":"PackStubTest","appUrl":"app://packstubtest","icon":{}}};
      for (var id in appIndex) {
	appIndex[id].icon = {
	  "MIMEType": "image/jpg",
	  "data": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABYAFgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD1iytBCN743/8AoNRXdx5mUj+53PrRdXPmfJGfk7n1qzY2mMSSDnsPSvyVLn/c0durASxs8YkkHPYelPup+scZ+pp9zP1SM89zS2drvw8g+XsPWtrW/c0fmwIrO034eQfL2HrVi6mEY2p9/wDlU9xL5Y2p97+VV7e2MrZbO3ufWr5fZr2VLfqx2K1vamZtzZ2Z5PrVq4dbeMBQN2PlWrM7rAgAAz2FZ6QtcSHJ+ppOPsVyU9ZMLFRIXuZSSf8AeY9quSGO1h4HHYdyatSBLWEfKQOw9aynWS5m9SfyArOUVQVlrNiKzCS6m9SfyAorUWOO1hJJ47n1orP6vTj/ABnqxEVhabcSSjnsvpU9zP1SM89zUdzc9Y4zz3apLG234dx8vYetarT9zR+bGh1la78O4+XsPWo/E+sw6BoOoalMjyR2UDzuiY3EKM4GeM1fmmEY2p97+Vcn8Toi3wz8Vueg02c59flrsoQjGcaMOrVyjyK9/aPtFJ+xeGp5Pee8C/yU1k3v7SuvMuNP0PSbcdvMMkuP/HhXgwBJwBknsK07Lw/rN/8A8eOk6hc/9cbZ3/kK+2p5Tg6O0Pvb/wAxXPQNQ+PHje7JKXdlbE/88bRP/Zs1h3fxX8c3SFZPEuoIp7QsIv8A0ECorP4XeOLsAxeF9VAPQywGMf8Aj2K3NO+Bfj28dVOkxW+e893EMfkxNNQy+i/sJ/K4anp/7Mup6nrtj4gk1S/u76ZZoAr3MzSFQVfOCScV7qI0tojn8T614d+ylbtp9l4vtrnaJLe8hifacjcokBx68ivaLh3nkAAPstfJZvyUcVOUVq7W+5AU7l3uZAAD/sqKK0YoFt0LMRuxy3pRXj/VlL3qr1YitYW2/DyD5Ow9avzTiMbE+/8AyqCe4EQ2J9/+VNs4TK25s7e59a1i1T/dUt+rGixaQmVstnb3PrWJ8W2WP4XeKVHU6bMAB/u10zSLCgAAz2Fcf8VQ0nwy8VsecadMSfwrvwtqVSEI6ybX5jM74A2EDfCvw7KtvAsjQuXkEa7j+9fqcZNeobvJjwGYDsM9a8++AjrH8HPDJP8Azwf8f3r13WWlb3/lXTimqdadtZNv8xoidWmk9T/Kpo1SAof9oZPrzUuFiQ/qfWqLu006AD+IYH41yytRV3rJgeEfs6gvqPjwKCc6oOPxlr3COFYVLNjdjk+leMfs0gLfePy2BjVFGfxlr128mMp2rnb2HrW2a8tLEyqS1btb7kSVr2czHaudnYetFWoLcR/O/wB/+VFeT9WlU96o7MRTsoTM25s7O59a05JlgQKAM9hVaWdbdAqgbscLUFur3EhJP1anFqj+7hrJjLkCtPJkn6msT4tlIvhX4qUcZ06UD34qz4q8WaH4M0xbvXb1LWJjtjTBaSU+iqOT9egrw7x58d9A1/wzrWkWmn6oHvLV4IppAgUE9MjcSBXr4DCVlKM4Rb1V303Hc9T+A25/hN4aUc4gf8P3r16Su2JOT9T61538BWWP4P8Ahtjx+4fP/f167R5mmcAD6CpxUlRrTe8m3+Y0SyytK2B+ApDdWdjNGt1d20MhYcSyqh69gTmvHP2kfHeqeDdG03T9Cka2vdU8wyXa/ejjTaCqHsxLdeoA465r5Jubie7uHnupZJpnOXkkYszH1JPJr0MBlEsRD21SVr/MTZ9Q/s7PuvvHmw5VtUBGO/Mte3QwBBvf7/8AKvGv2VvD97pfhLUdSv4Ghj1GdGtlcYLIikb8ehLceuDXrl9dbspGfl7n1rzs15KeKnUk77W+SQiO+ud2UjPy9z60UW1v0klH0FFeO6E63vydhFK3R7mUkn/eatXfHbQgDp2Hcmq5eO0hAHTsO5NU1aS6m9SfyApRaw6stZsD5u/aG8P+J9S8cy6ktjeXumNDGls9vGZFiUL8ykKPl+bceeuc1xvhP4W+LPEdzGIdKuLO0yN93eRmKNB6/Ny30UE19sQ7LSLO4j1buaqyXD3Mo6n0Gc19FDPquGw8aXKuZKwFHwlo8Xh7w3pmiWjvLDZQiJWbgucksxHbJJPtXSwqIUyxGe5qvbosCEsRuxyfSqtxdGVtq52dh615DqOF6tV3kyjP8XaJpHiyxFjrlhFeWqtuQPkMrdMqwwQfoawdA+EPgnRrlbqHQoZZ1O5ftUjzqn/AWJH5g121tF5Y3P8Af/lVa8u92UjPy9z61pDFVaEHKU2r9Lv8hDry5BHlx8IOMj+X0pttB0kkH0WktoOkkg+i0y+u9uY4z83c+lcjf/L6t8kAl/d7cxxn5u59KKrWtuZTvk+52HrRWDhVr+/exJVDSXU3ufyArViEdrCST9T3NFFLDaQlV6gUpZ3uJQAOP4VrRto1t0LMw3Y5PpRRV4X3r1JasZWubozNtXITsPWrVpEIxvfG/wBPSiiqwz9pJzluBBeXm7KRn5e59aLSAcSSfgp/nRRSov21Ryn0AS+vNuY4j83c+lVrS38075PuenrRRURftqz5+gia9uhCuxMF8ce1FFFc+Irz9o0nawH/2Q=="
	}
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

  function cleanAppId(str) {
    return str.split("?")[0];
  }

  function normalizeQuery(query) {
    return query.toLowerCase();
  }
};
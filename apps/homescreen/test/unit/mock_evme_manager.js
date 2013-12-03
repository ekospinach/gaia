'use strict';

var EvmeManager = (function EvmeManager() {
  function addGridItem(params, extra) {
    // No need to implement
  }

  function removeGridItem(params) {
    // No need to implement
  }

  function openUrl(url) {
    // No need to implement
  }

  function onAppSavedToHomescreen(name) {
    // No need to implement
  }

  function statusShow(message, duration) {
    // No need to implement
  }

  function menuShow() {
    // No need to implement
  }

  function menuHide() {
    // No need to implement
  }

  function getMenuHeight() {
    return 50;
  }

  function getGridApps() {
    return [];
  }

  function getAllAppsInfo() {
    return [];
  }

  function getCollections() {
    return [];
  }

  function getCollectionNames(lowerCase) {
    return [];
  }

  function getAppByOrigin(origin) {
    return getAppInfo(icon);
  }

  function getAppByDescriptor(descriptor) {
    return getAppInfo(icon);
  }

  function getIconByDescriptor(descriptor) {
    return null;
  }

  function getAppInfo(gridApp) {
    return {
      'id': 'test-app-id',
      'name': 'test-app-name',
      'appUrl': 'test-app-url',
      'icon': 'test-app-icon',
      'isOfflineReady': false
    };
  }

  function generateAppId(manifestURL, entryPoint) {
    return 'test-app-id';
  }

  function getIconSize() {
    return 60;
  }

  function isEvmeVisible(isVisible) {
    // No need to implement
  }

  function openInstalledApp(params) {
    // No need to implement
  }

  function openCloudApp(params) {
    // No need to implement
  }

  function enableOpenCloudApp() {
    // No need to implement
  }

  function openMarketplaceApp(data) {
    // No need to implement
  }

  function openMarketplaceSearch(data) {
    // No need to implement
  }

  function setWallpaper(image) {
    // No need to implement
  }

  function setIconName(name, origin, entryPoint) {
    // No need to implement
  }

  function getIconName(origin, entryPoint) {
    return 'Test Name';
  }

  function setIconImage(image, origin, entryPoint) {
    // No need to implement
  }

  return {
    addGridItem: addGridItem,
    removeGridItem: removeGridItem,

    isAppInstalled: function isAppInstalled(origin) {
      return false;
    },

    getIconByDescriptor: getIconByDescriptor,
    getAppByDescriptor: getAppByDescriptor,
    getAppByOrigin: getAppByOrigin,
    getGridApps: getGridApps,
    getCollections: getCollections,
    getCollectionNames: getCollectionNames,
    getAppInfo: getAppInfo,
    getAllAppsInfo: getAllAppsInfo,

    openUrl: openUrl,
    openCloudApp: openCloudApp,
    openInstalledApp: openInstalledApp,
    openMarketplaceApp: openMarketplaceApp,
    openMarketplaceSearch: openMarketplaceSearch,

    isEvmeVisible: isEvmeVisible,

    onAppSavedToHomescreen: onAppSavedToHomescreen,

    menuShow: menuShow,
    menuHide: menuHide,
    getMenuHeight: getMenuHeight,

    getIconSize: getIconSize,

    setWallpaper: setWallpaper,

    getIconName: getIconName,
    setIconName: setIconName,
    setIconImage: setIconImage,
    get currentPageOffset() {
      return 0;
    }
  };
}());

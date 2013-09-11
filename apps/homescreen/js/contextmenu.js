
'use strict';

var ContextMenuDialog = (function() {
  var dialog, wallpaperButton, collectionsButton, cancelButton;
  
  function initialize() {
    dialog = document.getElementById('contextmenu-dialog');
    
    wallpaperButton = document.getElementById('contextmenu-dialog-wallpaper-button');
    collectionsButton = document.getElementById('contextmenu-dialog-collections-button');
    cancelButton = document.getElementById('contextmenu-dialog-cancel-button');

    wallpaperButton.addEventListener('click', function chooseWallpaper() {
      Wallpaper.select();
      
      // prevent flickering until wallpaper dialog opens
      window.setTimeout(contextmenu_hide, 50);
    });

    collectionsButton.addEventListener('click', function addCollection() {
      window.dispatchEvent(new CustomEvent('suggestcollections'));
      contextmenu_hide();
    });

    cancelButton.addEventListener('click', contextmenu_hide);
  }

  function contextmenu_show() {
    dialog.classList.add('visible');
  }

  function contextmenu_hide() {
    dialog.classList.remove('visible');
  }

  initialize();
  
  return {
    hide: contextmenu_hide,
    show: contextmenu_show,
    init: initialize
  }
}());
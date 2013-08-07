
define('tmpl!cards/message_reader.html',['tmpl'], function (tmpl) { return tmpl.toDom('<div class="card-message-reader card">\n  <section class="msg-reader-header" role="region">\n    <header>\n      <a href="#" class="msg-back-btn">\n        <span class="icon icon-back"></span>\n      </a>\n      <menu type="toolbar">\n        <a href="#" class="msg-reply-all-btn">\n          <span class="icon icon-reply-all"></span>\n        </a>\n        <a href="#" class="msg-reply-btn">\n          <span class="icon icon-reply"></span>\n        </a>\n      </menu>\n      <h1 class="msg-reader-header-label"\n        data-l10n-id="reader-header">ReaD</h1>\n    </header>\n  </section>\n  <div class="scrollregion-below-header scrollregion-horizontal-too">\n    <div class="msg-envelope-bar">\n      <div class="msg-envelope-from-line">\n        <span class="msg-envelope-key"\n               data-l10n-id="envelope-from">FroM</span>\n      </div>\n      <!-- the details starts out collapsed, but can be toggled -->\n      <div class="msg-envelope-details">\n        <div class="msg-envelope-to-line">\n          <span class="msg-envelope-key"\n                 data-l10n-id="envelope-to">tO</span>\n        </div>\n        <div class="msg-envelope-cc-line">\n          <span class="msg-envelope-key"\n                 data-l10n-id="envelope-cc">cC</span>\n        </div>\n        <div class="msg-envelope-bcc-line">\n          <span class="msg-envelope-key"\n                 data-l10n-id="envelope-bcc">BcC</span>\n        </div>\n      </div>\n      <div class="msg-envelope-subject-container">\n        <h3 class="msg-envelope-subject"></h3>\n        <span class="msg-envelope-date"></span>\n      </div>\n    </div>\n    <ul class="msg-attachments-container">\n    </ul>\n    <div class="msg-body-container"><progress></progress></div>\n    <div class="bottom-toolbar-spacer"></div>\n  </div>\n  <!-- Tells us about remote/not downloaded images, asks to show -->\n  <div class="msg-reader-load-infobar collapsed">\n  </div>\n  <div class="msg-reader-action-toolbar bottom-toolbar">\n    <button class="msg-delete-btn bottom-btn"></button>\n    <button class="msg-star-btn bottom-btn"></button>\n    <button class="msg-move-btn bottom-btn"></button>\n    <button class="msg-forward-btn bottom-btn"></button>\n  </div>\n</div>\n'); });

define('tmpl!cards/msg/contact_menu.html',['tmpl'], function (tmpl) { return tmpl.toDom('<form class="msg-contact-menu" role="dialog" data-type="action">\n   <header></header>\n   <menu>\n    <button class="msg-contact-menu-new collapsed" data-l10n-id="message-contact-menu-new">\n      Send new maiL\n    </button>\n    <button class="msg-contact-menu-reply collapsed" data-l10n-id="message-contact-menu-reply">\n      ReplY\n    </button>\n    <button class="msg-contact-menu-view collapsed" data-l10n-id="message-contact-menu-view">\n      View contacT\n    </button>\n    <button class="msg-contact-menu-create-contact collapsed" data-l10n-id="message-contact-menu-create">\n      Save new contacT\n    </button>\n    <button class="msg-contact-menu-add-to-existing-contact collapsed" data-l10n-id="message-contact-menu-add-existing">\n      Add to existing contacT\n    </button>\n     <button class="msg-contact-menu-cancel" data-l10n-id="message-multiedit-cancel">\n      CanceL\n    </button>\n   </menu>\n </form>'); });

define('tmpl!cards/msg/browse_confirm.html',['tmpl'], function (tmpl) { return tmpl.toDom('<form role="dialog" class="msg-browse-confirm" data-type="confirm">\n  <section>\n    <h1 data-l10n-id="confirm-dialog-title">Confirmation</h1>\n    <p></p>\n  </section>\n  <menu>\n    <button id="msg-browse-cancel" data-l10n-id="message-multiedit-cancel">CanceL</button>\n    <button id="msg-browse-ok" class="recommend" data-l10n-id="dialog-button-ok">OK</button>\n  </menu>\n</form>'); });

define('tmpl!cards/msg/peep_bubble.html',['tmpl'], function (tmpl) { return tmpl.toDom('<div class="msg-peep-bubble peep-bubble">\n  <span class="msg-peep-content"></span>\n</div>\n'); });

define('tmpl!cards/msg/attachment_item.html',['tmpl'], function (tmpl) { return tmpl.toDom('<li class="msg-attachment-item">\n  <span class="msg-attachment-icon"></span>\n  <span class="msg-attachment-filename"></span>\n  <span class="msg-attachment-filesize"></span>\n  <button class="msg-attachment-download">\n    <span class="icon icon-download"></span></button>\n  <span class="msg-attachment-downloading">\n    <progress class="small"></progress>\n  </span>\n  <button class="msg-attachment-view">\n    <span data-l10n-id="message-attachment-view"></span>\n  </button>\n</li>\n'); });

define('tmpl!cards/msg/attachment_disabled_confirm.html',['tmpl'], function (tmpl) { return tmpl.toDom('<form role="dialog" class="msg-attachment-disabled-confirm" data-type="confirm">\n  <section>\n    <p><span data-l10n-id="message-send-attachment-disabled-confirm"></span></p>\n  </section>\n  <menu>\n    <button id="msg-attachment-disabled-cancel" data-l10n-id="message-multiedit-cancel">CanceL</button>\n    <button id="msg-attachment-disabled-ok" data-l10n-id="dialog-button-ok">OK</button>\n  </menu>\n</form>'); });



define('marquee',[],function() {

/**
 * HTML Marquee in JavaScript/CSS
 * - slow scrolling of text depending on `behavior' and `timingFunction'
 *   parameters provided to the `activate' method
 * - start aligned left with delay (see marquee.css for details on classes)
 *
 * Creates a HTML element of the form:
 *  <headerNode>
 *    <div id="marquee-h-wrapper">
 *      <div id="marquee-h-text" class="marquee">
 *          Marqueed text content
 *      </div>
 *    </div>
 *  </headerNode>
 * where 'headerNode' is the node that will containt the text that needs a
 * marquee (i.e. <header>, <h1>, etc.).
 */
var Marquee = {
  /**
   * List of supported timing functions
   */
  timingFunction: ['linear', 'ease'],

  /**
   * Setup the marquee DOM structure
   * @param {string} text the string of text that requires a marquee.
   * @param {element} headerNode the DOM element parent of the text.
   */
  setup: function marquee_setup(text, headerNode) {
    this._headerNode = headerNode;

    this._headerWrapper = document.getElementById('marquee-h-wrapper');
    if (!this._headerWrapper) {
      this._headerWrapper = document.createElement('div');
      this._headerWrapper.id = 'marquee-h-wrapper';
      this._headerNode.appendChild(this._headerWrapper);
    }

    var headerText = document.getElementById('marquee-h-text');
    if (!headerText) {
      headerText = document.createElement('div');
      headerText.id = 'marquee-h-text';
      this._headerWrapper.appendChild(headerText);
    }

    headerText.textContent = text;
  },

  /**
   * Activate the marquee
   * NOTE: This should only be called once the DOM structure is updated with
   *       Marquee.setup() and all created DOM elements are appended to the
   *       document, otherwise the text overflow check will not work properly.
   * @param {string} behavior the way the marquee behaves: 'scroll' (default)
   *                           for continuous right-to-left (rtl) scrolling or
   *                           'alternate' for alternating right-to-left and
   *                           left-to-right scrolling.
   * @param {string} timingFun the animation timing function: 'linear' (default)
   *                           for linear animation speed, or 'ease' for slow
   *                           start of the animation.
   */
  activate: function marquee_activate(behavior, timingFun) {
    if (!this._headerNode || !this._headerWrapper)
      return;

    // Set defaults for arguments
    var mode = behavior || 'scroll';
    var tf = timingFun || null;
    var timing = (Marquee.timingFunction.indexOf(tf) >= 0) ? tf : 'linear';
    var marqueeCssClass = 'marquee';

    var titleText = document.getElementById('marquee-h-text');

    // Check if the title text overflows, and if so, add the marquee class
    // NOTE: this can only be checked it the DOM structure is updated
    //       through Marquee.setup()
    if (this._headerWrapper.clientWidth < this._headerWrapper.scrollWidth) {
      // Track the CSS classes added to the text
      this._marqueeCssClassList = [];
      switch (mode) {
        case 'scroll':
          var cssClass = marqueeCssClass + '-rtl';
          // Set the width of the marquee to match the text contents length
          var width = this._headerWrapper.scrollWidth;
          titleText.style.width = width + 'px';
          // Start the marquee animation (aligned left with delay)
          titleText.classList.add(cssClass + '-start-' + timing);
          this._marqueeCssClassList.push(cssClass + '-start-' + timing);

          var self = this;
          titleText.addEventListener('animationend', function() {
            titleText.classList.remove(cssClass + '-start-' + timing);
            this._marqueeCssClassList.pop();
            // Correctly calculate the width of the marquee
            var visibleWidth = self._headerWrapper.clientWidth + 'px';
            titleText.style.transform = 'translateX(' + visibleWidth + ')';
            // Enable the continuous marquee
            titleText.classList.add(cssClass);
            this._marqueeCssClassList.push(cssClass);
          });
          break;
        case 'alternate':
          var cssClass = marqueeCssClass + '-alt-';
          // Set the width of the marquee to match the text contents length
          var width =
              this._headerWrapper.scrollWidth - this._headerWrapper.clientWidth;
          titleText.style.width = width + 'px';

          // Start the marquee animation (aligned left with delay)
          titleText.classList.add(cssClass + timing);
          break;
      }
    } else {
      if (!this._marqueeCssClassList)
        return;
      // Remove the active marquee CSS classes
      for (var cssClass in this._marqueeCssClassList)
        titleText.classList.remove(cssClass);

      titleText.style.transform = '';
    }
  }
};

return Marquee;

});

/*global define, console, window, navigator, document, MozActivity */
define('cards/message_reader',['require','tmpl!./message_reader.html','tmpl!./msg/delete_confirm.html','tmpl!./msg/contact_menu.html','tmpl!./msg/browse_confirm.html','tmpl!./msg/peep_bubble.html','tmpl!./msg/attachment_item.html','tmpl!./msg/attachment_disabled_confirm.html','mail_common','model','evt','iframe_shims','marquee','l10n!'],function(require) {

var MimeMapper,
    templateNode = require('tmpl!./message_reader.html'),
    msgDeleteConfirmNode = require('tmpl!./msg/delete_confirm.html'),
    msgContactMenuNode = require('tmpl!./msg/contact_menu.html'),
    msgBrowseConfirmNode = require('tmpl!./msg/browse_confirm.html'),
    msgPeepBubbleNode = require('tmpl!./msg/peep_bubble.html'),
    msgAttachmentItemNode = require('tmpl!./msg/attachment_item.html'),
    msgAttachmentDisabledConfirmNode =
                         require('tmpl!./msg/attachment_disabled_confirm.html'),
    common = require('mail_common'),
    model = require('model'),
    evt = require('evt'),
    iframeShims = require('iframe_shims'),
    Marquee = require('marquee'),
    mozL10n = require('l10n!'),

    Cards = common.Cards,
    Toaster = common.Toaster,
    ConfirmDialog = common.ConfirmDialog,
    displaySubject = common.displaySubject,
    prettyDate = common.prettyDate,
    prettyFileSize = common.prettyFileSize;
var CONTENT_TYPES_TO_CLASS_NAMES = [
    null,
    'msg-body-content',
    'msg-body-signature',
    'msg-body-leadin',
    null,
    'msg-body-disclaimer',
    'msg-body-list',
    'msg-body-product',
    'msg-body-ads'
  ];
var CONTENT_QUOTE_CLASS_NAMES = [
    'msg-body-q1',
    'msg-body-q2',
    'msg-body-q3',
    'msg-body-q4',
    'msg-body-q5',
    'msg-body-q6',
    'msg-body-q7',
    'msg-body-q8',
    'msg-body-q9'
  ];
var MAX_QUOTE_CLASS_NAME = 'msg-body-qmax';

function MessageReaderCard(domNode, mode, args) {
  // Set up instance-specific storage for events
  evt.Emitter.call(this);

  this.domNode = domNode;
  this.messageSuid = args.messageSuid;

  if (args.header) {
    this._setHeader(args.header);
  } else {
    // TODO: This assumes latest folder is the one of interest.
    // Later, for direct linking from a notification, this may
    // not be true. But this is good for now, and probably
    // need MailAPI changes to just fetch a single message.
    model.latestOnce('folder', function(folder) {
      var messagesSlice = model.api.viewFolderMessages(folder);
      messagesSlice.onsplice = (function(index, howMany, addedItems,
                                         requested, moreExpected) {

        if (!this.header && addedItems && addedItems.length) {
          addedItems.some(function(item) {
              if (item.id === this.messageSuid) {
                this._setHeader(item);
                messagesSlice.die();
                messagesSlice = null;
                return true;
              }
          }.bind(this));
        }

      }).bind(this);
    }.bind(this));
  }

  // The body elements for the (potentially multiple) iframes we created to hold
  // HTML email content.
  this.htmlBodyNodes = [];

  this._on('msg-back-btn', 'click', 'onBack', true);
  this._on('msg-reply-btn', 'click', 'onReply');
  this._on('msg-reply-all-btn', 'click', 'onReplyAll');
  this._on('msg-delete-btn', 'click', 'onDelete');
  this._on('msg-star-btn', 'click', 'onToggleStar');
  this._on('msg-move-btn', 'click', 'onMove');
  this._on('msg-forward-btn', 'click', 'onForward');
  this._on('msg-envelope-bar', 'click', 'onEnvelopeClick');
  this._on('msg-reader-load-infobar', 'click', 'onLoadBarClick');

  this.scrollContainer =
    domNode.getElementsByClassName('scrollregion-below-header')[0];

  // event handler for body change events...
  this.handleBodyChange = this.handleBodyChange.bind(this);
}
MessageReaderCard.prototype = {
  _contextMenuType: {
    VIEW_CONTACT: 1,
    CREATE_CONTACT: 2,
    ADD_TO_CONTACT: 4,
    REPLY: 8,
    NEW_MESSAGE: 16
  },

  // Method to help bind event listeners to method names, and ensures
  // a header object before activating the method, to protect the buttons
  // from being activated while the model is still loading.
  _on: function(className, eventName, method, skipProtection) {
    this.domNode.getElementsByClassName(className)[0]
    .addEventListener(eventName, function(evt) {
      if (this.header || skipProtection)
        return this[method](evt);
    }.bind(this), false);
  },

  _setHeader: function(header) {
    this.header = header.makeCopy();
    this.hackMutationHeader = header;

    // - mark message read (if it is not already)
    if (!this.header.isRead)
      this.header.setRead(true);

    if (this.hackMutationHeader.isStarred)
      this.domNode.getElementsByClassName('msg-star-btn')[0].classList
             .add('msg-btn-active');

    this.emit('header');
  },

  postInsert: function() {
    this.latestOnce('header', function() {
      // iframes need to be linked into the DOM tree before their
      // contentDocument can be instantiated.
      this.buildHeaderDom(this.domNode);

      this.header.getBody({ downloadBodyReps: true }, function(body) {
        this.body = body;

        // always attach the change listener.
        body.onchange = this.handleBodyChange;

        // if the body reps are downloaded show the message immediately.
        if (body.bodyRepsDownloaded) {
          this.buildBodyDom();
        }

        // XXX trigger spinner
        //
      }.bind(this));
    }.bind(this));
  },

  handleBodyChange: function(evt) {
    switch (evt.changeType) {
      case 'bodyReps':
        if (this.body.bodyRepsDownloaded) {
          this.buildBodyDom();
        }
        break;
    }
  },

  onBack: function(event) {
    Cards.removeCardAndSuccessors(this.domNode, 'animate');
  },

  onReply: function(event) {
    Cards.eatEventsUntilNextCard();
    var composer = this.header.replyToMessage(null, function() {
      Cards.pushCard('compose', 'default', 'animate',
                     { composer: composer });
    });
  },

  onReplyAll: function(event) {
    Cards.eatEventsUntilNextCard();
    var composer = this.header.replyToMessage('all', function() {
      Cards.pushCard('compose', 'default', 'animate',
                     { composer: composer });
    });
  },

  onForward: function(event) {
    // If we don't have a body yet, we can't forward the message.  In the future
    // we should visibly disable the button until the body has been retrieved.
    if (!this.body)
      return;

    var needToPrompt = this.header.hasAttachments ||
      this.body.embeddedImageCount > 0;

    var forwardMessage = (function() {
      Cards.eatEventsUntilNextCard();
      var composer = this.header.forwardMessage('inline', function() {
             Cards.pushCard('compose', 'default', 'animate',
                            { composer: composer });
      });
    }.bind(this));

    if (needToPrompt) {
      var dialog = msgAttachmentDisabledConfirmNode.cloneNode(true);
      ConfirmDialog.show(dialog,
        {
          id: 'msg-attachment-disabled-ok',
          handler: function() {
            forwardMessage();
          }
        },
        {
          id: 'msg-attachment-disabled-cancel',
          handler: null
        }
      );
    } else {
      forwardMessage();
    }
  },

  onDelete: function() {
    var dialog = msgDeleteConfirmNode.cloneNode(true);
    ConfirmDialog.show(dialog,
      { // Confirm
        id: 'msg-delete-ok',
        handler: function() {
          var op = this.header.deleteMessage();
          Toaster.logMutation(op, true);
          Cards.removeCardAndSuccessors(this.domNode, 'animate');
        }.bind(this)
      },
      { // Cancel
        id: 'msg-delete-cancel',
        handler: null
      }
    );
  },

  onToggleStar: function() {
    var button = this.domNode.getElementsByClassName('msg-star-btn')[0];
    if (!this.hackMutationHeader.isStarred)
      button.classList.add('msg-btn-active');
    else
      button.classList.remove('msg-btn-active');

    this.hackMutationHeader.isStarred = !this.hackMutationHeader.isStarred;
    this.header.setStarred(this.hackMutationHeader.isStarred);
  },

  onMove: function() {
    //TODO: Please verify move functionality after api landed.
    Cards.folderSelector(function(folder) {
      var op = this.header.moveMessage(folder);
      Toaster.logMutation(op, true);
      Cards.removeCardAndSuccessors(this.domNode, 'animate');
    }.bind(this));
  },

  /**
   * Handle peep bubble click event and trigger context menu.
   */
  onEnvelopeClick: function(event) {
    var target = event.target;
    if (!target.classList.contains('msg-peep-bubble')) {
      return;
    }
    // - peep click
    this.onPeepClick(target);
  },

  onPeepClick: function(target) {
    var contents = msgContactMenuNode.cloneNode(true);
    var peep = target.peep;
    var headerNode = contents.getElementsByTagName('header')[0];
    // Setup the marquee structure
    Marquee.setup(peep.address, headerNode);

    // Activate marquee once the contents DOM are added to document
    document.body.appendChild(contents);
    // XXX Remove 'ease' if linear animation is wanted
    Marquee.activate('alternate', 'ease');

    // -- context menu selection handling
    var formSubmit = (function(evt) {
      document.body.removeChild(contents);
      switch (evt.explicitOriginalTarget.className) {
        // All of these mutations are immediately reflected, easily observed
        // and easily undone, so we don't show them as toaster actions.
        case 'msg-contact-menu-new':
          Cards.pushCard('compose', 'default', 'animate', {
            composerData: {
              message: this.header,
              onComposer: function(composer) {
                composer.to = [{
                  address: peep.address,
                  name: peep.name
                }];
              }
            }
          });
          break;
        case 'msg-contact-menu-view':
          var activity = new MozActivity({
            name: 'open',
            data: {
              type: 'webcontacts/contact',
              params: {
                'id': peep.contactId
              }
            }
          });
          break;
        case 'msg-contact-menu-create-contact':
          var params = {
            'email': peep.address
          };

          if (peep.name)
            params.givenName = peep.name;

          var activity = new MozActivity({
            name: 'new',
            data: {
              type: 'webcontacts/contact',
              params: params
            }
          });

          // since we already have contact change listeners that are hooked up
          // to the UI, we leave it up to them to update the UI for us.
          break;
        case 'msg-contact-menu-add-to-existing-contact':
          var activity = new MozActivity({
            name: 'update',
            data: {
              type: 'webcontacts/contact',
              params: {
                'email': peep.address
              }
            }
          });

          // since we already have contact change listeners that are hooked up
          // to the UI, we leave it up to them to update the UI for us.
          break;
        case 'msg-contact-menu-reply':
          //TODO: We need to enter compose view with specific email address.
          var composer = this.header.replyToMessage(null, function() {
            Cards.pushCard('compose', 'default', 'animate',
                           { composer: composer });
          });
          break;
      }
      return false;
    }).bind(this);
    contents.addEventListener('submit', formSubmit);

    // -- populate context menu
    var contextMenuOptions = this._contextMenuType.NEW_MESSAGE;
    var messageType = peep.type;

    if (messageType === 'from')
      contextMenuOptions |= this._contextMenuType.REPLY;

    if (peep.isContact) {
      contextMenuOptions |= this._contextMenuType.VIEW_CONTACT;
    } else {
      contextMenuOptions |= this._contextMenuType.CREATE_CONTACT;
      contextMenuOptions |= this._contextMenuType.ADD_TO_CONTACT;
    }

    if (contextMenuOptions & this._contextMenuType.VIEW_CONTACT)
      contents.querySelector('.msg-contact-menu-view')
        .classList.remove('collapsed');
    if (contextMenuOptions & this._contextMenuType.CREATE_CONTACT)
      contents.querySelector('.msg-contact-menu-create-contact')
        .classList.remove('collapsed');
    if (contextMenuOptions & this._contextMenuType.ADD_TO_CONTACT)
      contents.querySelector('.msg-contact-menu-add-to-existing-contact')
        .classList.remove('collapsed');
    if (contextMenuOptions & this._contextMenuType.REPLY)
      contents.querySelector('.msg-contact-menu-reply')
        .classList.remove('collapsed');
    if (contextMenuOptions & this._contextMenuType.NEW_MESSAGE)
      contents.querySelector('.msg-contact-menu-new')
        .classList.remove('collapsed');
  },

  onLoadBarClick: function(event) {
    var self = this;
    var loadBar =
          this.domNode.getElementsByClassName('msg-reader-load-infobar')[0];
    if (!this.body.embeddedImagesDownloaded) {
      this.body.downloadEmbeddedImages(function() {
        // this gets nulled out when we get killed, so use this to bail.
        // XXX of course, this closure will cause us to potentially hold onto
        // a lot of garbage, so it would be better to add an
        // 'onimagesdownloaded' to body so that the closure would end up as
        // part of a cycle that would get collected.
        if (!self.domNode)
          return;

        for (var i = 0; i < self.htmlBodyNodes.length; i++) {
          self.body.showEmbeddedImages(self.htmlBodyNodes[i],
                                       self.iframeResizeHandler);
        }
      });
      // XXX really we should check for external images to display that load
      // bar, although it's a bit silly to have both in a single e-mail.
      loadBar.classList.add('collapsed');
    }
    else {
      for (var i = 0; i < this.htmlBodyNodes.length; i++) {
        this.body.showExternalImages(this.htmlBodyNodes[i],
                                     this.iframeResizeHandler);
      }
      loadBar.classList.add('collapsed');
    }
  },

  getAttachmentBlob: function(attachment, callback) {
    try {
      // Get the file contents as a blob, so we can open the blob
      var storageType = attachment._file[0];
      var filename = attachment._file[1];
      var storage = navigator.getDeviceStorage(storageType);
      var getreq = storage.get(filename);

      getreq.onerror = function() {
        console.warn('Could not open attachment file: ', filename,
                     getreq.error.name);
      };

      getreq.onsuccess = function() {
        // Now that we have the file, return the blob within callback function
        var blob = getreq.result;
        callback(blob);
      };
    } catch (ex) {
      console.warn('Exception getting attachment from device storage:',
                   attachment._file, '\n', ex, '\n', ex.stack);
    }
  },

  onDownloadAttachmentClick: function(node, attachment) {
    node.setAttribute('state', 'downloading');
    attachment.download(function downloaded() {
      if (!attachment._file)
        return;

      node.setAttribute('state', 'downloaded');
    });
  },

  onViewAttachmentClick: function(node, attachment) {
    console.log('trying to open', attachment._file, 'type:',
                attachment.mimetype);
    if (!attachment._file)
      return;

    if (attachment.isDownloaded) {
      this.getAttachmentBlob(attachment, function(blob) {
        try {
          // Now that we have the file, use an activity to open it
          if (!blob) {
            throw new Error('Blob does not exist');
          }

          // To delegate a correct activity, we should try to avoid the unsure
          // mimetype because types like "application/octet-stream" which told
          // by the e-mail client are not supported.
          // But it doesn't mean we really don't support that attachment
          // what we can do here is:
          // 1. Check blob.type, most of the time it will not be empty
          //    because it's reported by deviceStorage, it should be a
          //    correct mimetype, or
          // 2. Use the original mimetype from the attachment,
          //    but it's possibly an unsupported mimetype, like
          //    "application/octet-stream" which cannot be used correctly, or
          // 3. Use MimeMapper to help us, if it's still an unsure mimetype,
          //    MimeMapper can guess the possible mimetype from extension,
          //    then we can delegate a right activity.
          var extension = attachment.filename.split('.').pop();
          var originalType = blob.type || attachment.mimetype;
          var mappedType = (MimeMapper.isSupportedType(originalType)) ?
            originalType : MimeMapper.guessTypeFromExtension(extension);

          var activity = new MozActivity({
            name: 'open',
            data: {
              type: mappedType,
              blob: blob
            }
          });
          activity.onerror = function() {
            console.warn('Problem with "open" activity', activity.error.name);
          };
          activity.onsuccess = function() {
            console.log('"open" activity allegedly succeeded');
          };
        }
        catch (ex) {
          console.warn('Problem creating "open" activity:', ex, '\n', ex.stack);
        }
      });
    }
  },

  onHyperlinkClick: function(event, linkNode, linkUrl, linkText) {
    var dialog = msgBrowseConfirmNode.cloneNode(true);
    var content = dialog.getElementsByTagName('p')[0];
    content.textContent = mozL10n.get('browse-to-url-prompt', { url: linkUrl });
    ConfirmDialog.show(dialog,
      { // Confirm
        id: 'msg-browse-ok',
        handler: function() {
          window.open(linkUrl, '_blank');
        }.bind(this)
      },
      { // Cancel
        id: 'msg-browse-cancel',
        handler: null
      }
    );
  },

  _populatePlaintextBodyNode: function(bodyNode, rep) {
    for (var i = 0; i < rep.length; i += 2) {
      var node = document.createElement('div'), cname;

      var etype = rep[i] & 0xf, rtype = null;
      if (etype === 0x4) {
        var qdepth = (((rep[i] >> 8) & 0xff) + 1);
        if (qdepth > 8)
          cname = MAX_QUOTE_CLASS_NAME;
        else
          cname = CONTENT_QUOTE_CLASS_NAMES[qdepth];
      }
      else {
        cname = CONTENT_TYPES_TO_CLASS_NAMES[etype];
      }
      if (cname)
        node.setAttribute('class', cname);

      var subnodes = model.api.utils.linkifyPlain(rep[i + 1], document);
      for (var iNode = 0; iNode < subnodes.length; iNode++) {
        node.appendChild(subnodes[iNode]);
      }

      bodyNode.appendChild(node);
    }
  },

  buildHeaderDom: function(domNode) {
    var header = this.header, body = this.body;

    // -- Header
    function updatePeep(peep) {
      var nameNode = peep.element.getElementsByClassName('msg-peep-content')[0];

      if (peep.type === 'from') {
        // We display the sender of the message's name in the header and the
        // address in the bubble.
        domNode.getElementsByClassName('msg-reader-header-label')[0]
          .textContent = peep.name || peep.address;

        nameNode.textContent = peep.address;
        nameNode.classList.add('msg-peep-address');
      }
      else {
        nameNode.textContent = peep.name || peep.address;
        if (!peep.name && peep.address) {
          nameNode.classList.add('msg-peep-address');
        } else {
          nameNode.classList.remove('msg-peep-address');
        }
      }
    }

    function addHeaderEmails(type, peeps) {
      var lineClass = 'msg-envelope-' + type + '-line';
      var lineNode = domNode.getElementsByClassName(lineClass)[0];

      if (!peeps || !peeps.length) {
        lineNode.classList.add('collapsed');
        return;
      }

      // Because we can avoid having to do multiple selector lookups, we just
      // mutate the template in-place...
      var peepTemplate = msgPeepBubbleNode;

      for (var i = 0; i < peeps.length; i++) {
        var peep = peeps[i];
        peep.type = type;
        peep.element = peepTemplate.cloneNode(true);
        peep.element.peep = peep;
        peep.onchange = updatePeep;
        updatePeep(peep);
        lineNode.appendChild(peep.element);
      }
    }

    addHeaderEmails('from', [header.author]);
    addHeaderEmails('to', header.to);
    addHeaderEmails('cc', header.cc);
    addHeaderEmails('bcc', header.bcc);

    var dateNode = domNode.getElementsByClassName('msg-envelope-date')[0];
    dateNode.dataset.time = header.date.valueOf();
    dateNode.textContent = prettyDate(header.date);

    displaySubject(domNode.getElementsByClassName('msg-envelope-subject')[0],
                   header);
  },

  buildBodyDom: function() {
    var body = this.body;
    var domNode = this.domNode;

    var rootBodyNode = domNode.getElementsByClassName('msg-body-container')[0],
        reps = body.bodyReps,
        hasExternalImages = false,
        showEmbeddedImages = body.embeddedImageCount &&
                             body.embeddedImagesDownloaded;

    iframeShims.bindSanitizedClickHandler(rootBodyNode,
                                          this.onHyperlinkClick.bind(this),
                                          rootBodyNode,
                                          null);

    for (var iRep = 0; iRep < reps.length; iRep++) {
      var rep = reps[iRep];

      if (rep.type === 'plain') {
        this._populatePlaintextBodyNode(rootBodyNode, rep.content);
      }
      else if (rep.type === 'html') {
        var iframeShim = iframeShims.createAndInsertIframeForContent(
          rep.content, this.scrollContainer, rootBodyNode, null,
          'interactive', this.onHyperlinkClick.bind(this));
        var iframe = iframeShim.iframe;
        var bodyNode = iframe.contentDocument.body;
        this.iframeResizeHandler = iframeShim.resizeHandler;
        model.api.utils.linkifyHTML(iframe.contentDocument);
        this.htmlBodyNodes.push(bodyNode);

        if (body.checkForExternalImages(bodyNode))
          hasExternalImages = true;
        if (showEmbeddedImages)
          body.showEmbeddedImages(bodyNode);
      }

      if (iRep === 0) {
        // remove progress bar
        var progressNode = rootBodyNode.querySelector('progress');
        if (progressNode) {
          progressNode.parentNode.removeChild(progressNode);
        }
      }
    }

    // -- HTML-referenced Images
    var loadBar = domNode.getElementsByClassName('msg-reader-load-infobar')[0];
    if (body.embeddedImageCount && !body.embeddedImagesDownloaded) {
      loadBar.classList.remove('collapsed');
      loadBar.textContent =
        mozL10n.get('message-download-images',
                    { n: body.embeddedImageCount });
    }
    else if (hasExternalImages) {
      loadBar.classList.remove('collapsed');
      loadBar.textContent =
        mozL10n.get('message-show-external-images');
    }
    else {
      loadBar.classList.add('collapsed');
    }

    // -- Attachments (footer)
    // An attachment can be in 1 of 3 possible states for UI purposes:
    // - Not downloadable: We can't download this message because we wouldn't
    //   be able to do anything with it if we downloaded it.  Anything that's
    //   not a supported image type falls in this category.
    // - Downloadable, not downloaded: The user can trigger download of the
    //   attachment to DeviceStorage.
    // - Downloadable, downloaded: The attachment is already fully downloaded
    //   to DeviceStorage and we can trigger its display.
    var attachmentsContainer =
      domNode.getElementsByClassName('msg-attachments-container')[0];
    if (body.attachments && body.attachments.length) {
      // We need MimeMapper to help us determining the downloadable attachments
      // but it might not be loaded yet, so load before use it
      require(['shared/js/mime_mapper'], function(mapper) {
        if (!MimeMapper)
          MimeMapper = mapper;

        var attTemplate = msgAttachmentItemNode,
            filenameTemplate =
              attTemplate.getElementsByClassName('msg-attachment-filename')[0],
            filesizeTemplate =
              attTemplate.getElementsByClassName('msg-attachment-filesize')[0];
        for (var iAttach = 0; iAttach < body.attachments.length; iAttach++) {
          var attachment = body.attachments[iAttach], state;
          var extension = attachment.filename.split('.').pop();

          if (attachment.isDownloaded)
            state = 'downloaded';
          else if (MimeMapper.isSupportedType(attachment.mimetype) ||
                   MimeMapper.isSupportedExtension(extension))
            state = 'downloadable';
          else
            state = 'nodownload';
          attTemplate.setAttribute('state', state);
          filenameTemplate.textContent = attachment.filename;
          filesizeTemplate.textContent = prettyFileSize(
            attachment.sizeEstimateInBytes);

          var attachmentNode = attTemplate.cloneNode(true);
          attachmentsContainer.appendChild(attachmentNode);
          attachmentNode.getElementsByClassName('msg-attachment-download')[0]
            .addEventListener('click',
                              this.onDownloadAttachmentClick.bind(
                                this, attachmentNode, attachment));
          attachmentNode.getElementsByClassName('msg-attachment-view')[0]
            .addEventListener('click',
                              this.onViewAttachmentClick.bind(
                                this, attachmentNode, attachment));
        }
      }.bind(this));
    }
    else {
      attachmentsContainer.classList.add('collapsed');
    }
  },

  die: function() {
    // Our header was makeCopy()d from the message-list and so needs to be
    // explicitly removed since it is not part of a slice.
    if (this.header) {
      this.header.__die();
      this.header = null;
    }
    if (this.body) {
      this.body.die();
      this.body = null;
    }
    this.domNode = null;
  }
};

evt.mix(MessageReaderCard.prototype);

Cards.defineCardWithDefaultMode(
    'message_reader',
    { tray: false },
    MessageReaderCard,
    templateNode
);

return MessageReaderCard;
});

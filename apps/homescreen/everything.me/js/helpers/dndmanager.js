'use strict';

/**
 * Manager for organizing items ordered in a (rows, ICONS_PER_ROW) dimensional
 * grid.
 *
 * Assuming 'o' (originNode) was dragged and dropped over 't' (targetNode) :
 * x o z t      x z t o
 * x x x x  ==> x x x x
 * x x x x      x x x x
 *
 */
function Evme_dndManager() {

  // the dragging arena (container)
  // currently hard coded for collections for simplicity
  var dndContainerEl = document.getElementById('collection');

  // initial coordinates
  var sx, sy;

  // coordinates updated with every touch move
  var cx, cy;

  // the element we want to drag
  var originNode;

  // the common parent of the nodes we are organizing
  var parentNode;

  // child nodes of parentNode
  // we store a mutable copy for keeping track of temporary ordering while
  // dragging without actually changing the DOM
  var children;

  // the dragged node will be inserted before this node
  var insertBeforeNode;

  // the 'cloned' element that is visually dragged on screen
  var draggableEl;

  // the element we are dragging above
  var targetNode;

  // flags that nodes are shifted from original positions
  var shifted = false;

  // callback to execute after rearranging
  var rearrangeCb;

  // currently animating nodes
  var animatingNodes;

  var hoverTimeout = null;

  // constants
  var HOVER_DELAY = Page.prototype.REARRANGE_DELAY;
  var DRAGGING_TRANSITION = Page.prototype.DRAGGING_TRANSITION;
  var ICONS_PER_ROW = Page.prototype.ICONS_PER_ROW;

  // support mouse events for simulator and desktopb2g
  var isTouch = 'ontouchstart' in window;
  var touchmove = isTouch ? 'touchmove' : 'mousemove';
  var touchend = isTouch ? 'touchend' : 'mouseup';

  var getTouch = (function getTouchWrapper() {
    return isTouch ? function(e) { return e.touches[0] } :
                     function(e) { return e };
  })();

  /**
   * touchmove handler
   *
   * - animate draggable element
   * - trigger rearrange preview if hovering on sibling longer than HOVER_DELAY
   */
  function onMove(evt) {
    evt.preventDefault();

    cx = getTouch(evt).pageX;
    cy = getTouch(evt).pageY;

    window.mozRequestAnimationFrame(animateDraggable);

    var elFromPoint = document.elementFromPoint(cx, cy);

    // same target, do nothing
    if (elFromPoint === targetNode) {
      return;
    }

    targetNode = elFromPoint;

    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    // dragging within parent bounds
    if (targetNode.parentNode === parentNode) {
      // on sibling - re-arrange
      if (targetNode !== originNode) {
        hoverTimeout = setTimeout(shiftNodes, HOVER_DELAY);
      }
    } else {
      // outside of valid dragging bounds
      hoverTimeout = setTimeout(clearTranslate, HOVER_DELAY);
    }
  }

  // touchend handler
  function onEnd() {
    window.removeEventListener(touchmove, onMove);
    window.removeEventListener(touchend, onEnd);

    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    if (shifted) {
      rearrange();
    } else {
      revert();
    }
  }

  function animateDraggable() {
    draggableEl.style.MozTransform =
      'translate(' + (cx - sx) + 'px,' + (cy - sy) + 'px)';
  }

  // 'preview mode' - move nodes to where they would end up when dropping
  // the dragged icon on targetNode
  function shiftNodes() {
    // animation already in progress - abort
    if (animatingNodes.length) {
      return;
    }

    shifted = true;

    var originIndex = children.indexOf(originNode);
    var targetIndex = children.indexOf(targetNode);

    if (originIndex < 0 || targetIndex < 0) {
      return;
    }

    var forward = originIndex < targetIndex;
    insertBeforeNode = forward ? targetNode.nextSibling : targetNode;

    // translate nodes to new positions
    translateNode(originNode, originIndex, targetIndex);

    if (forward) {
      for (var i = originIndex + 1; i <= targetIndex; i++) {
        translateNode(children[i], i, i - 1, DRAGGING_TRANSITION);
      }
    } else {
      for (var i = targetIndex; i < originIndex; i++) {
        translateNode(children[i], i, i + 1, DRAGGING_TRANSITION);
      }
    }

    function translateNode(node, from, to, transition) {
      if (!node) {
        return;
      }

      var x = node.dataset.posX = parseInt(node.dataset.posX || 0) +
                        ((Math.floor(to % ICONS_PER_ROW) -
                          Math.floor(from % ICONS_PER_ROW)) * 100);
      var y = node.dataset.posY = parseInt(node.dataset.posY || 0) +
                        ((Math.floor(to / ICONS_PER_ROW) -
                          Math.floor(from / ICONS_PER_ROW)) * 100);

      animatingNodes.push(node);

      window.mozRequestAnimationFrame(function() {
        node.style.MozTransform = 'translate(' + x + '%, ' + y + '%)';
        if (transition) {
          node.style.MozTransition = transition;
        }
      });

      node.addEventListener('transitionend', function tEnd() {
        node.removeEventListener('transitionend', tEnd);
        animatingNodes.splice(animatingNodes.indexOf(node), 1);

        // animations ended, update children ordering to reflect shifting
        if (animatingNodes.length === 0) {
          children.splice(originIndex, 1);
          children.splice(targetIndex, 0, originNode);
        }
      });
    }
  }

  function clearTranslate() {
    for (var i = 0, node; node = children[i++]; ) {
      node.style.MozTransform = node.style.MozTransition = '';
      delete node.dataset.posX;
      delete node.dataset.posY;
    }

    // restore original order
    children = Array.prototype.slice.call(parentNode.childNodes);
    shifted = false;
  }

  // update DOM with new node ordering
  function rearrange() {
    clearTranslate();
    parentNode.insertBefore(originNode, insertBeforeNode);
    cleanup();

    // call callback with new index of originNode
    var newIndex =
      Array.prototype.indexOf.call(parentNode.childNodes, originNode);

    if (newIndex > -1) {
      rearrangeCb(newIndex);
    }
  }

  // move originNode back to original location
  function revert() {
    dndContainerEl.dataset.transitioning = true;
    draggableEl.style.MozTransition = '-moz-transform .4s';
    draggableEl.style.MozTransform = 'translate(0, 0)';

    draggableEl.addEventListener('transitionend', function tEnd(e) {
      e.target.removeEventListener('transitionend', tEnd);
      delete dndContainerEl.dataset.transitioning;
      cleanup();
    });
  }

  function cleanup() {
    delete dndContainerEl.dataset.dragging;
    delete originNode.dataset.dragging;

    if (draggableEl) {
      dndContainerEl.removeChild(draggableEl);
    }
  }

  // create cloned draggable grid-like element from an E.me li element
  function initDraggable() {
    draggableEl = document.createElement('div');
    draggableEl.className = 'draggable';

    var container = document.createElement('div');
    var img = originNode.querySelector('img').cloneNode();
    var labelWrapper = document.createElement('span');
    var label = document.createElement('span');

    labelWrapper.className = 'labelWrapper';
    label.textContent = originNode.dataset.name;
    labelWrapper.appendChild(label);

    container.appendChild(img);
    container.appendChild(labelWrapper);
    draggableEl.appendChild(container);

    var rect = originNode.getBoundingClientRect();
    draggableEl.style.left = rect.left + 'px';
    draggableEl.style.top = rect.top + 'px';
  }

  /**
   * Start dragging an E.me static app inside a Collection for re-ordering
   * @param  {DOM element}  node
   * @param  {MouseEvent}   contextMenuEvent 'contextmenu' event
   * @param  {Function}     cb callback to execute after rearrange
   *                           receives the new index of node as parameter
   */
  this.start = function start(node, contextMenuEvent, cb) {
    originNode = node;
    parentNode = originNode.parentNode;
    targetNode = originNode;

    children = Array.prototype.slice.call(parentNode.childNodes);
    animatingNodes = [];

    dndContainerEl.dataset.dragging = true;
    originNode.dataset.dragging = true;

    window.addEventListener(touchmove, onMove);
    window.addEventListener(touchend, onEnd);

    initDraggable();
    dndContainerEl.appendChild(draggableEl);

    // save start position
    sx = contextMenuEvent.pageX;
    sy = contextMenuEvent.pageY;

    // set callback
    rearrangeCb = cb || Evme.Utils.NOOP;
  };

  this.stop = function stop() {
    rearrangeCb = Evme.Utils.NOOP;
    revert();
  };
}

Evme.dndManager = new Evme_dndManager();

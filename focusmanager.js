"use strict";

require('js-ext/lib/object.js');
require('polyfill');

/**
 *
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 * @module focusmanager
 * @class FocusManager
 * @since 0.0.1
*/

var NAME = '[focusmanager]: ',
    async = require('utils').async,
    createHashMap = require('js-ext/extra/hashmap.js').createMap,
    DEFAULT_SELECTOR = 'input, button, select, textarea, .focusable, [plugin-fm="true"], [itag-formelement="true"]',
    // SPECIAL_KEYS needs to be a native Object --> we need .some()
    SPECIAL_KEYS = {
        shift: 'shiftKey',
        ctrl: 'ctrlKey',
        cmd: 'metaKey',
        alt: 'altKey'
    },
    DEFAULT_KEYUP = 'shift+9',
    DEFAULT_KEYDOWN = '9',
    DEFAULT_NOLOOP = false,
    FM_SELECTION = 'fm-selection',
    FM_SELECTION_START = FM_SELECTION+'start',
    FM_SELECTION_END = FM_SELECTION+'end',
    FOCUSSED = 'focussed';

module.exports = function (window) {

    var DOCUMENT = window.document,
        FocusManager, Event, nextFocusNode, searchFocusNode, markAsFocussed,
        resetLastValue, getFocusManagerSelector, setupEvents, defineFocusEvent;

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', createHashMap());

/*jshint boss:true */
    if (FocusManager=window._ITSAmodules.FocusManager) {
/*jshint boss:false */
        return FocusManager; // FocusManager was already created
    }

    require('window-ext')(window);
    require('node-plugin')(window);

    Event = require('event-mobile')(window);

    getFocusManagerSelector = function(focusContainerNode) {
        var selector = focusContainerNode._plugin.fm.model.manage;
        (selector.toLowerCase()==='true') && (selector=DEFAULT_SELECTOR);
        return selector;
    };

    nextFocusNode = function(e, keyCode, actionkey, focusContainerNode, sourceNode, selector, downwards, initialSourceNode) {
        console.log(NAME+'nextFocusNode');
        var keys, lastIndex, i, specialKeysMatch, specialKey, len, enterPressedOnInput, primaryButtons,
            inputType, foundNode, formNode, primaryonenter, noloop, nodeHit, foundContainer;
        keys = actionkey.split('+');
        len = keys.length;
        lastIndex = len - 1;

        if ((keyCode===13) && (sourceNode.getTagName()==='INPUT')) {
            inputType = sourceNode.getAttr('type').toLowerCase();
            enterPressedOnInput = (inputType==='text') || (inputType==='password');
        }

        if (enterPressedOnInput) {
            // check if we need to press the primary button - if available
/*jshint boss:true */
            if ((primaryonenter=sourceNode.getAttr('fm-primaryonenter')) && (primaryonenter.toLowerCase()==='true')) {
/*jshint boss:false */
                primaryButtons = focusContainerNode.getAll('button.pure-button-primary');
                primaryButtons.some(function(buttonNode) {
                    buttonNode.matches(selector) && (foundNode=buttonNode);
                    return foundNode;
                });
                if (foundNode) {
                    async(function() {
                        Event.emit(foundNode, 'UI:tap');
                        // _buttonPressed make event-dom to simulate a pressed button for 200ms
                        Event.emit(foundNode, 'UI:tap', {_buttonPressed: true});
                        // if the button is of type `submit`, then try to submit the form
                        formNode = foundNode.inside('form');
                        formNode && formNode.submit();
                    });
                    return foundNode;
                }
            }
        }
        // double == --> keyCode is number, keys is a string
        if (enterPressedOnInput || (keyCode==keys[lastIndex])) {
            // posible keyup --> check if special characters match:
            specialKeysMatch = true;
            SPECIAL_KEYS.some(function(value) {
                specialKeysMatch = !e[value];
                return !specialKeysMatch;
            });
            for (i=lastIndex-1; (i>=0) && !specialKeysMatch; i--) {
                specialKey = keys[i].toLowerCase();
                specialKeysMatch = e[SPECIAL_KEYS[specialKey]];
            }
        }
        if (specialKeysMatch) {
            noloop = focusContainerNode._plugin.fm.model.noloop;
            // in case sourceNode is an innernode of a selector, we need to start from the selector:
            sourceNode.matches(selector) || (sourceNode=sourceNode.inside(selector));
            if (downwards) {
                nodeHit = sourceNode;
/*jshint noempty:true */
                while ((nodeHit=nodeHit.next(selector, focusContainerNode)) && (nodeHit.getStyle('display')==='none')) {}
/*jshint noempty:false */
                if (!nodeHit) {
                    nodeHit = noloop ? sourceNode.last(selector, focusContainerNode) : sourceNode.first(selector, focusContainerNode);
                    if (nodeHit.getStyle('display')==='none') {
/*jshint noempty:true */
                        while ((nodeHit=nodeHit[noloop ? 'previous' : 'next'](selector, focusContainerNode)) && (nodeHit.getStyle('display')==='none')) {}
/*jshint noempty:false */
                    }
                }
            }
            else {
                nodeHit = sourceNode;
/*jshint noempty:true */
                while ((nodeHit=nodeHit.previous(selector, focusContainerNode)) && (nodeHit.getStyle('display')==='none')) {}
/*jshint noempty:false */
                if (!nodeHit) {
                    nodeHit = noloop ? sourceNode.first(selector, focusContainerNode) : sourceNode.last(selector, focusContainerNode);
                    if (nodeHit.getStyle('display')==='none') {
/*jshint noempty:true */
                        while ((nodeHit=nodeHit[noloop ? 'next' : 'previous'](selector, focusContainerNode)) && (nodeHit.getStyle('display')==='none')) {}
/*jshint noempty:false */
                    }
                }
            }
            if (nodeHit===sourceNode) {
                // cannot found another, return itself, BUT return `initialSourceNode` if it is available
                return initialSourceNode || sourceNode;
            }
            else {
                foundContainer = nodeHit.inside('[plugin-fm="true"]');
                // only if `nodeHit` is inside the runniong focusContainer, we may return it,
                // otherwise look further
                return (foundContainer===focusContainerNode) ? nodeHit : nextFocusNode(e, keyCode, actionkey, focusContainerNode, nodeHit, selector, downwards, sourceNode);
            }
        }
        return false;
    };

    markAsFocussed = function(focusContainerNode, node) {
        console.log(NAME+'markAsFocussed');
        var selector = getFocusManagerSelector(focusContainerNode),
            index = focusContainerNode.getAll(selector).indexOf(node) || 0;
        // we also need to set the appropriate nodeData, so that when the itags re-render,
        // they don't reset this particular information
        resetLastValue(focusContainerNode);

        // also store the lastitem's index --> in case the node gets removed,
        // or re-rendering itags which don't have the attribute-data.
        // otherwise, a refocus on the container will set the focus to the nearest item
        focusContainerNode.setData('fm-lastitem-bkp', index);
        node.setData('fm-tabindex', true);
        node.setAttrs([
            {name: 'tabindex', value: '0'},
            {name: 'fm-lastitem', value: true}
        ], true);
    };

    resetLastValue = function(focusContainerNode) {
        var lastItemNodes = focusContainerNode.getAll('[fm-lastitem]');
        lastItemNodes.removeAttrs(['fm-lastitem', 'tabindex'], true)
                     .removeData('fm-tabindex');
        focusContainerNode.removeData('fm-lastitem-bkp');
    };

    searchFocusNode = function(initialNode, deeper) {
        console.log(NAME+'searchFocusNode');
        var focusContainerNode = initialNode.hasAttr('fm-manage') ? initialNode : initialNode.inside('[plugin-fm="true"]'),
            focusNode, alwaysDefault, selector, allFocusableNodes, index, parentContainerNode, parentSelector;

        if (focusContainerNode) {
            selector = getFocusManagerSelector(focusContainerNode);
            focusNode = initialNode.matches(selector) ? initialNode : initialNode.inside(selector);
            // focusNode can only be equal focusContainerNode when focusContainerNode lies with a focusnode itself with that particular selector:
            if (focusNode===focusContainerNode) {
                parentContainerNode = focusNode.inside('[plugin-fm="true"]');
                if (parentContainerNode) {
                    parentSelector = getFocusManagerSelector(parentContainerNode);
                    if (!focusNode.matches(parentSelector) || deeper) {
                        focusNode = null;
                    }
                }
                else {
                    focusNode = null;
                }
            }
            if (focusNode && focusContainerNode.contains(focusNode, true)) {
                markAsFocussed(parentContainerNode || focusContainerNode, focusNode);
            }
            else {
                // find the right node that should get focus
/*jshint boss:true */
                alwaysDefault = focusContainerNode._plugin.fm.model.alwaysdefault;
/*jshint boss:false */
                alwaysDefault && (focusNode=focusContainerNode.getElement('[fm-defaultitem="true"]'));
                if (!focusNode) {
                    // search for last item
                    focusNode = focusContainerNode.getElement('[fm-lastitem="true"]');
                    if (!focusNode) {
                        // look at the lastitemindex of the focuscontainer
                        index = focusContainerNode.getData('fm-lastitem-bkp');
                        if (index!==undefined) {
                            allFocusableNodes = focusContainerNode.getAll(selector);
                            focusNode = allFocusableNodes[index];
                        }
                    }
                }
                // still not found and alwaysDefault was falsy: try the defualt node:
                !focusNode && !alwaysDefault && (focusNode=focusContainerNode.getElement('[fm-defaultitem="true"]'));
                // still not found: try the first focussable node (which we might find inside `allFocusableNodes`:
                !focusNode && (focusNode = allFocusableNodes ? allFocusableNodes[0] : focusContainerNode.getElement(selector));
                if (focusNode) {
                    markAsFocussed(parentContainerNode || focusContainerNode, focusNode);
                }
                else {
                    focusNode = initialNode;
                }
            }
        }
        else {
            focusNode = initialNode;
        }
        return focusNode;
    };

    setupEvents = function() {

        Event.before('keydown', function(e) {
            console.log(NAME+'before keydown-event');
            var focusContainerNode,
                sourceNode = e.target,
                selector, keyCode, actionkey, focusNode, keys, len, lastIndex, specialKeysMatch, i, specialKey;

            focusContainerNode = sourceNode.inside('[plugin-fm="true"]');
            if (focusContainerNode) {
                // key was pressed inside a focusmanagable container
                selector = getFocusManagerSelector(focusContainerNode);
                keyCode = e.keyCode;

                // first check for keydown:
                actionkey = focusContainerNode._plugin.fm.model.keydown;
                focusNode = nextFocusNode(e, keyCode, actionkey, focusContainerNode, sourceNode, selector, true);
                if (!focusNode) {
                    // check for keyup:
                    actionkey = focusContainerNode._plugin.fm.model.keyup;
                    focusNode = nextFocusNode(e, keyCode, actionkey, focusContainerNode, sourceNode, selector);
                }
                if (!focusNode) {
                    // check for keyenter, but only when e.target equals a focusmanager:
                    if (sourceNode.matches('[plugin-fm="true"]')) {
                        actionkey = sourceNode._plugin.fm.model.keyenter;
                        if (actionkey) {
                            keys = actionkey.split('+');
                            len = keys.length;
                            lastIndex = len - 1;
                            // double == --> keyCode is number, keys is a string
                            if (keyCode==keys[lastIndex]) {
                                // posible keyup --> check if special characters match:
                                specialKeysMatch = true;
                                SPECIAL_KEYS.some(function(value) {
                                    specialKeysMatch = !e[value];
                                    return !specialKeysMatch;
                                });
                                for (i=lastIndex-1; (i>=0) && !specialKeysMatch; i--) {
                                    specialKey = keys[i].toLowerCase();
                                    specialKeysMatch = e[SPECIAL_KEYS[specialKey]];
                                }
                            }
                            if (specialKeysMatch) {
                                resetLastValue(sourceNode);
                                focusNode = searchFocusNode(sourceNode, true);
                            }
                        }
                    }
                }
                if (!focusNode) {
                    // check for keyleave:
                    actionkey = focusContainerNode._plugin.fm.model.keyleave;
                    if (actionkey) {
                        keys = actionkey.split('+');
                        len = keys.length;
                        lastIndex = len - 1;
                        // double == --> keyCode is number, keys is a string
                        if (keyCode==keys[lastIndex]) {
                            // posible keyup --> check if special characters match:
                            specialKeysMatch = true;
                            SPECIAL_KEYS.some(function(value) {
                                specialKeysMatch = !e[value];
                                return !specialKeysMatch;
                            });
                            for (i=lastIndex-1; (i>=0) && !specialKeysMatch; i--) {
                                specialKey = keys[i].toLowerCase();
                                specialKeysMatch = e[SPECIAL_KEYS[specialKey]];
                            }
                        }
                        if (specialKeysMatch) {
                            resetLastValue(focusContainerNode);
                            focusNode = focusContainerNode;
                        }
                    }
                }
                if (focusNode) {
                    e.preventDefaultContinue();
                    e.preventRender(); // don't double render --> focus does this
                    // prevent default action --> we just want to re-focus, but we DO want afterlisteners
                    // to be handled in the after-listener: someone else might want to halt the keydown event.
                    e._focusNode = focusNode;
                }
            }
        });

        Event.after('keydown', function(e) {
            console.log(NAME+'after keydown-event');
            var focusNode = e._focusNode;
            if (focusNode && focusNode.focus) {
                e.preventRender(); // don't double render --> focus does this
                focusNode.focus();
            }
        });

        Event.after('focus', function(e) {
            console.log(NAME+'after focus-event');
            var node = e.target,
                body = DOCUMENT.body,
                cleanFocussedData = function(element, loop) {
                    if (element.removeData) {
                        do {
                            // we also need to set the appropriate nodeData, so that when the itags re-render,
                            // they don't reset this particular information
                            element.removeData(FOCUSSED);
                            element.removeClass(FOCUSSED, null, null, true);
                            element = (element===body) ? null : element.getParent();
                        } while (element && loop);
                    }
                };
            // first, unfocus currently focussed items and up the tree
            DOCUMENT.getAll('.'+FOCUSSED, true).forEach(cleanFocussedData);
            if (node && node.setClass) {
                do {
                    // we also need to set the appropriate nodeData, so that when the itags re-render,
                    // they don't reset this particular information
                    node.setData(FOCUSSED, true);
                    node.setClass(FOCUSSED, null, null, true);
                    node = (node===body) ? null : node.getParent();
                } while (node);
            }
        }, true); // set in front: we need to make use of the previous DOCUMENT._activeElement, before it gets updated by event-dom

        // focus-fix for keeping focus when a mouse gets down for a longer time
        Event.after('mousedown', function(e) {
            console.log(NAME+'after focus-event');
            var node = e.target;
            if (!node.hasFocus()) {
                e.preventRender(); // don't double render --> focus does this
                node.focus();
            }
        }, 'button');

        Event.after('tap', function(e) {
            console.log(NAME+'after tap-event');
            var focusNode = e.target,
                focusContainerNode;
            if (e._noFocus) {
                return;
            }
            if (focusNode && focusNode.inside) {
                focusContainerNode = focusNode.hasAttr('plugin-fm') ? focusNode : focusNode.inside('[plugin-fm="true"]');
            }
            if (focusContainerNode) {
                if ((focusNode===focusContainerNode) || !focusNode.matches(getFocusManagerSelector(focusContainerNode))) {
                    focusNode = searchFocusNode(focusNode, true);
                }
                if (focusNode.hasFocus()) {
                    markAsFocussed(focusContainerNode, focusNode);
                }
                else {
                    e.preventRender(); // don't double render --> let focus do this
                    focusNode.focus();
                }
            }
        }, null, null, true);

        Event.after(['keypress', 'mouseup', 'panup', 'mousedown', 'pandown'], function(e) {
            console.log(NAME+'after '+e.type+'-event');
            var focusContainerNode,
                sourceNode = e.target,
                selector;

            focusContainerNode = sourceNode.inside('[plugin-fm="true"]');
            if (focusContainerNode) {
                // key was pressed inside a focusmanagable container
                selector = getFocusManagerSelector(focusContainerNode);
                if (sourceNode.matches(selector)) {
                    sourceNode.setAttr(FM_SELECTION_START, sourceNode.selectionStart || '0', true)
                              .setAttr(FM_SELECTION_END, sourceNode.selectionEnd || '0', true);
                }
            }
        }, 'input[type="text"], textarea');

        Event.after('focus', function(e) {
            console.log(NAME+'after focus-event');
            var focusContainerNode,
                sourceNode = e.target,
                selector, selectionStart, selectionEnd;

            focusContainerNode = sourceNode.inside('[plugin-fm="true"]');
            if (focusContainerNode) {
                // key was pressed inside a focusmanagable container
                selector = getFocusManagerSelector(focusContainerNode);
                if (sourceNode.matches(selector)) {
                    // cautious: fm-selectionstart can be 0 --> which would lead into a falsy value
                    selectionStart = sourceNode.getAttr(FM_SELECTION_START);
                    (selectionStart===undefined) && (selectionStart=sourceNode.getValue().length);
                    selectionEnd = Math.max(sourceNode.getAttr(FM_SELECTION_END) || selectionStart, selectionStart);
                    sourceNode.selectionEnd = selectionEnd;
                    sourceNode.selectionStart = selectionStart;
                    markAsFocussed(focusContainerNode, sourceNode);
                }
            }
        }, 'input[type="text"], textarea');

    };

    setupEvents();

    window._ITSAmodules.FocusManager = FocusManager = DOCUMENT.definePlugin('fm', null, {
                attrs: {
                    manage: 'string',
                    alwaysdefault: 'boolean',
                    keyup: 'string',
                    keydown: 'string',
                    keyenter: 'string',
                    keyleave: 'string',
                    noloop: 'boolean'
                },
                defaults: {
                    manage: 'true',
                    alwaysdefault: false,
                    keyup: DEFAULT_KEYUP,
                    keydown: DEFAULT_KEYDOWN,
                    noloop: DEFAULT_NOLOOP
                }
            });

    defineFocusEvent = function(customevent) {
        Event.defineEvent(customevent)
             .defaultFn(function(e) {
                 var node = e.target,
                     leftScroll = window.getScrollLeft(),
                     topScroll = window.getScrollTop();
                 node._focus();
                 // reset winscroll:
                 window.scrollTo(leftScroll, topScroll);
                 // make sure the node is inside the viewport:
                 // node.forceIntoView();
             });
    };

    (function(HTMLElementPrototype) {

        HTMLElementPrototype._focus = HTMLElementPrototype.focus;
        HTMLElementPrototype.focus = function(noRender, noRefocus) {
            console.log(NAME+'focus');
            /**
             * In case of a manual focus (node.focus()) the node will fire an `manualfocus`-event
             * which can be prevented.
             * @event manualfocus
            */
            var focusElement = this,
                doEmit, focusContainerNode;
            doEmit = function(focusNode) {
                var emitterName = focusNode._emitterName,
                    customevent = emitterName+':manualfocus';
                Event._ce[customevent] || defineFocusEvent(customevent);
                focusNode.emit('manualfocus', noRender ? {_noRender: true} : null);
            };
            if (noRefocus) {
                doEmit(focusElement);
            }
            else {
                focusContainerNode = (this.getAttr('plugin-fm')==='true') ? focusElement : focusElement.inside('[plugin-fm="true"]');
                if (focusContainerNode) {
                    focusContainerNode.pluginReady('fm').then(
                        function() {
                            doEmit(searchFocusNode(focusElement));
                        }
                    );
                }
                else {
                    doEmit(focusElement);
                }
            }
        };

    }(window.HTMLElement.prototype));


    return FocusManager;
};
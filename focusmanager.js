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
    DEFAULT_SELECTOR = 'input, button, select, textarea, .focusable',
    // SPECIAL_KEYS needs to be a native Object --> we need .some()
    SPECIAL_KEYS = {
        shift: 'shiftKey',
        ctrl: 'ctrlKey',
        cmd: 'metaKey',
        alt: 'altKey'
    },
    DEFAULT_KEYUP = 'shift+9',
    DEFAULT_KEYDOWN = '9',
    FM_SELECTION = 'fm-selection',
    FM_SELECTION_START = FM_SELECTION+'start',
    FM_SELECTION_END = FM_SELECTION+'end',
    FOCUSSED = 'focussed';

module.exports = function (window) {

    var DOCUMENT = window.document,
        nodePlugin, FocusManager, Event, nextFocusNode, searchFocusNode, markAsFocussed, getFocusManagerSelector, setupEvents, defineFocusEvent;

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', createHashMap());

    require('window-ext')(window);
/*jshint boss:true */
    if (FocusManager=window._ITSAmodules.FocusManager) {
/*jshint boss:false */
        return FocusManager; // FocusManager was already created
    }

    nodePlugin = require('vdom')(window).Plugins.nodePlugin;
    Event = require('event-mobile')(window);

    getFocusManagerSelector = function(focusContainerNode) {
        var selector = focusContainerNode.getAttr('fm-manage');
        (selector.toLowerCase()==='true') && (selector=DEFAULT_SELECTOR);
        return selector;
    };

    nextFocusNode = function(e, keyCode, actionkey, focusContainerNode, sourceNode, selector, downwards) {
        console.log(NAME+'nextFocusNode');
        var keys, lastIndex, i, specialKeysMatch, specialKey, len, enterPressedOnInput, primaryButtons,
            inputType, foundNode, formNode, primaryonenter, noloop;
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
            noloop = focusContainerNode.getAttr('fm-noloop');
            noloop = noloop && (noloop.toLowerCase()==='true');
            if (downwards) {
                return sourceNode.next(selector, focusContainerNode) || (noloop ? sourceNode.last(selector, focusContainerNode) : sourceNode.first(selector, focusContainerNode));
            }
            else {
                return sourceNode.previous(selector, focusContainerNode) || (noloop ? sourceNode.first(selector, focusContainerNode) : sourceNode.last(selector, focusContainerNode));
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
        focusContainerNode.getAll('[fm-lastitem]')
                          .removeAttrs(['fm-lastitem', 'tabindex'], true)
                          .removeData('fm-tabindex');

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

    searchFocusNode = function(initialNode) {
        console.log(NAME+'searchFocusNode');
        var focusContainerNode = initialNode.hasAttr('fm-manage') ? initialNode : initialNode.inside('[fm-manage]'),
            focusNode, alwaysDefault, fmAlwaysDefault, selector, allFocusableNodes, index;

        if (focusContainerNode) {
            selector = getFocusManagerSelector(focusContainerNode);
            focusNode = initialNode.matches(selector) ? initialNode : initialNode.inside(selector);
            if (focusNode && focusContainerNode.contains(focusNode)) {
                markAsFocussed(focusContainerNode, focusNode);
            }
            else {
                // find the right node that should get focus
/*jshint boss:true */
                alwaysDefault = ((fmAlwaysDefault=focusContainerNode.getAttr('fm-alwaysdefault')) && (fmAlwaysDefault.toLowerCase()==='true'));
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
                    markAsFocussed(focusContainerNode, focusNode);
                }
                else {
                    focusNode = initialNode;
                }
            }
        }
        else {
            focusNode = initialNode;
        }
console.warn('searchFocusNode found the node to be focussed:');
console.warn(focusNode);
        return focusNode;
    };

    setupEvents = function() {

        Event.before('keydown', function(e) {
            console.log(NAME+'before keydown-event');
            var focusContainerNode,
                sourceNode = e.target,
                node = sourceNode.getParent(),
                selector, keyCode, actionkey, focusNode;

            focusContainerNode = sourceNode.inside('[fm-manage]');
            if (focusContainerNode) {
                // key was pressed inside a focusmanagable container
                selector = getFocusManagerSelector(focusContainerNode);
                keyCode = e.keyCode;

                // first check for keydown:
                actionkey = node.getAttr('fm-keydown') || DEFAULT_KEYDOWN;
                focusNode = nextFocusNode(e, keyCode, actionkey, focusContainerNode, sourceNode, selector, true);
                if (!focusNode) {
                    // check for keyup:
                    actionkey = node.getAttr('fm-keyup') || DEFAULT_KEYUP;
                    focusNode = nextFocusNode(e, keyCode, actionkey, focusContainerNode, sourceNode, selector);
                }
                if (focusNode) {
                    e.preventDefaultContinue();
                    e.preventRender(); // don't double render --> focus does this
                    // prevent default action --> we just want to re-focus, but we DO want afterlisteners
                    // to be handled in the after-listener: someone else might want to halt the keydown event.
                    sourceNode.matches(selector) && (e._focusNode=focusNode);
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

        Event.after('blur', function(e) {
            console.log(NAME+'after blur-event');
            var node = e.target,
                body = DOCUMENT.body;
            if (node && node.removeAttr) {
                do {
                    // we also need to set the appropriate nodeData, so that when the itags re-render,
                    // they don't reset this particular information
                    node.removeData(FOCUSSED);
                    node.removeClass(FOCUSSED, null, null, true);
                    node = (node===body) ? null : node.getParent();
                } while (node);
            }
        });

        Event.after('focus', function(e) {
            console.log(NAME+'after focus-event');
            var node = e.target,
                body = DOCUMENT.body;
            if (node && node.setClass) {
                do {
                    // we also need to set the appropriate nodeData, so that when the itags re-render,
                    // they don't reset this particular information
                    node.setData(FOCUSSED, true);
                    node.setClass(FOCUSSED, null, null, true);
                    node = (node===body) ? null : node.getParent();
                } while (node);
            }
        });

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
            if (focusNode && focusNode.inside) {
                focusContainerNode = focusNode.hasAttr('fm-manage') ? focusNode : focusNode.inside('[fm-manage]');
            }
            if (focusContainerNode) {
                if ((focusNode===focusContainerNode) || !focusNode.matches(getFocusManagerSelector(focusContainerNode))) {
                    focusNode = searchFocusNode(focusNode);
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

            focusContainerNode = sourceNode.inside('[fm-manage]');
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

            focusContainerNode = sourceNode.inside('[fm-manage]');
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

    window._ITSAmodules.FocusManager = FocusManager = nodePlugin.definePlugin('fm', {manage: 'true'});

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
            var focusNode = noRefocus ? this : searchFocusNode(this),
                emitterName = focusNode._emitterName,
                customevent = emitterName+':manualfocus';
            Event._ce[customevent] || defineFocusEvent(customevent);
            focusNode.emit('manualfocus', noRender ? {_noRender: true} : null);
        };

    }(window.HTMLElement.prototype));


    return FocusManager;
};
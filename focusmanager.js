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
    DEFAULT_SELECTOR = 'input, button, select, .focusable',
    SPECIAL_KEYS = {
        shift: 'shiftKey',
        ctrl: 'ctrlKey',
        cmd: 'metaKey',
        alt: 'altKey'
    },
    DEFAULT_KEYUP = 'shift+9',
    DEFAULT_KEYDOWN = '9';

module.exports = function (window) {

    var DOCUMENT = window.document,
        NodePlugin, FocusManager, Event, nextFocusNode, searchFocusNode, markAsFocussed, getFocusManagerSelector;

    if (!window._ITSAmodules) {
        Object.defineProperty(window, '_ITSAmodules', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: {} // `writable` is false means we cannot chance the value-reference, but we can change {} its members
        });
    }

/*jshint boss:true */
    if (FocusManager=window._ITSAmodules.FocusManager) {
/*jshint boss:false */
        return FocusManager; // FocusManager was already created
    }

    NodePlugin = require('vdom')(window).Plugins.NodePlugin;
    Event = require('event-dom')(window);

    getFocusManagerSelector = function(focusContainerNode) {
        var selector = focusContainerNode.getAttr('focusmanager');
        (selector.toLowerCase()==='true') && (selector=DEFAULT_SELECTOR);
        return selector;
    };

    nextFocusNode = function(e, keyCode, actionkey, focusContainerNode, sourceNode, selector, downwards) {
        console.log(NAME+'nextFocusNode');
        var keys, lastIndex, i, specialKeysMatch, specialKey, len, enterPressedOnInput, primaryButtons, foundNode, formNode, primaryonenter;
        keys = actionkey.split('+');
        len = keys.length;
        lastIndex = len - 1;
        enterPressedOnInput = (keyCode===13) && (sourceNode.getTagName()==='INPUT') && (sourceNode.getAttr('type').toLowerCase()==='text');
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
                        Event.emit(foundNode, 'UI:click');
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
            if (downwards) {
                return sourceNode.next(selector) || sourceNode.first(selector);
            }
            else {
                return sourceNode.previous(selector) || sourceNode.last(selector);
            }
        }
        return false;
    };

    markAsFocussed = function(focusContainerNode, node) {
        console.log(NAME+'markAsFocussed');
        focusContainerNode.getAll('[fm-lastitem]').removeAttr('fm-lastitem');
        node.setAttrs([
            {name: 'tabIndex', value: '0'},
            {name: 'fm-lastitem', value: true}
        ]);
    };

    searchFocusNode = function(initialNode) {
        console.log(NAME+'searchFocusNode');
        var focusContainerNode = initialNode.hasAttr('focusmanager') ? initialNode : initialNode.inside('[focusmanager]'),
            focusNode, alwaysDefault, fmAlwaysDefault;

        if (focusContainerNode) {
            if (initialNode.matches(getFocusManagerSelector(focusContainerNode))) {
                markAsFocussed(focusContainerNode, initialNode);
                focusNode = initialNode;
            }
            else {
                // find the right node that should get focus
/*jshint boss:true */
                alwaysDefault = ((fmAlwaysDefault=focusContainerNode.getAttr('fm-alwaysdefault')) && (fmAlwaysDefault.toLowerCase()==='true'));
/*jshint boss:false */
                focusNode = focusContainerNode.getElement(alwaysDefault ? '[fm-defaultitem="true"]' : '[fm-lastitem="true"]') ||
                            focusContainerNode.getElement(alwaysDefault ? '[fm-lastitem="true"]' : '[fm-defaultitem="true"]') ||
                            focusContainerNode.getElement(getFocusManagerSelector(focusContainerNode));
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
        return focusNode;
    };

    Event.before('keydown', function(e) {
        console.log(NAME+'before keydown-event');
        var focusContainerNode,
            sourceNode = e.target,
            node = sourceNode.getParent(),
            selector, keyCode, actionkey, focusNode;

        focusContainerNode = sourceNode.inside('[focusmanager]');
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
                // prevent default action --> we just want to re-focus, but we DO want afterlisteners
                // to be handled in the after-listener: someone else might want to halt the keydown event.
                sourceNode.matches(selector) && (e._focusNode=focusNode);
            }
        }
    });

    Event.after('keydown', function(e) {
        console.log(NAME+'after keydown-event');
        var focusNode = e._focusNode;
        focusNode && focusNode.focus && focusNode.focus();
    });

    Event.after('blur', function(e) {
        console.log(NAME+'after blur-event');
        var node = e.target,
            body = DOCUMENT.body;
        if (node && node.removeAttr) {
            node.removeAttr('tabIndex');
            do {
                node.removeClass('focussed');
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
                node.setClass('focussed');
                node = (node===body) ? null : node.getParent();
            } while (node);
        }
    });

    Event.after('tap', function(e) {
        console.log(NAME+'after tap-event');
        var focusNode = e.target,
            focusContainerNode;

        if (focusNode && focusNode.inside) {
            focusContainerNode = focusNode.hasAttr('focusmanager') ? focusNode : focusNode.inside('[focusmanager]');
        }
        if (focusContainerNode) {
            if ((focusNode===focusContainerNode) || !focusNode.matches(getFocusManagerSelector(focusContainerNode))) {
                focusNode = searchFocusNode(focusNode);
            }
            if (focusNode.hasFocus()) {
                markAsFocussed(focusContainerNode, focusNode);
            }
            else {
                focusNode.focus();
            }
        }
    });

    Event.after(['keypress', 'mouseup', 'panup', 'mousedown', 'pandown'], function(e) {
        console.log(NAME+'after '+e.type+'-event');
        var focusContainerNode,
            sourceNode = e.target,
            selector;

        focusContainerNode = sourceNode.inside('[focusmanager]');
        if (focusContainerNode) {
            // key was pressed inside a focusmanagable container
            selector = getFocusManagerSelector(focusContainerNode);
            if (sourceNode.matches(selector)) {
                sourceNode.setAttr('fm-selectionstart', sourceNode.selectionStart)
                          .setAttr('fm-selectionend', sourceNode.selectionEnd);
            }
        }
    }, 'input[type="text"], textarea');

    Event.after('focus', function(e) {
        console.log(NAME+'after focus-event');
        var focusContainerNode,
            sourceNode = e.target,
            selector, selectionStart, selectionEnd;

        focusContainerNode = sourceNode.inside('[focusmanager]');
        if (focusContainerNode) {
            // key was pressed inside a focusmanagable container
            selector = getFocusManagerSelector(focusContainerNode);
            if (sourceNode.matches(selector)) {
                selectionStart = sourceNode.getAttr('fm-selectionstart') || sourceNode.getValue().length;
                selectionEnd = Math.max(sourceNode.getAttr('fm-selectionend') || selectionStart, selectionStart);
                sourceNode.selectionEnd = selectionEnd;
                sourceNode.selectionStart = selectionStart;
                markAsFocussed(focusContainerNode, sourceNode);
            }
        }
    }, 'input[type="text"], textarea');

    window._ITSAmodules.FocusManager = FocusManager = NodePlugin.subClass(
        function (config) {
            var instance = this;
            config || (config={});
            instance.focusmanager = config.selector;
            instance['fm-keyup'] = config.keyup;
            instance['fm-keydown'] = config.keydown;
            instance['fm-alwaysdefault'] = config.alwaysdefault;
        }
    );


    (function(HTMLElementPrototype) {

        HTMLElementPrototype._focus = HTMLElementPrototype.focus;
        HTMLElementPrototype.focus = function() {
            console.log(NAME+'focus');
            searchFocusNode(this)._focus();
        };

    }(window.HTMLElement.prototype));


    return FocusManager;
};
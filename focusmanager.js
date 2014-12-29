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
 * @module useragent
 * @class USERAGENT
 * @since 0.0.1
*/

var NAME = '[focusmanager]: ',
    DEFAULT_SELECTOR = 'input, button, select, .focusable',
    SPECIAL_KEYS = {
        shift: 'shiftKey',
        ctrl: 'ctrlKey',
        cmd: 'metaKey',
        alt: 'altKey'
    };

module.exports = function (window) {

    var DOCUMENT = window.document,
        NodePlugin, FocusManager, Event, findFocusNode;

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

    findFocusNode = function(e, keyCode, actionkey, sourceNode, selector, downwards) {
        var keys, lastIndex, i, specialKeysMatch, specialKey, len;
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
            if (downwards) {
                return sourceNode.next(selector) || sourceNode.first(selector);
            }
            else {
                return sourceNode.previous(selector) || sourceNode.last(selector);
            }
        }
        return false;
    };

    Event.before('keydown', function(e) {
        var focusContainerNode,
            sourceNode = e.target,
            node = sourceNode.getParent(),
            selector, keyCode, actionkey, focusNode;

        focusContainerNode = sourceNode.inside('[fm-selector]');
        if (focusContainerNode) {
            // key was pressed inside a focusmanagable container
            selector = focusContainerNode.getAttr('fm-selector');
            keyCode = e.keyCode;

            // first check for keydown:
            actionkey = node.getAttr('fm-keydown');
            focusNode = findFocusNode(e, keyCode, actionkey, sourceNode, selector, true);
            if (!focusNode) {
                // check for keyup:
                actionkey = node.getAttr('fm-keyup');
                focusNode = findFocusNode(e, keyCode, actionkey, sourceNode, selector);
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
        var focusNode = e._focusNode;
        focusNode && focusNode.focus && focusNode.focus();
    });

    Event.after('blur', function(e) {
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
        var focusNode = e.target,
            focusContainerNode = focusNode && focusNode.inside && focusNode.inside('[fm-selector]');

        if (focusContainerNode && focusNode.matches(focusContainerNode.getAttr('fm-selector'))) {
            focusNode.hasFocus() || focusNode.focus();
        }
    });

    window._ITSAmodules.FocusManager = FocusManager = NodePlugin.subClass(
        function (config) {
            var instance = this;
            config || (config={});
            instance['fm-selector'] = config.selector || DEFAULT_SELECTOR;
            instance['fm-keyup'] = config.keyup || 'shift+9';
            instance['fm-keydown'] = config.keydown || '9';
        }
    );


    (function(HTMLElementPrototype) {

        HTMLElementPrototype._focus = HTMLElementPrototype.focus;
        HTMLElementPrototype.focus = function() {
            var instance = this,
                focusContainerNode = instance.inside('[fm-selector]');

            focusContainerNode && instance.matches(focusContainerNode.getAttr('fm-selector')) && instance.setAttr('tabIndex', '0');
            instance._focus();
        };

    }(window.HTMLElement.prototype));


    return FocusManager;
};
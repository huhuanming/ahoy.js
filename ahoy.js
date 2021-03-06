/*
 * Ahoy.js
 * Simple, powerful JavaScript analytics
 * https://github.com/ankane/ahoy.js
 * v0.1.0
 * MIT License
 */
/*jslint browser: true, indent: 2, plusplus: true, vars: true */
(function (window) {
  'use strict';
  var ahoy = window.ahoy || window.Ahoy || {};
  var visitId, visitorId, track;
  var visitTtl = 4 * 60;
  // 4 hours
  var visitorTtl = 2 * 365 * 24 * 60;
  // 2 years
  var isReady = false;
  var queue = [];
  var canStringify = typeof JSON !== 'undefined' && typeof JSON.stringify !== 'undefined';
  var eventQueue = [];
  var visitsUrl = ahoy.visitsUrl || '/ahoy/visits';
  var eventsUrl = ahoy.eventsUrl || '/ahoy/events';
  // cookies
  // http://www.quirksmode.org/js/cookies.html
  function setCookie(name, value, ttl) {
    var expires = '';
    var cookieDomain = '';
    if (ttl) {
      var date = new Date();
      date.setTime(date.getTime() + ttl * 60 * 1000);
      expires = '; expires=' + date.toGMTString();
    }
    if (ahoy.domain) {
      cookieDomain = '; domain=' + ahoy.domain;
    }
    document.cookie = name + '=' + escape(value) + expires + cookieDomain + '; path=/';
  }
  function getCookie(name) {
    var i, c;
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for (i = 0; i < ca.length; i++) {
      c = ca[i];
      while (c.charAt(0) === ' ') {
        c = c.substring(1, c.length);
      }
      if (c.indexOf(nameEQ) === 0) {
        return unescape(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  }
  function destroyCookie(name) {
    setCookie(name, '', -1);
  }
  function log(message) {
    if (getCookie('ahoy_debug')) {
      window.console.log(message);
    }
  }
  function post(url, data, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        callback();
      }
    };
    xhr.send(JSON.stringify(data));
  }
  function setReady() {
    var callback;
    while (callback = queue.shift()) {
      callback();
    }
    isReady = true;
  }
  function ready(callback) {
    if (isReady) {
      callback();
    } else {
      queue.push(callback);
    }
  }
  // http://stackoverflow.com/a/2117523/1177228
  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : r & 3 | 8;
      return v.toString(16);
    });
  }
  function saveEventQueue() {
    // TODO add stringify method for IE 7 and under
    if (canStringify) {
      setCookie('ahoy_events', JSON.stringify(eventQueue), 1);
    }
  }
  function trackEvent(event) {
    if (!ahoy.getVisitId()) {
      ready(createVisit);
    }
    ready(function () {
      // ensure JSON is defined
      if (canStringify) {
        post(eventsUrl, [event], function () {
          for (var i = 0; i < eventQueue.length; i++) {
            if (eventQueue[i].id == event.id) {
              eventQueue.splice(i, 1);
              break;
            }
          }
          saveEventQueue();
        });
      }
    });
  }
  function page() {
    return ahoy.page || window.location.pathname;
  }
  function eventProperties(e) {
    var target = e.target || e.srcElement;
    return {
      tag: target.nodeName.toLowerCase(),
      id: target.getAttribute('id'),
      'class': target.className,
      page: page()  // because it is not frequently used, I think it can be deleted.
              // section: $target.closest("*[data-section]").data("section")
    };
  }
  // main
  function createVisit() {
    visitId = ahoy.getVisitId();
    visitorId = ahoy.getVisitorId();
    track = getCookie('ahoy_track');
    if (visitId && visitorId && !track) {
      // TODO keep visit alive?
      log('Active visit');
      setReady();
    } else {
      if (track) {
        destroyCookie('ahoy_track');
      }
      if (!visitId) {
        visitId = generateId();
        setCookie('ahoy_visit', visitId, visitTtl);
      }
      // make sure cookies are enabled
      if (getCookie('ahoy_visit')) {
        log('Visit started');
        if (!visitorId) {
          visitorId = generateId();
          setCookie('ahoy_visitor', visitorId, visitorTtl);
        }
        var data = {
          visit_token: visitId,
          visitor_token: visitorId,
          platform: ahoy.platform || 'Web',
          landing_page: window.location.href,
          screen_width: window.screen.width,
          screen_height: window.screen.height
        };
        // referrer
        if (document.referrer.length > 0) {
          data.referrer = document.referrer;
        }
        log(data);
        post(visitsUrl, data, setReady);
      } else {
        log('Cookies disabled');
        setReady();
      }
    }
  }
  ahoy.getVisitId = ahoy.getVisitToken = function () {
    return getCookie('ahoy_visit');
  };
  ahoy.getVisitorId = ahoy.getVisitorToken = function () {
    return getCookie('ahoy_visitor');
  };
  ahoy.reset = function () {
    destroyCookie('ahoy_visit');
    destroyCookie('ahoy_visitor');
    destroyCookie('ahoy_events');
    destroyCookie('ahoy_track');
    return true;
  };
  ahoy.debug = function (enabled) {
    if (enabled === false) {
      destroyCookie('ahoy_debug');
    } else {
      setCookie('ahoy_debug', 't', 365 * 24 * 60);  // 1 year
    }
    return true;
  };
  ahoy.track = function (name, properties) {
    // generate unique id
    var event = {
      id: generateId(),
      name: name,
      properties: properties,
      time: new Date().getTime() / 1000
    };
    log(event);
    eventQueue.push(event);
    saveEventQueue();
    // wait in case navigating to reduce duplicate events
    setTimeout(function () {
      trackEvent(event);
    }, 1000);
  };
  ahoy.trackView = function () {
    var properties = {
      url: window.location.href,
      title: document.title,
      page: page()
    };
    ahoy.track('$view', properties);
  };
  ahoy.trackClicks = function () {
    document.onclick = function (event) {
      event = event || window.event;
      var target = event.target || event.srcElement;
      if (target.nodeName === 'A' || target.nodeName === 'BUTTON' || target.nodeName === 'INPUT' && target.getAttribute('type') === 'submit') {
        var properties = eventProperties(event);
        properties.text = target.nodeName === 'INPUT' ? target.value : target.innerText.replace(/[\s\r\n]+/g, ' ').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
        properties.href = target.getAttribute('href');
        ahoy.track('$click', properties);
      }
    };
  };
  ahoy.trackSubmits = function () {
    document.onsubmit = function (event) {
      var event = event || window.event;
      var target = event.target || event.srcElement;
      if (target.nodeName === 'FORM') {
        var properties = eventProperties(event);
        ahoy.track('$submit', properties);
      }
    };
  };
  ahoy.trackChanges = function () {
    document.onchange = function (event) {
      var event = event || window.event;
      var target = event.target || event.srcElement;
      if (target.nodeName === 'INPUT' || target.nodeName === 'TEXTAREA' || target.nodeName === 'SELECT') {
        var properties = eventProperties(event);
        ahoy.track('$change', properties);
      }
    };
  };
  ahoy.trackAll = function () {
    ahoy.trackView();
    ahoy.trackClicks();
    ahoy.trackSubmits();
    ahoy.trackChanges();
  };
  createVisit();
  // push events from queue
  try {
    eventQueue = JSON.parse(getCookie('ahoy_events') || '[]');
  } catch (e) {
  }
  for (var i = 0; i < eventQueue.length; i++) {
    trackEvent(eventQueue[i]);
  }
  window.ahoy = ahoy;
}(window));
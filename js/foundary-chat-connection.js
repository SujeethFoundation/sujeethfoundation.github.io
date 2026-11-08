/* Connects Microsoft Web Chat to the Sujeeth chat API.
 *
 * Web Chat normally talks to a Bot Framework "Direct Line" service. The Foundry agent is not one, so this file
 * stands in for it: it offers the same small interface Web Chat uses (activity$, connectionStatus$,
 * postActivity, end), keeps the conversation in the page, and sends it to the chat API for each question.
 *
 * Usage (see chat.html):
 *   const connection = window.SujeethChat.createConnection({ endpoint, userID, greeting, suggestions });
 *   window.WebChat.renderWebChat({ directLine: connection, userID, ... }, element);
 */
(function (global) {
  'use strict';

  // Values Web Chat expects for connectionStatus$.
  var STATUS = { Uninitialized: 0, Connecting: 1, Online: 2, ExpiredToken: 3, FailedToConnect: 4, Ended: 5 };

  // A tiny observable. Web Chat only needs subscribe() with an observer or callbacks, and unsubscribe().
  function Source(onSubscribe) {
    this._observers = [];
    this._onSubscribe = onSubscribe || null;
  }
  Source.prototype.subscribe = function (next, error, complete) {
    var observer = (typeof next === 'function' || next == null) ? { next: next, error: error, complete: complete } : next;
    var list = this._observers;
    list.push(observer);
    if (this._onSubscribe) { this._onSubscribe(observer); }
    return { unsubscribe: function () { var i = list.indexOf(observer); if (i >= 0) { list.splice(i, 1); } } };
  };
  Source.prototype.emit = function (value) {
    this._observers.slice().forEach(function (o) { if (o.next) { o.next(value); } });
  };
  Source.prototype.finish = function () {
    this._observers.slice().forEach(function (o) { if (o.complete) { o.complete(); } });
    this._observers.length = 0;
  };
  // Lets libraries that look for the standard observable symbol treat this as an observable.
  Source.prototype['@@observable'] = function () { return this; };
  if (typeof Symbol === 'function' && Symbol.observable) { Source.prototype[Symbol.observable] = function () { return this; }; }

  function nowIso() { return new Date().toISOString(); }

  function createConnection(options) {
    options = options || {};
    var endpoint = options.endpoint;
    var userID = options.userID || ('u_' + Math.random().toString(36).slice(2, 10));
    var conversationId = 'c_' + Math.random().toString(36).slice(2, 12);
    var timeoutMs = options.timeoutMs || 100000;
    var bot = { id: 'sujeeth-assistant', name: options.botName || 'Sujeeth Foundation', role: 'bot' };
    var counter = 0;
    var history = [];      // what the chat API sees: { role, content }
    var delivered = [];    // every message so far, replayed to anyone who starts listening later
    var ended = false;
    var status = STATUS.Uninitialized;

    // Web Chat starts listening more than once, and the listener that shows messages can start after the first
    // message was produced. A real chat service sends the history again when a listener joins, so do the same.
    // Web Chat replaces a message it already has (same id), so a repeat does not show twice.
    var activity$ = new Source(function (observer) {
      delivered.slice().forEach(function (a) { if (observer.next) { observer.next(a); } });
    });
    var connectionStatus$ = new Source(function (observer) {
      if (observer.next) { observer.next(status); }  // behaves like a value that replays to new listeners
    });

    function setStatus(value) { status = value; connectionStatus$.emit(value); }

    function deliver(activity) {
      if (ended) { return; }
      if (activity.type !== 'typing') { delivered.push(activity); }  // typing signals are not history
      activity$.emit(activity);
    }

    function botMessage(text, extra) {
      counter += 1;
      var activity = {
        type: 'message', id: conversationId + '|b' + counter, timestamp: nowIso(), text: text, textFormat: 'markdown',
        from: bot, conversation: { id: conversationId }, channelData: {}
      };
      if (extra) { Object.keys(extra).forEach(function (k) { activity[k] = extra[k]; }); }
      return activity;
    }

    function typing() {
      return { type: 'typing', id: conversationId + '|t' + (++counter), timestamp: nowIso(), from: bot, conversation: { id: conversationId } };
    }

    function greet() {
      if (!options.greeting) { return; }
      var extra = null;
      if (options.suggestions && options.suggestions.length) {
        extra = { suggestedActions: { to: [userID], actions: options.suggestions.map(function (s) {
          return { type: 'imBack', title: s, value: s };
        }) } };
      }
      deliver(botMessage(options.greeting, extra));
    }

    function ask(text) {
      history.push({ role: 'user', content: text });
      var keepTyping = setInterval(function () { deliver(typing()); }, 3000);
      deliver(typing());
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;

      function fail(message) {
        history.pop();  // the question got no answer, so leave it out of the conversation
        deliver(botMessage(message));
      }

      fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }), signal: controller ? controller.signal : undefined
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) { return { ok: response.ok, data: data }; });
      }).then(function (result) {
        if (result.ok && result.data && result.data.reply) {
          history.push({ role: 'assistant', content: result.data.reply });
          deliver(botMessage(result.data.reply));
        } else {
          fail((result.data && result.data.error) || 'The assistant is unavailable right now. Please try again in a minute, or browse sujeeth.org.');
        }
      }).catch(function () {
        fail('The assistant is unavailable right now. Please try again in a minute, or browse sujeeth.org.');
      }).then(function () {
        clearInterval(keepTyping);
        if (timer) { clearTimeout(timer); }
      });
    }

    function postActivity(activity) {
      var id = conversationId + '|u' + (++counter);
      var result = new Source(function (observer) {
        // Web Chat expects the new activity's id, then completion.
        setTimeout(function () { if (observer.next) { observer.next(id); } if (observer.complete) { observer.complete(); } }, 0);
      });
      if (ended) { return result; }
      var clientActivityID = activity && activity.channelData && activity.channelData.clientActivityID;

      // Web Chat waits to see its own message come back before it marks the message as sent.
      var echo = {};
      Object.keys(activity || {}).forEach(function (k) { echo[k] = activity[k]; });
      echo.id = id;
      echo.timestamp = nowIso();
      echo.conversation = { id: conversationId };
      echo.from = { id: userID, role: 'user' };
      echo.channelData = Object.assign({}, activity && activity.channelData, clientActivityID ? { clientActivityID: clientActivityID } : {});
      setTimeout(function () { deliver(echo); }, 0);

      if (activity && activity.type === 'message' && typeof activity.text === 'string' && activity.text.trim()) {
        setTimeout(function () { ask(activity.text.trim()); }, 0);
      }
      return result;
    }

    function end() {
      if (ended) { return; }
      ended = true;
      setStatus(STATUS.Ended);
      activity$.finish();
      connectionStatus$.finish();
    }

    // Go online on the next tick, so Web Chat has attached its listeners first.
    setTimeout(function () {
      if (ended) { return; }
      setStatus(STATUS.Connecting);
      setTimeout(function () {
        if (ended) { return; }
        setStatus(STATUS.Online);
        greet();
      }, 0);
    }, 0);

    return {
      activity$: activity$,
      connectionStatus$: connectionStatus$,
      postActivity: postActivity,
      end: end,
      referenceGrammarId: undefined,
      conversationId: conversationId
    };
  }

  global.SujeethChat = { createConnection: createConnection, STATUS: STATUS };
})(window);
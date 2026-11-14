/* Sujeeth Foundation chat widget loader.
 *
 * Embed on any page with ONE line:
 *   <script src="https://www.sujeeth.org/js/sujeeth-chat-widget.js" defer></script>
 *
 * Optional attributes on that tag:
 *   data-chat-url="https://www.sujeeth.org/chat"   page loaded in the iframe
 *   data-css-url="https://.../sujeeth-chat-widget.css"   override the stylesheet location
 *
 * Layout lives in /css/sujeeth-chat-widget.css. This script only:
 *   1. loads that stylesheet,
 *   2. builds the launcher + iframe panel,
 *   3. opens/closes them by toggling html.sjf-chat-open,
 *   4. makes sure the viewport meta lets the on-screen keyboard resize the layout viewport.
 */
(function () {
  "use strict";

  if (window.__sjfChatLoaded) return;
  window.__sjfChatLoaded = true;

  var script = document.currentScript ||
    document.querySelector('script[src*="sujeeth-chat-widget"]');
  var scriptSrc = script && script.src ? script.src : "https://www.sujeeth.org/js/sujeeth-chat-widget.js";
  var chatUrl = (script && script.getAttribute("data-chat-url")) || "https://www.sujeeth.org/chat";
  var cssUrl = (script && script.getAttribute("data-css-url")) ||
    new URL("../css/sujeeth-chat-widget.css", scriptSrc).href;

  var root = document.documentElement;
  var isOpen = false;
  var toggle, panel, frame;

  // Chromium on Android (including Edge) only shrinks the layout viewport for the
  // keyboard when the viewport meta says so. Add it without duplicating the tag.
  function ensureKeyboardResizesContent() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    if (meta.content.indexOf("interactive-widget") === -1) {
      meta.content = (meta.content ? meta.content + ", " : "width=device-width, initial-scale=1, ") +
        "interactive-widget=resizes-content";
    }
  }

  function setChat(open) {
    if (isOpen === open || !panel) return;
    isOpen = open;
    if (open && !frame.getAttribute("src")) frame.setAttribute("src", chatUrl);
    root.classList.toggle("sjf-chat-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  }

  function build() {
    var wrap = document.createElement("div");
    wrap.id = "sjf-chat";
    wrap.innerHTML =
      '<button class="sjf-chat-toggle" type="button" aria-label="Open chat" ' +
        'aria-expanded="false" aria-controls="sjf-chat-panel"></button>' +
      '<div class="sjf-chat-panel" id="sjf-chat-panel" role="dialog" aria-label="Sujeeth Foundation chat">' +
        '<iframe title="Sujeeth Foundation chat"></iframe>' +
      "</div>";
    document.body.appendChild(wrap); // direct child of <body>: escapes host-page stacking contexts

    toggle = wrap.querySelector(".sjf-chat-toggle");
    panel = wrap.querySelector(".sjf-chat-panel");
    frame = wrap.querySelector("iframe");

    toggle.addEventListener("click", function () { setChat(!isOpen); });

    // Start loading the chat page when the visitor reaches for the launcher, so it is ready by the click.
    // Visitors who never do this download nothing extra.
    function preload() {
      if (!frame.getAttribute("src")) frame.setAttribute("src", chatUrl);
    }
    ["pointerenter", "focus", "touchstart"].forEach(function (name) {
      toggle.addEventListener(name, preload, { once: true, passive: true });
    });
  }

  function init() {
    ensureKeyboardResizesContent();

    // Build the UI only once the stylesheet is in, so the button never flashes unstyled.
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    link.onload = build;
    link.onerror = function () { console.error("Sujeeth chat: could not load " + cssUrl); };
    document.head.appendChild(link);
  }

  window.openSujeethChat = function () { setChat(true); };
  window.closeSujeethChat = function () {
    setChat(false);
    if (toggle) toggle.focus();
  };

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) window.closeSujeethChat();
  });

  // The chat page posts this from its own close button.
  window.addEventListener("message", function (e) {
    if (frame && e.source === frame.contentWindow && e.data && e.data.type === "sujeeth-chat-close") {
      window.closeSujeethChat();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
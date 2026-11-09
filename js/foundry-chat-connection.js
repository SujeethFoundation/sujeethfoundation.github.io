/* Sujeeth Foundation standalone chat client.
 * The matching markup is in /chat.html and styles are in /css/sujeeth-chat.css.
 * Attachments remain in this tab's memory; they are never written to local storage.
 *
 * Assistant replies are rendered from a small markdown subset (links, bold,
 * italics, inline code, bullet and numbered lists, headings, paragraphs).
 * Rendering builds DOM nodes with textContent, never innerHTML, and only
 * https: and mailto: link targets are allowed.
 */
(function () {
  "use strict";

  const CHAT_ENDPOINT = "https://ontology-ghgedphdh6eefych.eastus-01.azurewebsites.net/api/chat";
  const GREETING = "Hi, I'm the Sujeeth Foundation assistant. I can answer questions about Career Circles and volunteering as a mentor, and help with career questions such as resumes, networking and interviews. Please don't share personal contact details.";
  const SUGGESTIONS = [
    "What is a Career Circle?",
    "How do I become a mentor?",
    "Give me feedback on my resume"
  ];

  const MAX_FILES_PER_MESSAGE = 3;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  // The API applies this limit across the 12-message request history, not just one turn.
  const MAX_TOTAL_FILE_BYTES = 7 * 1024 * 1024;
  const MAX_HISTORY_MESSAGES = 12;
  const ALLOWED_EXTENSIONS = new Set([
    "pdf", "txt", "md", "csv", "docx", "pptx", "xlsx"
  ]);

  // Groups: 1 link label, 2 link url, 3 bold, 4 code, 5 italic, 6 bare url.
  const INLINE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*\n]*)\*|(https?:\/\/[^\s<]*[^\s<.,;:!?)\]])/g;

  function makeLink(url, label) {
    const a = document.createElement("a");
    a.href = url;
    a.textContent = label;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  function appendInline(parent, text) {
    let last = 0;
    let match;
    INLINE.lastIndex = 0;
    while ((match = INLINE.exec(text)) !== null) {
      if (match.index > last) {
        parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      if (match[1]) {
        parent.appendChild(makeLink(match[2], match[1]));
      } else if (match[3]) {
        const strong = document.createElement("strong");
        strong.textContent = match[3];
        parent.appendChild(strong);
      } else if (match[4]) {
        const code = document.createElement("code");
        code.textContent = match[4];
        parent.appendChild(code);
      } else if (match[5]) {
        const em = document.createElement("em");
        em.textContent = match[5];
        parent.appendChild(em);
      } else if (match[6]) {
        parent.appendChild(makeLink(match[6], match[6]));
      }
      last = INLINE.lastIndex;
    }
    if (last < text.length) {
      parent.appendChild(document.createTextNode(text.slice(last)));
    }
  }

  function renderMarkdown(text, container) {
    container.textContent = "";
    // Strip Foundry citation markers such as 【4:0†source】 if the agent emits them.
    const lines = String(text)
      .replace(/【[^】]*】/g, "")
      .replace(/\r\n?/g, "\n")
      .split("\n");
    let paragraph = [];
    let list = null;     // the top-level list being built
    let sublist = null;  // a nested list under the last item
    let lastItem = null;

    function flushParagraph() {
      if (!paragraph.length) return;
      const p = document.createElement("p");
      appendInline(p, paragraph.join(" "));
      container.appendChild(p);
      paragraph = [];
    }

    function endList() {
      list = null;
      sublist = null;
      lastItem = null;
    }

    function newList(tag, parent, start) {
      const element = document.createElement(tag);
      if (tag === "ol" && start > 1) element.start = start;  // keep "3." as 3 when the model splits a list
      parent.appendChild(element);
      return element;
    }

    lines.forEach(raw => {
      const indent = raw.match(/^\s*/)[0].replace(/\t/g, "    ").length;
      const line = raw.trim();
      const bullet = line.match(/^[-*\u2022]\s+(.*)/);
      const number = line.match(/^(\d+)[.)]\s+(.*)/);
      const heading = line.match(/^#{1,6}\s+(.*)/);

      if (!line) {  // a blank line keeps a list open; the next line that is not a list item closes it
        flushParagraph();
        return;
      }

      if (bullet || number) {
        flushParagraph();
        const tag = bullet ? "ul" : "ol";
        const body = bullet ? bullet[1] : number[2];
        const start = bullet ? 1 : Number(number[1]);
        const item = document.createElement("li");
        appendInline(item, body);

        if (list && lastItem && indent >= 2) {  // an indented item nests under the one above it
          if (!sublist || sublist.tagName.toLowerCase() !== tag) sublist = newList(tag, lastItem, start);
          sublist.appendChild(item);
          return;
        }
        if (!list || list.tagName.toLowerCase() !== tag) list = newList(tag, container, start);
        sublist = null;
        lastItem = item;
        list.appendChild(item);
        return;
      }

      if (list && lastItem && indent >= 2 && !heading) {  // wrapped text that belongs to the item above
        lastItem.appendChild(document.createTextNode(" "));
        appendInline(lastItem, line);
        return;
      }

      endList();
      if (heading) {
        flushParagraph();
        const p = document.createElement("p");
        const strong = document.createElement("strong");
        appendInline(strong, heading[1]);
        p.appendChild(strong);
        container.appendChild(p);
        return;
      }
      paragraph.push(line);
    });
    flushParagraph();
  }

  function initialize() {
    const transcript = document.getElementById("transcript");
    const form = document.getElementById("composer");
    const input = document.getElementById("message");
    const fileInput = document.getElementById("file-input");
    const pendingFiles = document.getElementById("pending-files");
    const attachButton = document.getElementById("attach");
    const sendButton = document.getElementById("send");
    const restartButton = document.getElementById("restart");
    const closeButton = document.getElementById("close");

    const required = {
      transcript, form, input, fileInput, pendingFiles,
      attachButton, sendButton, restartButton, closeButton
    };
    const missing = Object.entries(required).filter(([, element]) => !element).map(([id]) => id);
    if (missing.length) {
      console.error("Sujeeth chat could not initialize. Missing chat.html elements:", missing.join(", "));
      return;
    }

    let history = [];
    let selectedFiles = [];
    let busy = false;
    let suggestionsElement = null;

    // options.markdown: render the text as markdown (assistant replies only).
    function addMessage(role, text, files, options) {
      const settings = options || {};
      const wrapper = document.createElement("article");
      wrapper.className = "message " + role;

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      const content = document.createElement("div");
      content.className = "bubble-text";
      if (role === "assistant" && settings.markdown) {
        renderMarkdown(text, content);
      } else {
        content.textContent = text;
      }
      bubble.appendChild(content);

      if (files && files.length) {
        const list = document.createElement("div");
        list.className = "message-files";
        files.forEach(file => {
          const item = document.createElement("span");
          item.className = "message-file";
          item.textContent = "Attachment: " + file.name;
          list.appendChild(item);
        });
        bubble.appendChild(list);
      }

      wrapper.appendChild(bubble);
      transcript.appendChild(wrapper);
      transcript.scrollTop = transcript.scrollHeight;
      return wrapper;
    }

    function addSuggestions() {
      suggestionsElement = document.createElement("div");
      suggestionsElement.className = "suggestions";
      SUGGESTIONS.forEach(label => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
          input.value = label;
          form.requestSubmit();
        });
        suggestionsElement.appendChild(button);
      });
      transcript.appendChild(suggestionsElement);
    }

    function renderGreeting() {
      transcript.textContent = "";
      suggestionsElement = null;
      addMessage("assistant", GREETING);
      addSuggestions();
    }

    function formatBytes(bytes) {
      return bytes < 1024 * 1024
        ? Math.ceil(bytes / 1024) + " KB"
        : (bytes / 1024 / 1024).toFixed(1) + " MB";
    }

    function recentHistoryAttachmentBytes() {
      return history.slice(-(MAX_HISTORY_MESSAGES - 1)).reduce((sum, message) => {
        if (!Array.isArray(message.attachments)) return sum;
        return sum + message.attachments.reduce((fileSum, file) => fileSum + (Number(file.size) || 0), 0);
      }, 0);
    }

    function renderPending() {
      pendingFiles.textContent = "";
      selectedFiles.forEach((file, index) => {
        const chip = document.createElement("span");
        chip.className = "pending-file";

        const label = document.createElement("span");
        label.textContent = file.name + " \u00b7 " + formatBytes(file.size);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "\u00d7";
        remove.setAttribute("aria-label", "Remove " + file.name);
        remove.addEventListener("click", () => {
          selectedFiles.splice(index, 1);
          renderPending();
        });

        chip.append(label, remove);
        pendingFiles.appendChild(chip);
      });
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read " + file.name + "."));
        reader.onload = () => {
          const result = String(reader.result || "");
          const comma = result.indexOf(",");
          if (comma < 0) {
            reject(new Error("Could not encode " + file.name + "."));
            return;
          }
          resolve(result.slice(comma + 1));
        };
        reader.readAsDataURL(file);
      });
    }

    async function encodeFiles(files) {
      const encoded = [];
      for (const file of files) {
        encoded.push({
          name: file.name,
          mime_type: file.type || "",
          size: file.size,
          data: await fileToBase64(file)
        });
      }
      return encoded;
    }

    function setBusy(value) {
      busy = value;
      sendButton.disabled = value;
      attachButton.disabled = value;
      input.disabled = value;
      restartButton.disabled = value;
      sendButton.classList.toggle("busy", value);
    }

    function closeChat() {
      if (window.parent !== window) {
        window.parent.postMessage({ type: "sujeeth-chat-close" }, "*");
      } else {
        window.location.href = "/";
      }
    }

    async function sendMessage(text, files) {
      let userMessage;
      let typing;
      try {
        const attachments = await encodeFiles(files);
        userMessage = { role: "user", content: text, attachments };
        history.push(userMessage);

        addMessage("user", text || "Please review the attached file(s).", files);
        if (suggestionsElement) {
          suggestionsElement.remove();
          suggestionsElement = null;
        }
        typing = addMessage("assistant", "Thinking\u2026");

        const response = await fetch(CHAT_ENDPOINT, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.slice(-MAX_HISTORY_MESSAGES) })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.reply) {
          history.pop();
          typing.remove();
          addMessage("assistant", data.error || "The assistant is unavailable right now. Please try again in a minute.");
          return;
        }

        history.push({ role: "assistant", content: data.reply, attachments: [] });
        renderMarkdown(data.reply, typing.querySelector(".bubble-text"));
        transcript.scrollTop = transcript.scrollHeight;
      } catch (error) {
        if (userMessage && history[history.length - 1] === userMessage) history.pop();
        if (typing) typing.remove();
        console.error("Sujeeth chat request failed:", error);
        addMessage("assistant", error && error.message
          ? error.message
          : "I couldn't reach the assistant. Check your connection and try again.");
      }
    }

    attachButton.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
      const incoming = Array.from(fileInput.files || []);
      let currentTotal = recentHistoryAttachmentBytes() + selectedFiles.reduce((sum, file) => sum + file.size, 0);

      for (const file of incoming) {
        const extension = (file.name.split(".").pop() || "").toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(extension)) {
          addMessage("assistant", file.name + " is not a supported file type.");
          continue;
        }
        if (selectedFiles.length >= MAX_FILES_PER_MESSAGE) {
          addMessage("assistant", "You can attach up to " + MAX_FILES_PER_MESSAGE + " files to one message.");
          break;
        }
        if (!file.size || file.size > MAX_FILE_BYTES) {
          addMessage("assistant", file.name + " must be no larger than 5 MB.");
          continue;
        }
        if (currentTotal + file.size > MAX_TOTAL_FILE_BYTES) {
          addMessage("assistant", "Attachments in the recent conversation must total no more than 7 MB. Start a new conversation to attach more.");
          break;
        }
        selectedFiles.push(file);
        currentTotal += file.size;
      }

      renderPending();
      fileInput.value = "";
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (busy) return;

      const text = input.value.trim();
      if (!text && !selectedFiles.length) return;

      const files = selectedFiles.slice();
      selectedFiles = [];
      renderPending();
      input.value = "";
      setBusy(true);
      try {
        await sendMessage(text, files);
      } finally {
        setBusy(false);
        input.focus();
      }
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    restartButton.addEventListener("click", () => {
      if (busy) return;
      history = [];
      selectedFiles = [];
      renderPending();
      renderGreeting();
      input.focus();
    });

    closeButton.addEventListener("click", closeChat);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeChat();
    });

    renderGreeting();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
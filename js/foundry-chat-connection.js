/* Lightweight chat client for the Sujeeth Foundation API.
 * Attachments remain in this tab's memory and are re-sent with the conversation history.
 * They are not saved to local storage. The server validates and processes every attachment.
 */
(function () {
  "use strict";

  const CHAT_ENDPOINT = "https://ontology-ghgedphdh6eefych.eastus-01.azurewebsites.net/api/chat";
  const GREETING = "Hi, I'm the Sujeeth Foundation assistant. I can answer questions about Career Circles and volunteering as a mentor, and help with career questions such as resumes, networking and interviews. Please don't share personal contact details.";
  const SUGGESTIONS = ["What is a Career Circle?", "How do I become a mentor?", "Give me feedback on my resume"];
  const MAX_FILES = 3;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 7 * 1024 * 1024;
  const ALLOWED = new Set(["pdf", "png", "jpg", "jpeg", "webp", "txt", "md", "csv", "docx", "pptx", "xlsx"]);

  const transcript = document.getElementById("transcript");
  const form = document.getElementById("composer");
  const input = document.getElementById("message");
  const fileInput = document.getElementById("file-input");
  const pendingFiles = document.getElementById("pending-files");
  const sendButton = document.getElementById("send");
  let history = [];
  let selectedFiles = [];
  let busy = false;

  function addMessage(role, text, files) {
    const wrapper = document.createElement("article");
    wrapper.className = "message " + role;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const content = document.createElement("p");
    content.textContent = text;
    bubble.appendChild(content);
    if (files && files.length) {
      const list = document.createElement("div");
      list.className = "message-files";
      files.forEach(file => {
        const item = document.createElement("span");
        item.className = "message-file";
        item.textContent = "📎 " + file.name;
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
    const wrap = document.createElement("div");
    wrap.className = "suggestions";
    SUGGESTIONS.forEach(label => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        input.value = label;
        form.requestSubmit();
      });
      wrap.appendChild(button);
    });
    transcript.appendChild(wrap);
  }

  function renderGreeting() {
    transcript.textContent = "";
    addMessage("assistant", GREETING);
    addSuggestions();
  }

  function formatBytes(bytes) {
    return bytes < 1024 * 1024 ? Math.ceil(bytes / 1024) + " KB" : (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function renderPending() {
    pendingFiles.textContent = "";
    selectedFiles.forEach((file, index) => {
      const chip = document.createElement("span");
      chip.className = "pending-file";
      const label = document.createElement("span");
      label.textContent = file.name + " · " + formatBytes(file.size);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
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
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.readAsDataURL(file);
    });
  }

  async function encodeFiles(files) {
    const result = [];
    for (const file of files) {
      result.push({
        name: file.name,
        mime_type: file.type || "",
        data: await fileToBase64(file)
      });
    }
    return result;
  }

  function setBusy(value) {
    busy = value;
    sendButton.disabled = value;
    document.getElementById("attach").disabled = value;
    input.disabled = value;
    sendButton.classList.toggle("busy", value);
  }

  async function sendMessage(text, files) {
    const attachments = await encodeFiles(files);
    const message = { role: "user", content: text, attachments };
    history.push(message);
    addMessage("user", text || "Please review the attached file(s).", files);
    const typing = addMessage("assistant", "Thinking…");
    const payload = { messages: history };
    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.reply) {
        history.pop();
        typing.remove();
        addMessage("assistant", data.error || "The assistant is unavailable right now. Please try again in a minute.");
        return;
      }
      history.push({ role: "assistant", content: data.reply, attachments: [] });
      typing.querySelector("p").textContent = data.reply;
      transcript.scrollTop = transcript.scrollHeight;
    } catch (error) {
      history.pop();
      typing.remove();
      addMessage("assistant", "I couldn't reach the assistant. Check your connection and try again.");
    }
  }

  document.getElementById("attach").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const incoming = Array.from(fileInput.files || []);
    let total = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    for (const file of incoming) {
      const extension = (file.name.split(".").pop() || "").toLowerCase();
      if (!ALLOWED.has(extension)) {
        addMessage("assistant", file.name + " is not a supported file type.");
        continue;
      }
      if (selectedFiles.length >= MAX_FILES) {
        addMessage("assistant", "You can attach up to " + MAX_FILES + " files to one message.");
        break;
      }
      if (!file.size || file.size > MAX_FILE_BYTES) {
        addMessage("assistant", file.name + " must be no larger than 5 MB.");
        continue;
      }
      if (total + file.size > MAX_TOTAL_BYTES) {
        addMessage("assistant", "The combined attachment size must be no larger than 7 MB.");
        break;
      }
      selectedFiles.push(file);
      total += file.size;
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

  document.getElementById("restart").addEventListener("click", () => {
    history = [];
    selectedFiles = [];
    renderPending();
    renderGreeting();
  });

  document.getElementById("close").addEventListener("click", () => {
    if (window.parent !== window) window.parent.postMessage({ type: "sujeeth-chat-close" }, "*");
    else window.location.href = "/";
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (window.parent !== window) window.parent.postMessage({ type: "sujeeth-chat-close" }, "*");
      else window.location.href = "/";
    }
  });

  renderGreeting();
})();

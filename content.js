(() => {
  if (globalThis.__gpsSidebarInjected) return;
  globalThis.__gpsSidebarInjected = true;

  const SIDEBAR_ID = "gps-root";
  const TOAST_ID = "gps-toast";
  const COLLAPSED_KEY = "gps-collapsed";
  const SCRATCH_KEY = "gps-scratch";
  const SCRATCH_PINNED_KEY = "gps-scratch-pinned";
  const SCRATCH_PERSIST_KEY = "gps-scratch-persist";
  const SCRATCH_COLLAPSED_KEY = "gps-scratch-collapsed";
  const EXPORT_COLLAPSED_KEY = "gps-export-collapsed";
  const POSITION_KEY = "gps-position";
  const HIDDEN_KEY = "gps-hidden";
  const REFERENCE_COLLAPSED_KEY = "gps-reference-collapsed";
  const REFERENCE_SLOTS = {
    meeting: {
      key: "gps-reference-doc-meeting",
      metaKey: "gps-reference-meta-meeting",
      label: "会议参考"
    },
    who: {
      key: "gps-reference-doc-who",
      metaKey: "gps-reference-meta-who",
      label: "Who 参考"
    }
  };
  const DEFAULT_REFERENCE_PATHS = {
    meeting:
      "/Users/yangyuan/Library/Mobile Documents/iCloud~md~obsidian/Documents/ViviNotes/4_Source/MeetingSum/2026-01-28 Meeting-Tony-2026 业务战略规划.md",
    who: "/Users/yangyuan/Library/Mobile Documents/iCloud~md~obsidian/Documents/ViviNotes/7_Entities/71_Who/Who-Roger Liang.md"
  };
  const REFERENCE_TOKEN_MAP = {
    ref: "meeting",
    meeting_ref: "meeting",
    meeting: "meeting",
    who_ref: "who",
    who: "who"
  };
  const OBSIDIAN_VAULT = "ViviNotes";
  const OBSIDIAN_FOLDER = "Draft";
  const OBSIDIAN_PREFIX = "Gemini-";

  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const loadPosition = () => {
    try {
      const raw = localStorage.getItem(POSITION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed.left !== "number" || typeof parsed.top !== "number") return null;
      return parsed;
    } catch (error) {
      return null;
    }
  };

  const savePosition = (left, top) => {
    localStorage.setItem(POSITION_KEY, JSON.stringify({ left, top }));
  };

  const applyPosition = (root, position) => {
    if (!root || !position) return;
    root.style.left = `${position.left}px`;
    root.style.top = `${position.top}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
  };

  const queryAllDeep = (selector, root = document) => {
    const results = [];
    const visit = (node) => {
      if (!node) return;
      if (node.querySelectorAll) {
        results.push(...node.querySelectorAll(selector));
      }
      if (!node.querySelectorAll) return;
      const children = node.querySelectorAll("*");
      for (const el of children) {
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    };
    visit(root);
    return results;
  };

  const isVisible = (el) => {
    if (!el) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  };

  const isEditable = (el) => {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      return ["text", "search", "url", "email", "tel", ""].includes(type);
    }
    return el.isContentEditable === true;
  };

  const getDeepActiveElement = () => {
    let current = document.activeElement;
    while (current && current.shadowRoot && current.shadowRoot.activeElement) {
      current = current.shadowRoot.activeElement;
    }
    return current;
  };

  const findEditableTarget = () => {
    const active = getDeepActiveElement();
    if (isEditable(active)) return active;

    const selectors = [
      "textarea",
      "input[type='text']",
      "input[type='search']",
      "input[type='email']",
      "div[contenteditable='true']",
      "[contenteditable='true']",
      "[role='textbox']"
    ];
    const candidates = queryAllDeep(selectors.join(","))
      .filter(isVisible)
      .filter((el) => !el.closest(`#${SIDEBAR_ID}`));

    if (candidates.length === 0) return null;

    const keywordMatches = ["prompt", "输入", "ask", "message", "chat", "问题"];
    const preferred = candidates.find((el) => {
      const label = (el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").toLowerCase();
      return keywordMatches.some((keyword) => label.includes(keyword));
    });

    return preferred || candidates[0];
  };

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const resolveReferenceSlot = (token) => {
    if (!token) return null;
    return REFERENCE_TOKEN_MAP[token.toLowerCase()] || null;
  };

  const loadReference = (slotId) => {
    const slot = REFERENCE_SLOTS[slotId];
    if (!slot) return { text: "", name: "", updatedAt: "" };
    const text = localStorage.getItem(slot.key) || "";
    const metaRaw = localStorage.getItem(slot.metaKey);
    let meta = {};
    if (metaRaw) {
      try {
        meta = JSON.parse(metaRaw);
      } catch (error) {
        meta = {};
      }
    }
    return {
      text,
      name: typeof meta.name === "string" ? meta.name : "",
      updatedAt: typeof meta.updatedAt === "string" ? meta.updatedAt : ""
    };
  };

  const saveReference = (slotId, text, name) => {
    const slot = REFERENCE_SLOTS[slotId];
    if (!slot) return;
    localStorage.setItem(slot.key, text);
    localStorage.setItem(
      slot.metaKey,
      JSON.stringify({ name: name || "reference.md", updatedAt: new Date().toISOString() })
    );
  };

  const clearReference = (slotId) => {
    const slot = REFERENCE_SLOTS[slotId];
    if (!slot) return;
    localStorage.removeItem(slot.key);
    localStorage.removeItem(slot.metaKey);
  };

  const fillTemplate = (template) => {
    const tokenRegex = /{{\s*([^}]+?)\s*}}/g;
    const tokens = [];
    template.replace(tokenRegex, (_, raw) => {
      const key = raw.trim();
      if (key && !tokens.includes(key)) tokens.push(key);
      return "";
    });

    let output = template;
    for (const token of tokens) {
      const slotId = resolveReferenceSlot(token);
      if (slotId) {
        const reference = loadReference(slotId);
        if (!reference.text) {
          const label = REFERENCE_SLOTS[slotId]?.label || "参考文档";
          showToast(`请先导入${label}`);
          return null;
        }
        const pattern = new RegExp(`{{\\s*${escapeRegExp(token)}\\s*}}`, "g");
        output = output.replace(pattern, reference.text);
        continue;
      }
      const value = window.prompt(`填写：${token}`);
      if (value === null) return null;
      const pattern = new RegExp(`{{\\s*${escapeRegExp(token)}\\s*}}`, "g");
      output = output.replace(pattern, value);
    }

    return output;
  };

  const showToast = (message) => {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.className = "gps-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("gps-toast-visible");
    window.setTimeout(() => {
      toast.classList.remove("gps-toast-visible");
    }, 1600);
  };

  const insertText = (text) => {
    const target = findEditableTarget();
    if (!target) {
      showToast("未找到可用的输入框");
      return;
    }

    target.focus();

    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
      const start = typeof target.selectionStart === "number" ? target.selectionStart : target.value.length;
      const end = typeof target.selectionEnd === "number" ? target.selectionEnd : target.value.length;
      target.setRangeText(text, start, end, "end");
      target.dispatchEvent(new Event("input", { bubbles: true }));
      showToast("已插入输入框");
      return;
    }

    if (target.isContentEditable) {
      const success = document.execCommand("insertText", false, text);
      if (!success) {
        target.textContent = `${target.textContent || ""}${text}`;
      }
      target.dispatchEvent(new Event("input", { bubbles: true }));
      showToast("已插入输入框");
    }
  };

  const MESSAGE_SELECTOR_SETS = [
    ["chat-message", "message-item", "bard-message", "gemini-message", "[data-message-id]", "[data-message-author]", "[data-message-role]"],
    ["article", "div[role='listitem']"],
    ["div[class*='response']", "div[class*='query']", "div[class*='message']"]
  ];

  const collectMessageElements = () => {
    for (const selectorSet of MESSAGE_SELECTOR_SETS) {
      const found = new Set();
      for (const selector of selectorSet) {
        for (const el of queryAllDeep(selector)) {
          found.add(el);
        }
      }
      const filtered = Array.from(found).filter(
        (el) =>
          isVisible(el) &&
          !el.closest(`#${SIDEBAR_ID}`) &&
          (el.innerText || el.textContent || "").trim().length > 1
      );
      const withoutContainers = filtered.filter(
        (el) => !filtered.some((other) => other !== el && el.contains(other))
      );
      if (withoutContainers.length >= 2) return withoutContainers;
    }
    return [];
  };

  const inferMessageRole = (el) => {
    const roleHints = {
      user: ["user", "human", "prompt", "query", "you"],
      assistant: ["assistant", "model", "gemini", "response", "bot"]
    };
    const attrs = ["data-message-author", "data-message-role", "data-author", "data-sender", "data-testid", "aria-label", "class"];
    const nodesToCheck = [];
    let current = el;
    for (let i = 0; i < 3 && current; i += 1) {
      nodesToCheck.push(current);
      current = current.parentElement;
    }
    for (const node of nodesToCheck) {
      for (const attr of attrs) {
        const value = (node.getAttribute(attr) || "").toLowerCase();
        if (!value) continue;
        if (roleHints.user.some((hint) => value.includes(hint))) return "user";
        if (roleHints.assistant.some((hint) => value.includes(hint))) return "assistant";
      }
      const tag = (node.tagName || "").toLowerCase();
      if (roleHints.user.some((hint) => tag.includes(hint))) return "user";
      if (roleHints.assistant.some((hint) => tag.includes(hint))) return "assistant";
    }
    const labelCandidates = el.querySelectorAll("[aria-label], [title], img[alt]");
    for (const node of labelCandidates) {
      const value =
        (node.getAttribute("aria-label") || node.getAttribute("title") || node.getAttribute("alt") || "").toLowerCase();
      if (!value) continue;
      if (roleHints.user.some((hint) => value.includes(hint))) return "user";
      if (roleHints.assistant.some((hint) => value.includes(hint))) return "assistant";
    }
    return "unknown";
  };

  const extractMessageText = (el) => {
    if (!el) return "";
    const clone = el.cloneNode(true);
    const removeSelectors = [
      "button",
      "svg",
      "path",
      "img",
      "video",
      "audio",
      "canvas",
      "textarea",
      "input",
      "select",
      "option",
      "noscript",
      "style",
      "script",
      "[aria-hidden='true']",
      "[role='button']"
    ];
    for (const selector of removeSelectors) {
      clone.querySelectorAll(selector).forEach((node) => node.remove());
    }
    const raw = clone.innerText || clone.textContent || "";
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line !== "You" && line !== "Gemini");
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  };

  const extractConversationMessages = () => {
    const elements = collectMessageElements();
    const messages = [];
    for (const el of elements) {
      const text = extractMessageText(el);
      if (!text) continue;
      messages.push({ role: inferMessageRole(el), text, el });
    }
    messages.sort((a, b) => {
      const rectA = a.el ? a.el.getBoundingClientRect() : null;
      const rectB = b.el ? b.el.getBoundingClientRect() : null;
      if (!rectA || !rectB) return 0;
      if (rectA.top !== rectB.top) return rectA.top - rectB.top;
      return rectA.left - rectB.left;
    });
    return messages;
  };

  const formatTimestamp = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  };

  const sanitizeFilename = (value) => {
    if (!value) return "";
    const cleaned = value
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned;
  };

  const extractTitleFromMarkdown = (value) => {
    if (!value) return "";
    const lines = value.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^#{1,6}\s+(.+)/);
      if (match) return match[1].trim();
    }
    return "";
  };

  const extractFilenameFromMarker = (value) => {
    if (!value) return "";
    const match = value.match(/<!--\s*filename:\s*([^>]+)\s*-->/i);
    if (!match) return "";
    let name = match[1].trim();
    if (name.toLowerCase().endsWith(".md")) {
      name = name.slice(0, -3);
    }
    return name;
  };

  const removeFilenameMarkerLine = (value) => {
    if (!value) return "";
    const lines = value.split("\n");
    const filtered = lines.filter((line) => !/<!--\s*filename:\s*[^>]+-->/i.test(line));
    return filtered.join("\n").trim();
  };

  const stripOuterFence = (value) => {
    if (!value) return "";
    const lines = value.split("\n");
    let start = 0;
    while (start < lines.length && lines[start].trim() === "") start += 1;
    let end = lines.length - 1;
    while (end >= 0 && lines[end].trim() === "") end -= 1;
    if (start >= end) return value.trim();
    const startMatch = lines[start].match(/^(`{3,})([^`]*)$/);
    const endMatch = lines[end].match(/^(`{3,})\s*$/);
    if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
      return lines.slice(start + 1, end).join("\n").trim();
    }
    return value.trim();
  };

  const hasFrontmatter = (value) => {
    const lines = value.split("\n");
    let start = 0;
    while (start < lines.length && lines[start].trim() === "") start += 1;
    if (start >= lines.length) return false;
    if (lines[start].trim() !== "---") return false;
    for (let i = start + 1; i < Math.min(lines.length, start + 30); i += 1) {
      if (lines[i].trim() === "---") return true;
    }
    return false;
  };

  const isLikelyCardBlock = (value) => {
    if (!value) return false;
    if (/<!--\s*filename:\s*[^>]+-->/i.test(value)) return true;
    if (hasFrontmatter(value)) return true;
    const lines = value.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      return /^#\s+/.test(trimmed);
    }
    return false;
  };

  const buildObsidianUrl = (fileName, content) => {
    const filePath = OBSIDIAN_FOLDER ? `${OBSIDIAN_FOLDER}/${fileName}` : fileName;
    return `obsidian://new?vault=${encodeURIComponent(OBSIDIAN_VAULT)}&file=${encodeURIComponent(filePath)}&content=${encodeURIComponent(content)}`;
  };

  const getCodeBlocksFromMessage = (messageEl, messageText) => {
    if (!messageEl) return [];
    const rawText = messageEl.innerText || messageEl.textContent || messageText || "";
    const parsedBlocks = [];

    const lines = rawText.split("\n");
    let current = null;
    for (const line of lines) {
      const fenceMatch = line.match(/^(`{3,})([^`]*)$/);
      if (!current) {
        if (fenceMatch) {
          current = { fence: fenceMatch[1], lines: [] };
        }
        continue;
      }
      if (line.startsWith(current.fence)) {
        const content = current.lines.join("\n");
        const normalized = stripOuterFence(content);
        if (isLikelyCardBlock(normalized)) {
          parsedBlocks.push(normalized);
        }
        current = null;
        continue;
      }
      current.lines.push(line);
    }
    if (parsedBlocks.length > 0) return parsedBlocks;

    const blocks = [];
    const preNodes = messageEl.querySelectorAll("pre");
    preNodes.forEach((pre) => {
      const code = pre.querySelector("code");
      const text = (code ? code.textContent : pre.textContent) || "";
      const normalized = stripOuterFence(text);
      if (isLikelyCardBlock(normalized)) {
        blocks.push(normalized);
      }
    });
    if (blocks.length > 0) return blocks;

    const source = messageText || rawText || "";
    const regex = /```[\w-]*\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
      const trimmed = stripOuterFence(match[1] || "");
      if (isLikelyCardBlock(trimmed)) {
        blocks.push(trimmed);
      }
    }
    if (blocks.length > 0) return blocks;

    const fmBlocks = [];
    const sourceLines = source.split("\n");
    const starts = [];
    for (let i = 0; i < sourceLines.length; i += 1) {
      if (sourceLines[i].trim() !== "---") continue;
      for (let j = i + 1; j < Math.min(sourceLines.length, i + 10); j += 1) {
        const probe = sourceLines[j].trim();
        if (!probe) continue;
        if (/^[A-Za-z0-9_-]+:\s*/.test(probe)) {
          starts.push(i);
        }
        break;
      }
    }
    if (starts.length) {
      for (let i = 0; i < starts.length; i += 1) {
        const start = starts[i];
        const end = i + 1 < starts.length ? starts[i + 1] : sourceLines.length;
        const chunk = sourceLines.slice(start, end).join("\n").trim();
        if (chunk && isLikelyCardBlock(chunk)) {
          fmBlocks.push(chunk);
        }
      }
    }
    return fmBlocks;
  };

  const openObsidianUrls = (urls) => {
    let index = 0;
    const openNext = () => {
      if (index >= urls.length) {
        showToast(`已发送 ${urls.length} 个卡片到 Obsidian`);
        return;
      }
      const link = document.createElement("a");
      link.href = urls[index];
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      index += 1;
      window.setTimeout(openNext, 420);
    };
    openNext();
  };

  const buildObsidianContentFromMessage = (messageEl, fallbackText) => {
    if (!messageEl) return (fallbackText || "").trim();
    const clone = messageEl.cloneNode(true);
    clone.querySelectorAll("pre").forEach((pre) => {
      const code = pre.querySelector("code");
      const text = (code ? code.textContent : pre.textContent) || "";
      const fenced = `\n\`\`\`\n${text.trimEnd()}\n\`\`\`\n`;
      pre.replaceWith(document.createTextNode(fenced));
    });
    const text = clone.innerText || clone.textContent || fallbackText || "";
    return text.trim();
  };

  const handleObsidianPush = () => {
    const messages = extractConversationMessages();
    if (!messages.length) {
      showToast("未识别到对话内容");
      return;
    }
    const assistantMessages = messages.filter((message) => message.role === "assistant");
    const lastMessage = assistantMessages.length
      ? assistantMessages[assistantMessages.length - 1]
      : messages[messages.length - 1];
    if (!lastMessage || !lastMessage.el) {
      showToast("未找到可用的回复");
      return;
    }
    const content = buildObsidianContentFromMessage(lastMessage.el, lastMessage.text);
    if (!content) {
      showToast("未找到可用内容");
      return;
    }
    const metaLines = [
      "## Gemini Context",
      `- URL: ${location.href}`,
      `- Exported: ${new Date().toISOString()}`,
      ""
    ];
    const stamp = formatTimestamp();
    const titleCandidate = extractTitleFromMarkdown(content);
    const baseTitle = titleCandidate
      ? `${OBSIDIAN_PREFIX}${titleCandidate}`
      : `${OBSIDIAN_PREFIX}Reply-${stamp}`;
    let fileName = sanitizeFilename(baseTitle);
    if (!fileName) {
      fileName = `${OBSIDIAN_PREFIX}Reply-${stamp}`;
    }
    const finalContent = `${metaLines.join("\n")}${content}\n`;
    const url = buildObsidianUrl(fileName, finalContent);
    showToast("准备推送到 Obsidian...");
    openObsidianUrls([url]);
  };

  const buildMarkdown = (messages, mode) => {
    const title = mode === "prompts" ? "Gemini Prompts Export" : "Gemini Chat Export";
    const lines = [
      `# ${title}`,
      `- Source: ${location.href}`,
      `- Exported: ${new Date().toISOString()}`,
      `- Mode: ${mode === "prompts" ? "Prompts only" : "All messages"}`,
      "",
      "---",
      ""
    ];
    messages.forEach((message, index) => {
      const label = message.role === "user" ? "You" : message.role === "assistant" ? "Gemini" : "Message";
      lines.push(`## ${index + 1}. ${label}`);
      lines.push(message.text);
      lines.push("");
    });
    return lines.join("\n");
  };

  const downloadMarkdown = (content, filename) => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const handleExport = (mode) => {
    const messages = extractConversationMessages();
    if (!messages.length) {
      showToast("未识别到对话内容");
      return;
    }
    const selected =
      mode === "prompts" ? messages.filter((message) => message.role === "user") : messages;
    if (mode === "prompts" && selected.length === 0) {
      showToast("未识别到我方提问");
      return;
    }
    const stamp = formatTimestamp();
    const filename = mode === "prompts" ? `gemini-prompts-${stamp}.md` : `gemini-chat-${stamp}.md`;
    downloadMarkdown(buildMarkdown(selected, mode), filename);
    showToast("已下载 Markdown");
  };

  const createGroup = (group, options = {}) => {
    const groupEl = document.createElement("div");
    groupEl.className = "gps-group";
    if (options.collapsed) {
      groupEl.classList.add("gps-group-collapsed");
    }

    const header = document.createElement("button");
    header.type = "button";
    header.className = "gps-group-header";
    header.innerHTML = `<span class="gps-group-title">${group.title}</span><span class="gps-caret">▾</span>`;
    header.addEventListener("click", () => {
      groupEl.classList.toggle("gps-group-collapsed");
    });

    const items = document.createElement("div");
    items.className = "gps-items";

    for (const item of group.items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gps-item";
      button.textContent = item.label;
      if (item.action === "obsidian-push") {
        button.addEventListener("click", () => handleObsidianPush());
      } else {
        button.addEventListener("click", () => {
          const filled = fillTemplate(item.template);
          if (filled === null) return;
          insertText(filled);
        });
      }
      items.appendChild(button);
    }

    groupEl.appendChild(header);
    groupEl.appendChild(items);
    return groupEl;
  };

  const loadScratchState = () => {
    const pinned = localStorage.getItem(SCRATCH_PINNED_KEY) === "1";
    const collapsed = localStorage.getItem(SCRATCH_COLLAPSED_KEY) !== "0";
    const text = pinned
      ? localStorage.getItem(SCRATCH_PERSIST_KEY) || ""
      : sessionStorage.getItem(SCRATCH_KEY) || "";
    return { pinned, text, collapsed };
  };

  const saveScratch = (text, pinned) => {
    if (pinned) {
      localStorage.setItem(SCRATCH_PERSIST_KEY, text);
      return;
    }
    sessionStorage.setItem(SCRATCH_KEY, text);
  };

  const setScratchPinned = (pinned, text) => {
    if (pinned) {
      localStorage.setItem(SCRATCH_PINNED_KEY, "1");
      localStorage.setItem(SCRATCH_PERSIST_KEY, text);
      return;
    }
    localStorage.removeItem(SCRATCH_PINNED_KEY);
    sessionStorage.setItem(SCRATCH_KEY, text);
  };

  const createScratchPad = () => {
    const { pinned: initialPinned, text: initialText, collapsed: initialCollapsed } = loadScratchState();
    let pinned = initialPinned;
    let collapsed = initialCollapsed;

    const wrap = document.createElement("div");
    wrap.className = "gps-scratch";

    const top = document.createElement("div");
    top.className = "gps-scratch-top gps-section-header";
    top.setAttribute("role", "button");
    top.tabIndex = 0;

    const title = document.createElement("div");
    title.className = "gps-scratch-title";
    title.textContent = "自由框";

    const topActions = document.createElement("div");
    topActions.className = "gps-scratch-top-actions";

    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = "gps-scratch-pin";

    const caret = document.createElement("span");
    caret.className = "gps-section-caret";
    caret.textContent = "▾";

    const textarea = document.createElement("textarea");
    textarea.className = "gps-scratch-input";
    textarea.placeholder = "临时记录/可固化保存...";
    textarea.value = initialText;

    const actions = document.createElement("div");
    actions.className = "gps-scratch-actions";

    const insertButton = document.createElement("button");
    insertButton.type = "button";
    insertButton.className = "gps-scratch-action";
    insertButton.textContent = "插入到输入框";
    insertButton.addEventListener("click", () => {
      const value = textarea.value.trim();
      if (!value) {
        showToast("自由框为空");
        return;
      }
      insertText(value);
    });

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "gps-scratch-action";
    clearButton.textContent = "清空";
    clearButton.addEventListener("click", () => {
      textarea.value = "";
      saveScratch("", pinned);
      showToast("已清空自由框");
    });

    const updatePinUI = () => {
      pinButton.textContent = pinned ? "解除固化" : "固化";
      pinButton.classList.toggle("gps-scratch-pinned", pinned);
    };

    const updateCollapseUI = () => {
      top.setAttribute("aria-expanded", collapsed ? "false" : "true");
      wrap.classList.toggle("gps-scratch-collapsed", collapsed);
      localStorage.setItem(SCRATCH_COLLAPSED_KEY, collapsed ? "1" : "0");
    };

    pinButton.addEventListener("click", () => {
      pinned = !pinned;
      setScratchPinned(pinned, textarea.value);
      updatePinUI();
      showToast(pinned ? "已固化保存" : "已取消固化");
    });

    const toggleCollapse = () => {
      collapsed = !collapsed;
      updateCollapseUI();
    };

    top.addEventListener("click", (event) => {
      if (event.target && event.target.closest("button")) return;
      toggleCollapse();
    });

    top.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleCollapse();
    });

    textarea.addEventListener("input", () => {
      saveScratch(textarea.value, pinned);
    });

    updatePinUI();
    updateCollapseUI();
    top.appendChild(title);
    topActions.appendChild(pinButton);
    topActions.appendChild(caret);
    top.appendChild(topActions);
    actions.appendChild(insertButton);
    actions.appendChild(clearButton);
    wrap.appendChild(top);
    wrap.appendChild(textarea);
    wrap.appendChild(actions);
    return wrap;
  };

  const loadExportState = () => localStorage.getItem(EXPORT_COLLAPSED_KEY) !== "0";

  const loadReferenceState = () => localStorage.getItem(REFERENCE_COLLAPSED_KEY) !== "0";

  const createReferencePanel = () => {
    let collapsed = loadReferenceState();
    const wrap = document.createElement("div");
    wrap.className = "gps-reference";

    const top = document.createElement("div");
    top.className = "gps-reference-top gps-section-header";
    top.setAttribute("role", "button");
    top.tabIndex = 0;

    const title = document.createElement("div");
    title.className = "gps-reference-title";
    title.textContent = "参考文档";

    const caret = document.createElement("span");
    caret.className = "gps-section-caret";
    caret.textContent = "▾";

    const hint = document.createElement("div");
    hint.className = "gps-reference-hint";
    hint.textContent = "会议用 {{ref}}，人物用 {{who_ref}}";

    const slotsWrap = document.createElement("div");
    slotsWrap.className = "gps-reference-slots";

    const createSlot = (slotId) => {
      const slot = REFERENCE_SLOTS[slotId];
      const slotWrap = document.createElement("div");
      slotWrap.className = "gps-reference-slot";

      const slotTitle = document.createElement("div");
      slotTitle.className = "gps-reference-slot-title";
      slotTitle.textContent = slot.label;

      const status = document.createElement("div");
      status.className = "gps-reference-status";

      const path = document.createElement("div");
      path.className = "gps-reference-path";
      path.textContent = `默认路径：${DEFAULT_REFERENCE_PATHS[slotId] || "未设置"}`;

      const actions = document.createElement("div");
      actions.className = "gps-reference-actions";

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".md,.markdown,.txt";
      fileInput.className = "gps-reference-file";
      fileInput.style.display = "none";

      const chooseButton = document.createElement("button");
      chooseButton.type = "button";
      chooseButton.className = "gps-reference-action";
      chooseButton.textContent = "选择本地文件";
      chooseButton.addEventListener("click", () => {
        fileInput.click();
      });

      const pasteButton = document.createElement("button");
      pasteButton.type = "button";
      pasteButton.className = "gps-reference-action";
      pasteButton.textContent = "从剪贴板导入";
      pasteButton.addEventListener("click", async () => {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          showToast("剪贴板不可用");
          return;
        }
        try {
          const text = await navigator.clipboard.readText();
          if (!text) {
            showToast("剪贴板为空");
            return;
          }
          saveReference(slotId, text, "clipboard.md");
          updateStatus();
          showToast(`已导入${slot.label}`);
        } catch (error) {
          showToast("剪贴板读取失败");
        }
      });

      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "gps-reference-action";
      clearButton.textContent = "清空";
      clearButton.addEventListener("click", () => {
        clearReference(slotId);
        updateStatus();
        showToast(`已清空${slot.label}`);
      });

      const updateStatus = () => {
        const reference = loadReference(slotId);
        if (!reference.text) {
          status.textContent = "未导入参考文档";
          return;
        }
        const size = reference.text.length;
        const name = reference.name || "reference.md";
        status.textContent = `${name} · ${size} 字`;
      };

      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const content = typeof reader.result === "string" ? reader.result : "";
          saveReference(slotId, content, file.name);
          updateStatus();
          showToast(`已导入${slot.label}`);
        };
        reader.onerror = () => {
          showToast(`${slot.label}读取失败`);
        };
        reader.readAsText(file, "utf-8");
      });

      actions.appendChild(chooseButton);
      actions.appendChild(pasteButton);
      actions.appendChild(clearButton);
      slotWrap.appendChild(slotTitle);
      slotWrap.appendChild(status);
      slotWrap.appendChild(path);
      slotWrap.appendChild(actions);
      slotWrap.appendChild(fileInput);
      updateStatus();
      return slotWrap;
    };

    const updateCollapseUI = () => {
      top.setAttribute("aria-expanded", collapsed ? "false" : "true");
      wrap.classList.toggle("gps-reference-collapsed", collapsed);
      localStorage.setItem(REFERENCE_COLLAPSED_KEY, collapsed ? "1" : "0");
    };

    const toggleCollapse = () => {
      collapsed = !collapsed;
      updateCollapseUI();
    };

    top.addEventListener("click", (event) => {
      if (event.target && event.target.closest("button")) return;
      toggleCollapse();
    });

    top.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleCollapse();
    });

    Object.keys(REFERENCE_SLOTS).forEach((slotId) => {
      slotsWrap.appendChild(createSlot(slotId));
    });
    top.appendChild(title);
    top.appendChild(caret);
    wrap.appendChild(top);
    wrap.appendChild(hint);
    wrap.appendChild(slotsWrap);
    updateCollapseUI();
    return wrap;
  };

  const createExportPanel = () => {
    let collapsed = loadExportState();
    const wrap = document.createElement("div");
    wrap.className = "gps-export";

    const top = document.createElement("div");
    top.className = "gps-export-top gps-section-header";
    top.setAttribute("role", "button");
    top.tabIndex = 0;

    const title = document.createElement("div");
    title.className = "gps-export-title";
    title.textContent = "对话导出";

    const caret = document.createElement("span");
    caret.className = "gps-section-caret";
    caret.textContent = "▾";

    const hint = document.createElement("div");
    hint.className = "gps-export-hint";
    hint.textContent = "请先滚动页面，确保本次对话已完整加载";

    const actions = document.createElement("div");
    actions.className = "gps-export-actions";

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "gps-export-action";
    allButton.textContent = "下载全部对话 (MD)";
    allButton.addEventListener("click", () => handleExport("all"));

    const promptsButton = document.createElement("button");
    promptsButton.type = "button";
    promptsButton.className = "gps-export-action";
    promptsButton.textContent = "仅我方提问 (MD)";
    promptsButton.addEventListener("click", () => handleExport("prompts"));

    const updateCollapseUI = () => {
      top.setAttribute("aria-expanded", collapsed ? "false" : "true");
      wrap.classList.toggle("gps-export-collapsed", collapsed);
      localStorage.setItem(EXPORT_COLLAPSED_KEY, collapsed ? "1" : "0");
    };

    const toggleCollapse = () => {
      collapsed = !collapsed;
      updateCollapseUI();
    };

    top.addEventListener("click", (event) => {
      if (event.target && event.target.closest("button")) return;
      toggleCollapse();
    });

    top.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleCollapse();
    });

    actions.appendChild(allButton);
    actions.appendChild(promptsButton);
    top.appendChild(title);
    top.appendChild(caret);
    wrap.appendChild(top);
    wrap.appendChild(hint);
    wrap.appendChild(actions);
    updateCollapseUI();
    return wrap;
  };

  const createUtilityGroup = () => {
    const groupEl = document.createElement("div");
    groupEl.className = "gps-group gps-utility-group";
    groupEl.classList.add("gps-group-collapsed");

    const header = document.createElement("button");
    header.type = "button";
    header.className = "gps-group-header";
    header.innerHTML = "<span class=\"gps-group-title\">辅助小工具</span><span class=\"gps-caret\">▾</span>";
    header.addEventListener("click", () => {
      groupEl.classList.toggle("gps-group-collapsed");
    });

    const items = document.createElement("div");
    items.className = "gps-items gps-utility-items";
    items.appendChild(createReferencePanel());
    items.appendChild(createExportPanel());
    items.appendChild(createScratchPad());

    groupEl.appendChild(header);
    groupEl.appendChild(items);
    return groupEl;
  };

  const updateToggleState = () => {
    const root = document.getElementById(SIDEBAR_ID);
    const toggle = root ? root.querySelector(".gps-toggle") : null;
    if (!root || !toggle) return;
    toggle.setAttribute("aria-expanded", root.classList.contains("gps-collapsed") ? "false" : "true");
  };

  const hideWidget = () => {
    localStorage.setItem(HIDDEN_KEY, "1");
    const root = document.getElementById(SIDEBAR_ID);
    if (root) root.remove();
  };

  const createSidebar = (groups) => {
    if (document.getElementById(SIDEBAR_ID)) return;

    const root = document.createElement("div");
    root.id = SIDEBAR_ID;
    root.className = "gps-root";
    if (localStorage.getItem(COLLAPSED_KEY) !== "0") {
      root.classList.add("gps-collapsed");
    }
    applyPosition(root, loadPosition());

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "gps-toggle";
    toggle.innerHTML = "<span class=\"gps-toggle-label\">Prompts</span><span class=\"gps-toggle-close\" aria-hidden=\"true\">×</span>";
    toggle.title = "Toggle prompt sidebar";
    let suppressToggleClick = false;
    let pointerToggleHandled = false;
    const toggleRoot = () => {
      root.classList.toggle("gps-collapsed");
      localStorage.setItem(COLLAPSED_KEY, root.classList.contains("gps-collapsed") ? "1" : "0");
      updateToggleState();
    };
    toggle.addEventListener("click", () => {
      if (pointerToggleHandled) {
        pointerToggleHandled = false;
        return;
      }
      if (suppressToggleClick) {
        suppressToggleClick = false;
        return;
      }
      toggleRoot();
    });
    const closeBadge = toggle.querySelector(".gps-toggle-close");
    if (closeBadge) {
      closeBadge.addEventListener("click", (event) => {
        event.stopPropagation();
        hideWidget();
      });
    }

    const panel = document.createElement("div");
    panel.className = "gps-panel";

    const header = document.createElement("div");
    header.className = "gps-header";
    header.innerHTML =
      "<div class=\"gps-title\">Gemini Prompt Shelf</div><div class=\"gps-subtitle\">点击条目直接插入输入框</div>";

    const groupWrap = document.createElement("div");
    groupWrap.className = "gps-groups";
    const meetingGroup = groups.find((group) => group && group.id === "meeting-summary");
    if (meetingGroup && Array.isArray(meetingGroup.items) && meetingGroup.items.length > 0) {
      groupWrap.appendChild(
        createGroup(meetingGroup, { collapsed: meetingGroup.id !== "consulting-delivery" })
      );
    }
    for (const group of groups) {
      if (!group || group === meetingGroup) continue;
      if (!Array.isArray(group.items) || group.items.length === 0) continue;
      groupWrap.appendChild(createGroup(group, { collapsed: group.id !== "consulting-delivery" }));
    }
    groupWrap.appendChild(createUtilityGroup());

    panel.appendChild(header);
    panel.appendChild(groupWrap);
    root.appendChild(toggle);
    root.appendChild(panel);

    document.body.appendChild(root);
    updateToggleState();

    const dragHandles = [toggle, header];
    dragHandles.forEach((handle) => {
      let dragState = null;
      handle.addEventListener("pointerdown", (event) => {
        if (event.target && event.target.closest(".gps-toggle-close")) return;
        if (event.button !== 0) return;
        const rect = root.getBoundingClientRect();
        dragState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startLeft: rect.left,
          startTop: rect.top,
          moved: false
        };
        handle.setPointerCapture(event.pointerId);
      });

      handle.addEventListener("pointermove", (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - dragState.startX;
        const deltaY = event.clientY - dragState.startY;
        if (!dragState.moved && Math.hypot(deltaX, deltaY) < 4) return;
        dragState.moved = true;
        const maxLeft = window.innerWidth - root.offsetWidth - 8;
        const maxTop = window.innerHeight - root.offsetHeight - 8;
        const left = clamp(dragState.startLeft + deltaX, 8, Math.max(8, maxLeft));
        const top = clamp(dragState.startTop + deltaY, 8, Math.max(8, maxTop));
        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
        root.style.right = "auto";
        root.style.bottom = "auto";
      });

      handle.addEventListener("pointerup", (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        handle.releasePointerCapture(event.pointerId);
        if (dragState.moved) {
          if (handle === toggle) {
            suppressToggleClick = true;
          }
          const rect = root.getBoundingClientRect();
          savePosition(rect.left, rect.top);
        } else if (handle === toggle) {
          pointerToggleHandled = true;
          toggleRoot();
        }
        dragState = null;
      });
    });
  };

  const ensureSidebar = () => {
    if (document.getElementById(SIDEBAR_ID)) return true;
    if (localStorage.getItem(HIDDEN_KEY) === "1") return false;
    if (typeof PRESET_GROUPS === "undefined") {
      console.warn("PRESET_GROUPS not found. Check presets.js");
      return false;
    }
    createSidebar(PRESET_GROUPS);
    return true;
  };

  const openSidebar = () => {
    if (localStorage.getItem(HIDDEN_KEY) === "1") {
      localStorage.removeItem(HIDDEN_KEY);
    }
    if (!ensureSidebar()) return;
    const root = document.getElementById(SIDEBAR_ID);
    if (!root) return;
    root.classList.remove("gps-collapsed");
    localStorage.setItem(COLLAPSED_KEY, "0");
    updateToggleState();
  };

  const closeSidebar = () => {
    if (!ensureSidebar()) return;
    const root = document.getElementById(SIDEBAR_ID);
    if (!root) return;
    root.classList.add("gps-collapsed");
    localStorage.setItem(COLLAPSED_KEY, "1");
    updateToggleState();
  };

  const toggleSidebar = () => {
    if (localStorage.getItem(HIDDEN_KEY) === "1") {
      localStorage.removeItem(HIDDEN_KEY);
    }
    if (!ensureSidebar()) return;
    const root = document.getElementById(SIDEBAR_ID);
    if (!root) return;
    root.classList.toggle("gps-collapsed");
    localStorage.setItem(COLLAPSED_KEY, root.classList.contains("gps-collapsed") ? "1" : "0");
    updateToggleState();
  };

  const handleMessage = (message) => {
    if (!message || typeof message !== "object") return;
    if (!message.type) return;
    ready(() => {
      if (message.type === "gps-open") openSidebar();
      if (message.type === "gps-close") closeSidebar();
      if (message.type === "gps-toggle") toggleSidebar();
    });
  };

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      handleMessage(message);
    });
  }
})();

chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) return;
  const tabId = tab.id;

  const shouldRetryInjection = (error) => {
    if (!error || !error.message) return false;
    const message = error.message;
    return message.includes("Frame with ID 0 was removed") || message.includes("frame was removed");
  };

  const sendOpen = () => {
    chrome.tabs.sendMessage(tabId, { type: "gps-open" }, () => {
      if (chrome.runtime.lastError) {
        console.info("Gemini Prompt Sidebar: no content script on this tab.");
      }
    });
  };

  const injectAndOpen = (attempt = 0) => {
    chrome.scripting.insertCSS({ target: { tabId }, files: ["sidebar.css"] }, () => {
      const cssError = chrome.runtime.lastError;
      if (cssError) {
        if (attempt < 2 && shouldRetryInjection(cssError)) {
          setTimeout(() => injectAndOpen(attempt + 1), 500);
          return;
        }
        console.info(`Gemini Prompt Sidebar: failed to inject CSS: ${cssError.message}`);
        return;
      }
      chrome.scripting.executeScript(
        { target: { tabId }, files: ["presets.js", "content.js"] },
        () => {
          const scriptError = chrome.runtime.lastError;
          if (scriptError) {
            if (attempt < 2 && shouldRetryInjection(scriptError)) {
              setTimeout(() => injectAndOpen(attempt + 1), 500);
              return;
            }
            console.info(
              `Gemini Prompt Sidebar: failed to inject scripts: ${scriptError.message}`
            );
            return;
          }
          sendOpen();
        }
      );
    });
  };

  chrome.tabs.sendMessage(tabId, { type: "gps-open" }, () => {
    if (!chrome.runtime.lastError) {
      sendOpen();
      return;
    }
    injectAndOpen();
  });
});

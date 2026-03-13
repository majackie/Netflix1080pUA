(function () {
  const FALLBACK_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 OPR/120.0.0.0";

  function runInPage(code) {
    try {
      const script = document.createElement("script");
      script.textContent = code;
      (document.head || document.documentElement).prepend(script);
      script.remove();
      return true;
    } catch (e) {
      console.error("[Netflix 1080p UA] Failed to inject script:", e);
      return false;
    }
  }

  const injectUA = (ua) => runInPage(`(function(){
    const props = {
      userAgent:  () => ${JSON.stringify(ua)},
      appVersion: () => ${JSON.stringify(ua.replace("Mozilla/", ""))},
      platform:   () => "Linux x86_64",
      vendor:     () => "Google Inc.",
      appName:    () => "Netscape"
    };
    for (const [key, get] of Object.entries(props)) {
      try { 
        Object.defineProperty(navigator, key, { get, configurable: true }); 
      } catch {}
    }
    console.log("[Netflix 1080p UA] Injected UA:", navigator.userAgent);
  })()`);

  const clearNetflixCache = () => runInPage(`(function(){
    // Clear Netflix's cached playback capabilities from localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('playback') || key.includes('capability') || key.includes('msl') || key.includes('drm'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      console.log("[Netflix 1080p UA] Clearing localStorage:", key);
      localStorage.removeItem(key);
    });
    
    // Also clear sessionStorage
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('playback') || key.includes('capability'))) {
        console.log("[Netflix 1080p UA] Clearing sessionStorage:", key);
        sessionStorage.removeItem(key);
      }
    }
  })()`);

  const restoreUA = () => runInPage(`(function(){
    for (const p of ["userAgent","appVersion","platform","vendor","appName"])
      try { Object.defineProperty(navigator, p, { configurable: true, writable: true }); } catch {}
    console.log("[Netflix 1080p UA] Restored native UA:", navigator.userAgent);
  })()`);

  // Clear any cached Netflix capabilities BEFORE injecting UA
  console.log("[Netflix 1080p UA] Clearing cached capabilities at document_start");
  clearNetflixCache();
  
  // inject immediately with fallback so page scripts see the spoofed UA from the start
  console.log("[Netflix 1080p UA] Injecting fallback UA at document_start");
  injectUA(FALLBACK_UA);

  // async: re-inject with up-to-date UA or undo if disabled
  browser.storage.local.get(["cachedUA", "enabled"]).then(({ cachedUA, enabled }) => {
    console.log("[Netflix 1080p UA] Storage loaded - enabled:", enabled, "cachedUA:", cachedUA ? "present" : "missing");
    if (enabled === false) return restoreUA();
    const ua = cachedUA || FALLBACK_UA;
    if (ua !== FALLBACK_UA) {
      console.log("[Netflix 1080p UA] Updating to cached UA");
      injectUA(ua);
    }
  }).catch((e) => {
    console.error("[Netflix 1080p UA] Storage error:", e);
  });

  // Listen for messages from background script to update UA in real-time
  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === "UPDATE_UA") {
      console.log("[Netflix 1080p UA] Received UPDATE_UA message - enabled:", msg.enabled);
      if (msg.enabled === false) {
        restoreUA();
      } else {
        clearNetflixCache();
        injectUA(msg.ua || FALLBACK_UA);
      }
    } else if (msg.type === "CLEAR_CACHE") {
      console.log("[Netflix 1080p UA] Received CLEAR_CACHE message");
      clearNetflixCache();
    }
  });
})();

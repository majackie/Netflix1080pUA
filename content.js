(function () {
  const FALLBACK_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 OPR/120.0.0.0";

  function runInPage(code) {
    const script = document.createElement("script");
    script.textContent = code;
    (document.head || document.documentElement).prepend(script);
    script.remove();
  }

  const injectUA = (ua) => runInPage(`(function(){
    const props = {
      userAgent:  () => ${JSON.stringify(ua)},
      appVersion: () => ${JSON.stringify(ua.replace("Mozilla/", ""))},
      platform:   () => "Linux x86_64",
      vendor:     () => "Google Inc.",
      appName:    () => "Netscape"
    };
    for (const [key, get] of Object.entries(props))
      try { Object.defineProperty(navigator, key, { get, configurable: true }); } catch {}
  })()`);

  const restoreUA = () => runInPage(`(function(){
    for (const p of ["userAgent","appVersion","platform","vendor","appName"])
      try { Object.defineProperty(navigator, p, { configurable: true, writable: true }); } catch {}
  })()`);

  // inject immediately with fallback so page scripts see the spoofed UA from the start
  injectUA(FALLBACK_UA);

  // async: re-inject with up-to-date UA or undo if disabled
  browser.storage.local.get(["cachedUA", "enabled"]).then(({ cachedUA, enabled }) => {
    if (enabled === false) return restoreUA();
    const ua = cachedUA || FALLBACK_UA;
    if (ua !== FALLBACK_UA) injectUA(ua);
  }).catch(() => {});
})();

const FALLBACK_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 OPR/120.0.0.0";
const UA_API = "https://jnrbsn.github.io/user-agents/user-agents.json";
const CACHE_TTL = 24 * 60 * 60 * 1000;
const ICON_SIZE = 128;
const NETFLIX_URLS = ["*://*.netflix.com/*", "*://assets.nflxext.com/*"];

let activeUA = FALLBACK_UA;
let enabled = true;

// UA
function buildOperaUA(list) {
  const base = list.find(ua => ua.includes("X11; Linux x86_64") && ua.includes("Chrome/") && !ua.includes("Mobile")) ?? "";
  const chrome = base.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/)?.[1] ?? "135.0.0.0";
  const webkit = base.match(/AppleWebKit\/(\d+\.\d+)/)?.[1] ?? "537.36";
  return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/${webkit} (KHTML, like Gecko) Chrome/${chrome} Safari/${webkit} OPR/${parseInt(chrome) - 15}.0.0.0`;
}

async function refreshUA() {
  const now = Date.now();
  const { cachedUA, cachedUATimestamp } = await browser.storage.local.get(["cachedUA", "cachedUATimestamp"]);
  if (cachedUA && (now - cachedUATimestamp) < CACHE_TTL) return void (activeUA = cachedUA);
  try {
    const data = await fetch(UA_API).then(r => { if (!r.ok) throw r; return r.json(); });
    activeUA = buildOperaUA(data);
    console.log("[Netflix 1080p UA] Fetched fresh UA:", activeUA);
    await browser.storage.local.set({ cachedUA: activeUA, cachedUATimestamp: now });
  } catch (e) {
    console.error("[Netflix 1080p UA] Failed to fetch UA, using fallback:", e);
    activeUA = cachedUA ?? FALLBACK_UA;
  }
}

// icon
function drawIcon(on) {
  const canvas = new OffscreenCanvas(ICON_SIZE, ICON_SIZE);
  const ctx = canvas.getContext("2d");
  const mid = ICON_SIZE / 2;
  ctx.beginPath();
  ctx.arc(mid, mid, mid, 0, Math.PI * 2);
  ctx.fillStyle = on ? "#e50914" : "#555";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${ICON_SIZE * 0.72}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", mid, mid + ICON_SIZE * 0.04);
  return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
}

const updateIcon = (on) => browser.browserAction.setIcon({ imageData: drawIcon(on) });

// state
async function setEnabled(value) {
  enabled = value;
  await browser.storage.local.set({ enabled });
  updateIcon(enabled);
  
  // Notify all Netflix tabs of the change
  const tabs = await browser.tabs.query({ url: "*://*.netflix.com/*" });
  for (const tab of tabs) {
    browser.tabs.sendMessage(tab.id, { type: "UPDATE_UA", enabled, ua: activeUA }).catch(() => {});
  }
}

// messages
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SET_ENABLED") {
    return setEnabled(msg.value).then(() => ({ ok: true, ua: activeUA }));
  }
  if (msg.type === "GET_STATE") return Promise.resolve({ enabled, ua: activeUA });
});

// Monitor page navigation to Netflix and clear caches
browser.webNavigation.onBeforeNavigate.addListener(
  ({ tabId, url }) => {
    if (enabled && (url.includes("netflix.com"))) {
      console.log("[Netflix 1080p UA] Netflix page navigation detected, clearing caches");
      browser.tabs.sendMessage(tabId, { type: "CLEAR_CACHE" }).catch(() => {});
    }
  },
  { url: [{ hostContains: "netflix.com" }] }
);

// request interception - must be registered before any requests happen
console.log("[Netflix 1080p UA] Registering webRequest listener");
browser.webRequest.onBeforeSendHeaders.addListener(
  ({ requestHeaders, url }) => {
    if (!enabled) return {};
    
    const uaHeader = requestHeaders.find(h => h.name.toLowerCase() === "user-agent");
    if (uaHeader) {
      uaHeader.value = activeUA;
    } else {
      requestHeaders.push({ name: "User-Agent", value: activeUA });
    }
    
    // Add cache-busting headers for playback/capability requests to force fresh detection
    if (url.includes("shakti") || url.includes("playback") || url.includes("capability")) {
      requestHeaders.push({ name: "Cache-Control", value: "no-cache, no-store, must-revalidate" });
      requestHeaders.push({ name: "Pragma", value: "no-cache" });
      requestHeaders.push({ name: "Expires", value: "0" });
      console.log(`[Netflix 1080p UA] Capability request with cache-busting: ${new URL(url).pathname} | UA: ${activeUA.split(' ').pop()}`);
    }
    
    return { requestHeaders };
  },
  { urls: NETFLIX_URLS },
  ["blocking", "requestHeaders"]
);

// Intercept responses to prevent caching of capability requests
browser.webRequest.onHeadersReceived.addListener(
  ({ responseHeaders, url }) => {
    if (!enabled) return {};
    
    // For capability/playback requests, force cache validation
    if (url.includes("shakti") || url.includes("playback") || url.includes("capability")) {
      const headersToUpdate = ["Cache-Control", "Expires", "Pragma"];
      let modified = false;
      
      for (const header of responseHeaders) {
        if (headersToUpdate.includes(header.name)) {
          if (header.name === "Cache-Control") {
            header.value = "no-cache, no-store, must-revalidate, max-age=0";
            modified = true;
          } else if (header.name === "Expires") {
            header.value = "0";
            modified = true;
          } else if (header.name === "Pragma") {
            header.value = "no-cache";
            modified = true;
          }
        }
      }
      
      if (modified) {
        console.log(`[Netflix 1080p UA] Modified cache headers for: ${new URL(url).pathname}`);
      }
      
      return { responseHeaders };
    }
    
    return {};
  },
  { urls: NETFLIX_URLS },
  ["blocking", "responseHeaders"]
);

// init
async function init() {
  // First, load cached UA synchronously for immediate use
  const { enabled: saved, cachedUA } = await browser.storage.local.get(["enabled", "cachedUA"]);
  
  // Set activeUA to cached value immediately before any network requests happen
  if (cachedUA) {
    activeUA = cachedUA;
  }
  
  await setEnabled(saved ?? true);
  
  // Then refresh/verify the UA in the background
  await refreshUA();
  updateIcon(enabled);
}

// Ensure UA is fresh when extension starts
init();

// Refresh UA periodically, but also ensure it's available quickly
const refreshInterval = setInterval(refreshUA, CACHE_TTL);

// Also refresh UA when extension loses and regains focus (in case cache expired)
browser.tabs.onActivated.addListener(async () => {
  const { cachedUATimestamp } = await browser.storage.local.get("cachedUATimestamp");
  const now = Date.now();
  if (!cachedUATimestamp || (now - cachedUATimestamp) > CACHE_TTL) {
    await refreshUA();
    // Notify all Netflix tabs of the updated UA
    const tabs = await browser.tabs.query({ url: "*://*.netflix.com/*" });
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, { type: "UPDATE_UA", enabled, ua: activeUA }).catch(() => {});
    }
  }
});

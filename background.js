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
    await browser.storage.local.set({ cachedUA: activeUA, cachedUATimestamp: now });
  } catch {
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
}

// messages
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SET_ENABLED") return setEnabled(msg.value).then(() => ({ ok: true, ua: activeUA }));
  if (msg.type === "GET_STATE")   return Promise.resolve({ enabled, ua: activeUA });
});

// request interception
browser.webRequest.onBeforeSendHeaders.addListener(
  ({ requestHeaders }) => {
    if (!enabled) return {};
    const uaHeader = requestHeaders.find(h => h.name.toLowerCase() === "user-agent");
    if (uaHeader) uaHeader.value = activeUA;
    else requestHeaders.push({ name: "User-Agent", value: activeUA });
    return { requestHeaders };
  },
  { urls: NETFLIX_URLS },
  ["blocking", "requestHeaders"]
);

// init
async function init() {
  const { enabled: saved } = await browser.storage.local.get("enabled");
  await setEnabled(saved ?? true);
  await refreshUA();
  updateIcon(enabled);
}

init();
setInterval(refreshUA, CACHE_TTL);

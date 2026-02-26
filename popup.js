const toggle = document.getElementById("toggle");
const statusLabel = document.getElementById("statusLabel");
const uaText = document.getElementById("uaText");

// ui helpers
const setLoading = (loading) => { toggle.disabled = loading; };

function formatUA(ua) {
  if (!ua) return "—";
  return ua
    .replace(/(AppleWebKit\/\S+)/, "<br>$1")
    .replace(/(Chrome\/\S+)/, "<br>$1")
    .replace(/(Safari\/\S+)/, "<br>$1")
    .replace(/(OPR\/\S+)/, "<br>$1")
    .replace(/^<br>/, "");
}

function applyState(enabled, ua) {
  toggle.checked = enabled;
  statusLabel.textContent = enabled ? "Enabled" : "Disabled";
  statusLabel.className = `status ${enabled ? "on" : "off"}`;
  uaText.textContent = ua ? ua : "—";
}

function setToggleEnabled(enabled) {
  toggle.disabled = !enabled;
  toggle.title = enabled ? "" : "Only works on Netflix tabs";
}

// netflix tab reload
async function reloadNetflixTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes("netflix.com")) {
    await browser.tabs.reload(tab.id, { bypassCache: true });
    return true;
  }
  return false;
}

// toggle
toggle.addEventListener("change", async () => {
  setLoading(true);
  try {
    const { ua } = await browser.runtime.sendMessage({ type: "SET_ENABLED", value: toggle.checked });
    applyState(toggle.checked, ua);
    if (await reloadNetflixTab()) window.close();
  } catch {
    toggle.checked = !toggle.checked;
  } finally {
    setLoading(false);
  }
});

// init
setLoading(true);
Promise.all([
  browser.runtime.sendMessage({ type: "GET_STATE" }),
  browser.tabs.query({ active: true, currentWindow: true })
]).then(([{ enabled, ua }, [tab]]) => {
  applyState(enabled, ua);
  const onNetflix = !!tab?.url?.includes("netflix.com");
  setToggleEnabled(onNetflix);
}).catch(() => {
  statusLabel.textContent = "Error — extension not ready";
  statusLabel.className = "status off";
  uaText.textContent = "unavailable";
  setToggleEnabled(false);
});

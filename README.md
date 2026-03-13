# Netflix 1080p UA
Forces Netflix to stream at 1080p.

## Description
Forces Netflix to stream at 1080p on Firefox/Linux by spoofing the User‑Agent to an Opera-on-Linux UA. Click the icon to toggle.

## Installation
### Firefox Add-On
Visit [Netflix 1080p UA](https://addons.mozilla.org/en-US/firefox/addon/netflix-1080p-ua/) to download add-on.

### Firefox Browser
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `manifest.json` in this directory

## Usage
Click the extension icon to toggle it on/off.

### Checking Video Quality
To verify Netflix is streaming at 1080p:
1. Open Netflix and start playing a video
2. Press `Ctrl+Shift+Alt+D` (or `Ctrl+Shift+Option+D` on Mac) to open the stats overlay
3. The bitrate and resolution should show in the left center

### Troubleshooting
If Netflix is not streaming in 1080p:
1. **Toggle the extension** — Click the extension icon to disable it, then enable it again
2. **Refresh the tab** — Press `F5` or `Ctrl+R` to reload the Netflix page
3. **Check the panel** — A small panel appears when clicking the extension icon; confirm it shows "Enabled"

If issues persist, try clearing your browser cache and reloading Netflix.

## Contributors
Jackie Ma
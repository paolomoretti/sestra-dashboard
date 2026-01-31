# Setting Up Your Dashboard in Home Assistant iframe

## The Problem

When embedding your dashboard in Home Assistant using a Webpage Card or iframe panel, navigation to Home Assistant URLs (like entity details) gets blocked due to browser security restrictions. This is because iframes cannot freely navigate their parent window when they're from different origins (cross-origin security).

## The Solution

We've implemented a two-part solution:

1. **Your Dashboard** now uses `postMessage` API to send navigation requests to the parent window
2. **Home Assistant** needs a listener script to receive and handle these messages

---

## Installation Steps

### Step 1: Update Your Dashboard (Already Done ✓)

The dashboard code has been updated in `src/utils/actionHandler.ts` to:
- Send `postMessage` events when trying to navigate or show entity details
- Fall back gracefully if postMessage doesn't work
- Support multiple communication methods

### Step 2: Add Listener Script to Home Assistant

#### 2.1 Copy the Listener Script

Copy the file `ha-iframe-listener.js` to your Home Assistant's `/config/www/` directory.

**SSH/Terminal Method:**
```bash
# Copy to your Home Assistant
scp ha-iframe-listener.js root@your-ha-ip:/config/www/
```

**File Editor Method:**
1. In Home Assistant, go to **Settings** → **Add-ons** → **File editor** (install if needed)
2. Navigate to `/config/www/`
3. Create a new file called `ha-iframe-listener.js`
4. Copy the contents of `ha-iframe-listener.js` into it
5. Save

#### 2.2 Register the Script as a Resource

1. In Home Assistant, go to **Settings** → **Dashboards**
2. Click the **⋮** (three dots menu) in the top right
3. Select **Resources**
4. Click **+ Add Resource**
5. Fill in:
   - **URL:** `/local/ha-iframe-listener.js`
   - **Resource type:** JavaScript Module
6. Click **Create**

#### 2.3 Reload Your Dashboard

1. Clear your browser cache (Ctrl+Shift+R / Cmd+Shift+R)
2. Reload the Home Assistant page

---

## Embedding Your Dashboard

Now you can embed your dashboard in Home Assistant using the Webpage Card:

### Option A: Using Webpage Card in Lovelace

1. Edit your dashboard
2. Add a new card
3. Choose **Webpage Card** (or **Manual** card and paste YAML below)

```yaml
type: iframe
url: http://your-dashboard-url:3333  # Your dashboard URL via Tailscale
aspect_ratio: 100%
```

### Option B: Using iframe Panel (Full Page)

1. Edit your Home Assistant `configuration.yaml`:

```yaml
panel_iframe:
  sestra_dashboard:
    title: "Sestra Dashboard"
    url: "http://your-dashboard-url:3333"
    icon: mdi:floor-plan
```

2. Restart Home Assistant
3. The dashboard will appear in your sidebar

---

## Testing the Setup

### 1. Check if Listener is Loaded

Open your browser's developer console (F12) in Home Assistant and type:

```javascript
window.testIframeListener()
```

You should see:
```
[HA iframe Listener] Test function called - listener is working!
```

### 2. Test Navigation

1. Open your dashboard in the Home Assistant iframe
2. Try clicking an entity with a "more-info" action
3. Check the console for messages like:
   ```
   Sent show-more-info postMessage to parent HA for entity: light.bedroom
   [HA iframe Listener] Received message: {type: "show-more-info", entityId: "light.bedroom"}
   ```

4. The entity detail dialog should open in Home Assistant

---

## How It Works

```
┌─────────────────────────────────────────────────┐
│         Home Assistant (Parent Window)          │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │  ha-iframe-listener.js                  │    │
│  │  - Listens for postMessage events       │    │
│  │  - Handles 'navigate' messages          │◄───┼─┐
│  │  - Handles 'show-more-info' messages    │    │ │
│  └────────────────────────────────────────┘    │ │
│                                                  │ │
│  ┌────────────────────────────────────────┐    │ │
│  │     Webpage Card (iframe)               │    │ │
│  │  ┌──────────────────────────────────┐  │    │ │
│  │  │  Your Sestra Dashboard            │  │    │ │
│  │  │                                    │  │    │ │
│  │  │  When user clicks entity:         │  │    │ │
│  │  │  1. executeTapAction() called     │  │    │ │
│  │  │  2. Sends postMessage to parent   │──┼────┼─┘
│  │  │     {type: 'show-more-info', ...} │  │    │
│  │  │                                    │  │    │
│  │  │  3. Parent listener receives      │  │    │
│  │  │  4. Opens entity dialog in HA     │  │    │
│  │  └──────────────────────────────────┘  │    │
│  └────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Message Types

The dashboard sends two types of messages:

1. **Navigate:**
   ```javascript
   {
     type: 'navigate',
     path: '/lovelace/dashboard1'
   }
   ```

2. **Show More Info:**
   ```javascript
   {
     type: 'show-more-info',
     entityId: 'light.bedroom'
   }
   ```

---

## Troubleshooting

### Entities don't open when clicked

**Check:**
1. Is the listener script loaded? Test with `window.testIframeListener()`
2. Open browser console (F12) and look for:
   - `[HA iframe Listener] Initializing...`
   - `[HA iframe Listener] Listener installed successfully`
3. Check for CORS or security errors

**Fix:**
- Clear browser cache and reload
- Verify the resource URL is exactly `/local/ha-iframe-listener.js`
- Make sure you're using JavaScript Module type, not JavaScript

### Navigation opens in new tab instead

This is the fallback behavior when:
- The listener script isn't loaded
- postMessage fails
- Browser blocks the navigation

**Fix:**
- Ensure the listener script is properly installed
- Check browser console for errors

### Console shows "Home Assistant object not found"

This means the listener can't find the Home Assistant frontend object.

**Fix:**
- Make sure you're using a modern Home Assistant version (2023+)
- Try reloading the page
- Check if Home Assistant is fully loaded before opening the iframe

---

## Security Considerations

### Origin Restriction (Optional)

For better security, you can restrict which origins can send messages to Home Assistant.

Edit `ha-iframe-listener.js` line 96:

```javascript
// Uncomment and modify this line to restrict origins:
if (event.origin !== 'http://your-dashboard-domain:3333') return;
```

Replace `http://your-dashboard-domain:3333` with your actual dashboard URL.

### Target Origin (Optional)

You can also specify the target origin in your dashboard code.

Edit `src/utils/actionHandler.ts` lines 144 and 220:

```javascript
// Change from:
'*' // Target origin

// To:
'http://your-ha-address:8123' // Your Home Assistant URL
```

---

## Alternative Solutions (If Above Doesn't Work)

### Option 1: Use HACS Panel Redirect Card

Install the "Panel Redirect" custom card from HACS, which has better iframe support.

### Option 2: Expose Dashboard Directly

Instead of embedding in iframe, add your dashboard as a separate tab:

```yaml
# configuration.yaml
panel_custom:
  - name: sestra-dashboard
    sidebar_title: Sestra Dashboard
    sidebar_icon: mdi:floor-plan
    url_path: sestra
    url: http://your-dashboard-url:3333
```

### Option 3: Use Tailscale Serve

Expose your dashboard using Tailscale Serve on the same domain as Home Assistant, avoiding cross-origin issues entirely.

---

## Next Steps

1. ✅ Install `ha-iframe-listener.js` in Home Assistant
2. ✅ Register it as a resource
3. ✅ Embed your dashboard in an iframe
4. ✅ Test entity navigation
5. 🎉 Enjoy your dashboard!

---

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify both scripts are loaded
3. Test with `window.testIframeListener()` in the console
4. Check Home Assistant logs for any errors

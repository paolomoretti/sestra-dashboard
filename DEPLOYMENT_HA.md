# Home Assistant Local Hosting Guide

This guide explains how to host the Sestra Dashboard directly on your Home Assistant instance. This is the **recommended** deployment method as it avoids CORS and Private Network Access issues.

## Why host locally?

Modern browsers block requests from public websites (like `sestra-dashboard.web.app`) to private network resources (like your Home Assistant instance), even if you use HTTPS. This is called "Private Network Access" protection.

By hosting the dashboard on Home Assistant itself:

1. The dashboard and API are on the **same origin**.
2. No CORS configuration is needed.
3. No Private Network Access errors.
4. It works securely both locally and remotely (via Nabu Casa, Tailscale, etc.).

## Step 1: Build for Local Hosting

We need to build the app with a relative base path so it works in a subfolder.

1. Run the specialized build script:

   ```bash
   ./scripts/build_ha.sh
   ```

   This will create a `dist` folder with the built application.

## Step 2: Upload to Home Assistant

You need to place the contents of the `dist` folder into your Home Assistant's `www` folder.

1. **Access your Home Assistant configuration files** (using VS Code Server add-on, Samba Share, or SSH).
2. **Locate the `www` folder** in your configuration directory (e.g., `/config/www`).
   - If it doesn't exist, create it.
3. **Create a subfolder** named `sestra-dashboard` inside `www`.
   - Path: `/config/www/sestra-dashboard`
4. **Copy all files** from your local `dist` folder into `/config/www/sestra-dashboard`.

## Step 3: Access the Dashboard

Once uploaded, your dashboard is available at:

```
/local/sestra-dashboard/index.html
```

For example: `https://halaptop.tail8c24dc.ts.net/local/sestra-dashboard/index.html`

> **Note**: If you just created the `www` folder for the first time, you must restart Home Assistant.

## Step 4: Add to Home Assistant Sidebar (Optional)

You can add it as a dashboard in Home Assistant:

1. Go to **Settings** > **Dashboards**.
2. Click **Add Dashboard**.
3. Choose **Webpage**.
4. Fill in the details:
   - **Title**: Sestra Dashboard
   - **Icon**: mdi:view-dashboard-variant
   - **URL**: `/local/sestra-dashboard/index.html`
   - **Access**: Admin only (or as preferred)

## Configuration

When running locally, you should configure the dashboard to use the current origin or explicitly set the address.

1. Open the dashboard in your browser.
2. If it doesn't connect automatically, open the browser console (F12).
3. Set the address to your HA URL (or empty string to use relative path if supported):
   ```javascript
   localStorage.setItem('ha_config_address', window.location.origin);
   localStorage.setItem('ha_config_access_token', 'YOUR_TOKEN');
   ```
4. Refresh the page.

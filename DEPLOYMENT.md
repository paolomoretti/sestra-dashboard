# Firebase Hosting Deployment Guide

This guide explains how to deploy the Sestra Dashboard to Firebase Hosting.

## Prerequisites

1. Firebase CLI installed (`npm install -g firebase-tools`)
2. Firebase project created (`sestra-dashboard`)
3. Logged into Firebase (`firebase login`)

## Configuration

The project is already configured with:

- **Firebase Project**: `sestra-dashboard`
- **Build Output**: `dist` directory
- **Hosting Config**: `firebase.json`

## Home Assistant Configuration

The app supports multiple ways to configure your Home Assistant connection:

### Configuration Priority (highest to lowest):

1. **localStorage** (runtime) - Best for multi-user scenarios
2. **Environment variables** (build-time) - Baked into the build
3. **Default values** (fallback)

### Option 1: Environment Variables (Build-Time)

Set these before building to bake them into the production build:

**Using command line:**

```bash
export VITE_HA_ADDRESS="http://your-ha-instance:8123"
export VITE_HA_ACCESS_TOKEN="your-token-here"
npm run build
```

**Or create a `.env.production` file:**

```bash
cp env.example .env.production
# Then edit .env.production with your values
```

Example `.env.production`:

```
VITE_HA_ADDRESS=http://your-ha-instance:8123
VITE_HA_ACCESS_TOKEN=your-long-lived-access-token-here
```

**Note**: These values are baked into the JavaScript bundle at build time, so they'll be visible to anyone who inspects the code. Use this for personal deployments or trusted environments.

### Option 2: localStorage (Runtime) - Recommended

For better security and multi-user support, configure at runtime:

1. Open your deployed app in the browser
2. Open the browser console (F12)
3. Run:

```javascript
localStorage.setItem('ha_config_address', 'http://your-ha-instance:8123');
localStorage.setItem('ha_config_access_token', 'your-token-here');
```

4. Refresh the page

**Benefits:**

- Credentials are not in the source code
- Each user can configure their own HA instance
- Works well for public deployments

### Getting Your Home Assistant Access Token

1. Go to your Home Assistant instance: `http://your-ha-instance:8123`
2. Click your profile (bottom-left)
3. Scroll down to "Long-Lived Access Tokens"
4. Click "Create Token"
5. Give it a name (e.g., "Sestra Dashboard")
6. Copy the token (you won't see it again!)

## Deployment Steps

1. **Build the app**:

   ```bash
   npm run build
   ```

2. **Deploy to Firebase**:

   ```bash
   npm run deploy
   ```

   Or deploy only hosting:

   ```bash
   npm run deploy:hosting
   ```

3. **Access your app**: After deployment, Firebase will provide you with a hosting URL like:
   ```
   https://sestra-dashboard.web.app
   ```
   or
   ```
   https://sestra-dashboard.firebaseapp.com
   ```

## Custom Domain (Optional)

You can configure a custom domain in the Firebase Console:

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow the instructions to verify your domain

## Important Notes

- The app stores configuration in `localStorage`, so each user's dashboard layout is stored in their browser
- For production, consider removing hardcoded credentials from `config.ts`
- The app uses SPA routing, so all routes are rewritten to `index.html` (already configured)

## Option 3: Tailscale Serve (Alternative)

If you use Tailscale, you can host the dashboard on your computer but make it available on your private Tailscale network. This solves the "Private Network Access" issue because both the dashboard and Home Assistant are on the same private network.

### 1. Build the app

```bash
npm run build
```

### 2. Serve with Tailscale

Run this command in your project directory:

```bash
tailscale serve https /dist
```

This will make your dashboard available at something like `https://your-machine.tailnet.ts.net`.

### 3. Configure Home Assistant CORS

Since the dashboard is on a different domain than Home Assistant (e.g., `your-machine.ts.net` vs `halaptop.ts.net`), you **must** add the dashboard's URL to your Home Assistant `configuration.yaml`:

```yaml
http:
  cors_allowed_origins:
    - https://your-machine.tailnet.ts.net
```

## Option 4: Firebase + Tailscale Funnel (Advanced)

If you strictly want to keep the dashboard on Firebase Hosting but need it to connect to your private Home Assistant:

1. **Expose Home Assistant via Funnel**:
   Run this on the machine running Home Assistant (or a machine that can reach it):

   ```bash
   tailscale funnel --bg --https=443 localhost:8123
   ```

   This creates a **public** URL (e.g., `https://halaptop.tailnet.ts.net`) that is accessible from the open internet.

2. **Configure Dashboard**:
   Point your Firebase-hosted dashboard to this new public Funnel URL.

3. **⚠️ Security Warning**:

## Option 5: Docker (QNAP / Synology / Self-Hosted)

If you have a NAS (like QNAP or Synology) or a server with Docker, you can host the dashboard there. This keeps it on your local network, avoiding PNA issues when accessing Home Assistant via its local IP or Tailscale.

### 1. Configure and Run

1. Copy the project to your NAS/Server.
2. Edit `docker-compose.yml` to set your Home Assistant details:
   ```yaml
   environment:
     - HA_ADDRESS=https://halaptop.tail8c24dc.ts.net
     - HA_ACCESS_TOKEN=your_token_here
   ```
3. Run:
   ```bash
   docker-compose up -d --build
   ```
4. Access the dashboard at `http://YOUR_NAS_IP:8080`.

### 2. Configure Home Assistant CORS

Since the dashboard is on a different origin (e.g., `http://192.168.1.10:8080`) than Home Assistant, you **must** add the dashboard's URL to your Home Assistant `configuration.yaml`:

```yaml
http:
  cors_allowed_origins:
    - http://192.168.1.10:8080 # Replace with your NAS IP and port
```

Restart Home Assistant after changing the configuration.

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


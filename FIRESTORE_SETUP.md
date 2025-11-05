# Firestore Setup Guide

## Step 1: Complete Firestore Initialization

The `firebase init firestore` command is waiting for you to select a database location. Choose the closest location to you (e.g., `nam5` for North America).

## Step 2: Get Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/project/sestra-dashboard/settings/general)
2. Scroll down to "Your apps" section
3. If you don't have a web app yet:
   - Click "Add app" → Web (</> icon)
   - Register app with nickname (e.g., "Sestra Dashboard")
   - Copy the `firebaseConfig` object
4. If you already have a web app, click the gear icon → "Project settings"
5. Scroll to "Your apps" and find your web app
6. Copy the `firebaseConfig` values

## Step 3: Add Firebase Config to Environment Variables

Create or update `.env.production` with your Firebase config:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=sestra-dashboard.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sestra-dashboard
VITE_FIREBASE_STORAGE_BUCKET=sestra-dashboard.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## Step 4: Enable Anonymous Authentication

Anonymous authentication must be enabled for Firestore to work:

1. Go to [Firebase Console → Authentication](https://console.firebase.google.com/project/sestra-dashboard/authentication/providers)
2. Click "Get started" if Authentication isn't enabled yet
3. Go to the "Sign-in method" tab
4. Find "Anonymous" in the list
5. Click on it and toggle "Enable"
6. Click "Save"

**Why?** The app uses anonymous authentication to allow users to access Firestore without requiring a login. This is perfect for a dashboard that should work immediately.

## Step 5: Enable Firestore Rules

After initializing Firestore, you'll need to set up security rules. For now, you can use these development rules (update later for production):

1. Go to [Firestore Console](https://console.firebase.google.com/project/sestra-dashboard/firestore)
2. Click "Rules" tab
3. Use these rules for development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /dashboards/{document} {
      // Allow read/write for authenticated users
      allow read, write: if request.auth != null;

      // For anonymous auth (current setup):
      allow read, write: if true; // ⚠️ Only for development!
    }
  }
}
```

**⚠️ Warning**: The rules above allow anyone to read/write. For production, you should:

- Use proper authentication
- Add user-based access control
- Restrict write access

## Step 6: Deploy

After setting up:

1. Build and deploy: `npm run deploy`
2. The app will automatically migrate localStorage data to Firestore on first load
3. Future changes will sync to Firestore in real-time

## Troubleshooting

- **Firestore not initialized?** Make sure you completed `firebase init firestore` and selected a location
- **Config errors?** Check that all environment variables are set in `.env` (for development) or `.env.production` (for production)
- **400 Bad Request when signing in?** Anonymous authentication is not enabled. See Step 4 above.
- **Permission denied?** Check your Firestore security rules
- **Migration failed?** Check browser console for errors

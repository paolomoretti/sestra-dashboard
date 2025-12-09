#!/bin/sh

# Generate config.js from environment variables
cat <<EOF > /usr/share/nginx/html/config.js
window.env = {
  HA_ADDRESS: "${HA_ADDRESS:-}",
  HA_ACCESS_TOKEN: "${HA_ACCESS_TOKEN:-}",
  FIREBASE_API_KEY: "${VITE_FIREBASE_API_KEY:-}",
  FIREBASE_AUTH_DOMAIN: "${VITE_FIREBASE_AUTH_DOMAIN:-}",
  FIREBASE_PROJECT_ID: "${VITE_FIREBASE_PROJECT_ID:-}",
  FIREBASE_STORAGE_BUCKET: "${VITE_FIREBASE_STORAGE_BUCKET:-}",
  FIREBASE_MESSAGING_SENDER_ID: "${VITE_FIREBASE_MESSAGING_SENDER_ID:-}",
  FIREBASE_APP_ID: "${VITE_FIREBASE_APP_ID:-}"
};
EOF

# Start Nginx
exec nginx -g "daemon off;"

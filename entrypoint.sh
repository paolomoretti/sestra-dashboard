#!/bin/sh

# Generate config.js from environment variables
cat <<EOF > /usr/share/nginx/html/config.js
window.env = {
  HA_ADDRESS: "${HA_ADDRESS:-}",
  HA_ACCESS_TOKEN: "${HA_ACCESS_TOKEN:-}"
};
EOF

# Start Nginx
exec nginx -g "daemon off;"

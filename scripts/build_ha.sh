#!/bin/bash

# Build script for Home Assistant local hosting
# This builds the app with a relative base path so it can be hosted in a subdirectory
# (e.g., /local/sestra-dashboard/)

echo "🏗️  Building for Home Assistant local hosting..."

# Set base path to relative so it works in any subdirectory
export BASE_PATH="./"

# Run the build
npm run build

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Build successful!"
  echo ""
  echo "To deploy to Home Assistant:"
  echo "1. Copy the contents of the 'dist' folder to your Home Assistant 'www/sestra-dashboard' folder."
  echo "   (You might need to create the folder first)"
  echo ""
  echo "2. Access the dashboard at:"
  echo "   /local/sestra-dashboard/index.html"
  echo ""
  echo "See DEPLOYMENT_HA.md for full instructions."
else
  echo "❌ Build failed."
  exit 1
fi

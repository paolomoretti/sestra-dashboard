# Docker Hub Deployment Guide (QNAP / Synology)

This guide explains how to build the Sestra Dashboard image, push it to Docker Hub, and run it on your NAS (QNAP, Synology, etc.).

## Prerequisites

1.  **Docker Desktop** installed on your computer.
2.  **Docker Hub Account** (create one at [hub.docker.com](https://hub.docker.com)).
3.  **Container Station** (QNAP) or **Container Manager** (Synology) installed on your NAS.

---

## Step 1: Build and Push Image

Run these commands on your computer (where the code is):

1.  **Login to Docker Hub**:

    ```bash
    docker login
    ```

2.  **Build and Push**:
    I have added a convenient script in `package.json` to handle multi-platform builds (ARM64 & AMD64) automatically. This ensures the image works on both newer Macs (Apple Silicon) and standard NAS processors (Intel/AMD).

    **Crucial**: Make sure you have a `.dockerignore` file (I just added one for you) to prevent your local `node_modules` from breaking the Linux container build.

    ```bash
    # This command builds for both platforms and pushes to Docker Hub
    npm run docker:push
    ```

    _If you prefer running the command manually:_

    ```bash
    docker buildx build --platform linux/amd64,linux/arm64 -t littlebrown/sestra-dashboard:latest --push .
    ```

---

## Step 2: Deploy on QNAP (Container Station)

1.  Open **Container Station**.
2.  Go to **Images** -> **Pull**.
3.  Enter your image name: `littlebrown/sestra-dashboard:latest`.
4.  Click **Pull**.
5.  Once downloaded, click the **+ (Create Container)** icon next to the image.
6.  **Configure the Container**:
    - **Name**: `sestra-dashboard`
    - **Network**: Bridge (or Host if you prefer)
    - **Port Forwarding**: Map container port `80` to a NAS port (e.g., `8787`).
    - **Environment Variables** (Crucial Step):
      Add these variables so the app knows where Home Assistant is:
      - `HA_ADDRESS`: `https://halaptop.tail8c24dc.ts.net` (Your HA URL)
      - `HA_ACCESS_TOKEN`: `YOUR_LONG_LIVED_ACCESS_TOKEN`
      - `VITE_FIREBASE_API_KEY`: Your Firebase API Key
      - `VITE_FIREBASE_AUTH_DOMAIN`: Your Auth Domain
      - `VITE_FIREBASE_PROJECT_ID`: Your Project ID
      - `VITE_FIREBASE_STORAGE_BUCKET`: Your Storage Bucket
      - `VITE_FIREBASE_MESSAGING_SENDER_ID`: Your Messaging Sender ID
      - `VITE_FIREBASE_APP_ID`: Your App ID
7.  Click **Create**.

---

## Step 3: Configure Home Assistant CORS

Since your dashboard is now running on your NAS (e.g., `http://192.168.1.50:8787`), you must tell Home Assistant to allow connections from it.

1.  Open your Home Assistant `configuration.yaml` (using File Editor or VS Code add-on).
2.  Add or update the `http` section:
    ```yaml
    http:
      cors_allowed_origins:
        - http://192.168.1.50:8787 # Replace with your NAS IP and the port you chose
        - https://halaptop.tail8c24dc.ts.net # Good idea to add this too if accessing via Tailscale
    ```
3.  **Restart Home Assistant**.

---

## Troubleshooting

### "I only see Watchtower running" / Container keeps restarting

If the `sestra-dashboard` container appears and then disappears, or shows a "Restarting" status, it is crashing on startup.

1.  **Check Logs**:
    - In Container Station, click on the `sestra-dashboard` container.
    - Click **Logs** or **Console**.
2.  **Look for "Exec format error"**:
    - If you see `exec /entrypoint.sh: exec format error`, it means the image architecture doesn't match your NAS.
    - **Fix**: Run `npm run docker:push` again to ensure both `linux/amd64` and `linux/arm64` are built.
3.  **Look for "Permission denied"**:
    - If `entrypoint.sh` fails to run, it might be a permission issue. (The Dockerfile handles this, but good to check).

### "I don't see anything at the IP address"

1.  **Check the Port**: Did you map `8787` (Host) to `80` (Container)?
2.  **Check the Logs**: Is Nginx starting? You should see:
    ```
    /docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration
    ...
    start worker processes
    ```
3.  **Browser Console**: If the page loads but is blank or shows an error:
    - Press F12.
    - Check the **Console** tab for errors (like CORS or connection refused).
    - Type `window.env` to verify your config is loaded.

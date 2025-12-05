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

2.  **Build the image**:
    Replace `YOUR_DOCKER_USERNAME` with your actual Docker Hub username.

    ```bash
    # Build for multiple platforms (important for NAS which might be ARM or x86)
    docker buildx build --platform linux/amd64,linux/arm64 -t YOUR_DOCKER_USERNAME/sestra-dashboard:latest --push .
    ```

    _If `docker buildx` doesn't work, just use standard build (might limit compatibility):_

    ```bash
    docker build -t YOUR_DOCKER_USERNAME/sestra-dashboard:latest .
    docker push YOUR_DOCKER_USERNAME/sestra-dashboard:latest
    ```

---

## Step 2: Deploy on QNAP (Container Station)

1.  Open **Container Station**.
2.  Go to **Images** -> **Pull**.
3.  Enter your image name: `YOUR_DOCKER_USERNAME/sestra-dashboard:latest`.
4.  Click **Pull**.
5.  Once downloaded, click the **+ (Create Container)** icon next to the image.
6.  **Configure the Container**:
    - **Name**: `sestra-dashboard`
    - **Network**: Bridge (or Host if you prefer)
    - **Port Forwarding**: Map container port `80` to a NAS port (e.g., `8080`).
    - **Environment Variables** (Crucial Step):
      Add these variables so the app knows where Home Assistant is:
      - `HA_ADDRESS`: `https://halaptop.tail8c24dc.ts.net` (Your HA URL)
      - `HA_ACCESS_TOKEN`: `YOUR_LONG_LIVED_ACCESS_TOKEN`
7.  Click **Create**.

---

## Step 3: Configure Home Assistant CORS

Since your dashboard is now running on your NAS (e.g., `http://192.168.1.50:8080`), you must tell Home Assistant to allow connections from it.

1.  Open your Home Assistant `configuration.yaml`.
2.  Add or update the `http` section:
    ```yaml
    http:
      cors_allowed_origins:
        - http://192.168.1.50:8080 # Replace with your NAS IP and the port you chose
    ```
3.  **Restart Home Assistant**.

---

## Step 4: Access and Test

1.  Open your browser and go to `http://YOUR_NAS_IP:8080`.
2.  The dashboard should load.
3.  It should automatically connect to Home Assistant using the environment variables you set.
4.  **Troubleshooting**:
    - If it doesn't connect, open the browser console (F12).
    - Type `window.env` to see if the variables were injected correctly.
    * **CORS Error?**: This means Home Assistant blocked the connection.
      - Check your `configuration.yaml`.
      - **CRITICAL**: The URL in `cors_allowed_origins` must **exactly match** what you see in your browser address bar.
      - If you access via `http://sestra:8787`, you MUST add `http://sestra:8787`.
      - If you access via `http://192.168.1.50:8787`, you MUST add `http://192.168.1.50:8787`.

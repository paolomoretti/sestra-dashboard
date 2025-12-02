<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="camera-modal-overlay"
      @click.self="close"
      @keydown.esc="close"
    >
      <div class="camera-modal" @click.stop>
        <div class="camera-modal-header">
          <h2 class="camera-modal-title">{{ entityName }}</h2>
          <div class="camera-modal-controls">
            <button
              class="camera-modal-button"
              :class="{ active: viewMode === 'live' }"
              @click="switchToLive"
            >
              Live
            </button>
            <button
              v-if="supportsRecordings"
              class="camera-modal-button"
              :class="{ active: viewMode === 'recording' }"
              @click="viewMode = 'recording'"
            >
              Recording
            </button>
            <button class="camera-modal-close" @click="close" aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="camera-modal-content">
          <!-- Live Stream -->
          <div v-if="viewMode === 'live'" class="camera-stream-container">
            <div v-if="loading && !liveStreamUrl" class="camera-loading">
              <div class="spinner"></div>
              <p>Loading stream...</p>
            </div>
            <template v-else-if="liveStreamUrl">
              <img
                :key="liveStreamUrl"
                :src="liveStreamUrl"
                class="camera-stream"
                alt="Live camera view"
                crossorigin="anonymous"
                @error="handleStreamError"
                @load="handleStreamLoaded"
                @loadstart="handleStreamLoadStart"
              />
              <div v-if="loading" class="camera-loading-overlay">
                <div class="spinner"></div>
                <p>Loading stream...</p>
              </div>
            </template>
            <div v-else-if="streamError" class="camera-error">
              <p>Unable to load live stream</p>
              <p class="camera-error-hint">Check your Home Assistant connection and camera settings</p>
            </div>
            <div v-else class="camera-error">
              <p>No stream URL available</p>
            </div>
          </div>
          <!-- Recording -->
          <div v-else-if="viewMode === 'recording'" class="camera-recording-container">
            <video
              v-if="recordingUrl"
              :src="recordingUrl"
              class="camera-recording"
              controls
              autoplay
              @error="handleRecordingError"
            />
            <div v-else-if="loadingRecording" class="camera-loading">
              <div class="spinner"></div>
              <p>Loading recording...</p>
            </div>
            <div v-else class="camera-error">
              <p>No recording available</p>
              <p class="camera-error-hint">Recordings may not be available for this camera</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { haConfig } from '../../config';
import { getApiBaseUrl } from '../utils/haServices';

interface Props {
  isOpen: boolean;
  entityId: string;
  entityName: string;
  videoUrl?: string;
  entityPicture?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const viewMode = ref<'live' | 'recording'>('live');
const loading = ref(true);
const loadingRecording = ref(false);
const streamError = ref(false);
const recordingUrl = ref<string | null>(null);
const supportsRecordings = ref(false);
const liveStreamUrl = ref<string | null>(null);
const posterUrl = ref<string | null>(null);
let liveStreamRefreshInterval: ReturnType<typeof setInterval> | null = null;

// Check if this is a Ring camera
const isRingCamera = computed(() => {
  const entityIdLower = props.entityId.toLowerCase();
  return entityIdLower.includes('ring') || entityIdLower.includes('doorbell');
});

// Get the camera live stream URL (for live view)
// Use camera_proxy endpoint - in dev mode use proxy (handles CORS), in prod use full address with token
// Refresh the URL periodically to show latest snapshot
function getCameraStreamUrl(): string | null {
  const timestamp = Date.now();
  
  // In dev mode, use proxy which handles CORS and auth
  // In prod, use full address with token
  if (import.meta.env.DEV) {
    const apiBaseUrl = getApiBaseUrl(haConfig);
    return `${apiBaseUrl}/camera_proxy/${props.entityId}?t=${timestamp}`;
  } else {
    return `${haConfig.address}/api/camera_proxy/${props.entityId}?token=${haConfig.accessToken}&t=${timestamp}`;
  }
}

// Get the poster (snapshot) URL for the video
function getPosterUrl(): string | null {
  // Use entity_picture if available
  if (props.entityPicture) {
    let pictureUrl = props.entityPicture;
    if (pictureUrl.startsWith('/')) {
      if (pictureUrl.startsWith('/api/')) {
        // If it's a relative API path, make it absolute with full HA address
        return `${haConfig.address}${pictureUrl}`;
      }
      pictureUrl = `${haConfig.address}${pictureUrl}`;
    }
    return pictureUrl;
  }
  
  // Fallback to camera_proxy endpoint for snapshot
  // Use full HA address and keep the full entity ID, add token for authentication
  return `${haConfig.address}/api/camera_proxy/${props.entityId}?token=${haConfig.accessToken}`;
}

// Initialize stream URL
function initializeStream(): void {
  loading.value = true;
  streamError.value = false;
  
  // Clear any existing refresh interval
  if (liveStreamRefreshInterval) {
    clearInterval(liveStreamRefreshInterval);
    liveStreamRefreshInterval = null;
  }
  
  const streamUrl = getCameraStreamUrl();
  const poster = getPosterUrl();
  
  if (streamUrl) {
    posterUrl.value = poster;
    liveStreamUrl.value = streamUrl;
    console.log('Camera stream URL:', streamUrl);
    console.log('Camera poster URL:', poster);
    
    // Refresh the image URL every 2 seconds to show latest snapshot
    // Update the src with a new timestamp to force browser to reload
    liveStreamRefreshInterval = setInterval(() => {
      if (viewMode.value === 'live' && !streamError.value) {
        // Update URL with new timestamp to force refresh
        const newUrl = getCameraStreamUrl();
        if (newUrl) {
          liveStreamUrl.value = newUrl;
        }
      }
    }, 2000);
    
    // Image will load and trigger load event
  } else {
    console.error('No stream URL available');
    streamError.value = true;
    loading.value = false;
  }
}

// Load recording for Ring cameras
async function loadRecording() {
  if (!isRingCamera.value) {
    supportsRecordings.value = false;
    return;
  }

  loadingRecording.value = true;
  supportsRecordings.value = true;

  try {
    const apiBaseUrl = getApiBaseUrl(haConfig);
    
    // First, get the current state to check for recording URLs
    const stateResponse = await fetch(`${apiBaseUrl}/states/${props.entityId}`, {
      headers: {
        Authorization: `Bearer ${haConfig.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (stateResponse.ok) {
      const state = await stateResponse.json();
      
      // Check for recording URL in attributes (Ring might store this)
      const recordingUrlAttr = 
        state.attributes?.recording_url || 
        state.attributes?.last_recording_url ||
        state.attributes?.video_url;
      
      if (recordingUrlAttr) {
        let url = recordingUrlAttr;
        if (url.startsWith('/')) {
          url = `${haConfig.address}${url}`;
        }
        recordingUrl.value = url;
        loadingRecording.value = false;
        return;
      }
    }

    // Try to get the latest event/recording from Ring service
    // Ring integration provides ring.get_recording service
    try {
      const serviceResponse = await fetch(`${apiBaseUrl}/services/ring/get_recording`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${haConfig.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: props.entityId,
        }),
      });

      if (serviceResponse.ok) {
        const result = await serviceResponse.json();
        // The service might return a URL or the recording data
        if (result.url) {
          let url = result.url;
          if (url.startsWith('/')) {
            url = `${haConfig.address}${url}`;
          }
          recordingUrl.value = url;
        } else if (result.recording_url) {
          let url = result.recording_url;
          if (url.startsWith('/')) {
            url = `${haConfig.address}${url}`;
          }
          recordingUrl.value = url;
        }
      }
    } catch (serviceError) {
      // Service might not be available, that's okay
      console.log('Ring get_recording service not available or failed:', serviceError);
    }

    // If we still don't have a recording URL, use videoUrl (which is the recording)
    if (!recordingUrl.value && props.videoUrl) {
      // videoUrl points to the latest recording
      let url = props.videoUrl;
      if (url.startsWith('/')) {
        url = `${haConfig.address}${url}`;
      }
      recordingUrl.value = url;
    }
  } catch (error) {
    console.error('Error loading recording:', error);
    recordingUrl.value = null;
  } finally {
    loadingRecording.value = false;
  }
}

function handleStreamError(e: Event) {
  console.error('Stream load error:', e);
  const img = e.target as HTMLImageElement;
  if (img) {
    console.error('Image error details:', {
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
    });
  }
  streamError.value = true;
  loading.value = false;
}

function handleStreamLoadStart() {
  console.log('Stream started loading');
  loading.value = true;
  streamError.value = false;
}

function handleStreamLoaded() {
  console.log('Stream image loaded');
  loading.value = false;
  streamError.value = false;
}

function handleRecordingError() {
  recordingUrl.value = null;
  loadingRecording.value = false;
}

function switchToLive() {
  viewMode.value = 'live';
  initializeStream();
}

function close() {
  emit('close');
}


watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      streamError.value = false;
      // Start with recording view (shows latest recording)
      viewMode.value = 'recording';
      
      // Load recording first (this is what works)
      if (isRingCamera.value) {
        loadRecording();
      } else if (props.videoUrl) {
        // For non-Ring cameras, use videoUrl as recording
        let url = props.videoUrl;
        if (url.startsWith('/')) {
          url = `${haConfig.address}${url}`;
        }
        recordingUrl.value = url;
        supportsRecordings.value = true;
      }
      
      // Initialize poster for live view
      const poster = getPosterUrl();
      posterUrl.value = poster;
    } else {
      // Clean up
      if (liveStreamRefreshInterval) {
        clearInterval(liveStreamRefreshInterval);
        liveStreamRefreshInterval = null;
      }
      liveStreamUrl.value = null;
      posterUrl.value = null;
      recordingUrl.value = null;
    }
  },
  { immediate: true }
);

// Watch viewMode to reinitialize stream when switching to live
watch(viewMode, (newMode) => {
  if (newMode === 'live' && props.isOpen) {
    initializeStream();
  }
});

// Handle Escape key
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.isOpen) {
      close();
    }
  };
  document.addEventListener('keydown', handleEscape);
  onUnmounted(() => {
    document.removeEventListener('keydown', handleEscape);
  });
});

onUnmounted(() => {
  // Clean up
  if (liveStreamRefreshInterval) {
    clearInterval(liveStreamRefreshInterval);
    liveStreamRefreshInterval = null;
  }
  
  liveStreamUrl.value = null;
  posterUrl.value = null;
});
</script>

<style scoped>
.camera-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.camera-modal {
  background: #1e1e1e;
  border-radius: 12px;
  width: 100%;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.camera-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #333;
  background: #252525;
}

.camera-modal-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #ffffff;
}

.camera-modal-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.camera-modal-button {
  padding: 8px 16px;
  background: #333;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.camera-modal-button:hover {
  background: #444;
  border-color: #666;
}

.camera-modal-button.active {
  background: #2196f3;
  border-color: #2196f3;
  color: #fff;
}

.camera-modal-close {
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s;
}

.camera-modal-close:hover {
  background: #444;
}

.camera-modal-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  min-height: 400px;
  overflow: auto;
}

.camera-stream-container,
.camera-recording-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.camera-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 10;
  color: #fff;
  gap: 16px;
}

.camera-stream {
  width: 100%;
  max-width: 100%;
  max-height: calc(90vh - 120px);
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  background: #000;
}

.camera-recording {
  max-width: 100%;
  max-height: calc(90vh - 120px);
  border-radius: 8px;
}

.camera-loading,
.camera-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #fff;
}

.camera-error p {
  margin: 0;
  font-size: 1.1rem;
  color: #ff6b6b;
}

.camera-error-hint {
  margin-top: 8px;
  font-size: 0.9rem;
  color: #999 !important;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #333;
  border-top-color: #2196f3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .camera-modal {
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
  }

  .camera-modal-header {
    padding: 16px;
  }

  .camera-modal-title {
    font-size: 1.2rem;
  }

  .camera-modal-button {
    padding: 6px 12px;
    font-size: 0.85rem;
  }
}
</style>


<template>

  <div
    v-if="isOpen"
    ref="panelRef"
    class="entity-info-panel"
    :class="{ expanded: isExpanded }"
    :style="infoPanelStyle"
    @mousedown.stop
    @click.stop
  >
     <!-- Label/Header - always visible, clickable to collapse/expand -->
    <div
      class="panel-header"
      :class="{ collapsed: !isExpanded, expanded: isExpanded }"
      @click="toggleExpanded"
    >
       <span class="panel-title">{{ displayLabel }}</span
      > <span class="expand-indicator" v-if="isExpanded">▲</span>
    </div>
     <!-- Expandable content --> <transition name="expand"
      >
      <div v-if="isExpanded">
         <!-- Divider -->
        <div class="panel-divider"></div>
         <!-- Tabs -->
        <div class="panel-tabs">
           <button
            class="panel-tab"
            :class="{ active: activeTab === 'general' }"
            @click.stop="activeTab = 'general'"
            @mousedown.stop
          >
             General </button
          > <button
            class="panel-tab"
            :class="{ active: activeTab === 'style' }"
            @click.stop="activeTab = 'style'"
            @mousedown.stop
          >
             Style </button
          >
        </div>
         <!-- Entity details -->
        <div class="panel-content">
           <!-- General Tab -->
          <div v-show="activeTab === 'general'" class="tab-content">
             <!-- Label Override -->
            <div class="detail-row">
               <span class="detail-label">Label:</span> <input
                type="text"
                v-model="labelOverrideInput"
                @blur="handleLabelOverrideBlur"
                @mousedown.stop
                @click.stop
                class="text-input"
                placeholder="Custom label (leave empty for default)"
              />
            </div>

            <div class="detail-row">
               <span class="detail-label">Entity ID:</span> <span
                class="detail-value entity-id-value"
                >{{ entity.key || 'N/A' }}</span
              >
            </div>

            <div class="detail-row">
               <span class="detail-label">State:</span> <span class="detail-value state-value">{{
                entity.state || 'unknown'
              }}</span
              >
            </div>

            <div class="detail-row">
               <span class="detail-label">Category:</span> <span class="detail-value">{{
                entity.category || 'sensor'
              }}</span
              >
            </div>
             <!-- Entity Selector (for image widgets) -->
            <div v-if="entity.isImageWidget" class="detail-row">
               <span class="detail-label">Linked Entity:</span>
              <div class="entity-selector-wrapper">

                <div class="icon-search-wrapper">
                   <input
                    type="text"
                    :value="
                      entitySearchQuery || (currentLinkedEntityId ? currentLinkedEntityName : '')
                    "
                    @input="
                      e => {
                        entitySearchQuery = (e.target as HTMLInputElement).value;
                      }
                    "
                    @mousedown.stop
                    @click.stop
                    @focus="
                      () => {
                        if (currentLinkedEntityId) entitySearchQuery = '';
                      }
                    "
                    @keydown="handleEntitySearchKeydown"
                    :placeholder="
                      currentLinkedEntityId ? currentLinkedEntityName : 'Search entities...'
                    "
                    class="icon-search-input"
                  />
                </div>

                <div
                  class="icon-dropdown entity-dropdown"
                  @mousedown.stop
                  @click.stop
                  @wheel="handleIconDropdownWheel"
                  @touchmove="handleIconDropdownTouchMove"
                  v-show="entitySearchQuery.trim().length > 0"
                >

                  <div
                    class="icon-option"
                    :class="{
                      'icon-option-selected': currentLinkedEntityId === '',
                      'icon-option-highlighted': entityHighlightedIndex === 0,
                    }"
                    @click="selectLinkedEntity('')"
                    @mouseenter="entityHighlightedIndex = 0"
                  >
                     <span class="icon-option-label">None (always show)</span>
                  </div>

                  <div
                    v-for="(entityOption, index) in filteredEntities"
                    :key="entityOption.key"
                    class="icon-option"
                    :class="{
                      'icon-option-selected': currentLinkedEntityId === entityOption.key,
                      'icon-option-highlighted': entityHighlightedIndex === index + 1,
                    }"
                    :ref="
                      el => {
                        if (el) entityOptionRefs[index] = el as HTMLElement;
                      }
                    "
                    @click="selectLinkedEntity(entityOption.key)"
                    @mouseenter="entityHighlightedIndex = index + 1"
                  >
                     <span class="icon-option-label">{{
                      entityOption.name || entityOption.key
                    }}</span
                    >
                  </div>

                  <div v-if="filteredEntities.length === 0" class="icon-search-hint">
                     No entities found
                  </div>

                </div>

                <div
                  v-if="currentLinkedEntityName && !entitySearchQuery.trim()"
                  class="ha-action-selected"
                >
                   Selected: {{ currentLinkedEntityName }}
                </div>

              </div>

            </div>
             <!-- HA Action (for action buttons) -->
            <div v-if="entity.isActionButton" class="detail-row">
               <span class="detail-label">HA Action:</span>
              <div class="ha-action-selector-wrapper">
                 <input
                  type="text"
                  :value="haActionSearchQuery || (currentHAAction ? currentHAActionLabel : '')"
                  @input="
                    e => {
                      haActionSearchQuery = (e.target as HTMLInputElement).value;
                    }
                  "
                  @mousedown.stop
                  @click.stop
                  @focus="
                    () => {
                      if (currentHAAction) haActionSearchQuery = '';
                    }
                  "
                  @keydown="handleHAActionSearchKeydown"
                  :placeholder="currentHAAction ? currentHAActionLabel : 'Search actions...'"
                  class="icon-search-input"
                />
                <div
                  class="icon-dropdown ha-action-dropdown"
                  @mousedown.stop
                  @click.stop
                  @wheel="handleIconDropdownWheel"
                  @touchmove="handleIconDropdownTouchMove"
                  v-show="haActionSearchQuery.trim().length > 0"
                >

                  <div
                    v-for="service in filteredHAActions"
                    :key="service.service"
                    class="icon-option"
                    :class="{ 'icon-option-selected': currentHAAction === service.service }"
                    @click="selectHAAction(service.service)"
                  >
                     <span class="icon-option-label">{{ service.label }}</span
                    >
                  </div>

                  <div
                    v-if="filteredHAActions.length === 0 && !isLoadingHAActions"
                    class="icon-search-hint"
                  >
                     No actions found
                  </div>

                  <div v-if="isLoadingHAActions" class="icon-loading">Loading actions...</div>

                </div>

                <div
                  v-if="currentHAActionLabel && !haActionSearchQuery.trim()"
                  class="ha-action-selected"
                >
                   Selected: {{ currentHAActionLabel }}
                </div>
                 <!-- Automation selector (shown when automation.trigger is selected) -->
                <div v-if="currentHAAction === 'automation.trigger'" class="automation-selector">

                  <div class="detail-label" style="margin-bottom: 6px">Automation:</div>
                   <select
                    :value="selectedAutomation"
                    @change="handleAutomationChange"
                    @mousedown.stop
                    @click.stop
                    class="icon-select"
                  >

                    <option value="">Select automation...</option>

                    <option
                      v-for="automation in automations"
                      :key="automation.entity_id"
                      :value="automation.entity_id"
                    >
                       {{ automation.name }}
                    </option>
                     </select
                  >
                  <div v-if="isLoadingAutomations" class="icon-loading">
                     Loading automations...
                  </div>

                </div>

              </div>

            </div>
             <!-- Tap Action (for regular entities) -->
            <div v-if="!entity.isActionButton" class="detail-row">
               <span class="detail-label">Tap Action:</span> <select
                :value="currentTapAction"
                @change="handleTapActionChange"
                @mousedown.stop
                @click.stop
                class="icon-select"
              >

                <option value="">None</option>

                <option value="toggle">Toggle</option>

                <option value="more-info">More Info</option>

                <option value="navigate">Navigate</option>
                 </select
              >
            </div>
             <!-- Navigation Path (only show if navigate is selected) -->
            <div
              v-if="!entity.isActionButton && currentTapAction === 'navigate'"
              class="detail-row"
            >
               <span class="detail-label">Navigation Path:</span> <input
                type="text"
                :value="currentNavigationPath"
                @input="handleNavigationPathChange"
                @mousedown.stop
                @click.stop
                class="text-input"
                placeholder="/dashboard/living-room"
              />
            </div>
             <!-- Long Press Action (for regular entities) -->
            <div v-if="!entity.isActionButton" class="detail-row">
               <span class="detail-label">Long Press Action:</span> <select
                :value="currentLongPressAction"
                @change="handleLongPressActionChange"
                @mousedown.stop
                @click.stop
                class="icon-select"
              >

                <option value="">None</option>

                <option value="toggle">Toggle</option>

                <option value="more-info">More Info</option>

                <option value="navigate">Navigate</option>
                 </select
              >
            </div>
             <!-- Long Press Navigation Path (only show if navigate is selected) -->
            <div
              v-if="!entity.isActionButton && currentLongPressAction === 'navigate'"
              class="detail-row"
            >
               <span class="detail-label">Long Press Nav Path:</span> <input
                type="text"
                :value="currentLongPressNavigationPath"
                @input="handleLongPressNavigationPathChange"
                @mousedown.stop
                @click.stop
                class="text-input"
                placeholder="/dashboard/living-room"
              />
            </div>
             <!-- Delete Button -->
            <div class="detail-row delete-row">
               <button
                @click.stop="handleDelete"
                @mousedown.stop
                class="delete-button"
                title="Delete widget (or press Backspace)"
              >
                 🗑️ Delete Widget </button
              >
            </div>

          </div>
           <!-- Style Tab -->
          <div v-show="activeTab === 'style'" class="tab-content">
             <!-- Label Visibility -->
            <div class="detail-row">
               <span class="detail-label">Show Label:</span> <label class="toggle-switch"
                > <input
                  type="checkbox"
                  :checked="widgetLabelVisible"
                  @change="handleLabelVisibilityChange"
                  @mousedown.stop
                  @click.stop
                /> <span class="toggle-slider"></span> </label
              >
            </div>
             <!-- Image URL (for image widgets) -->
            <div v-if="entity.isImageWidget" class="detail-row">
               <span class="detail-label">Image URL:</span>
              <div class="image-url-wrapper">
                 <input
                  type="text"
                  :value="currentImageUrl"
                  @input="handleImageUrlChange"
                  @mousedown.stop
                  @click.stop
                  class="text-input"
                  placeholder="Enter image URL or path"
                /> <button
                  @click.stop="handleImageFileSelect"
                  @mousedown.stop
                  class="image-select-button"
                >
                   Select Image File </button
                >
              </div>

            </div>
             <!-- Image Condition (for image widgets) -->
            <div v-if="entity.isImageWidget && entity.linkedEntityId" class="detail-row">
               <span class="detail-label">Show Image If:</span>
              <div class="condition-controls">
                 <select
                  :value="imageConditionOperator"
                  @change="handleImageConditionOperatorChange"
                  @mousedown.stop
                  @click.stop
                  class="icon-select condition-operator"
                >

                  <option value="">Always</option>

                  <option value="equal">Equal (=)</option>

                  <option value="notEqual">Not Equal (≠)</option>

                  <option value="greater">Greater (>)</option>

                  <option value="lower">Lower (<)</option>

                  <option value="greaterEqual">Greater or Equal (≥)</option>

                  <option value="lowerEqual">Lower or Equal (≤)</option>
                   </select
                > <input
                  v-if="imageConditionOperator"
                  type="text"
                  :value="imageConditionValue"
                  @input="handleImageConditionValueChange"
                  @mousedown.stop
                  @click.stop
                  class="text-input condition-value"
                  placeholder="Value or state"
                />
              </div>

            </div>
             <!-- State Visibility -->
            <div class="detail-row" v-if="entity.state && !entity.isImageWidget">
               <span class="detail-label">Show State:</span> <label class="toggle-switch"
                > <input
                  type="checkbox"
                  :checked="widgetStateVisible"
                  @change="handleStateVisibilityChange"
                  @mousedown.stop
                  @click.stop
                /> <span class="toggle-slider"></span> </label
              >
            </div>
             <!-- Value Prefix -->
            <div class="detail-row" v-if="isNumericEntity">
               <span class="detail-label">Value Prefix:</span> <input
                type="text"
                :value="entity.valuePrefix || ''"
                @input="handleValuePrefixChange"
                @mousedown.stop
                @click.stop
                class="text-input"
                placeholder="e.g., $, €"
              />
            </div>
             <!-- Value Suffix -->
            <div class="detail-row" v-if="isNumericEntity">
               <span class="detail-label">Value Suffix:</span> <input
                type="text"
                :value="entity.valueSuffix || ''"
                @input="handleValueSuffixChange"
                @mousedown.stop
                @click.stop
                class="text-input"
                placeholder="e.g., %, °C, W"
              />
            </div>
             <!-- Icon selection -->
            <div class="detail-row" v-if="!entity.isImageWidget">
               <span class="detail-label">Icon:</span>
              <div class="icon-selector-wrapper">

                <div class="icon-search-wrapper">
                   <input
                    type="text"
                    v-model="iconSearchQuery"
                    @mousedown.stop
                    @click.stop
                    @input.stop
                    @keydown="handleIconSearchKeydown"
                    @focus="handleIconSearchFocus"
                    placeholder="Search icons..."
                    class="icon-search-input"
                    ref="iconSearchInputRef"
                  />
                </div>

                <div
                  class="icon-dropdown"
                  @mousedown.stop
                  @click.stop
                  @wheel="handleIconDropdownWheel"
                  @touchmove="handleIconDropdownTouchMove"
                  @keydown="handleIconDropdownKeydown"
                  @focus="handleIconDropdownFocus"
                  tabindex="0"
                  ref="iconDropdownRef"
                >
                   <!-- Only show options if debounced search has at least 1 character --> <template
                    v-if="debouncedIconSearchQuery.trim().length > 0"
                    >
                    <div
                      class="icon-option"
                      :class="{
                        'icon-option-selected': currentIcon === '',
                        'icon-option-highlighted': highlightedIndex === 0,
                      }"
                      @click="selectIcon('')"
                      @mouseenter="highlightedIndex = 0"
                    >
                       <span class="icon-option-label">(Use HA default)</span>
                    </div>

                    <div v-if="isLoadingIcons" class="icon-loading">Loading icons...</div>

                    <div
                      v-for="(icon, index) in filteredIconOptions"
                      :key="icon.value"
                      class="icon-option"
                      :class="{
                        'icon-option-selected': currentIcon === icon.value,
                        'icon-option-highlighted': highlightedIndex === index + 1,
                      }"
                      :ref="
                        el => {
                          if (el) iconOptionRefs[index] = el as HTMLElement;
                        }
                      "
                      @click="selectIcon(icon.value)"
                      @mouseenter="highlightedIndex = index + 1"
                    >
                       <img
                        v-if="getIconPreview(icon.value)"
                        :src="getIconPreview(icon.value) ?? ''"
                        class="icon-preview"
                        alt=""
                      /> <span class="icon-option-label">{{ icon.label }}</span
                      >
                    </div>
                     </template
                  >
                  <div
                    v-if="
                      iconSearchQuery.trim().length > 0 &&
                      debouncedIconSearchQuery.trim().length === 0
                    "
                    class="icon-search-hint"
                  >
                     Searching...
                  </div>

                  <div
                    v-else-if="
                      debouncedIconSearchQuery.trim().length > 0 &&
                      filteredIconOptions.length === 0 &&
                      !isLoadingIcons
                    "
                    class="icon-search-hint"
                  >
                     No icons found
                  </div>

                  <div
                    v-else-if="
                      debouncedIconSearchQuery.trim().length === 0 &&
                      iconSearchQuery.trim().length === 0 &&
                      isExpanded
                    "
                    class="icon-search-hint"
                  >
                     Type to search {{
                      iconOptions.length > COMMON_MDI_ICONS.length
                        ? `${iconOptions.length.toLocaleString()}`
                        : 'thousands of'
                    }} available icons
                  </div>

                </div>

              </div>

            </div>
             <!-- Icon Color Overrides -->
            <div class="detail-row">
               <span class="detail-label">Icon Color (On):</span>
              <div class="color-input-wrapper">
                 <input
                  type="color"
                  :value="entity.iconColorOn || '#FFC107'"
                  @input="handleIconColorOnChange"
                  @mousedown.stop
                  @click.stop
                  class="color-input"
                /> <input
                  type="text"
                  :value="entity.iconColorOn || '#FFC107'"
                  @input="handleIconColorOnTextChange"
                  @mousedown.stop
                  @click.stop
                  class="text-input color-text-input"
                  placeholder="#FFC107"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>

            </div>
             <!-- Icon Color Off -->
            <div class="detail-row">
               <span class="detail-label">Icon Color (Off):</span>
              <div class="color-input-wrapper">
                 <input
                  type="color"
                  :value="entity.iconColorOff || '#888888'"
                  @input="handleIconColorOffChange"
                  @mousedown.stop
                  @click.stop
                  class="color-input"
                /> <input
                  type="text"
                  :value="entity.iconColorOff || '#888888'"
                  @input="handleIconColorOffTextChange"
                  @mousedown.stop
                  @click.stop
                  class="text-input color-text-input"
                  placeholder="#888888"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>

            </div>
             <!-- State Condition -->
            <div class="detail-row" v-if="isNumericEntity">
               <span class="detail-label">Show State If:</span>
              <div class="condition-controls">
                 <select
                  :value="stateConditionOperator"
                  @change="handleStateConditionOperatorChange"
                  @mousedown.stop
                  @click.stop
                  class="icon-select condition-operator"
                >

                  <option value="">Always</option>

                  <option value="equal">Equal (=)</option>

                  <option value="greater">Greater (>)</option>

                  <option value="lower">Lower (<)</option>

                  <option value="greaterEqual">Greater or Equal (≥)</option>

                  <option value="lowerEqual">Lower or Equal (≤)</option>
                   </select
                > <input
                  v-if="stateConditionOperator"
                  type="number"
                  step="any"
                  :value="stateConditionValue"
                  @input="handleStateConditionValueChange"
                  @mousedown.stop
                  @click.stop
                  class="text-input condition-value"
                  placeholder="Value"
                />
              </div>

            </div>

          </div>

        </div>

      </div>
       </transition
    >
  </div>

</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { debouncedRef } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { useLocalStorage } from '../composables/useLocalStorage';
import { useToast } from '../composables/useToast';
import { clearSelection, type EntityData } from '../composables/useEntitySelection';
import {
  getMDIIconPath,
  createIconSVG,
  extractIconFromHA,
  getDefaultIcon,
} from '../utils/iconUtils';
import { type TapAction } from '../utils/actionHandler';
import { useUIStore } from '../stores/ui';
import { useEntitiesStore } from '../stores/entities';
import { getAllMDIIcons, COMMON_MDI_ICONS } from '../utils/mdiIconList';
import { haConfig } from '../../config';
import {
  fetchHAServices,
  getAllServices,
  fetchAutomations,
  type HAService,
} from '../utils/haServices';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getStorageInstance } from '../utils/firebase';

interface Props {
  entity: EntityData;
  isOpen: boolean;
  scale: number;
  displayLabel: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  update: [entityId: string, updates: Partial<EntityData>];
  delete: [entityId: string];
  close: [];
}>();

const panelRef = ref<HTMLElement>();
const isExpanded = ref(false);
const activeTab = ref<'general' | 'style'>('general');

// Watch for panel open to auto-expand
watch(
  () => props.isOpen,
  open => {
    if (open) {
      isExpanded.value = true;
    }
  },
  { immediate: true }
);

// Panel style with scale transform
const uiStore = useUIStore();
const { scale: uiScale } = storeToRefs(uiStore);

const infoPanelStyle = computed(() => {
  const scale = 1 / (uiScale.value || 1);
  return {
    transform: `translateX(-50%) scale(${scale})`,
    transformOrigin: 'top center',
  };
});

// Widget-specific label visibility
const widgetLabelVisible = computed(() => {
  return props.entity.labelVisible !== undefined ? props.entity.labelVisible : true;
});

// Widget-specific state visibility
const widgetStateVisible = computed(() => {
  if (props.entity.stateVisible !== undefined) {
    return props.entity.stateVisible;
  }
  const state = props.entity.state?.toLowerCase().trim();
  if (state === 'on' || state === 'off') {
    return false;
  }
  return true;
});

// State condition settings
const stateConditionOperatorKey = `ha_dashboard_state_condition_operator_${props.entity.key}`;
const stateConditionValueKey = `ha_dashboard_state_condition_value_${props.entity.key}`;
const [stateConditionOperator, setStateConditionOperator] = useLocalStorage<string>(
  stateConditionOperatorKey,
  ''
);
const [stateConditionValue, setStateConditionValue] = useLocalStorage<number | null>(
  stateConditionValueKey,
  null
);

// Image condition settings
const imageConditionOperatorKey = `ha_dashboard_image_condition_operator_${props.entity.key}`;
const imageConditionValueKey = `ha_dashboard_image_condition_value_${props.entity.key}`;
const [imageConditionOperator, setImageConditionOperator] = useLocalStorage<string>(
  imageConditionOperatorKey,
  props.entity.imageConditionOperator || ''
);
const [imageConditionValue, setImageConditionValue] = useLocalStorage<string | null>(
  imageConditionValueKey,
  props.entity.imageConditionValue !== undefined && props.entity.imageConditionValue !== null
    ? String(props.entity.imageConditionValue)
    : null
);

// Sync with entity data
watch(
  () => props.entity.imageConditionOperator,
  newValue => {
    if (newValue !== undefined) {
      setImageConditionOperator(newValue || '');
    }
  },
  { immediate: true }
);

watch(
  () => props.entity.imageConditionValue,
  newValue => {
    if (newValue !== undefined && newValue !== null) {
      setImageConditionValue(String(newValue));
    }
  },
  { immediate: true }
);

const currentImageUrl = computed(() => {
  return props.entity.imageUrl || '';
});

// Check if entity has numeric state
const isNumericEntity = computed(() => {
  const state = props.entity.state;
  if (!state) return false;
  const trimmedState = state.trim();
  if (!trimmedState || trimmedState === 'unknown' || trimmedState === 'unavailable') return false;
  const numericMatch = trimmedState.match(/^(-?\d+\.?\d*)/);
  if (!numericMatch?.[1]) return false;
  return !isNaN(parseFloat(numericMatch[1]));
});

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

// Icon options
const iconSearchQuery = ref('');
const debouncedIconSearchQuery = debouncedRef(iconSearchQuery, 500);
const highlightedIndex = ref(-1);
const iconDropdownRef = ref<HTMLElement>();
const iconSearchInputRef = ref<HTMLInputElement>();
const iconOptionRefs = ref<(HTMLElement | null)[]>([]);

const iconOptions = ref<typeof COMMON_MDI_ICONS | ReturnType<typeof getAllMDIIcons>>(
  COMMON_MDI_ICONS
);
const isLoadingIcons = ref(false);

// eslint-disable-next-line no-console
console.log(
  '[Icon Panel] Initialized with',
  COMMON_MDI_ICONS.length,
  'common icons, iconOptions has',
  iconOptions.value.length
);

// Function to load all icons (defined after iconOptions)
function loadAllIcons() {
  if (iconOptions.value.length <= COMMON_MDI_ICONS.length) {
    // eslint-disable-next-line no-console
    console.log('[Icon Panel] Loading all icons...');
    isLoadingIcons.value = true;
    setTimeout(() => {
      try {
        const allIcons = getAllMDIIcons();
        iconOptions.value = allIcons;
        // eslint-disable-next-line no-console
        console.log(`[Icon Panel] ✅ Loaded ${allIcons.length} icons from MDI library`);
      } catch (error) {
        console.error('[Icon Panel] ❌ Error loading all icons:', error);
        // If loading fails, at least keep the common icons
        iconOptions.value = COMMON_MDI_ICONS;
      } finally {
        isLoadingIcons.value = false;
      }
    }, 0);
  } else {
    // eslint-disable-next-line no-console
    console.log('[Icon Panel] Icons already loaded, count:', iconOptions.value.length);
  }
}

// Watch for panel open to trigger icon loading (after iconOptions is defined)
watch(
  () => props.isOpen,
  open => {
    if (open) {
      // Load icons when panel opens
      loadAllIcons();
    }
  },
  { immediate: true }
);

// Watch for panel expansion
watch(isExpanded, expanded => {
  // eslint-disable-next-line no-console
  console.log(
    '[Icon Panel] Panel expanded:',
    expanded,
    'Current icon count:',
    iconOptions.value.length
  );
  if (expanded) {
    // Also try loading icons when expanded (in case they weren't loaded on open)
    loadAllIcons();
  }
});

const filteredIconOptions = computed(() => {
  if (debouncedIconSearchQuery.value.trim().length === 0) {
    return [];
  }
  if (!isExpanded.value || iconOptions.value.length === 0) {
    return [];
  }
  const query = debouncedIconSearchQuery.value.toLowerCase();
  return iconOptions.value.filter(
    icon => icon.label.toLowerCase().includes(query) || icon.value.toLowerCase().includes(query)
  );
});

const allVisibleOptions = computed(() => {
  const options: Array<{ value: string; label: string }> = [];
  if (debouncedIconSearchQuery.value.trim().length > 0 && isExpanded.value) {
    options.push({ value: '', label: '(Use HA default)' });
    options.push(...filteredIconOptions.value);
  }
  return options;
});

function handleIconDropdownKeydown(e: KeyboardEvent) {
  if (!isExpanded.value) return;

  const options = allVisibleOptions.value;
  const totalOptions = options.length;
  if (totalOptions === 0) return;

  if (e.key === 'Enter' && highlightedIndex.value < 0 && totalOptions > 0) {
    highlightedIndex.value = 0;
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      highlightedIndex.value =
        highlightedIndex.value < totalOptions - 1 ? highlightedIndex.value + 1 : 0;
      scrollToHighlighted();
      break;
    case 'ArrowUp':
      e.preventDefault();
      highlightedIndex.value =
        highlightedIndex.value <= 0 ? totalOptions - 1 : highlightedIndex.value - 1;
      scrollToHighlighted();
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedIndex.value >= 0 && highlightedIndex.value < totalOptions) {
        const option = options[highlightedIndex.value];
        if (option) {
          selectIcon(option.value);
        }
      }
      break;
    case 'Escape':
      e.preventDefault();
      isExpanded.value = false;
      emit('close');
      break;
  }
}

function scrollToHighlighted() {
  void nextTick(() => {
    if (highlightedIndex.value === 0) {
      const defaultOption = iconDropdownRef.value?.querySelector(
        '.icon-option:first-child'
      ) as HTMLElement;
      defaultOption?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (highlightedIndex.value > 0) {
      const optionIndex = highlightedIndex.value - 1;
      if (iconOptionRefs.value[optionIndex]) {
        iconOptionRefs.value[optionIndex]?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  });
}

function handleIconSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (allVisibleOptions.value.length > 0) {
      if (highlightedIndex.value < 0) {
        highlightedIndex.value = e.key === 'ArrowDown' ? 0 : allVisibleOptions.value.length - 1;
      }
      iconDropdownRef.value?.focus();
    }
  }
  if (e.key === 'Escape') {
    isExpanded.value = false;
    emit('close');
  }
}

function handleIconSearchFocus() {
  highlightedIndex.value = -1;
}

function handleIconDropdownFocus() {
  if (highlightedIndex.value < 0 && allVisibleOptions.value.length > 0) {
    highlightedIndex.value = 0;
  }
}

function handleIconDropdownWheel(e: WheelEvent) {
  const dropdown = e.currentTarget as HTMLElement;
  if (!dropdown) return;

  const { scrollTop, scrollHeight, clientHeight } = dropdown;
  const isAtTop = scrollTop === 0;
  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

  // If we're at the boundaries and trying to scroll further, prevent default to stop page zoom
  // Otherwise, allow the dropdown to scroll normally
  if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
    // At boundary, prevent default and stop propagation to prevent page zoom
    e.preventDefault();
    e.stopPropagation();
  } else {
    // Not at boundary, allow dropdown scrolling but stop propagation to prevent page zoom
    e.stopPropagation();
  }
}

function handleIconDropdownTouchMove(e: TouchEvent) {
  // Stop propagation to prevent page panning when scrolling the dropdown
  e.stopPropagation();
}

watch(iconSearchQuery, () => {
  highlightedIndex.value = -1;
});

function getIconPreview(iconName: string): string | null {
  if (!iconName) return null;
  const path = getMDIIconPath(iconName);
  if (!path) return null;
  return createIconSVG(path, '#ffffff', 20);
}

const currentIcon = computed(() => {
  if (props.entity.icon) {
    return props.entity.icon;
  }
  if (props.entity.category === 'door') {
    return 'door';
  } else if (props.entity.category === 'camera') {
    return 'camera';
  }
  return 'radar';
});

const currentTapAction = computed(() => {
  return props.entity.tapAction?.action ?? '';
});

const currentNavigationPath = computed(() => {
  return props.entity.tapAction?.navigation_path ?? '';
});

const currentLongPressAction = computed(() => {
  return props.entity.holdAction?.action ?? '';
});

const currentLongPressNavigationPath = computed(() => {
  return props.entity.holdAction?.navigation_path ?? '';
});

const labelOverride = computed(() => {
  return props.entity.labelOverride ?? props.entity.name ?? '';
});

const currentHAAction = computed(() => {
  return props.entity.haAction?.service ?? '';
});

// Entity selector for image widgets
const entitiesStore = useEntitiesStore();
const availableEntities = computed(() => {
  return entitiesStore.allEntities.filter(e => !e.isActionButton && !e.isImageWidget);
});

const currentLinkedEntityId = computed(() => {
  return props.entity.linkedEntityId || '';
});

const currentLinkedEntityName = computed(() => {
  if (!currentLinkedEntityId.value) return '';
  const entity = availableEntities.value.find(e => e.key === currentLinkedEntityId.value);
  return entity?.name || entity?.key || '';
});

// Entity search state
const entitySearchQuery = ref('');
const debouncedEntitySearchQuery = debouncedRef(entitySearchQuery, 300);
const entityHighlightedIndex = ref(-1);
const entityOptionRefs = ref<(HTMLElement | null)[]>([]);

const filteredEntities = computed(() => {
  if (debouncedEntitySearchQuery.value.trim().length === 0) {
    return [];
  }
  const query = debouncedEntitySearchQuery.value.toLowerCase();
  return availableEntities.value.filter(
    entity =>
      (entity.name || '').toLowerCase().includes(query) || entity.key.toLowerCase().includes(query)
  );
});

const currentHAActionLabel = computed(() => {
  if (!currentHAAction.value) return '';
  const allServices = getAllServices(haServices.value);
  const service = allServices.find(s => s.service === currentHAAction.value);
  return service?.label ?? currentHAAction.value;
});

// HA Services state
const haServices = ref<HAService[]>([]);
const haActionSearchQuery = ref('');
const isLoadingHAActions = ref(false);
const debouncedHAActionSearchQuery = debouncedRef(haActionSearchQuery, 500);

const automations = ref<Array<{ entity_id: string; name: string }>>([]);
const isLoadingAutomations = ref(false);
const selectedAutomation = computed(() => {
  return (
    (props.entity.haAction?.serviceData as { entity_id?: string } | undefined)?.entity_id ?? ''
  );
});

const filteredHAActions = computed(() => {
  if (debouncedHAActionSearchQuery.value.trim().length === 0) {
    return [];
  }
  const allServices = getAllServices(haServices.value);
  const query = debouncedHAActionSearchQuery.value.toLowerCase();
  return allServices.filter(
    service =>
      service.service.toLowerCase().includes(query) || service.label.toLowerCase().includes(query)
  );
});

watch(isExpanded, async expanded => {
  if (expanded && props.entity.isActionButton && haServices.value.length === 0) {
    isLoadingHAActions.value = true;
    try {
      haServices.value = await fetchHAServices(haConfig);
    } catch (error) {
      console.error('Error loading HA services:', error);
    } finally {
      isLoadingHAActions.value = false;
    }
  }
});

watch(
  currentHAAction,
  async service => {
    if (service === 'automation.trigger' && automations.value.length === 0) {
      isLoadingAutomations.value = true;
      try {
        automations.value = await fetchAutomations(haConfig);
      } catch (error) {
        console.error('Error loading automations:', error);
      } finally {
        isLoadingAutomations.value = false;
      }
    }
  },
  { immediate: true }
);

function selectIcon(iconValue: string) {
  handleIconChangeDirect(iconValue);
}

function handleIconChangeDirect(newIcon: string) {
  if (newIcon === '') {
    const entityInfo = window.allEntities?.find(e => e.entityId === props.entity.key);
    let haIcon = 'radar';

    if (entityInfo?.state) {
      haIcon =
        extractIconFromHA(entityInfo.state) ??
        getDefaultIcon(entityInfo.domain, entityInfo.state.attributes?.device_class);
    }

    emit('update', props.entity.key, { icon: haIcon });
  } else {
    emit('update', props.entity.key, { icon: newIcon });
  }
}

function handleTapActionChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const actionType = target.value;

  let tapAction: TapAction | null = null;
  if (
    actionType &&
    (actionType === 'toggle' ||
      actionType === 'more-info' ||
      actionType === 'navigate' ||
      actionType === 'call-service')
  ) {
    tapAction = { action: actionType } as TapAction;
    if (actionType === 'navigate' && props.entity.tapAction?.navigation_path) {
      tapAction.navigation_path = props.entity.tapAction.navigation_path;
    }
  }

  emit('update', props.entity.key, { tapAction });

  const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
  if (tapAction || props.entity.holdAction) {
    actions[props.entity.key] = {
      tapAction: tapAction ?? null,
      holdAction: props.entity.holdAction ?? null,
    };
  } else {
    delete actions[props.entity.key];
  }
  localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
}

const labelOverrideInput = ref<string>(labelOverride.value);

watch(
  labelOverride,
  newValue => {
    labelOverrideInput.value = newValue;
  },
  { immediate: true }
);

function handleLabelOverrideBlur() {
  const newLabel = labelOverrideInput.value.trim();
  emit('update', props.entity.key, { labelOverride: newLabel });

  const labelOverrides = JSON.parse(localStorage.getItem('ha_dashboard_label_overrides') ?? '{}');
  if (newLabel) {
    labelOverrides[props.entity.key] = newLabel;
  } else {
    delete labelOverrides[props.entity.key];
  }
  localStorage.setItem('ha_dashboard_label_overrides', JSON.stringify(labelOverrides));
}

function selectHAAction(service: string) {
  const existingServiceData =
    props.entity.haAction?.service === service ? props.entity.haAction.serviceData : undefined;

  const haAction = {
    service,
    ...(existingServiceData ? { serviceData: existingServiceData } : {}),
  };

  emit('update', props.entity.key, { haAction });

  const tapAction = {
    action: 'call-service' as const,
    service,
  };
  emit('update', props.entity.key, { tapAction });

  const haActions = JSON.parse(localStorage.getItem('ha_dashboard_ha_actions') ?? '{}');
  haActions[props.entity.key] = haAction;
  localStorage.setItem('ha_dashboard_ha_actions', JSON.stringify(haActions));

  const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
  if (!actions[props.entity.key]) actions[props.entity.key] = {};
  actions[props.entity.key].tapAction = tapAction;
  localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));

  haActionSearchQuery.value = '';
}

function handleAutomationChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const automationEntityId = target.value;

  const haAction = {
    service: 'automation.trigger',
    serviceData: {
      entity_id: automationEntityId,
    },
  };

  emit('update', props.entity.key, { haAction });

  const haActions = JSON.parse(localStorage.getItem('ha_dashboard_ha_actions') ?? '{}');
  haActions[props.entity.key] = haAction;
  localStorage.setItem('ha_dashboard_ha_actions', JSON.stringify(haActions));
}

function handleHAActionSearchKeydown() {
  // Could implement keyboard navigation for HA actions if needed
}

function selectLinkedEntity(entityId: string) {
  emit('update', props.entity.key, { linkedEntityId: entityId });
  entitySearchQuery.value = '';
  entityHighlightedIndex.value = -1;
}

function handleEntitySearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const options = ['', ...filteredEntities.value.map(e => e.key)];
    if (options.length > 0) {
      if (entityHighlightedIndex.value < 0) {
        entityHighlightedIndex.value = e.key === 'ArrowDown' ? 0 : options.length - 1;
      } else {
        if (e.key === 'ArrowDown') {
          entityHighlightedIndex.value =
            entityHighlightedIndex.value < options.length - 1
              ? entityHighlightedIndex.value + 1
              : 0;
        } else {
          entityHighlightedIndex.value =
            entityHighlightedIndex.value > 0
              ? entityHighlightedIndex.value - 1
              : options.length - 1;
        }
      }
      scrollToHighlightedEntity();
    }
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    const options = ['', ...filteredEntities.value.map(e => e.key)];
    if (entityHighlightedIndex.value >= 0 && entityHighlightedIndex.value < options.length) {
      const selectedOption = options[entityHighlightedIndex.value];
      if (selectedOption !== undefined) {
        selectLinkedEntity(selectedOption);
      }
    }
  }
  if (e.key === 'Escape') {
    entitySearchQuery.value = '';
    entityHighlightedIndex.value = -1;
  }
}

function scrollToHighlightedEntity() {
  void nextTick(() => {
    if (entityHighlightedIndex.value === 0) {
      const defaultOption = document.querySelector(
        '.entity-dropdown .icon-option:first-child'
      ) as HTMLElement;
      if (defaultOption) {
        defaultOption.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else if (entityHighlightedIndex.value > 0) {
      const optionIndex = entityHighlightedIndex.value - 1;
      if (entityOptionRefs.value[optionIndex]) {
        const ref = entityOptionRefs.value[optionIndex];
        if (ref) {
          ref.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth',
          });
        }
      }
    }
  });
}

function handleImageUrlChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const imageUrl = target.value.trim();
  emit('update', props.entity.key, { imageUrl });
}

async function handleImageFileSelect() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      try {
        // Show loading state if we had a way to indicate it (could use a local ref for button text)
        // For now, console log
        console.log('Starting image upload from info panel...', file.name);

        const storage = getStorageInstance();
        if (!storage) {
          throw new Error('Firebase Storage not initialized');
        }

        const timestamp = Date.now();
        const filename = `images/${timestamp}_${file.name}`;
        const fileRef = storageRef(storage, filename);

        // Upload file
        await uploadBytes(fileRef, file);
        console.log('Image uploaded successfully');

        // Get download URL
        const imageUrl = await getDownloadURL(fileRef);
        console.log('Download URL:', imageUrl);

        // Update entity with new URL
        emit('update', props.entity.key, { imageUrl });

        // Use toast if possible, otherwise alert
        const { success } = useToast();
        success('Image uploaded successfully');
      } catch (error) {
        console.error('Error uploading image:', error);
        alert(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  input.click();
}

function handleImageConditionOperatorChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const operator = target.value || '';
  setImageConditionOperator(operator);
  emit('update', props.entity.key, { imageConditionOperator: operator });
}

function handleImageConditionValueChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = target.value.trim();
  setImageConditionValue(value || null);
  // Try to parse as number, otherwise keep as string
  const numValue = Number.parseFloat(value);
  const finalValue = isNaN(numValue) ? value : numValue;
  emit('update', props.entity.key, { imageConditionValue: finalValue });
}

function handleLabelVisibilityChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update', props.entity.key, { labelVisible: target.checked });
}

function handleStateVisibilityChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update', props.entity.key, { stateVisible: target.checked });
}

function handleIconColorOnChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update', props.entity.key, { iconColorOn: target.value });
}

function handleIconColorOnTextChange(event: Event) {
  const target = event.target as HTMLInputElement;
  let color = target.value.trim();
  if (color && !color.startsWith('#')) {
    color = `#${color}`;
  }
  if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
    emit('update', props.entity.key, { iconColorOn: color });
  } else if (color === '' || color === '#') {
    // Omit the property instead of passing undefined
    const updates: Partial<EntityData> = {};
    emit('update', props.entity.key, updates);
  }
}

function handleIconColorOffChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update', props.entity.key, { iconColorOff: target.value });
}

function handleIconColorOffTextChange(event: Event) {
  const target = event.target as HTMLInputElement;
  let color = target.value.trim();
  if (color && !color.startsWith('#')) {
    color = `#${color}`;
  }
  if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
    emit('update', props.entity.key, { iconColorOff: color });
  } else if (color === '' || color === '#') {
    // Omit the property instead of passing undefined
    const updates: Partial<EntityData> = {};
    emit('update', props.entity.key, updates);
  }
}

function handleValuePrefixChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update', props.entity.key, { valuePrefix: target.value.trim() });
}

function handleValueSuffixChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update', props.entity.key, { valueSuffix: target.value.trim() });
}

function handleStateConditionOperatorChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  setStateConditionOperator(target.value);
  if (!target.value) {
    setStateConditionValue(null);
  }
}

function handleStateConditionValueChange(event: Event) {
  const target = event.target as HTMLInputElement;
  setStateConditionValue(target.value ? parseFloat(target.value) : null);
}

function handleNavigationPathChange(event: Event) {
  const target = event.target as HTMLInputElement;
  // Create a copy to avoid mutating prop
  const tapAction: TapAction = { ...(props.entity.tapAction ?? { action: 'navigate' }) };
  tapAction.navigation_path = target.value;

  emit('update', props.entity.key, { tapAction });

  const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
  actions[props.entity.key] = {
    tapAction,
    holdAction: props.entity.holdAction ?? null,
  };
  localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
}

function handleLongPressActionChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const actionType = target.value;

  let holdAction: TapAction | null = null;
  if (
    actionType &&
    (actionType === 'toggle' ||
      actionType === 'more-info' ||
      actionType === 'navigate' ||
      actionType === 'call-service')
  ) {
    holdAction = { action: actionType } as TapAction;
    if (actionType === 'navigate' && props.entity.holdAction?.navigation_path) {
      holdAction.navigation_path = props.entity.holdAction.navigation_path;
    }
  }

  emit('update', props.entity.key, { holdAction });

  const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
  if (holdAction || props.entity.tapAction) {
    actions[props.entity.key] = {
      tapAction: props.entity.tapAction ?? null,
      holdAction: holdAction ?? null,
    };
  } else {
    delete actions[props.entity.key];
  }
  localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
}

function handleLongPressNavigationPathChange(event: Event) {
  const target = event.target as HTMLInputElement;
  // Create a copy to avoid mutating prop
  const holdAction: TapAction = { ...(props.entity.holdAction ?? { action: 'navigate' }) };
  holdAction.navigation_path = target.value;

  emit('update', props.entity.key, { holdAction });

  const actions = JSON.parse(localStorage.getItem('ha_dashboard_actions') ?? '{}');
  actions[props.entity.key] = {
    tapAction: props.entity.tapAction ?? null,
    holdAction,
  };
  localStorage.setItem('ha_dashboard_actions', JSON.stringify(actions));
}

function handleDelete() {
  if (confirm('Are you sure you want to delete this widget?')) {
    emit('delete', props.entity.key);
    clearSelection();
    emit('close');
    const { success } = useToast();
    success(`Widget deleted: ${props.displayLabel}`);
  }
}

// Handle Escape key
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.isOpen) {
      emit('close');
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
});
</script>

<style scoped>
.entity-info-panel {
  position: absolute;
  top: 100%;
  left: 50%;
  margin-top: 4px;
  min-width: 200px;
  max-width: 400px;
  background-color: #2a2a2a;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 20001;
  pointer-events: auto;
  overflow: visible;
}

.entity-info-panel.expanded {
  min-width: 280px;
}

.entity-info-panel:not(.expanded) {
  min-width: auto;
  max-width: 200px;
}

@media (max-width: 768px) {
  .entity-info-panel {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    min-width: calc(100vw - 32px);
    max-width: calc(100vw - 32px);
    width: calc(100vw - 32px);
  }

  .entity-info-panel.expanded {
    min-width: calc(100vw - 32px);
    max-width: calc(100vw - 32px);
  }

  .entity-info-panel:not(.expanded) {
    min-width: calc(100vw - 32px);
    max-width: calc(100vw - 32px);
  }
}

.panel-header {
  background-color: #333333;
  padding: 10px 14px;
  border-radius: 4px 4px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: none;
}

.panel-header.collapsed {
  background-color: rgba(42, 42, 42, 0.9);
  padding: 4px 8px;
  border-radius: 3px;
  border: 1px solid #4a4a4a;
  font-size: 11px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.panel-header.collapsed:hover {
  background-color: rgba(51, 51, 51, 0.95);
  border-color: #5a5a5a;
}

.panel-header.expanded {
  border-radius: 4px 4px 0 0;
}

.panel-header.expanded:hover {
  background-color: #3a3a3a;
}

.expand-indicator {
  font-size: 10px;
  color: #aaaaaa;
  flex-shrink: 0;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
  color: #ffffff;
  line-height: 1.4;
  word-wrap: break-word;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .panel-title {
    font-size: 18px;
  }

  .panel-header {
    padding: 12px 16px;
    min-height: 44px;
  }
}

.panel-header.collapsed .panel-title {
  font-size: 11px;
  font-weight: normal;
}

.panel-divider {
  height: 1px;
  background-color: #4a4a4a;
  margin: 4px 0;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #4a4a4a;
  margin: 0;
  padding: 0;
}

.panel-tab {
  flex: 1;
  padding: 6px 8px;
  background-color: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #aaaaaa;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

@media (max-width: 768px) {
  .panel-tab {
    padding: 10px 8px;
    font-size: 14px;
    min-height: 44px;
  }
}

.panel-tab:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

.panel-tab.active {
  color: #ffffff;
  border-bottom-color: #2d5aa0;
  background-color: rgba(45, 90, 160, 0.1);
}

.tab-content {
  min-height: 50px;
}

.panel-content {
  padding: 8px 14px 10px;
  overflow: visible;
}

@media (max-width: 768px) {
  .panel-content {
    padding: 12px 16px 14px;
  }
}

.detail-row {
  display: flex;
  margin-bottom: 4px;
  align-items: flex-start;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.delete-row {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3a3a3a;
}

.delete-button {
  width: 100%;
  background-color: #d32f2f;
  border: 1px solid #b71c1c;
  border-radius: 3px;
  color: #ffffff;
  font-size: 11px;
  padding: 6px 12px;
  cursor: pointer;
  outline: none;
  transition: background-color 0.2s ease;
}

@media (max-width: 768px) {
  .delete-button {
    font-size: 15px;
    padding: 12px 16px;
    min-height: 44px;
  }
}

.delete-button:hover {
  background-color: #c62828;
}

.delete-button:active {
  background-color: #b71c1c;
}

.detail-label {
  font-size: 11px;
  color: #aaaaaa;
  min-width: 90px;
  margin-right: 8px;
  flex-shrink: 0;
}

.detail-value {
  font-size: 11px;
  color: #ffffff;
  flex: 1;
  word-break: break-word;
}

@media (max-width: 768px) {
  .detail-label {
    font-size: 13px;
    min-width: 100px;
  }

  .detail-value {
    font-size: 13px;
  }
}

.detail-value.state-value {
  font-weight: bold;
  color: #4caf50;
}

.detail-value.entity-id-value {
  font-family: 'Courier New', Courier, monospace;
  font-size: 10px;
  color: #cccccc;
}

.icon-select {
  flex: 1;
  background-color: #333333;
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  color: #ffffff;
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  outline: none;
  z-index: 10001;
  position: relative;
}

@media (max-width: 768px) {
  .icon-select {
    font-size: 16px;
    padding: 8px 12px;
    min-height: 44px;
  }
}

.icon-select:hover {
  border-color: #5a5a5a;
}

.icon-select:focus {
  border-color: #2196f3;
}

.icon-selector-wrapper {
  flex: 1;
  position: relative;
}

.icon-search-wrapper {
  margin-bottom: 6px;
}

.icon-search-input {
  width: 100%;
  background-color: #333333;
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  color: #ffffff;
  font-size: 11px;
  padding: 4px 8px;
  outline: none;
}

@media (max-width: 768px) {
  .icon-search-input {
    font-size: 16px;
    padding: 8px 12px;
    min-height: 44px;
  }
}

.icon-search-input:focus {
  border-color: #2196f3;
}

.icon-dropdown {
  max-height: 200px;
  overflow-y: auto;
  background-color: #2a2a2a;
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  z-index: 10002;
  position: relative;
}

.icon-option {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  border-bottom: 1px solid #3a3a3a;
  transition: background-color 0.15s;
}

.icon-option:last-child {
  border-bottom: none;
}

.icon-option:hover {
  background-color: #3a3a3a;
}

.icon-option-selected {
  background-color: #2196f3;
}

.icon-option-selected:hover {
  background-color: #2196f3;
}

.icon-option-highlighted {
  background-color: #3a3a3a;
}

.icon-option-highlighted.icon-option-selected {
  background-color: #2196f3;
}

.icon-search-hint {
  padding: 12px;
  text-align: center;
  color: #888888;
  font-size: 11px;
  font-style: italic;
}

.ha-action-selector-wrapper {
  position: relative;
  flex: 1;
}

.ha-action-selected {
  margin-top: 4px;
  padding: 4px 8px;
  background-color: rgba(45, 90, 160, 0.2);
  border: 1px solid rgba(45, 90, 160, 0.4);
  border-radius: 4px;
  color: #ffffff;
  font-size: 12px;
}

.automation-selector {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #4a4a4a;
}

.icon-preview {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  flex-shrink: 0;
}

.icon-option-label {
  font-size: 11px;
  color: #ffffff;
  flex: 1;
}

.icon-loading {
  padding: 12px;
  text-align: center;
  color: #888888;
  font-size: 11px;
  font-style: italic;
}

.text-input {
  flex: 1;
  background-color: #333333;
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  color: #ffffff;
  font-size: 11px;
  padding: 4px 8px;
  outline: none;
}

@media (max-width: 768px) {
  .text-input {
    font-size: 16px;
    padding: 8px 12px;
    min-height: 44px;
  }
}

.text-input:hover {
  border-color: #5a5a5a;
}

.text-input:focus {
  border-color: #2196f3;
}

.condition-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.condition-operator {
  flex: 0 0 auto;
  min-width: 120px;
}

.condition-value {
  flex: 0 0 auto;
  width: 80px;
}

.image-url-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.image-select-button {
  flex: 0 0 auto;
  padding: 6px 12px;
  background-color: #2d5aa0;
  border: 1px solid #3a6bc0;
  border-radius: 3px;
  color: #ffffff;
  font-size: 11px;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.image-select-button:hover {
  background-color: #3a6bc0;
}

.image-select-button:active {
  background-color: #1e3f73;
}

.entity-selector-wrapper {
  flex: 1;
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.color-input {
  width: 40px;
  height: 30px;
  border: 1px solid #4a4a4a;
  border-radius: 3px;
  cursor: pointer;
  background: none;
  padding: 0;
  flex-shrink: 0;
}

.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}

.color-text-input {
  flex: 1;
  min-width: 0;
}

@media (max-width: 768px) {
  .condition-controls {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .condition-operator {
    min-width: 100%;
    width: 100%;
  }

  .condition-value {
    width: 100%;
  }
}

.expand-enter-active,
.expand-leave-active {
  transition: none;
  overflow: visible;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #555;
  transition: 0.3s;
  border-radius: 20px;
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #2d5aa0;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(16px);
}

.toggle-switch input:focus + .toggle-slider {
  box-shadow: 0 0 1px #2d5aa0;
}
</style>


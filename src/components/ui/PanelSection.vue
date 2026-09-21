<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  title?: string;
  icon?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  noPadding?: boolean;
  noPaddingX?: boolean;
  // For controlled accordion behavior (only used when sectionId is provided)
  collapsed?: boolean;
  sectionId?: string;
}>();

const emit = defineEmits<{
  (e: 'toggle', sectionId: string | undefined, isOpen: boolean): void;
}>();

// Check if we're in controlled mode (sectionId indicates controlled accordion group)
const isControlled = computed(() => props.sectionId !== undefined);

// Use internal state only if not controlled externally
const internalCollapsed = ref(props.defaultCollapsed ?? false);

// Computed to support both controlled and uncontrolled modes
const isCollapsed = computed(() => {
  // If in controlled mode, use the collapsed prop
  if (isControlled.value) {
    return props.collapsed ?? false;
  }
  // Otherwise use internal state (uncontrolled mode)
  return internalCollapsed.value;
});

function toggle() {
  if (props.collapsible) {
    if (isControlled.value) {
      // Controlled mode: emit event, parent handles state
      emit('toggle', props.sectionId, isCollapsed.value);
    } else {
      // Uncontrolled mode: toggle internal state
      internalCollapsed.value = !internalCollapsed.value;
    }
  }
}
</script>

<template>
  <section
    class="panel-section"
    :class="{
      collapsed: isCollapsed,
      collapsible,
      'no-padding': noPadding,
      'no-padding-x': noPaddingX,
    }"
  >
    <header v-if="title" class="section-header" :class="{ clickable: collapsible }" @click="toggle">
      <div class="section-title">
        <iconify-icon v-if="icon" :icon="icon" class="section-icon"></iconify-icon>
        <h3>{{ title }}</h3>
      </div>
      <div class="section-actions" @click.stop>
        <slot name="actions"></slot>
      </div>
      <iconify-icon v-if="collapsible" icon="ph:caret-down-bold" class="toggle-icon"></iconify-icon>
    </header>

    <Transition name="collapse">
      <div v-show="!isCollapsed" class="section-content">
        <slot></slot>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.panel-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--glass-border);
  box-sizing: border-box;
}

.panel-section:last-child {
  border-bottom: none;
}

.panel-section.no-padding {
  padding: 0;
}

.panel-section.no-padding .section-content {
  padding: 0 20px 16px;
}

.panel-section.no-padding-x {
  padding-left: 0;
  padding-right: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  user-select: none;
  margin-bottom: 14px;
}

.section-header.clickable {
  cursor: pointer;
  transition: color var(--duration-fast) ease;
}

.section-header.clickable:hover {
  color: var(--text-primary);
}

.section-header.clickable:hover .section-icon {
  color: var(--accent-primary);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding: 0 4px 0;
  transition: color var(--duration-fast) ease;
  &:hover {
    h3 {
      color: var(--accent-primary);
    }
  }
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-icon {
  font-size: 14px;
  color: var(--text-muted);
}

h3 {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--text-muted);
  margin: 0;
}

.toggle-icon {
  font-size: 12px;
  color: var(--text-muted);
  transition: transform var(--duration-normal) var(--ease-out);
}

.collapsed .toggle-icon {
  transform: rotate(-90deg);
}

.collapsed .section-header {
  margin-bottom: 0;
}

/* Collapse animation */
.collapse-enter-active {
  animation: collapseIn var(--duration-normal) var(--ease-out);
}

.collapse-leave-active {
  animation: collapseOut var(--duration-fast) ease-in;
}

@keyframes collapseIn {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    max-height: 500px;
    transform: translateY(0);
  }
}

@keyframes collapseOut {
  from {
    opacity: 1;
    max-height: 500px;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    max-height: 0;
    transform: translateY(-8px);
  }
}

.panel-section.hidden {
  display: none;
}
</style>

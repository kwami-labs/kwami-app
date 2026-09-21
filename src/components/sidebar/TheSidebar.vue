<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useUIStore } from '@/stores/ui';
import { useThemeStore } from '@/stores/theme';
import SidebarNavigation from './SidebarNavigation.vue';
import SidebarContent from './SidebarContent.vue';

const uiStore = useUIStore();
const themeStore = useThemeStore();

const sidebarRef = ref<HTMLElement | null>(null);

// Computed class for sidebar position
const isRight = computed(() => themeStore.sidebarPosition === 'right');

// Computed style (empty - we manipulate the element directly for FLIP)
const sidebarStyle = computed(() => ({}));

// FLIP animation for position changes
watch(
  () => themeStore.sidebarPosition,
  async (_newPos, oldPos) => {
    if (!sidebarRef.value || oldPos === undefined) return;

    const sidebar = sidebarRef.value;

    // FIRST: Capture current position
    const firstRect = sidebar.getBoundingClientRect();

    // Wait for Vue to update the DOM (class change)
    await nextTick();

    // LAST: Get the new position after class change
    const lastRect = sidebar.getBoundingClientRect();

    // INVERT: Calculate the difference
    const deltaX = firstRect.left - lastRect.left;

    if (deltaX === 0) return;

    // Disable transition temporarily
    sidebar.style.transition = 'none';
    // Apply inverse transform to make it appear at the old position
    sidebar.style.transform = `translateX(${deltaX}px)`;

    // Force browser reflow
    void sidebar.offsetHeight;

    // PLAY: Re-enable transition and animate to final position
    sidebar.style.transition = '';
    sidebar.style.transform = '';
  },
);

onMounted(() => {});
onUnmounted(() => {});
</script>

<template>
  <div
    ref="sidebarRef"
    class="sidebar"
    :class="{
      collapsed: !uiStore.isPanelOpen,
      'sidebar-right': isRight,
    }"
    :style="sidebarStyle"
  >
    <SidebarNavigation />
    <SidebarContent>
      <slot></slot>
    </SidebarContent>
  </div>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 20px;
  left: 20px;
  bottom: 20px;
  display: flex;
  gap: 12px;
  z-index: 1000;
  pointer-events: none;
  /* Smooth transform animation for position changes */
  transition:
    transform 0.5s cubic-bezier(0.4, 0, 0.2, 1),
    gap var(--duration-slow) var(--ease-out);
  will-change: transform;
}

/* Right sidebar - anchor to right edge and reverse flex direction */
.sidebar.sidebar-right {
  left: auto;
  right: 20px;
  flex-direction: row-reverse;
}

/* Handle collapsed state for content via deep selector */
.sidebar.collapsed {
  gap: 0;
}

/* Panel collapse animation is handled by SidebarContent dynamic styles */
</style>

import 'iconify-icon';
import './assets/main.css';
import './assets/shared.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Toast, { type PluginOptions, POSITION } from 'vue-toastification';
import 'vue-toastification/dist/index.css';
import App from './App.vue';
import { useThemeStore } from './stores/theme';
import { useSceneStore } from './stores/scene';
import { useAvatarStore } from './stores/avatar';
import { useVoiceStore } from './stores/voice';
import { i18n } from './i18n';
import { initPwaInstall } from './composables/usePwaInstall';

const app = createApp(App);
const pinia = createPinia();

const toastOptions: PluginOptions = {
  position: POSITION.BOTTOM_RIGHT,
  timeout: 4000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false,
};

app.use(pinia);
app.use(Toast, toastOptions);
app.use(i18n);

// Capture beforeinstallprompt before Settings is opened.
initPwaInstall();

// Initialize theme settings
const themeStore = useThemeStore();
themeStore.loadSettings();

// Initialize scene settings
const sceneStore = useSceneStore();
sceneStore.loadSettings();

// Initialize avatar settings
const avatarStore = useAvatarStore();
avatarStore.loadSettings();

// Initialize voice/model settings
const voiceStore = useVoiceStore();
voiceStore.loadSettings();

app.mount('#app');

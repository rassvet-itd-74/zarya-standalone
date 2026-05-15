<script setup lang="ts">
import { defineAsyncComponent, onMounted, type Component } from 'vue';
import { useAppState } from './composables/useAppState';
import { useI18n } from './composables/useI18n';
import { useTheme } from './composables/useTheme';
import logoRound from './assets/images/logo_round.png';

const { currentView, isOffline, init } = useAppState();
const { t, changeLang, currentLang } = useI18n();
const { isDark, toggle: toggleTheme } = useTheme();

const viewMap: Record<string, Component> = {
  'setup':         defineAsyncComponent(() => import('./components/SetupView.vue')),
  'unlock':        defineAsyncComponent(() => import('./components/UnlockView.vue')),
  'wallet':        defineAsyncComponent(() => import('./components/SettingsView.vue')),
  'settings':      defineAsyncComponent(() => import('./components/SettingsView.vue')),
  'dashboard':     defineAsyncComponent(() => import('./components/DashboardView.vue')),
  'votings':       defineAsyncComponent(() => import('./components/VotingsView.vue')),
  'matrix':        defineAsyncComponent(() => import('./components/MatrixView.vue')),
  'create-voting': defineAsyncComponent(() => import('./components/CreateVotingView.vue')),
};

function onLangToggle(): void {
  changeLang(currentLang() === 'ru' ? 'en' : 'ru');
}

onMounted(init);
</script>

<template>
  <label
    for="theme-checkbox"
    class="fixed top-4 left-4 flex cursor-pointer items-center gap-1.5 text-sm select-none opacity-60 hover:opacity-100 transition-opacity"
  >
    <input
      id="theme-checkbox"
      type="checkbox"
      class="theme-toggle__input"
      :checked="isDark"
      @change="toggleTheme"
    />
    <span class="theme-toggle__track">
      <span class="theme-toggle__thumb"></span>
    </span>
  </label>

  <button class="lang-toggle" @click="onLangToggle">
    {{ currentLang() === 'ru' ? 'EN' : 'RU' }}
  </button>

  <div id="app">
    <div v-show="isOffline" class="rpc-banner">{{ t('offline.banner') }}</div>

    <img class="app-logo" :src="logoRound" alt="Zarya" />

    <component :is="viewMap[currentView]" />
  </div>

  <footer class="app-footer">
    <span>{{ t('city') }}</span> &middot; <span>{{ t('devCredit') }}</span>
  </footer>
</template>

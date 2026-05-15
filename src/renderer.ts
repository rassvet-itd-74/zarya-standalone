import './styles/index.scss';
import { createApp } from 'vue';
import { initI18n } from './i18n';
import App from './App.vue';

initI18n().then(() => createApp(App).mount('#app'));

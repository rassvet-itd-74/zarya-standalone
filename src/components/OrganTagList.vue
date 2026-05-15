<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useOrganTagList } from '../composables/useOrganTagList';

const { t } = useI18n();
const { tags, codeInput, addTag, removeTag, onExport, onImport, tagClass } = useOrganTagList();
</script>

<template>
  <div class="dashboard__section">
    <div class="dashboard__organs-header">
      <span class="dashboard__label">{{ t('dashboard.organsLabel') }}</span>
      <div class="dashboard__organs-actions">
        <button class="btn btn--ghost btn--xs" :title="t('organs.exportTitle')" @click="onExport">&#8593;</button>
        <button class="btn btn--ghost btn--xs" :title="t('organs.importTitle')" @click="onImport">&#8595;</button>
      </div>
    </div>

    <div class="dashboard__organs">
      <span v-if="tags.length === 0" class="dashboard__organ-none">{{ t('organs.noTags') }}</span>
      <span
        v-for="tag in tags"
        :key="tag.code"
        :class="tagClass(tag.code)"
        :title="tag.organ ?? t('organs.unresolved')"
      >
        <span class="dashboard__organ-dot"></span>
        <span>{{ tag.code }}</span>
        <button
          class="dashboard__organ-remove"
          :aria-label="t('organs.remove')"
          @click.stop="removeTag(tag.code)"
        >&times;</button>
      </span>
    </div>

    <div class="dashboard__organs-add">
      <input
        v-model="codeInput"
        class="field__input field__input--sm"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :placeholder="t('organs.codePlaceholder')"
        @keydown.enter="addTag"
      />
      <button class="btn btn--sm" @click="addTag">+</button>
    </div>
  </div>
</template>

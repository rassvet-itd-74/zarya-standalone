<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { readTags, writeTags, exportTags, importTags, resolveTag } from '../services/tagsService';
import { checkOrganMembership } from '../services/zaryaService';
import type { OrganTag, MembershipStatus } from '../types/organ';

const { t } = useI18n();
const { currentAddress } = useAppState();

const tags       = ref<OrganTag[]>([]);
const codeInput  = ref('');

const tagStatuses = ref<Map<string, MembershipStatus>>(new Map());

async function load(): Promise<void> {
  tags.value = await readTags();
  if (currentAddress.value) {
    for (const tag of tags.value) {
      if (!tag.organ) { tagStatuses.value.set(tag.code, 'unresolved'); continue; }
      tagStatuses.value.set(tag.code, 'pending');
      checkOrganMembership(tag.organ, currentAddress.value).then(isMember => {
        tagStatuses.value.set(tag.code, isMember ? 'member' : 'unknown');
        tagStatuses.value = new Map(tagStatuses.value);
      });
    }
  }
}

async function addTag(): Promise<void> {
  const code = codeInput.value.trim().toUpperCase();
  if (!code) return;
  const current = await readTags();
  if (current.some(tg => tg.code.toUpperCase() === code)) return;
  const updated = [...current, { code }];
  await writeTags(updated);
  codeInput.value = '';
  tags.value = updated;

  resolveTag(code).then(async organ => {
    if (!organ) return;
    const refreshed = await readTags();
    const target = refreshed.find(tg => tg.code.toUpperCase() === code);
    if (target) {
      target.organ = organ;
      await writeTags(refreshed);
      tags.value = refreshed;
    }
  });
}

async function removeTag(code: string): Promise<void> {
  const updated = (await readTags()).filter(tg => tg.code !== code);
  await writeTags(updated);
  tags.value = updated;
}

async function onExport(): Promise<void> {
  await exportTags();
}

async function onImport(): Promise<void> {
  const imported = await importTags();
  if (imported) {
    await writeTags(imported);
    tags.value = imported;
  }
}

function tagClass(code: string): string {
  const s = tagStatuses.value.get(code) ?? 'unresolved';
  return `dashboard__organ-tag dashboard__organ-tag--${s}`;
}

onMounted(load);
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

import { ref, onMounted } from 'vue';
import { useAppState } from './useAppState';
import { readTags, writeTags, exportTags, importTags, resolveTag } from '../services/tagsService';
import { checkOrganMembership } from '../services/zaryaService';
import type { OrganTag, MembershipStatus } from '../types/organ';

export function useOrganTagList() {
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

  return { tags, codeInput, tagStatuses, addTag, removeTag, onExport, onImport, tagClass };
}

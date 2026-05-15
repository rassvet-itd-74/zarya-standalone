import type { OrganTag } from '../types/organ';

export function readTags(): Promise<OrganTag[]> {
  return window.tagsAPI.read();
}

export function writeTags(tags: OrganTag[]): Promise<void> {
  return window.tagsAPI.write(tags);
}

export function exportTags(): Promise<boolean> {
  return window.tagsAPI.exportTags();
}

export function importTags(): Promise<OrganTag[] | null> {
  return window.tagsAPI.importTags();
}

export function resolveTag(code: string): Promise<string | null> {
  return window.tagsAPI.resolve(code);
}

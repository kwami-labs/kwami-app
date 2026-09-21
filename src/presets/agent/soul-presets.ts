import type { SoulPreset } from 'kwami';
import {
  soulPresets as librarySoulPresets,
  soulPresetCategories,
  getSoulPresetById,
  getSoulPresetsByCategory,
} from 'kwami';

export type { SoulPreset };
export const soulPresets: SoulPreset[] = librarySoulPresets;

export function getTemplateById(id: string): SoulPreset | undefined {
  return getSoulPresetById(id);
}

export function getTemplatesByCategory(category: SoulPreset['category']): SoulPreset[] {
  return getSoulPresetsByCategory(category);
}

export const templateCategories = soulPresetCategories;

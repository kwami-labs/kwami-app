/**
 * Avatar Composables
 *
 * Barrel exports for avatar-related composables.
 */

export {
  useColorPalettes,
  type PaletteType,
  type Palette,
  type UseColorPalettesOptions,
} from './useColorPalettes';
export {
  useAvatarInteractions,
  actionOptions,
  cursorOptions,
  type InteractionAction,
  type CursorStyle,
  type UseAvatarInteractionsOptions,
} from './useAvatarInteractions';

// Sync composables
export * from './sync';

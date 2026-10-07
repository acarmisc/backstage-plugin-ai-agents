/**
 * Semantic tones, mapped to Backstage UI (BUI) design tokens. Only CSS
 * variables are used, never hex colors, so everything follows the host's
 * theme (light/dark, custom themes) with no theme hook.
 */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Foreground (text, icons, dots) for a tone. */
export const TONE_FG: Record<Tone, string> = {
  success: 'var(--bui-fg-success)',
  warning: 'var(--bui-fg-warning)',
  danger: 'var(--bui-fg-danger)',
  info: 'var(--bui-fg-info)',
  neutral: 'var(--bui-fg-secondary)',
};

/** Tinted background that pairs with `TONE_FG`. */
export const TONE_BG: Record<Tone, string> = {
  success: 'var(--bui-bg-success)',
  warning: 'var(--bui-bg-warning)',
  danger: 'var(--bui-bg-danger)',
  info: 'var(--bui-bg-info)',
  neutral: 'var(--bui-bg-neutral-2)',
};

/** Border that pairs with `TONE_FG`. */
export const TONE_BORDER: Record<Tone, string> = {
  success: 'var(--bui-border-success)',
  warning: 'var(--bui-border-warning)',
  danger: 'var(--bui-border-danger)',
  info: 'var(--bui-border-info)',
  neutral: 'var(--bui-border-2)',
};

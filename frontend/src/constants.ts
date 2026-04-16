// ─── Design tokens ────────────────────────────────────────────────────────────
export const ACCENT  = 'var(--accent)';
export const PRIMARY = 'var(--primary)';
export const TEXT_WEAK = 'var(--text-weak)';
export const TEXT_SOFT = 'var(--text-soft)';
export const TEXT_MID = 'var(--text-mid)';
export const TEXT_FAINT = 'var(--text-faint)';
export const BORDER = 'var(--border)';
export const PANEL_BG = 'var(--bg-1)';
export const HOVER_BG = 'var(--panel-hover)';
export const SUCCESS = 'var(--success)';

// Risk colour scale
export const RISK_COLORS: Record<string, string> = {
  CRITICAL: 'var(--accent)',
  HIGH:     'var(--secondary)',
  MEDIUM:   'var(--text-weak)',
  LOW:      'var(--text-faint)',
};

export const RISK_BG: Record<string, string> = {
  CRITICAL: 'var(--accent-bg)',
  HIGH:     'color-mix(in srgb, var(--secondary) 10%, transparent)',
  MEDIUM:   'color-mix(in srgb, var(--text-weak) 8%, transparent)',
  LOW:      'transparent',
};

// General chart palette (index 0 = CRITICAL red, descending to dark grays)
export const PALETTE = [
  'var(--accent)', 'var(--secondary)', 'var(--sub)', 'var(--text-weak)', 'var(--text-mid)', 'var(--text-faint)', 'var(--muted-3)',
];

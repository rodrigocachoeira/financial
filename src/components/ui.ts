// Shared class names, so buttons, cards and badges look the same on every screen.

export const card = "rounded-2xl border border-border bg-surface shadow-sm";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55";

export const buttonPrimary = `${buttonBase} bg-accent px-5 py-2.5 text-accent-foreground shadow-md shadow-accent/25 hover:bg-accent-hover`;

export const buttonSecondary = `${buttonBase} border border-border bg-surface px-4 py-2 hover:bg-surface-muted`;

export const buttonGhost = `${buttonBase} px-3 py-2 text-muted hover:bg-surface-muted hover:text-foreground`;

const badgeBase = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

export const badge = {
  neutral: `${badgeBase} bg-surface-muted text-muted`,
  accent: `${badgeBase} bg-accent-soft text-accent`,
  positive: `${badgeBase} bg-positive-soft text-positive`,
  negative: `${badgeBase} bg-negative-soft text-negative`,
  warning: `${badgeBase} bg-warning-soft text-warning`,
};

export const skeleton = "animate-pulse rounded-lg bg-surface-muted";

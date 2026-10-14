export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

// Whole class names, written out: Tailwind finds classes by scanning source text, so a name built
// from pieces would never reach the stylesheet.
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'inline-block h-3 w-3 shrink-0 rounded-full bg-gray-400',
  success: 'inline-block h-3 w-3 shrink-0 rounded-full bg-green-600',
  warning: 'inline-block h-3 w-3 shrink-0 rounded-full bg-amber-500',
  danger: 'inline-block h-3 w-3 shrink-0 rounded-full bg-red-600',
};

// Purely decorative: the meaning is always carried by the text next to it, never by colour alone.
export function StatusDot({ tone }: { readonly tone: StatusTone }) {
  return <span aria-hidden="true" className={TONE_CLASSES[tone]} />;
}

import type { MouseEventHandler } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

// Whole class names, written out: Tailwind finds classes by scanning source text.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50',
};

interface ButtonProps {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  /** True while the action it starts is running: the button is disabled and says so to readers. */
  readonly busy?: boolean;
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function Button({
  label,
  variant = 'primary',
  type = 'button',
  disabled = false,
  busy = false,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy}
      className={VARIANT_CLASSES[variant]}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

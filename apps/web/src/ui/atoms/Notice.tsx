import type { ReactNode } from 'react';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<NoticeTone, string> = {
  info: 'flex flex-col gap-1 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-950',
  success:
    'flex flex-col gap-1 rounded-md border border-green-400 bg-green-50 p-3 text-sm text-green-950',
  warning:
    'flex flex-col gap-1 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950',
  danger: 'flex flex-col gap-1 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-950',
};

// Errors interrupt (assertive alert); everything else is announced politely.
const TONE_ROLES: Record<NoticeTone, 'status' | 'alert'> = {
  info: 'status',
  success: 'status',
  warning: 'status',
  danger: 'alert',
};

export function Notice({
  tone,
  children,
}: {
  readonly tone: NoticeTone;
  readonly children: ReactNode;
}) {
  return (
    <div role={TONE_ROLES[tone]} className={TONE_CLASSES[tone]}>
      {children}
    </div>
  );
}

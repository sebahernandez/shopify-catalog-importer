import type { ChangeEventHandler } from 'react';

interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
  readonly hint?: string;
  readonly type?: 'text' | 'password';
  readonly required?: boolean;
  readonly disabled?: boolean;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  type = 'text',
  required = true,
  disabled = false,
}: TextFieldProps) {
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-900">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={hint === undefined ? undefined : hintId}
        className="rounded-md border border-gray-400 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-700 disabled:bg-gray-100"
      />
      {hint === undefined ? null : (
        <p id={hintId} className="text-xs text-gray-600">
          {hint}
        </p>
      )}
    </div>
  );
}

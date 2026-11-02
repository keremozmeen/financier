import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

export const inputClass =
  'min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-fg placeholder:text-muted focus:border-accent focus:outline-none aria-[invalid=true]:border-alert disabled:opacity-60';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
  }) => ReactNode;
}

/** Label, hint and error wiring shared by all form controls. */
export function Field({ label, hint, error, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true as const } : {}),
        'aria-describedby': describedBy,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-alert">
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
};

export function TextField({
  label,
  hint,
  error,
  onChange,
  className = '',
  ...props
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(aria) => (
        <input
          {...props}
          {...aria}
          className={`${inputClass} ${className}`}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
};

export function SelectField({ label, hint, error, onChange, options, ...props }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(aria) => (
        <select
          {...props}
          {...aria}
          className={inputClass}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

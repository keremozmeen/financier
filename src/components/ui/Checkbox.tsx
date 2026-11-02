import { useId } from 'react';

/** A labelled checkbox with a 44px touch target and an optional hint. */
export function Checkbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const hintId = useId();
  return (
    <div className="space-y-1">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={hint ? hintId : undefined}
          className="size-5 shrink-0 accent-accent"
        />
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

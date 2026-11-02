interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  framed?: boolean;
}

/** A small group of toggle buttons where exactly one is pressed. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  framed = false,
}: SegmentedProps<T>) {
  return (
    <fieldset className={framed ? 'rounded-xl border border-border bg-surface p-4' : ''}>
      <legend className={`text-sm font-medium ${framed ? 'px-1 text-muted' : 'mb-1'}`}>
        {label}
      </legend>
      <div className="grid grid-flow-col gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-lg px-3 text-sm font-medium transition-colors ${
              option.value === value
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-raised text-fg hover:bg-border'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

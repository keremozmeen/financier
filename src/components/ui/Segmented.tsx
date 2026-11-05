interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  framed?: boolean;
  disabled?: boolean;
}

/** A small group of toggle buttons where exactly one is pressed. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  framed = false,
  disabled = false,
}: SegmentedProps<T>) {
  return (
    <fieldset disabled={disabled} className={`disabled:opacity-60 ${framed ? 'panel p-4' : ''}`}>
      {/* Floated so the legend sits inside the panel instead of on its edge. */}
      <legend
        className={`float-left w-full text-sm font-medium ${framed ? 'mb-2 text-muted' : 'mb-1'}`}
      >
        {label}
      </legend>
      <div className="clear-both grid grid-flow-col gap-1 rounded-full bg-surface-raised p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={`min-h-10 rounded-full px-3 text-sm font-medium transition-colors ${
              option.value === value ? 'bg-selected text-fg shadow-sm' : 'text-muted hover:text-fg'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

import { FileUp } from 'lucide-react';
import { useId, useState, type DragEvent } from 'react';
import { useT } from '../../i18n';

/** A file picker that also accepts a dropped file. */
export function FileDrop({ onFile }: { onFile: (file: File) => void }) {
  const t = useT();
  const id = useId();
  const [over, setOver] = useState(false);

  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        over ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:bg-surface-raised'
      }`}
    >
      <FileUp aria-hidden="true" size={28} className="text-accent" />
      <span className="font-semibold">{t('import.drop.title')}</span>
      <span className="text-sm text-muted">{t('import.drop.hint')}</span>
      <input
        id={id}
        type="file"
        aria-label={t('import.drop.label')}
        // Excel and PDF are accepted only to explain that they are not supported yet.
        accept=".csv,.tsv,.txt,text/csv,.xlsx,.xls,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

import { Upload } from 'lucide-react';
import { useId, useState, type DragEvent } from 'react';
import { useT } from '../../i18n';

/** One large "Choose file" button that also takes a dropped file (D20, D21). */
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
    <div className="space-y-2.5">
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={`flex h-14 cursor-pointer items-center justify-center gap-2.5 rounded-full bg-fg text-base font-semibold text-bg transition-opacity hover:opacity-90 ${
          over ? 'ring-4 ring-accent' : ''
        }`}
      >
        <Upload aria-hidden="true" size={20} />
        {t('import.choose')}
        <input
          id={id}
          type="file"
          aria-label={t('import.drop.label')}
          // PDF is accepted only to explain that it is not supported yet.
          accept=".csv,.tsv,.txt,text/csv,.xlsx,.xls,.pdf"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onFile(file);
          }}
        />
      </label>
      <p className="text-center text-sm text-muted">{t('import.note')}</p>
    </div>
  );
}

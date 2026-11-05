import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { todayIso } from '../../core/finance';
import { importsRepo } from '../../db';
import { useImportHistory } from '../../hooks/useImports';
import { useFormat } from '../../hooks/useFormat';
import { useT } from '../../i18n';
import type { ImportRecord } from '../../types/domain';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

export function ImportHistory() {
  const t = useT();
  const format = useFormat();
  const history = useImportHistory();
  const [undoing, setUndoing] = useState<ImportRecord | null>(null);

  return (
    <section aria-labelledby="import-history" className="mt-8">
      <h2 id="import-history" className="mb-2 text-lg font-semibold">
        {t('history.title')}
      </h2>
      {history === undefined ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : history.length === 0 ? (
        <p className="panel p-4 text-muted">{t('history.empty')}</p>
      ) : (
        <ul className="divide-y divide-border panel">
          {history.map(({ record, card }) => (
            <li key={record.id} className="flex items-center gap-3 py-2 pr-2 pl-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{record.fileName}</p>
                <p className="text-xs text-muted">
                  {t('history.meta', {
                    card: card?.name ?? '—',
                    date: format.date(todayIso(new Date(record.importedAt))),
                  })}
                </p>
                <p className="text-xs text-muted">{t('history.counts', { ...record.counts })}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setUndoing(record)}
                aria-label={t('history.undoLabel', { file: record.fileName })}
              >
                <Undo2 aria-hidden="true" size={18} />
                {t('history.undo')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {undoing && (
        <Dialog title={t('history.undo.title')} onClose={() => setUndoing(null)}>
          <p className="text-sm">
            {t('history.undo.body', { ...undoing.counts, file: undoing.fileName })}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setUndoing(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await importsRepo.undo(undoing.id);
                setUndoing(null);
              }}
            >
              {t('history.undo.confirm')}
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

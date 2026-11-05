import { ChevronDown, Undo2 } from 'lucide-react';
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
    <>
      {/* Folded to one line; nothing shows before the first import (D20). */}
      {history && history.length > 0 && (
        <details className="group panel">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
            <span className="flex-1">
              <span className="font-semibold">{t('history.title')}</span>{' '}
              <span className="text-muted">· {t('history.count', { count: history.length })}</span>
            </span>
            <ChevronDown
              aria-hidden="true"
              size={18}
              className="shrink-0 text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <ul className="divide-y divide-border border-t border-border">
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
        </details>
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
    </>
  );
}

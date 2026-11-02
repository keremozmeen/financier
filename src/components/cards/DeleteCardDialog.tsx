import { useState } from 'react';
import { useI18n } from '../../i18n';
import type { Card } from '../../types/domain';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { TextField } from '../ui/TextField';

/**
 * Deleting is permanent, so the dialog leads with "Archive instead" and only
 * enables the permanent delete after the user types the confirmation word.
 */
export function DeleteCardDialog({
  card,
  counts,
  onArchive,
  onDelete,
  onClose,
}: {
  card: Card;
  counts: { transactions: number; overrides: number };
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [typed, setTyped] = useState('');
  const word = t('delete.confirmWord');
  const confirmed = typed.trim().toLocaleUpperCase(locale) === word;

  return (
    <Dialog title={t('delete.title', { name: card.name })} onClose={onClose}>
      <p className="text-sm">{t('delete.suggestArchive')}</p>
      {!card.archived && (
        <Button variant="primary" className="w-full" onClick={onArchive}>
          {t('delete.archiveInstead')}
        </Button>
      )}
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm text-muted">
          {t('delete.body', { transactions: counts.transactions, overrides: counts.overrides })}
        </p>
        <TextField
          label={t('delete.typeToConfirm', { word })}
          value={typed}
          onChange={setTyped}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <Button variant="danger" className="w-full" disabled={!confirmed} onClick={onDelete}>
          {t('delete.confirm')}
        </Button>
      </div>
      <Button variant="ghost" className="w-full" onClick={onClose}>
        {t('common.cancel')}
      </Button>
    </Dialog>
  );
}

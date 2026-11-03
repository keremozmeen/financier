import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { FileDrop } from '../components/import/FileDrop';
import { ImportHistory } from '../components/import/ImportHistory';
import { MappingWizard, type MappingResult } from '../components/import/MappingWizard';
import { ReviewList } from '../components/import/ReviewList';
import { Button, ButtonLink } from '../components/ui/Button';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SelectField } from '../components/ui/TextField';
import { draftRows, type DraftRow } from '../core/import';
import {
  decodeText,
  detectHeaderRow,
  extractRows,
  fromColumnMap,
  guessMapping,
  guessOptions,
  headerSignature,
  isAccountStatement,
  parseCsv,
  toColumnMap,
  type CsvMapping,
  type CsvOptions,
} from '../parsers/csv';
import { importsRepo } from '../db';
import { readSpreadsheet, sniffSheetFormat } from '../parsers/sheet';
import { useCards, useToday } from '../hooks/useFinance';
import { useImportContext } from '../hooks/useImports';
import { useT, type MessageKey } from '../i18n';
import type { Card, StatementKind } from '../types/domain';

interface CsvFile {
  name: string;
  rows: string[][];
}

type Step =
  | { kind: 'start' }
  | { kind: 'mapping'; file: CsvFile; mapping: CsvMapping; options: CsvOptions }
  | {
      kind: 'review';
      file: CsvFile;
      mapping: CsvMapping;
      options: CsvOptions;
      drafts: DraftRow[];
      statement: StatementKind;
      profile?: { id: string; name: string; used: boolean };
    }
  | { kind: 'done'; cardId: string };

export function ImportScreen() {
  const t = useT();
  const today = useToday();
  const cards = useCards();
  const [cardId, setCardId] = useState<string>();
  const [step, setStep] = useState<Step>({ kind: 'start' });
  const [error, setError] = useState<MessageKey>();
  const [busy, setBusy] = useState(false);

  const card: Card | undefined = cards?.find((c) => c.id === cardId) ?? cards?.[0];
  const context = useImportContext(step.kind === 'review' ? card : undefined);

  async function openFile(file: File) {
    if (!card) return;
    setError(undefined);
    const extension = file.name.toLowerCase().split('.').pop() ?? '';
    if (extension === 'pdf') return setError('import.error.pdf');

    let rows: string[][];
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Excel and HTML-as-.xls go through SheetJS, loaded only now (D18).
      const sheet = sniffSheetFormat(bytes);
      rows = sheet ? await readSpreadsheet(bytes, sheet) : parseCsv(decodeText(bytes));
    } catch {
      return setError('import.error.read');
    }
    if (rows.length < 2) return setError('import.error.empty');

    const csv = { name: file.name, rows };
    const headerRow = detectHeaderRow(rows);
    // Account statements belong on the account's debit card (D17).
    if (isAccountStatement(rows[headerRow] ?? []) && card.type !== 'debit') {
      return setError('import.error.accountNeedsDebit');
    }
    // A saved profile for these headers skips the wizard (D3).
    const profile = await importsRepo.findProfile(headerSignature(rows[headerRow] ?? []));
    const saved = profile && fromColumnMap(profile.columnMap);
    if (profile && saved) {
      const options = { ...profile.options, headerRow };
      toReview(csv, saved, options, { id: profile.id, name: profile.name, used: true });
      return;
    }
    const mapping = guessMapping(rows[headerRow] ?? [], rows.slice(headerRow + 1));
    setStep({
      kind: 'mapping',
      file: csv,
      mapping,
      options: guessOptions(rows, headerRow, mapping),
    });
  }

  function toReview(
    file: CsvFile,
    mapping: CsvMapping,
    options: CsvOptions,
    profile?: { id: string; name: string; used: boolean },
  ) {
    if (!card) return;
    const kind: StatementKind = isAccountStatement(file.rows[options.headerRow] ?? [])
      ? 'account'
      : 'card';
    const parsed = extractRows(file.rows, mapping, options, card.currency);
    const drafts = draftRows(parsed, card.type, kind);
    setStep({
      kind: 'review',
      file,
      mapping,
      options,
      drafts,
      statement: kind,
      ...(profile ? { profile } : {}),
    });
  }

  async function finishMapping(file: CsvFile, result: MappingResult) {
    let profile: { id: string; name: string; used: boolean } | undefined;
    if (result.profileName) {
      const id = await importsRepo.saveProfile({
        name: result.profileName,
        headerSignature: headerSignature(file.rows[result.options.headerRow] ?? []),
        columnMap: toColumnMap(result.mapping),
        options: result.options,
      });
      profile = { id, name: result.profileName, used: false };
    }
    toReview(file, result.mapping, result.options, profile);
  }

  async function commit(review: Extract<Step, { kind: 'review' }>) {
    if (!card) return;
    setBusy(true);
    try {
      await importsRepo.commit({
        card,
        fileName: review.file.name,
        rows: review.drafts,
        source: 'csv',
        today,
        ...(review.profile ? { profileId: review.profile.id } : {}),
      });
      setStep({ kind: 'done', cardId: card.id });
    } finally {
      setBusy(false);
    }
  }

  if (cards === undefined) {
    return (
      <section>
        <ScreenHeader title={t('import.title')} />
        <p className="text-muted">{t('common.loading')}</p>
      </section>
    );
  }

  return (
    <section>
      <ScreenHeader title={t('import.title')} />
      <p className="mb-4 flex items-center gap-2 text-sm text-muted">
        <ShieldCheck aria-hidden="true" size={16} className="shrink-0 text-success" />
        {t('import.privacy')}
      </p>

      {!card ? (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-muted">{t('import.noCards')}</p>
          <ButtonLink to="/cards/new" variant="primary">
            {t('cards.add')}
          </ButtonLink>
        </div>
      ) : step.kind === 'start' ? (
        <div className="space-y-4">
          <SelectField
            label={t('import.card')}
            value={card.id}
            onChange={setCardId}
            options={cards.map((c) => ({
              value: c.id,
              label: `${c.name} · ${t(c.type === 'credit' ? 'cards.type.credit' : 'cards.type.debit')}`,
            }))}
          />
          {card.type === 'debit' && <p className="text-sm text-muted">{t('import.debitNote')}</p>}
          <FileDrop onFile={(file) => void openFile(file)} />
          {error && (
            <p role="alert" className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm">
              {t(error)}
            </p>
          )}
          <ImportHistory />
        </div>
      ) : step.kind === 'mapping' ? (
        <MappingWizard
          rows={step.file.rows}
          currency={card.currency}
          initial={step}
          defaultName={card.bank ? `${card.bank} CSV` : step.file.name}
          onCancel={() => setStep({ kind: 'start' })}
          onSubmit={(result) => void finishMapping(step.file, result)}
        />
      ) : step.kind === 'review' ? (
        <div className="space-y-4">
          <p className="text-sm">
            <span className="font-medium">{card.name}</span> · {step.file.name}
          </p>
          {step.statement === 'account' && (
            <p className="text-sm text-muted">{t('import.accountDetected')}</p>
          )}
          {step.profile?.used && (
            <p className="text-sm text-muted">
              {t('import.profileUsed', { name: step.profile.name })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                setStep({
                  kind: 'mapping',
                  file: step.file,
                  mapping: step.mapping,
                  options: step.options,
                })
              }
            >
              {t('import.changeMapping')}
            </Button>
            <Button variant="ghost" onClick={() => setStep({ kind: 'start' })}>
              {t('import.changeFile')}
            </Button>
          </div>
          {context === undefined ? (
            <p className="text-muted">{t('common.loading')}</p>
          ) : (
            <ReviewList
              card={card}
              statement={step.statement}
              drafts={step.drafts}
              context={context}
              busy={busy}
              onChange={(drafts) => setStep({ ...step, drafts })}
              onImport={() => void commit(step)}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 aria-hidden="true" size={20} className="text-success" />
            {t('done.title')}
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={`/cards/${step.cardId}`} variant="primary">
              {t('done.viewCard')}
            </ButtonLink>
            <Button onClick={() => setStep({ kind: 'start' })}>{t('done.another')}</Button>
          </div>
          <ImportHistory />
        </div>
      )}
    </section>
  );
}

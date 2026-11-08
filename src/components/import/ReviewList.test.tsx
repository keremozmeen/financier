import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { DraftRow, ImportContext } from '../../core/import';
import { I18nProvider } from '../../i18n';
import type { CreditCard } from '../../types/domain';
import { ReviewList } from './ReviewList';

const card: CreditCard = {
  id: 'c1',
  type: 'credit',
  name: 'Bonus',
  bank: '',
  last4: '',
  currency: 'TRY',
  color: '#000',
  archived: false,
  limit: 10_000_000,
  statementDay: 10,
  dueDay: 20,
};
const context: ImportContext = {
  card,
  transactions: [],
  plans: [],
  statements: [],
  payments: [],
  overrides: [],
};
const draft = (line: number, description: string): DraftRow => ({
  line,
  date: '2026-09-15',
  description,
  amount: 10_000,
  type: 'charge',
  confidence: 'high',
  dropped: false,
  unmerged: false,
});

let latest: DraftRow[] = [];
function Harness({ initial }: { initial: DraftRow[] }) {
  const [drafts, setDrafts] = useState(initial);
  return (
    <I18nProvider>
      <ReviewList
        card={card}
        statement="card"
        drafts={drafts}
        context={context}
        onChange={(next) => {
          latest = next;
          setDrafts(next);
        }}
        onImport={() => {}}
        busy={false}
      />
    </I18nProvider>
  );
}

const row = (text: string) => screen.getByText(text).closest('li') as HTMLElement;

describe('review categories (D22)', () => {
  it('shows each category, lets Change set it, and never asks for a look', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[draft(1, 'MIGROS'), draft(2, 'BILINMEYEN YER')]} />);

    expect(screen.getByText('Everything looks right.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show all/ }));
    expect(within(row('MIGROS')).getByText('Groceries')).toBeInTheDocument();
    expect(within(row('BILINMEYEN YER')).getByText('Other')).toBeInTheDocument();

    await user.click(within(row('BILINMEYEN YER')).getByRole('button', { name: /row 2/ }));
    await user.selectOptions(screen.getByLabelText('Category for row 2'), 'Shopping');

    expect(
      within(row('BILINMEYEN YER')).getByText('Shopping', { selector: 'span' }),
    ).toBeInTheDocument();
    expect(latest[1]!.category).toBe('shopping');
    expect(latest[0]!.category).toBeUndefined();
    expect(screen.getByText('Everything looks right.')).toBeInTheDocument();
  });
});

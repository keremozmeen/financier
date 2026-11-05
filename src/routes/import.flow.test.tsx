import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cardsRepo, db, transactionsRepo } from '../db';
import { CREDIT_CARD_CSV, DEBIT_CARD_CSV } from '../parsers/csv/fixtures';
import { renderApp } from '../test/renderApp';
import type { CreditCard } from '../types/domain';

const user = userEvent.setup();

async function seedCredit() {
  const id = await cardsRepo.create({
    type: 'credit',
    name: 'Bonus',
    bank: 'Garanti BBVA',
    last4: '',
    currency: 'TRY',
    limit: 10_000_000,
    statementDay: 10,
    dueDay: 20,
    color: '#34d399',
  });
  const card = (await cardsRepo.get(id)) as CreditCard;
  await transactionsRepo.addManual({
    card,
    date: '2026-08-20',
    description: 'Market',
    amount: 425_000,
    kind: 'charge',
    installments: 1,
  });
  return card;
}

const csvFile = (text: string, name = 'ekstre.csv') => new File([text], name, { type: 'text/csv' });

async function upload(file: File) {
  // The import screen is a lazy route (D18): give it time to load under a busy test run.
  await user.upload(await screen.findByLabelText('Statement file', {}, { timeout: 5000 }), file);
}

function rowFor(text: string) {
  return screen.getByText(text).closest('li') as HTMLElement;
}

describe('import flow (D3, D16)', () => {
  it('maps, reviews, imports, re-imports and undoes a statement', async () => {
    // The columns read and how "used" is worked out show in the detailed view (D20).
    window.localStorage.setItem('financier.detailedView', 'on');
    await seedCredit();
    renderApp('/import');

    await upload(csvFile(CREDIT_CARD_CSV));
    // Known headers: no mapping step, the review says how the file was read (D20).
    const review = await screen.findByRole('region', { name: 'Review' });
    expect(screen.queryByRole('form', { name: 'Which column is which?' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Columns: Date: İşlem Tarihi · Description: Açıklama · Amount: Tutar (TL)'),
    ).toBeInTheDocument();
    expect(await db.importProfiles.count()).toBe(1);
    expect(
      within(rowFor('ÖNCEKİ DÖNEM BAKİYESİ')).getByText('Balance line: not imported'),
    ).toBeInTheDocument();
    expect(
      within(rowFor('TEKNOSA ISTANBUL TAKSİT 3/6')).getByText(
        'Creates a plan with 4 installments left (₺2,000.00)',
      ),
    ).toBeInTheDocument();
    expect(
      within(rowFor('HESAPTAN ÖDEME')).getByText(
        'Payment for the bill due Sep 21, 2026 (₺4,250.00)',
      ),
    ).toBeInTheDocument();
    expect(within(rowFor('BSMV')).getByText('New fee')).toBeInTheDocument();
    expect(within(rowFor('BSMV')).getByLabelText('Type of row 10')).toHaveValue('fee');
    expect(within(review).getByText('4 new')).toBeInTheDocument();

    // Leave Netflix out.
    await user.click(screen.getByLabelText('Include row 9'));
    expect(within(rowFor('NETFLIX.COM')).getByText('Left out')).toBeInTheDocument();

    await user.click(within(review).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Import complete')).toBeInTheDocument();
    expect(await db.transactions.count()).toBe(5); // seed + 3 entries + plan purchase
    expect(await db.payments.count()).toBe(1);
    expect(await screen.findByText(/3 entries · 1 plans · 1 payments/)).toBeInTheDocument();

    // The same headers use the saved mapping, and nothing new is added.
    await user.click(screen.getByRole('button', { name: 'Import another file' }));
    await upload(csvFile(CREDIT_CARD_CSV, 'ekstre-2.csv'));
    await screen.findByRole('region', { name: 'Review' });
    expect(await db.importProfiles.count()).toBe(1);
    expect(within(rowFor('MIGROS KADIKOY')).getByText('Already imported')).toBeInTheDocument();
    expect(
      within(rowFor('HESAPTAN ÖDEME')).getByText('Payment already recorded'),
    ).toBeInTheDocument();
    expect(
      within(rowFor('TEKNOSA ISTANBUL TAKSİT 3/6')).getByText(
        'Part of your installment plan "TEKNOSA ISTANBUL TAKSİT 3/6"',
      ),
    ).toBeInTheDocument();
    // Netflix was left out the first time, so it is new now.
    expect(within(rowFor('NETFLIX.COM')).getByText('New entry')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose another file' }));

    // Undo the first import from the history, folded to one line.
    await user.click(await screen.findByText('History'));
    await user.click(await screen.findByRole('button', { name: 'Undo import of ekstre.csv' }));
    const dialog = screen.getByRole('dialog', { name: 'Undo this import?' });
    await user.click(within(dialog).getByRole('button', { name: 'Undo import' }));
    await waitFor(() => expect(screen.queryByText('History')).not.toBeInTheDocument());
    expect(await db.transactions.count()).toBe(1);
    expect(await db.payments.count()).toBe(0);
    expect(await db.installmentPlans.count()).toBe(0);
  });

  it("asks only for the columns it can't read, by their header names, and remembers them", async () => {
    // The columns read and how "used" is worked out show in the detailed view (D20).
    window.localStorage.setItem('financier.detailedView', 'on');
    await seedCredit();
    renderApp('/import');
    const file = 'Gün;Ne;Kaç TL\n15.09.2026;MIGROS KADIKOY;1.234,56\n16.09.2026;SHELL;850,00\n';
    await upload(csvFile(file, 'garip.csv'));

    const wizard = await screen.findByRole('form', { name: 'Which column is which?' });
    const date = within(wizard).getByLabelText('Date');
    expect(within(date).getByRole('option', { name: 'Gün' })).toBeInTheDocument();
    expect(within(date).queryByRole('option', { name: /Column/ })).not.toBeInTheDocument();
    // Formats stay folded while the preview reads every row.
    expect(
      within(wizard).getByText('Number and date formats').closest('details'),
    ).not.toHaveAttribute('open');
    await user.selectOptions(within(wizard).getByLabelText('Description'), 'Ne');
    await user.selectOptions(within(wizard).getByLabelText('Amount'), 'Kaç TL');
    await user.click(within(wizard).getByRole('button', { name: 'Continue' }));
    await screen.findByRole('region', { name: 'Review' }, { timeout: 5000 });
    expect(
      screen.getByText('Columns: Date: Gün · Description: Ne · Amount: Kaç TL'),
    ).toBeInTheDocument();

    // The same headers open straight in review next time.
    await user.click(screen.getByRole('button', { name: 'Choose another file' }));
    await upload(csvFile(file, 'garip-2.csv'));
    await screen.findByRole('region', { name: 'Review' }, { timeout: 5000 });
    expect(screen.queryByRole('form', { name: 'Which column is which?' })).not.toBeInTheDocument();
  });

  it('lets the user change a row type and unmerge a manual entry', async () => {
    const card = await seedCredit();
    await transactionsRepo.addManual({
      card,
      date: '2026-09-15',
      description: '',
      amount: 123_456,
      kind: 'charge',
      installments: 1,
    });
    renderApp('/import');
    await upload(csvFile(CREDIT_CARD_CSV));
    await screen.findByRole('region', { name: 'Review' }, { timeout: 5000 });
    const migros = screen.getByText('MIGROS KADIKOY');
    const row = migros.closest('li') as HTMLElement;
    expect(
      within(row).getByText('Already logged: your entry gets this description'),
    ).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Not the same' }));
    expect(within(row).getByText('New entry, kept apart from your entry')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Merge' }));
    expect(
      within(row).getByText('Already logged: your entry gets this description'),
    ).toBeInTheDocument();

    // A payment the user calls a refund becomes a refund.
    await user.selectOptions(
      within(rowFor('HESAPTAN ÖDEME')).getByLabelText('Type of row 6'),
      'refund',
    );
    expect(within(rowFor('HESAPTAN ÖDEME')).getByText('New entry')).toBeInTheDocument();

    // Editing the amount recomputes the outcome.
    await user.click(within(rowFor('BSMV')).getByRole('button', { name: 'Edit row 10' }));
    const amount = within(rowFor('BSMV')).getByLabelText('Amount');
    await user.clear(amount);
    expect(within(rowFor('BSMV')).getByText('Needs a valid amount')).toBeInTheDocument();
    await user.type(amount, '15.00');
    expect(within(rowFor('BSMV')).getByText('New fee')).toBeInTheDocument();
  });

  it('imports a debit card file without installment or payment rows', async () => {
    await cardsRepo.create({
      type: 'debit',
      name: 'Maaş',
      bank: '',
      last4: '',
      currency: 'TRY',
      color: '#38bdf8',
    });
    renderApp('/import');
    await upload(csvFile(DEBIT_CARD_CSV, 'hesap.csv'));

    await screen.findByRole('region', { name: 'Review' });
    const card = rowFor('KREDI KARTI ODEMESI');
    expect(
      within(card).getByText('Bill payment: add the credit card it paid to record it'),
    ).toBeInTheDocument();
    const types = within(card).getByLabelText('Type of row 5');
    expect(within(types).queryByRole('option', { name: 'Installment' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Import complete')).toBeInTheDocument();
    expect((await db.transactions.toArray()).map((t) => t.amount).sort((a, b) => a - b)).toEqual([
      -150_000, 9500, 9500,
    ]);
  });

  it('explains that PDF files are not supported yet', async () => {
    await seedCredit();
    renderApp('/import');
    await upload(new File(['x'], 'ekstre.pdf'));
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF statements');
  });

  it('asks for a card first', async () => {
    renderApp('/import');
    expect(
      await screen.findByText('Add a card first, then import its statement.'),
    ).toBeInTheDocument();
  });

  it('fills a new card’s statement and due days from the statement (D20)', async () => {
    const id = await cardsRepo.create({
      type: 'credit',
      name: 'Bonus',
      bank: 'Garanti BBVA',
      last4: '',
      currency: 'TRY',
      limit: 10_000_000,
      color: '#1f7a4d',
    });
    renderApp('/import');
    await upload(
      csvFile(
        CREDIT_CARD_CSV.replace(
          'Hesap Kesim Tarihi;10.10.2026',
          'Hesap Kesim Tarihi;10.10.2026\nSon Ödeme Tarihi;20.10.2026',
        ),
      ),
    );

    expect(
      await screen.findByText(
        'Added to your card from this statement: statement day 10, due day 20.',
      ),
    ).toBeInTheDocument();
    expect(await cardsRepo.get(id)).toMatchObject({ statementDay: 10, dueDay: 20 });
  });
});

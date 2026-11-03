import { screen, within } from '@testing-library/react';
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
  await user.upload(await screen.findByLabelText('Statement file'), file);
}

function rowFor(text: string) {
  return screen.getByText(text).closest('li') as HTMLElement;
}

describe('CSV import flow (D3, D16)', () => {
  it('maps, reviews, imports, re-imports and undoes a statement', async () => {
    await seedCredit();
    renderApp('/import');

    await upload(csvFile(CREDIT_CARD_CSV));
    const wizard = await screen.findByRole('form', { name: 'Match the columns' });
    expect(within(wizard).getByLabelText('Header row')).toHaveValue('2');
    expect(within(wizard).getByLabelText('Mapping name')).toHaveValue('Garanti BBVA CSV');
    expect(within(wizard).getByText('MIGROS KADIKOY')).toBeInTheDocument();
    await user.click(within(wizard).getByRole('button', { name: 'Continue' }));

    const review = await screen.findByRole('region', { name: 'Review' });
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
    expect(
      await screen.findByText('Using your saved mapping "Garanti BBVA CSV".'),
    ).toBeInTheDocument();
    await screen.findByRole('region', { name: 'Review' });
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

    // Undo the first import from the history.
    await user.click(await screen.findByRole('button', { name: 'Undo import of ekstre.csv' }));
    const dialog = screen.getByRole('dialog', { name: 'Undo this import?' });
    await user.click(within(dialog).getByRole('button', { name: 'Undo import' }));
    expect(await screen.findByText('No imports yet.')).toBeInTheDocument();
    expect(await db.transactions.count()).toBe(1);
    expect(await db.payments.count()).toBe(0);
    expect(await db.installmentPlans.count()).toBe(0);
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
    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    const migros = await screen.findByText('MIGROS KADIKOY');
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
    expect(await screen.findByText(/installment columns are ignored/)).toBeInTheDocument();
    await upload(csvFile(DEBIT_CARD_CSV, 'hesap.csv'));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    await screen.findByRole('region', { name: 'Review' });
    const card = rowFor('KREDI KARTI ODEMESI');
    expect(within(card).getByText('Debit cards have no bills: not imported')).toBeInTheDocument();
    const types = within(card).getByLabelText('Type of row 5');
    expect(within(types).queryByRole('option', { name: 'Installment' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Import complete')).toBeInTheDocument();
    expect((await db.transactions.toArray()).map((t) => t.amount).sort((a, b) => a - b)).toEqual([
      -150_000, 9500, 9500,
    ]);
  });

  it('explains that Excel and PDF files are not supported yet', async () => {
    await seedCredit();
    renderApp('/import');
    await upload(new File(['x'], 'ekstre.xlsx'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Excel files (.xlsx, .xls)');
    await upload(new File(['x'], 'ekstre.pdf'));
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF statements');
  });

  it('asks for a card first', async () => {
    renderApp('/import');
    expect(
      await screen.findByText('Add a card first, then import its statement.'),
    ).toBeInTheDocument();
  });
});

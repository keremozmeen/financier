import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cardsRepo, db, transactionsRepo } from '../db';
import { accountFile } from '../parsers/sheet/fixtures';
import { renderApp } from '../test/renderApp';
import type { CreditCard } from '../types/domain';

const user = userEvent.setup();

async function seed() {
  await cardsRepo.create({
    type: 'debit',
    name: 'İş Bankası',
    bank: 'İş Bankası',
    last4: '',
    currency: 'TRY',
    color: '#38bdf8',
  });
  const id = await cardsRepo.create({
    type: 'credit',
    name: 'Maximum',
    bank: 'İş Bankası',
    last4: '1234',
    currency: 'TRY',
    color: '#34d399',
    limit: 10_000_000,
    statementDay: 30,
    dueDay: 10,
  });
  await transactionsRepo.addManual({
    card: (await cardsRepo.get(id)) as CreditCard,
    date: '2026-09-15',
    description: 'Teknosa',
    amount: 425_000,
    kind: 'charge',
    installments: 1,
  });
}

const xls = (format: 'xls' | 'xlsx' | 'html') =>
  new File([accountFile(format)], `hesap-hareketleri.${format === 'xlsx' ? 'xlsx' : 'xls'}`);

const rowFor = (text: string) => screen.getByText(text).closest('li') as HTMLElement;

async function openFile(file: File) {
  await user.upload(await screen.findByLabelText('Statement file', {}, { timeout: 5000 }), file);
}

describe('account statement import flow (D17, D18)', () => {
  it('reads an HTML-as-.xls account statement and pays the credit card', async () => {
    await seed();
    renderApp('/import');
    await user.selectOptions(
      await screen.findByLabelText('Card', {}, { timeout: 5000 }),
      'İş Bankası · Debit card',
    );
    await openFile(xls('html'));

    // The info rows above the header are skipped and the columns read on their own.
    await screen.findByRole('region', { name: 'Review' }, { timeout: 5000 });
    expect(screen.getByText(/· bank account statement/)).toBeInTheDocument();
    expect(screen.getByText(/^Columns: Date: Tarih\/Saat/)).toBeInTheDocument();

    expect(
      within(rowFor('ACME A.Ş. EKİM MAAŞ')).getByText('Income: not counted as spending'),
    ).toBeInTheDocument();
    expect(
      within(rowFor('KREDİ KARTI ÖDEMESİ 5555********1234')).getByText(
        'Payment for the Maximum bill due Oct 12, 2026 (₺4,250.00)',
      ),
    ).toBeInTheDocument();
    expect(
      within(rowFor('ATM KADIKOY')).getByText('Transfer or cash: not counted as spending'),
    ).toBeInTheDocument();
    expect(within(rowFor('ENERJİSA ELEKTRİK FATURASI')).getByText('New bill')).toBeInTheDocument();

    // Count the rent transfer as spending.
    const rent = rowFor('MEHMET DEMİR KİRA');
    await user.click(within(rent).getByRole('button', { name: 'Count as spending' }));
    expect(within(rent).getByText('Counted as spending')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Import complete')).toBeInTheDocument();
    expect(await db.payments.count()).toBe(1);
    expect((await db.transactions.toArray()).some((t) => t.transfer)).toBe(true);
  });

  it('recognizes the same statement in another format through the saved mapping', async () => {
    await seed();
    renderApp('/import');
    await user.selectOptions(
      await screen.findByLabelText('Card', {}, { timeout: 5000 }),
      'İş Bankası · Debit card',
    );
    await openFile(xls('xlsx'));
    await screen.findByRole('region', { name: 'Review' }, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Import complete')).toBeInTheDocument();
    const saved = await db.transactions.count();

    // The HTML .xls writes "1.250,00" where Excel stores 1250: formats are read per file,
    // and the saved Referans and İşlem Türü columns still match every row (D17, D18).
    await user.click(screen.getByRole('button', { name: 'Import another file' }));
    await openFile(xls('html'));
    await screen.findByRole('region', { name: 'Review' }, { timeout: 5000 });
    expect(within(rowFor('MIGROS KADIKOY')).getByText('Already imported')).toBeInTheDocument();
    expect(within(rowFor('ACME A.Ş. EKİM MAAŞ')).getByText('Already imported')).toBeInTheDocument();
    expect(await db.importProfiles.count()).toBe(1);
    expect(await db.transactions.count()).toBe(saved);
  });

  it('lets the user pick the credit card a payment paid', async () => {
    await seed();
    await cardsRepo.create({
      type: 'credit',
      name: 'Bonus',
      bank: '',
      last4: '5678',
      currency: 'TRY',
      color: '#000',
      limit: 1_000_000,
      statementDay: 30,
      dueDay: 10,
    });
    const debitId = (await cardsRepo.list()).find((c) => c.type === 'debit')!.id;
    renderApp('/import');
    await user.selectOptions(await screen.findByLabelText('Card', {}, { timeout: 5000 }), debitId);
    await openFile(xls('xlsx'));
    await screen.findByRole('region', { name: 'Review' }, { timeout: 5000 });

    const payment = rowFor('KREDİ KARTI ÖDEMESİ 5555********1234');
    // Matched by the last 4 digits; the user can switch it.
    const picker = within(payment).getByLabelText('Credit card paid by row 10');
    expect(picker).toHaveDisplayValue('Maximum ·1234');
    await user.selectOptions(picker, 'Bonus ·5678');
    expect(
      within(payment).getByText('No bill to pay on this date: not imported'),
    ).toBeInTheDocument();
  });

  it('asks for a debit card when an account statement is opened on a credit card', async () => {
    await seed();
    renderApp('/import');
    await user.selectOptions(
      await screen.findByLabelText('Card', {}, { timeout: 5000 }),
      'Maximum · Credit card',
    );
    await openFile(xls('xls'));
    expect(await screen.findByRole('alert')).toHaveTextContent('bank account statement');
  });
});

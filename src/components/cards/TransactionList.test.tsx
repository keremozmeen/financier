import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '../../i18n';
import type { Transaction } from '../../types/domain';
import { TransactionList } from './TransactionList';

const tx = (id: string, description: string, amount: number, extra: Partial<Transaction> = {}) =>
  ({
    id,
    cardId: 'card',
    date: '2026-10-01',
    description,
    normalizedMerchant: description.toLowerCase(),
    amount,
    currency: 'TRY',
    category: '',
    fingerprint: id,
    source: 'manual',
    ...extra,
  }) satisfies Transaction;

function renderList(transactions: Transaction[]) {
  render(
    <I18nProvider>
      <TransactionList transactions={transactions} plans={[]} onDelete={() => {}} />
    </I18nProvider>,
  );
}

const row = (text: string) => screen.getByText(text).closest('li') as HTMLElement;

describe('TransactionList amounts', () => {
  it('shows a charge plain, and income and refunds with "+" in green', () => {
    renderList([
      tx('a', 'Market', 123_456),
      tx('b', 'Paycheck', -300_000, { income: true }),
      tx('c', 'Shoes return', -40_000),
    ]);

    const charge = within(row('Market')).getByText('₺1,234.56');
    expect(charge).not.toHaveClass('text-success');
    expect(charge.textContent).not.toMatch(/[-−+]/);

    expect(within(row('Paycheck')).getByText('+₺3,000.00')).toHaveClass('text-success');
    expect(within(row('Paycheck')).getByText('Income')).toBeInTheDocument();
    expect(within(row('Shoes return')).getByText('+₺400.00')).toHaveClass('text-success');
    expect(within(row('Shoes return')).getByText('Refund')).toBeInTheDocument();

    expect(screen.queryAllByText(/[-−]₺/)).toHaveLength(0);
  });

  it('labels income and refunds without a description by name', () => {
    renderList([tx('a', '', -300_000, { income: true }), tx('b', '', -5_000)]);
    expect(within(row('Income')).getByText('+₺3,000.00')).toBeInTheDocument();
    expect(within(row('Refund')).getByText('+₺50.00')).toBeInTheDocument();
  });

  it('formats in Turkish', () => {
    window.localStorage.setItem('financier.locale', 'tr');
    renderList([tx('a', 'Maaş', -300_000, { income: true }), tx('b', 'Market', 123_456)]);
    const plain = (text: string | null) => text?.replace(/[\u00a0\u202f]/g, ' ');
    expect(plain(within(row('Maaş')).getByText(/₺/).textContent)).toBe('+₺3.000,00');
    expect(plain(within(row('Market')).getByText(/₺/).textContent)).toBe('₺1.234,56');
  });
});

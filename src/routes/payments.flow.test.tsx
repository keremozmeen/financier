import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { todayIso } from '../core/finance';
import { cardsRepo, transactionsRepo } from '../db';
import { renderApp } from '../test/renderApp';
import type { CreditCard } from '../types/domain';

const user = userEvent.setup();

async function seedCreditCard() {
  const id = await cardsRepo.create({
    type: 'credit',
    name: 'Bonus',
    bank: '',
    last4: '',
    currency: 'TRY',
    limit: 5_000_000,
    statementDay: 10,
    dueDay: 20,
    color: '#34d399',
  });
  const card = (await cardsRepo.get(id)) as CreditCard;
  await transactionsRepo.addManual({
    card,
    date: todayIso(),
    description: 'Market',
    amount: 100_000,
    kind: 'charge',
    installments: 1,
  });
  return card;
}

const used = () => screen.getByText('Used', { selector: 'dt' }).nextElementSibling?.textContent;

describe('bill payments (D14)', () => {
  it('records a partial and then a full payment from the next bill', async () => {
    const card = await seedCreditCard();
    renderApp(`/cards/${card.id}`);

    const bill = await screen.findByRole('region', { name: 'Next bill' });
    expect(within(bill).getByText('₺1,000.00')).toBeInTheDocument();
    expect(used()).toBe('₺1,000.00');

    await user.click(within(bill).getByRole('button', { name: 'Mark as paid' }));
    const form = screen.getByRole('form', { name: 'Record a payment' });
    const amount = within(form).getByLabelText('Amount paid');
    expect(amount).toHaveValue('1000.00');
    await user.clear(amount);
    await user.type(amount, '400');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('₺400.00 paid so far')).toBeInTheDocument();
    const partial = screen.getByRole('region', { name: 'Next bill' });
    expect(within(partial).getByText('₺600.00')).toBeInTheDocument();
    expect(used()).toBe('₺600.00');

    await user.click(within(partial).getByRole('button', { name: 'Mark as paid' }));
    expect(screen.getByLabelText('Amount paid')).toHaveValue('600.00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Nothing to pay on this statement.')).toBeInTheDocument();
    expect(used()).toBe('₺0.00');
  });

  it('rejects an empty amount', async () => {
    const card = await seedCreditCard();
    renderApp(`/cards/${card.id}`);
    await user.click(await screen.findByRole('button', { name: 'Mark as paid' }));
    await user.clear(screen.getByLabelText('Amount paid'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter the amount you paid, e.g. 1.250,00.')).toBeInTheDocument();
  });

  it('shows no bill on a debit card', async () => {
    const id = await cardsRepo.create({
      type: 'debit',
      name: 'Maaş kartı',
      bank: '',
      last4: '',
      currency: 'TRY',
      color: '#38bdf8',
    });
    renderApp(`/cards/${id}`);
    await screen.findByRole('heading', { level: 1, name: 'Maaş kartı' });
    expect(screen.queryByRole('region', { name: 'Next bill' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as paid' })).not.toBeInTheDocument();
  });
});

describe('credit balance (D15)', () => {
  const figure = (label: string) =>
    screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;

  it('warns that an overpayment becomes credit and shows it in the figures', async () => {
    const card = await seedCreditCard();
    renderApp(`/cards/${card.id}`);

    await user.click(await screen.findByRole('button', { name: 'Mark as paid' }));
    const amount = screen.getByLabelText('Amount paid');
    expect(screen.queryByText(/will be added to your card as credit/)).not.toBeInTheDocument();
    await user.clear(amount);
    await user.type(amount, '1500');
    expect(screen.getByText('₺500.00 will be added to your card as credit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Credit', { selector: 'dt' });
    expect(figure('Credit')).toBe('+₺500.00');
    expect(figure('Used')).toBe('₺0.00');
    expect(figure('Available')).toBe('₺50,500.00');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
  });

  it('records a credit balance from the bank balance form', async () => {
    const card = await seedCreditCard();
    renderApp(`/cards/${card.id}`);

    await user.click(await screen.findByRole('button', { name: 'Update balance' }));
    await user.type(screen.getByLabelText('Current balance'), '300');
    await user.click(screen.getByRole('checkbox', { name: 'The card has a credit balance' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Credit', { selector: 'dt' });
    expect(figure('Credit')).toBe('+₺300.00');
    expect(figure('Available')).toBe('₺50,300.00');
  });
});

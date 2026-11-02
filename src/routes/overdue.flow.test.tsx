import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, todayIso } from '../core/finance';
import { cardsRepo, paymentsRepo, transactionsRepo } from '../db';
import { renderApp } from '../test/renderApp';
import type { Card } from '../types/domain';

const user = userEvent.setup();
const today = todayIso();
const day = (date: string) => Number(date.slice(8, 10));

/**
 * A credit card whose last statement closed 10 days ago and was due 3 days ago (at most
 * 5 days later when moved off a weekend, so still past), with an unpaid 1.000 ₺ charge.
 */
async function seedOverdueCard() {
  const closed = addDays(today, -10);
  const id = await cardsRepo.create({
    type: 'credit',
    name: 'Axess',
    bank: '',
    last4: '',
    currency: 'TRY',
    limit: 5_000_000,
    statementDay: day(closed),
    dueDay: day(addDays(closed, 7)),
    color: '#a78bfa',
  });
  const card = (await cardsRepo.get(id)) as Card;
  await transactionsRepo.addManual({
    card,
    date: addDays(closed, -1),
    description: 'Market',
    amount: 100_000,
    kind: 'charge',
    installments: 1,
  });
  return card;
}

describe('overdue bills (D14)', () => {
  it('shows an overdue bill on the card screen until it is paid outside the app', async () => {
    const card = await seedOverdueCard();
    renderApp(`/cards/${card.id}`);

    const overdue = await screen.findByRole('region', { name: 'Overdue bill' });
    expect(within(overdue).getByText('₺1,000.00')).toBeInTheDocument();
    // The open statement is still listed after it.
    expect(screen.getByRole('region', { name: 'Next bill' })).toBeInTheDocument();

    await user.click(within(overdue).getByRole('button', { name: 'Paid outside the app' }));

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Overdue bill' })).not.toBeInTheDocument(),
    );
    const [payment] = await paymentsRepo.listByCard(card.id);
    expect(payment).toMatchObject({ amount: 100_000, method: 'outside' });
    expect(screen.getByText('Paid outside the app')).toBeInTheDocument();
  });

  it('lists the overdue bill first on the dashboard and in the banner', async () => {
    await seedOverdueCard();
    renderApp('/');

    const banner = await screen.findByRole('region', { name: 'Due soon' });
    expect(within(banner).getByText(/^Axess: ₺1,000\.00 overdue since /)).toBeInTheDocument();

    const upcoming = screen.getByRole('region', { name: 'Upcoming payments' });
    const [first, second] = within(upcoming).getAllByRole('listitem');
    expect(first).toHaveTextContent('Overdue');
    expect(second).not.toHaveTextContent('Overdue');

    await user.click(within(upcoming).getByRole('button', { name: 'Paid outside the app: Axess' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Due soon' })).not.toBeInTheDocument(),
    );
  });
});

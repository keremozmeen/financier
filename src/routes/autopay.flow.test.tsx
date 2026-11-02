import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, todayIso } from '../core/finance';
import { cardsRepo, paymentsRepo, transactionsRepo } from '../db';
import { renderApp } from '../test/renderApp';
import type { Card, CreditCard } from '../types/domain';

const user = userEvent.setup();
const today = todayIso();
const day = (date: string) => Number(date.slice(8, 10));

/**
 * An auto-pay card turned on a month ago. Its last statement closed `closedAgo` days
 * ago and is due 7 days after closing, with a 1.000 ₺ charge on it.
 */
async function seedAutoPayCard(closedAgo: number) {
  const closed = addDays(today, -closedAgo);
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
    autoPay: true,
    autoPaySince: addDays(today, -30),
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
  return card as CreditCard;
}

describe('auto-pay (D14)', () => {
  it('is a credit card setting that starts today', async () => {
    renderApp('/cards/new');
    await user.type(await screen.findByLabelText('Card name'), 'Axess');
    await user.type(screen.getByLabelText('Credit limit'), '50000');
    await user.type(screen.getByLabelText('Statement closing day'), '10');
    await user.type(screen.getByLabelText('Payment due day'), '20');
    await user.click(screen.getByRole('checkbox', { name: 'Automatic payment' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { level: 1, name: 'Axess' });

    const [saved] = await cardsRepo.list();
    expect(saved).toMatchObject({ autoPay: true, autoPaySince: today });
  });

  it('shows "Paid automatically" instead of asking, and no due-soon banner', async () => {
    // Closed yesterday, due in 6 days (at most 8 when moved off a weekend).
    await seedAutoPayCard(1);
    renderApp('/');

    const upcoming = await screen.findByRole('region', { name: 'Upcoming payments' });
    expect(within(upcoming).getByText('Paid automatically')).toBeInTheDocument();
    expect(
      within(upcoming).queryByRole('button', { name: /Mark as paid/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Due soon' })).not.toBeInTheDocument();
  });

  it('records a past-due bill as paid automatically when the app opens', async () => {
    // Closed 10 days ago, due 3 days ago: never overdue, paid on its due date.
    const card = await seedAutoPayCard(10);
    renderApp(`/cards/${card.id}`);

    await waitFor(async () =>
      expect(await paymentsRepo.listByCard(card.id)).toEqual([
        expect.objectContaining({ amount: 100_000, method: 'automatic' }),
      ]),
    );
    expect(await screen.findByText('Paid automatically')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Overdue bill' })).not.toBeInTheDocument();
  });
});

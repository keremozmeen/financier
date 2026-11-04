import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, todayIso, transactionFingerprint } from '../core/finance';
import { cardsRepo, db } from '../db';
import { newId } from '../db/database';
import { renderApp } from '../test/renderApp';

const user = userEvent.setup();
const today = todayIso();

async function seedDebitCard() {
  return cardsRepo.create({
    type: 'debit',
    name: 'Maaş kartı',
    bank: 'Enpara',
    last4: '9876',
    currency: 'TRY',
    color: '#38bdf8',
  });
}

/** Three charges 30 days apart, the last one today. */
async function seedMonthly(cardId: string, description: string, amounts: [number, number, number]) {
  await db.transactions.bulkAdd(
    amounts.map((amount, i) => {
      const date = addDays(today, (i - 2) * 30);
      return {
        id: newId(),
        cardId,
        date,
        description,
        normalizedMerchant: description.toLowerCase(),
        amount,
        currency: 'TRY',
        category: 'uncategorized',
        fingerprint: transactionFingerprint(cardId, date, amount, description),
        source: 'csv' as const,
      };
    }),
  );
}

const subscriptions = () => screen.getByRole('region', { name: 'Active subscriptions' });

describe('Sub-Radar tab (D19)', () => {
  it('explains what it needs when nothing repeats yet', async () => {
    renderApp('/sub-radar');
    expect(await screen.findByText('No subscriptions found yet')).toBeInTheDocument();
  });

  it('lists subscriptions and bills with their totals', async () => {
    const card = await seedDebitCard();
    await seedMonthly(card, 'NETFLIX.COM', [22_999, 22_999, 22_999]);
    await seedMonthly(card, 'SPOTIFY', [5_999, 5_999, 5_999]);
    await seedMonthly(card, 'ENERJISA ELEKTRIK', [40_000, 50_000, 60_000]);
    renderApp('/sub-radar');

    const list = await screen.findByRole('region', { name: 'Active subscriptions' });
    expect(within(list).getByText('NETFLIX.COM')).toBeInTheDocument();
    expect(within(list).getAllByText('Detected')).toHaveLength(2);
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getByText('₺289.98 / month')).toBeInTheDocument();
    expect(within(summary).getByText('₺3,479.76 / year')).toBeInTheDocument();
    expect(within(summary).getByText('₺500.00 / month')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Bills' })).getByText('ENERJISA ELEKTRIK'),
    ).toBeInTheDocument();
  });

  it('alerts on a small price increase until it is acknowledged', async () => {
    const card = await seedDebitCard();
    await seedMonthly(card, 'NETFLIX.COM', [22_999, 22_999, 23_999]);
    renderApp('/sub-radar');

    expect(
      await screen.findByText('NETFLIX.COM went up from ₺229.99 to ₺239.99 (+₺10.00, +4.3%)'),
    ).toBeInTheDocument();
    expect(screen.getByText('+₺10.00 / month from price increases')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Alerts' })).not.toBeInTheDocument(),
    );
    // The increase still counts in the summary after "Got it".
    expect(screen.getByText('+₺10.00 / month from price increases')).toBeInTheDocument();
  });

  it('confirms, cancels and restores a subscription', async () => {
    const card = await seedDebitCard();
    await seedMonthly(card, 'NETFLIX.COM', [22_999, 22_999, 22_999]);
    renderApp('/sub-radar');

    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(within(subscriptions()).queryByText('Detected')).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Mark cancelled' }));
    await user.click(await screen.findByText('Not seen lately, cancelled and ignored (1)'));
    const cancelled = screen.getByRole('region', { name: 'Cancelled' });
    expect(within(cancelled).getByText('NETFLIX.COM')).toBeInTheDocument();

    await user.click(within(cancelled).getByRole('button', { name: 'Restore' }));
    expect(await screen.findByRole('region', { name: 'Active subscriptions' })).toBeInTheDocument();
  });

  it('shows the screen in Turkish', async () => {
    window.localStorage.setItem('financier.locale', 'tr');
    const card = await seedDebitCard();
    await seedMonthly(card, 'NETFLIX.COM', [22_999, 22_999, 23_999]);
    renderApp('/sub-radar');

    expect(await screen.findByRole('heading', { name: 'Abonelik Radarı' })).toBeInTheDocument();
    expect(
      await screen.findByText('NETFLIX.COM zamlandı: ₺229,99 → ₺239,99 (+₺10,00, +%4,3)'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anladım' })).toBeInTheDocument();
  });
});

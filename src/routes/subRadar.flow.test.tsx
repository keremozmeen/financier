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

const list = () => screen.getByRole('list', { name: 'Active subscriptions' });

describe('Sub-Radar tab (D19, D20)', () => {
  it('explains what it needs when nothing repeats yet', async () => {
    renderApp('/sub-radar');
    expect(await screen.findByText('No subscriptions found yet')).toBeInTheDocument();
  });

  it('shows one total and a short list of names and prices', async () => {
    const card = await seedDebitCard();
    await seedMonthly(card, 'NETFLIX.COM', [22_999, 22_999, 22_999]);
    await seedMonthly(card, 'IYZICO *SPOTIFY P1A2B3', [5_999, 5_999, 5_999]);
    await seedMonthly(card, 'ENERJISA ELEKTRIK', [40_000, 50_000, 60_000]);
    renderApp('/sub-radar');

    expect(await screen.findByText('₺289.98 / month')).toBeInTheDocument();
    expect(screen.getByText('₺3,479.76 a year · 2 subscriptions')).toBeInTheDocument();
    expect(within(list()).getByText('Netflix')).toBeInTheDocument();
    expect(within(list()).getByText('Spotify')).toBeInTheDocument();
    expect(screen.queryByText('Needs your attention', { exact: false })).not.toBeInTheDocument();

    // Bills stay folded in one line.
    await user.click(screen.getByText('Bills · about ₺500.00 a month'));
    expect(screen.getByText('Enerjisa')).toBeInTheDocument();
  });

  it('keeps the details and actions behind a tap', async () => {
    const card = await seedDebitCard();
    await seedMonthly(card, 'NETFLIX.COM', [22_999, 22_999, 22_999]);
    renderApp('/sub-radar');

    await user.click(
      await within(await screen.findByRole('list', { name: 'Active subscriptions' })).findByText(
        'Netflix',
      ),
    );
    expect(screen.getByText('On your statement: NETFLIX.COM')).toBeInTheDocument();
    expect(within(list()).getAllByText('₺229.99')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'I cancelled it' }));
    await user.click(await screen.findByText('Past and hidden (1)'));
    await user.click(screen.getByText('Netflix'));
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(await screen.findByRole('list', { name: 'Active subscriptions' })).toBeInTheDocument();
  });

  it('alerts on a notable raise until it is acknowledged', async () => {
    const card = await seedDebitCard();
    await seedMonthly(card, 'NETFLIX.COM', [22_999, 22_999, 23_999]);
    renderApp('/sub-radar');

    await user.click(await screen.findByText('Needs your attention (1)'));
    expect(screen.getByText('Netflix went up by ₺10.00: ₺229.99 → ₺239.99')).toBeInTheDocument();
    expect(screen.getByText(/raises add ₺10\.00 a month/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() =>
      expect(screen.queryByText('Needs your attention (1)')).not.toBeInTheDocument(),
    );
    // The raise still counts after "Got it".
    expect(screen.getByText(/raises add ₺10\.00 a month/)).toBeInTheDocument();
  });

  it('keeps a 50 kuruş raise quiet: counted, shown in the details, no alert', async () => {
    const card = await seedDebitCard();
    await seedMonthly(card, 'GOOGLE *YOUTUBE PREMIUM', [5_799, 5_799, 5_849]);
    renderApp('/sub-radar');

    expect(await screen.findByText(/raises add ₺0\.50 a month/)).toBeInTheDocument();
    expect(screen.queryByText('Needs your attention', { exact: false })).not.toBeInTheDocument();
    await user.click(screen.getByText('YouTube Premium'));
    expect(screen.getByText('Small price change: +₺0.50 (₺57.99 → ₺58.49)')).toBeInTheDocument();
  });

  it('shows the screen in Turkish', async () => {
    window.localStorage.setItem('financier.locale', 'tr');
    const card = await seedDebitCard();
    await seedMonthly(card, 'NETFLIX.COM', [22_999, 22_999, 23_999]);
    renderApp('/sub-radar');

    await user.click(await screen.findByText('Dikkatini isteyenler (1)'));
    expect(screen.getByText('Netflix ₺10,00 zamlandı: ₺229,99 → ₺239,99')).toBeInTheDocument();
    expect(screen.getByText('₺239,99 / ay', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anladım' })).toBeInTheDocument();
  });
});

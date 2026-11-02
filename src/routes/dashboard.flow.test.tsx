import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { addDays, todayIso } from '../core/finance';
import { cardsRepo, paymentsRepo, transactionsRepo } from '../db';
import { renderApp } from '../test/renderApp';
import type { Card } from '../types/domain';

const user = userEvent.setup();
const today = todayIso();
const dayOfMonth = (date: string) => Number(date.slice(8, 10));

/**
 * A credit card whose open statement closes today and is due `dueIn` days later
 * (plus at most two days when that falls on a weekend), with one charge today.
 */
async function seedCredit(name: string, dueIn: number, amount: number) {
  const id = await cardsRepo.create({
    type: 'credit',
    name,
    bank: '',
    last4: '',
    currency: 'TRY',
    limit: 5_000_000,
    statementDay: dayOfMonth(today),
    dueDay: dayOfMonth(addDays(today, dueIn)),
    color: '#34d399',
  });
  const card = (await cardsRepo.get(id)) as Card;
  await transactionsRepo.addManual({
    card,
    date: today,
    description: `${name} charge`,
    amount,
    kind: 'charge',
    installments: 1,
  });
  return card;
}

async function seedDebit() {
  const id = await cardsRepo.create({
    type: 'debit',
    name: 'Maaş kartı',
    bank: '',
    last4: '',
    currency: 'TRY',
    color: '#38bdf8',
  });
  const card = (await cardsRepo.get(id)) as Card;
  await transactionsRepo.addManual({
    card,
    date: today,
    description: 'Kira',
    amount: 1_250_000,
    kind: 'charge',
    installments: 1,
  });
  return card;
}

describe('dashboard (Phase 2)', () => {
  it('shows due-soon payments, upcoming bills of credit cards only, and recent activity of both types', async () => {
    await seedCredit('Axess', 3, 185_050);
    await seedCredit('Bonus', 20, 42_000);
    await seedDebit();
    renderApp('/');

    const banner = await screen.findByRole('region', { name: 'Due soon' });
    expect(within(banner).getByText(/^Axess: ₺1,850\.50 due /)).toBeInTheDocument();
    expect(within(banner).queryByText(/Bonus/)).not.toBeInTheDocument();

    const upcoming = screen.getByRole('region', { name: 'Upcoming payments' });
    expect(
      within(upcoming)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([expect.stringContaining('Axess'), expect.stringContaining('Bonus')]);
    expect(within(upcoming).queryByText('Maaş kartı')).not.toBeInTheDocument();

    const recent = screen.getByRole('region', { name: 'Recent activity' });
    for (const label of ['Axess charge', 'Bonus charge', 'Kira']) {
      expect(within(recent).getByText(label)).toBeInTheDocument();
    }
  });

  it('records a payment from the dashboard and clears the due-soon banner', async () => {
    await seedCredit('Axess', 3, 185_050);
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Mark as paid: Axess' }));
    const dialog = screen.getByRole('dialog', { name: 'Record a payment: Axess' });
    expect(within(dialog).getByLabelText('Amount paid')).toHaveValue('1850.50');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Due soon' })).not.toBeInTheDocument(),
    );
    const upcoming = screen.getByRole('region', { name: 'Upcoming payments' });
    expect(within(upcoming).getByText('Nothing to pay')).toBeInTheDocument();
  });

  it('shows the cash-flow projection with a 3/6/12 month toggle', async () => {
    await seedCredit('Axess', 3, 185_050);
    renderApp('/');

    const table = await screen.findByRole('table', { name: 'Cash flow' });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 6);
    expect(screen.getByText('Next 6 months: ₺1,850.50')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '12 mo' }));
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 12);
    await user.click(screen.getByRole('button', { name: '3 mo' }));
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 3);
  });

  it('downloads a local .ics file with one event per credit card', async () => {
    await seedCredit('Axess', 3, 185_050);
    await seedCredit('Bonus', 20, 42_000);
    await seedDebit();
    const blobs: Blob[] = [];
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:financier/test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Add to calendar' }));

    expect(click).toHaveBeenCalledOnce();
    const ics = await blobs[0]!.text();
    expect(blobs[0]!.type).toBe('text/calendar;charset=utf-8');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('SUMMARY:Axess payment due');
    expect(ics).toContain('TRIGGER:-P3D');
    expect(ics).not.toContain('Maaş');
    createUrl.mockRestore();
    vi.restoreAllMocks();
  });

  it('puts the number of due-soon payments on the app badge', async () => {
    const setAppBadge = vi.fn(() => Promise.resolve());
    const clearAppBadge = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { setAppBadge, clearAppBadge });
    try {
      await seedCredit('Axess', 3, 185_050);
      await seedCredit('Bonus', 20, 42_000);
      renderApp('/cards');
      await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(1));
    } finally {
      delete (navigator as Partial<typeof navigator>).setAppBadge;
      delete (navigator as Partial<typeof navigator>).clearAppBadge;
    }
  });
});

describe('payments on the card screen', () => {
  it('lists a recorded payment and deletes it after confirmation', async () => {
    const card = await seedCredit('Axess', 3, 185_050);
    renderApp(`/cards/${card.id}`);
    await user.click(await screen.findByRole('button', { name: 'Mark as paid' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const remove = await screen.findByRole('button', { name: /^Delete: Payment / });
    expect(await paymentsRepo.listByCard(card.id)).toHaveLength(1);
    await user.click(remove);
    const dialog = screen.getByRole('dialog', { name: 'Delete payment?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(async () => expect(await paymentsRepo.listByCard(card.id)).toHaveLength(0));
    expect(await screen.findByRole('button', { name: 'Mark as paid' })).toBeInTheDocument();
  });
});

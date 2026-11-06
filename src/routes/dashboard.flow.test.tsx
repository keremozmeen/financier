import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { addDays, todayIso } from '../core/finance';
import { cardsRepo, paymentsRepo, transactionsRepo } from '../db';
import { renderApp } from '../test/renderApp';
import type { Card } from '../types/domain';

const user = userEvent.setup();
const dayOfMonth = (date: string) => Number(date.slice(8, 10));

/**
 * A credit card whose open statement closes today and is due `dueIn` days later
 * (plus at most two days when that falls on a weekend), with one charge today.
 */
async function seedCredit(name: string, dueIn: number, amount: number) {
  const today = todayIso();
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
  const today = todayIso();
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
  it('leads with what is due in 30 days, then card tiles and recent activity of both types (D20)', async () => {
    await seedCredit('Axess', 3, 185_050);
    await seedCredit('Bonus', 20, 42_000);
    await seedDebit();
    renderApp('/');

    const due = await screen.findByRole('region', { name: 'Due in the next 30 days' });
    expect(within(due).getByText('₺2,270.50')).toBeInTheDocument();
    expect(
      within(due)
        .getAllByRole('button', { name: /^(Axess|Bonus), / })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      expect.stringMatching(/^Axess, ₺1,850\.50, /),
      expect.stringMatching(/^Bonus, ₺420\.00, /),
    ]);
    expect(within(due).queryByText('Maaş kartı')).not.toBeInTheDocument();

    const tiles = screen.getByRole('region', { name: 'Your cards' });
    expect(
      within(tiles).getByRole('link', { name: /Maaş kartı.*This month.*₺12,500\.00/ }),
    ).toBeInTheDocument();
    expect(within(tiles).getByRole('link', { name: /Axess.*Available/ })).toBeInTheDocument();
    // The simple dashboard has no gauges, no full payments list and no chart.
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Upcoming payments' })).not.toBeInTheDocument();

    const recent = screen.getByRole('region', { name: 'Recent activity' });
    for (const label of ['Axess charge', 'Bonus charge', 'Kira']) {
      expect(within(recent).getByText(label)).toBeInTheDocument();
    }
  });

  it('shows a payment due within 2 days in amber and a later one plain (D20)', async () => {
    // A Wednesday, so "tomorrow" is never moved past a weekend (on a Friday it would be 3 days).
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 14, 12) });
    try {
      await seedCredit('Axess', 1, 185_050);
      await seedCredit('Bonus', 20, 42_000);
      renderApp('/');

      const due = await screen.findByRole('region', { name: 'Due in the next 30 days' });
      const [first, second] = within(due).getAllByRole('button', { name: /^(Axess|Bonus), / });
      expect(first).toHaveAccessibleName('Axess, ₺1,850.50, Tomorrow');
      expect(second).toHaveAccessibleName(/^Bonus, ₺420\.00, \w{3} \d+$/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('records a payment from the payment dialog', async () => {
    await seedCredit('Axess', 3, 185_050);
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: /^Axess, ₺1,850\.50, / }));
    const dialog = screen.getByRole('dialog', { name: 'Axess' });
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
    expect(within(dialog).getByLabelText('Amount paid')).toHaveValue('1850.50');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    const due = screen.getByRole('region', { name: 'Due in the next 30 days' });
    expect(await within(due).findByText('Nothing to pay in the next 30 days.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the card from the payment dialog', async () => {
    const card = await seedCredit('Axess', 3, 185_050);
    const { router } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: /^Axess, / }));
    await user.click(screen.getByRole('button', { name: 'Open card' }));
    expect(router.state.location.pathname).toBe(`/cards/${card.id}`);
  });

  it('shows gauges, the full payments list and the cash-flow chart in the detailed view', async () => {
    window.localStorage.setItem('financier.detailedView', 'on');
    await seedCredit('Axess', 3, 185_050);
    renderApp('/');

    expect(await screen.findByRole('meter', { name: /^Axess: / })).toBeInTheDocument();
    const upcoming = screen.getByRole('region', { name: 'Upcoming payments' });
    expect(
      within(upcoming).getByRole('button', { name: 'Mark as paid: Axess' }),
    ).toBeInTheDocument();

    const table = await screen.findByRole('table', { name: 'Cash flow' });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 6);
    expect(screen.getByText('Next 6 months: ₺1,850.50')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '12 mo' }));
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 12);
    await user.click(screen.getByRole('button', { name: '3 mo' }));
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 3);
  });

  it('turns the detailed view on and off from Settings', async () => {
    await seedCredit('Axess', 3, 185_050);
    renderApp('/settings');

    await user.click(await screen.findByRole('checkbox', { name: 'Detailed view' }));
    expect(window.localStorage.getItem('financier.detailedView')).toBe('on');
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByRole('meter', { name: /^Axess: / })).toBeInTheDocument();
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

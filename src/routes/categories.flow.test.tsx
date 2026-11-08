import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { todayIso } from '../core/finance';
import { cardsRepo, db, merchantRulesRepo, transactionsRepo } from '../db';
import { renderApp } from '../test/renderApp';
import type { Card } from '../types/domain';

const user = userEvent.setup();

async function seedCard(type: 'credit' | 'debit') {
  const base = { name: 'Kart', bank: '', last4: '', currency: 'TRY', color: '#34d399' };
  const id = await cardsRepo.create(
    type === 'credit'
      ? { ...base, type, limit: 5_000_000, statementDay: 10, dueDay: 20 }
      : { ...base, type },
  );
  return (await cardsRepo.get(id))!;
}

const add = (card: Card, description: string, kind: 'charge' | 'income' = 'charge') =>
  transactionsRepo.addManual({
    card,
    date: '2026-11-02',
    description,
    amount: 10_000,
    kind,
    installments: 1,
  });

const chip = (name: string, entry: string) =>
  screen.findByRole('button', { name: `Category: ${name}. Change for ${entry}` });

describe.each(['credit', 'debit'] as const)('categories on a %s card (D22)', (type) => {
  it('shows the worked-out category and stores a pick for that entry only', async () => {
    const card = await seedCard(type);
    const first = await add(card, 'MIGROS KADIKOY');
    const second = await add(card, 'MIGROS ATASEHIR');
    const before = (await db.transactions.get(first))!;
    renderApp(`/cards/${card.id}`);

    await user.click(await chip('Groceries', 'MIGROS KADIKOY'));
    await user.click(await screen.findByRole('button', { name: 'Shopping' }));
    expect(await screen.findByText('Apply to all entries from Migros?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Only this one' }));

    expect(await chip('Shopping', 'MIGROS KADIKOY')).toBeInTheDocument();
    expect(await chip('Groceries', 'MIGROS ATASEHIR')).toBeInTheDocument();
    expect(await merchantRulesRepo.list()).toEqual([]);
    expect(await db.transactions.get(first)).toEqual({ ...before, category: 'shopping' });
    expect((await db.transactions.get(second))!.category).toBe('uncategorized');
  });

  it('stores a rule when applied to all, without touching the other entries', async () => {
    const card = await seedCard(type);
    await add(card, 'MIGROS KADIKOY');
    const other = await add(card, 'MIGROS ATASEHIR');
    renderApp(`/cards/${card.id}`);

    await user.click(await chip('Groceries', 'MIGROS KADIKOY'));
    await user.click(await screen.findByRole('button', { name: 'Shopping' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, all of them' }));

    expect(await chip('Shopping', 'MIGROS ATASEHIR')).toBeInTheDocument();
    expect((await merchantRulesRepo.list())[0]).toMatchObject({
      id: 'migros',
      category: 'shopping',
    });
    expect((await db.transactions.get(other))!.category).toBe('uncategorized');
  });
});

it('gives income no chip', async () => {
  const card = await seedCard('debit');
  await add(card, 'MAAS', 'income');
  renderApp(`/cards/${card.id}`);
  await screen.findByText('MAAS');
  expect(screen.queryByRole('button', { name: /^Category:/ })).not.toBeInTheDocument();
});

it('does not ask about a merchant when only a processor is named', async () => {
  const card = await seedCard('credit');
  await add(card, 'IYZICO 1234');
  renderApp(`/cards/${card.id}`);
  await user.click(await chip('Other', 'IYZICO 1234'));
  await user.click(await screen.findByRole('button', { name: 'Travel' }));
  expect(await chip('Travel', 'IYZICO 1234')).toBeInTheDocument();
  expect(screen.queryByText(/Apply to all/)).not.toBeInTheDocument();
});

describe('rules in Settings (D22)', () => {
  afterEach(() => window.localStorage.removeItem('financier.detailedView'));

  it('are hidden in the simple view', async () => {
    await merchantRulesRepo.set('migros', 'shopping');
    renderApp('/settings');
    await screen.findByLabelText(/Detailed view/);
    expect(screen.queryByText('Category rules')).not.toBeInTheDocument();
  });

  it('are listed and removable in the detailed view', async () => {
    window.localStorage.setItem('financier.detailedView', 'on');
    const card = await seedCard('credit');
    await add(card, 'MIGROS KADIKOY');
    await merchantRulesRepo.set('migros', 'shopping/home');
    renderApp('/settings');

    const section = (await screen.findByText('Category rules')).closest('section')!;
    expect(await within(section).findByText('Migros')).toBeInTheDocument();
    expect(within(section).getByText('Home')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Remove rule for Migros' }));
    await waitFor(async () => expect(await merchantRulesRepo.list()).toEqual([]));
  });
});

describe('where your money went (D22)', () => {
  afterEach(() => window.localStorage.removeItem('financier.detailedView'));

  async function seedSpending() {
    const card = await seedCard('debit');
    const today = todayIso();
    const entry = (description: string, amount: number, kind: 'charge' | 'income' = 'charge') =>
      transactionsRepo.addManual({ card, date: today, description, amount, kind, installments: 1 });
    await entry('MIGROS', 40_000);
    await entry('OPET', 30_000);
    await entry('STARBUCKS', 20_000);
    await entry('THY', 10_000);
    await entry('MAAS', 9_000_000, 'income');
  }

  it('shows the top three in one line and the rest in the breakdown', async () => {
    await seedSpending();
    renderApp('/');
    const line = await screen.findByRole('button', { name: /Where your money went/ });
    expect(line).toHaveTextContent('Groceries ₺400.00 · Transport ₺300.00 · Eating out ₺200.00');
    expect(line).not.toHaveTextContent('Travel');

    await user.click(line);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Travel')).toBeInTheDocument();
    expect(within(dialog).queryByText('Fuel')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Month by month')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/90,000/)).not.toBeInTheDocument();
  });

  it('adds subcategories and the comparison in the detailed view', async () => {
    window.localStorage.setItem('financier.detailedView', 'on');
    await seedSpending();
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: /Where your money went/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Fuel')).toBeInTheDocument();
    expect(within(dialog).getByText('Month by month')).toBeInTheDocument();
  });

  it('is absent with no spending this month', async () => {
    const card = await seedCard('debit');
    await add(card, 'MAAS', 'income');
    renderApp('/');
    await screen.findByText('Kart');
    expect(screen.queryByText('Where your money went')).not.toBeInTheDocument();
  });
});

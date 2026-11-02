import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cardsRepo, transactionsRepo } from '../db';
import { renderApp } from '../test/renderApp';

const user = userEvent.setup();

async function seedCard() {
  const id = await cardsRepo.create({
    name: 'Bonus',
    bank: '',
    last4: '',
    currency: 'TRY',
    limit: 5_000_000,
    statementDay: 10,
    dueDay: 20,
    color: '#34d399',
  });
  return (await cardsRepo.get(id))!;
}

/** A charge, a refund and an installment purchase, none with a description. */
async function seedUnnamedEntries() {
  const card = await seedCard();
  const base = { card, date: '2026-11-02', description: '' } as const;
  await transactionsRepo.addManual({ ...base, amount: 85_000, kind: 'charge', installments: 1 });
  await transactionsRepo.addManual({ ...base, amount: 10_000, kind: 'refund', installments: 1 });
  await transactionsRepo.addManual({ ...base, amount: 600_000, kind: 'charge', installments: 6 });
  return card;
}

const entryNames = () =>
  screen
    .getAllByRole('listitem')
    .map((item) => item.querySelector('p.font-medium')?.textContent)
    .filter(Boolean);

describe('quick entry without a description', () => {
  it('focuses the amount field and saves with only an amount', async () => {
    const card = await seedCard();
    renderApp(`/cards/${card.id}/add`);

    const amount = await screen.findByLabelText('Amount');
    expect(amount).toHaveFocus();
    await user.keyboard('850');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Delete: Charge' })).toBeInTheDocument();
    expect(entryNames()).toEqual(['Charge']);
  });

  it('saves two identical entries on the same day', async () => {
    const card = await seedCard();
    renderApp(`/cards/${card.id}`);
    for (let i = 0; i < 2; i++) {
      await user.click(await screen.findByRole('link', { name: 'Add entry' }));
      await user.type(await screen.findByLabelText('Amount'), '850');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByRole('heading', { level: 1, name: 'Bonus' });
    }
    expect(await screen.findAllByRole('button', { name: 'Delete: Charge' })).toHaveLength(2);
    expect(entryNames()).toEqual(['Charge', 'Charge']);
    expect(await transactionsRepo.listByCard(card.id)).toHaveLength(2);
  });
});

describe('fallback labels', () => {
  it('names unnamed entries in English', async () => {
    const card = await seedUnnamedEntries();
    renderApp(`/cards/${card.id}`);
    await screen.findByText('Installment purchase');
    expect(entryNames().sort()).toEqual(['Charge', 'Installment purchase', 'Refund']);
  });

  it('names unnamed entries in Turkish', async () => {
    window.localStorage.setItem('financier.locale', 'tr');
    const card = await seedUnnamedEntries();
    renderApp(`/cards/${card.id}`);
    await screen.findByText('Taksitli alışveriş');
    expect(entryNames().sort((a, b) => a!.localeCompare(b!, 'tr'))).toEqual([
      'Harcama',
      'İade',
      'Taksitli alışveriş',
    ]);
  });

  it('uses the fallback in the delete button and dialog', async () => {
    const card = await seedCard();
    await transactionsRepo.addManual({
      card,
      date: '2026-11-02',
      description: '',
      amount: 600_000,
      kind: 'charge',
      installments: 6,
    });
    renderApp(`/cards/${card.id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete: Installment purchase' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this entry?' });
    expect(
      within(dialog).getByText(
        'This removes "Installment purchase" and its installment plan from this card.',
      ),
    ).toBeInTheDocument();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { todayIso } from '../core/finance';
import { balanceOverridesRepo, cardsRepo, transactionsRepo } from '../db';
import { renderApp } from '../test/renderApp';

const user = userEvent.setup();
const TL = (lira: number) => lira * 100;

async function seedCard(usedLira = 0) {
  const id = await cardsRepo.create({
    type: 'credit',
    name: 'Bonus',
    bank: 'Garanti BBVA',
    last4: '',
    currency: 'TRY',
    limit: TL(50_000),
    statementDay: 10,
    dueDay: 20,
    color: '#34d399',
  });
  const card = (await cardsRepo.get(id))!;
  if (usedLira > 0) {
    await transactionsRepo.addManual({
      card,
      date: todayIso(),
      description: 'Earlier purchase',
      amount: TL(usedLira),
      kind: 'charge',
      installments: 1,
    });
  }
  return card;
}

async function fillEntry(description: string, amount: string) {
  await user.type(await screen.findByLabelText('Description'), description);
  await user.type(screen.getByLabelText('Amount'), amount);
}

const blockedMessage = (available: string) =>
  `Your bank would decline this: only ${available} is available.`;

describe('D12 entry form', () => {
  it('allows a charge of exactly the available limit', async () => {
    const card = await seedCard(45_000);
    renderApp(`/cards/${card.id}/add`);
    await fillEntry('Laptop', '5,000');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
  });

  it('blocks a charge one kuruş over the available limit', async () => {
    const card = await seedCard(45_000);
    renderApp(`/cards/${card.id}/add`);
    await fillEntry('Laptop', '5,000.01');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(blockedMessage('₺5,000.00'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(within(alert).getByRole('link', { name: 'Edit card limit' })).toHaveAttribute(
      'href',
      `/cards/${card.id}/edit`,
    );
  });

  it('checks an installment purchase by its full total', async () => {
    const card = await seedCard(45_000);
    renderApp(`/cards/${card.id}/add`);
    // 6 × 1,000 ₺: each installment fits, but the bank blocks the whole 6,000 ₺.
    await fillEntry('Phone', '6,000');
    await user.selectOptions(screen.getByLabelText('Installments'), '6');
    expect(screen.getByRole('alert')).toHaveTextContent(blockedMessage('₺5,000.00'));
  });

  it('never blocks a refund', async () => {
    const card = await seedCard(45_000);
    renderApp(`/cards/${card.id}/add`);
    await user.click(await screen.findByRole('button', { name: 'Refund' }));
    await fillEntry('Return', '90,000');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('offers no income on a credit card (D17)', async () => {
    const card = await seedCard(45_000);
    renderApp(`/cards/${card.id}/add`);
    await screen.findByRole('button', { name: 'Refund' });
    expect(screen.queryByRole('button', { name: 'Income' })).not.toBeInTheDocument();
  });

  it('lets the user update the bank balance without losing the entry', async () => {
    const card = await seedCard(45_000);
    renderApp(`/cards/${card.id}/add`);
    await fillEntry('Laptop', '10,000');
    await user.click(
      within(screen.getByRole('alert')).getByRole('button', { name: 'Update bank balance' }),
    );

    // The bill was paid: the bank shows a 0 balance today.
    const balanceForm = screen.getByRole('form', { name: 'Current balance from your bank' });
    await user.type(within(balanceForm).getByLabelText('Current balance'), '0');
    await user.click(within(balanceForm).getByRole('button', { name: 'Save' }));

    // The live query refreshes the available limit right after the balance is saved.
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Description')).toHaveValue('Laptop');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
  });
});

describe('D12 full card', () => {
  it('shows a card over its limit as full with a hint and no over-limit wording', async () => {
    const card = await seedCard();
    await balanceOverridesRepo.add(card, TL(52_000), todayIso());
    renderApp(`/cards/${card.id}`);

    const meter = await screen.findByRole('meter', { name: 'Bonus: 100% of limit used' });
    expect(meter).toHaveAttribute('aria-valuenow', '100');
    expect(
      screen.getByText(
        "Your balance is above your limit, usually because of interest, fees or a lowered limit. Your bank won't approve new spending until it is below the limit. If this doesn't match your bank, update your balance or limit.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Available', { selector: 'dt' }).nextElementSibling).toHaveTextContent(
      '₺0.00',
    );
    expect(screen.queryByText(/over limit/i)).not.toBeInTheDocument();
  });

  it('blocks every new charge on a full card', async () => {
    const card = await seedCard();
    await balanceOverridesRepo.add(card, TL(52_000), todayIso());
    renderApp(`/cards/${card.id}/add`);
    await fillEntry('Coffee', '0.01');
    expect(screen.getByRole('alert')).toHaveTextContent(blockedMessage('₺0.00'));
  });
});

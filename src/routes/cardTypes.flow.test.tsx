import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatDate, nextStatementDates, todayIso } from '../core/finance';
import { cardsRepo, transactionsRepo } from '../db';
import { renderApp } from '../test/renderApp';
import type { DebitCard } from '../types/domain';

const user = userEvent.setup();

async function seedDebitCard() {
  const id = await cardsRepo.create({
    type: 'debit',
    name: 'Maaş kartı',
    bank: 'Enpara',
    last4: '9876',
    currency: 'TRY',
    color: '#38bdf8',
  });
  return (await cardsRepo.get(id)) as DebitCard;
}

describe('card form type selector (D13)', () => {
  it('shows only name, bank, last 4 and color for a debit card', async () => {
    renderApp('/cards/new');
    await user.click(await screen.findByRole('button', { name: 'Debit card' }));

    expect(screen.getByLabelText('Card name')).toBeInTheDocument();
    expect(screen.getByLabelText('Bank')).toBeInTheDocument();
    expect(screen.getByLabelText('Last 4 digits')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Green' })).toBeInTheDocument();
    for (const label of ['Credit limit', 'Currency', 'Statement closing day', 'Payment due day']) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }

    await user.type(screen.getByLabelText('Card name'), 'Maaş kartı');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { level: 1, name: 'Maaş kartı' });

    const [saved] = await cardsRepo.list();
    expect(saved).toMatchObject({ type: 'debit', name: 'Maaş kartı', currency: 'TRY' });
    expect(saved).not.toHaveProperty('limit');
  });

  it('locks the type once the card has entries', async () => {
    const card = await seedDebitCard();
    await transactionsRepo.addManual({
      card,
      date: todayIso(),
      description: '',
      amount: 85_000,
      kind: 'charge',
      installments: 1,
    });
    renderApp(`/cards/${card.id}/edit`);

    expect(await screen.findByRole('button', { name: 'Credit card' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Debit card' })).toBeDisabled();
    expect(
      screen.getByText('The card type cannot change once the card has entries.'),
    ).toBeInTheDocument();
  });
});

describe('statement date preview', () => {
  const preview = (statementDay: number, dueDay: number) => {
    const dates = nextStatementDates(todayIso(), statementDay, dueDay);
    return `Next statement: ${formatDate(dates.statementDate, 'en')} · Payment due: ${formatDate(dates.dueDate, 'en')}`;
  };

  it('previews the next statement and due dates as the days are typed', async () => {
    renderApp('/cards/new');
    await user.type(await screen.findByLabelText('Statement closing day'), '10');
    expect(screen.queryByText(/Next statement/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Payment due day'), '20');
    expect(screen.getByText(preview(10, 20))).toBeInTheDocument();
    expect(screen.queryByText(/usually due about 10 days/)).not.toBeInTheDocument();
  });

  it('clamps the 31st to the end of short months in the preview', async () => {
    renderApp('/cards/new');
    await user.type(await screen.findByLabelText('Statement closing day'), '31');
    await user.type(screen.getByLabelText('Payment due day'), '31');
    expect(screen.getByText(preview(31, 31))).toBeInTheDocument();
  });

  it('shows a soft hint for equal days without blocking the save', async () => {
    renderApp('/cards/new');
    await user.type(await screen.findByLabelText('Card name'), 'Axess');
    await user.type(screen.getByLabelText('Credit limit'), '20,000');
    await user.type(screen.getByLabelText('Statement closing day'), '15');
    await user.type(screen.getByLabelText('Payment due day'), '15');

    expect(
      screen.getByText('Turkish cards are usually due about 10 days after the statement.'),
    ).toBeInTheDocument();
    expect(screen.getByText(preview(15, 15))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { level: 1, name: 'Axess' });
    expect((await cardsRepo.list())[0]).toMatchObject({ statementDay: 15, dueDay: 15 });
  });
});

describe('debit card screens (D13)', () => {
  it("shows this month's spending instead of a gauge or balance update", async () => {
    const card = await seedDebitCard();
    renderApp(`/cards/${card.id}`);

    expect(await screen.findByText("This month's spending")).toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update balance' })).not.toBeInTheDocument();
    expect(screen.getByText('Enpara · •••• 9876 · Debit card')).toBeInTheDocument();
  });

  it('adds an entry with no installment option and no limit check', async () => {
    const card = await seedDebitCard();
    renderApp(`/cards/${card.id}/add`);

    await user.type(await screen.findByLabelText('Amount'), '250,000');
    expect(screen.queryByLabelText('Installments')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const panel = (await screen.findByText("This month's spending")).parentElement!;
    expect(within(panel).getByText('₺250,000.00')).toBeInTheDocument();
  });

  it('adds income that is not counted as spending', async () => {
    const card = await seedDebitCard();
    renderApp(`/cards/${card.id}/add`);

    await user.type(await screen.findByLabelText('Amount'), '45,000');
    await user.click(screen.getByRole('button', { name: 'Income' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const panel = (await screen.findByText("This month's spending")).parentElement!;
    expect(within(panel).getByText('₺0.00')).toBeInTheDocument();
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('-₺45,000.00')).toBeInTheDocument();
  });

  it('lists debit and credit cards together on the detailed dashboard', async () => {
    window.localStorage.setItem('financier.detailedView', 'on');
    await seedDebitCard();
    await cardsRepo.create({
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
    renderApp('/');

    expect(
      await screen.findByRole('meter', { name: 'Bonus: 0% of limit used' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('meter')).toHaveLength(1);
    expect(screen.getByText("This month's spending")).toBeInTheDocument();
  });
});

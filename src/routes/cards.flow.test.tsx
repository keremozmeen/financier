import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatDate, todayIso } from '../core/finance';
import { cardsRepo } from '../db';
import { renderApp } from '../test/renderApp';

const user = userEvent.setup();

async function createCardThroughForm() {
  renderApp('/cards/new');
  await user.type(await screen.findByLabelText('Card name'), 'Bonus');
  await user.type(screen.getByLabelText(/^Bank/), 'Garanti BBVA');
  await user.type(screen.getByLabelText('Credit limit'), '50,000.00');
  await user.type(screen.getByLabelText('Statement closing day'), '10');
  await user.type(screen.getByLabelText('Payment due day'), '20');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { level: 1, name: 'Bonus' });
}

const meter = () => screen.getByRole('meter');

describe('cards flow', () => {
  it('creates a credit card from a name and a limit, in its bank’s color (D20, D21)', async () => {
    renderApp('/cards/new');
    expect(await screen.findByText('More options')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Card name'), 'Axess Platinum');
    await user.type(screen.getByLabelText('Credit limit'), '30,000.00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('heading', { level: 1, name: 'Axess Platinum' });
    const [card] = await cardsRepo.list();
    expect(card).toMatchObject({ type: 'credit', limit: 3_000_000, color: '#c8102e' });
    expect(card).not.toHaveProperty('statementDay');
    // The card asks for its days in one line instead of showing bills.
    expect(screen.getByText('Add your statement and due days')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Next bill' })).not.toBeInTheDocument();
  });

  it('rejects a day outside 1–31 but accepts an empty one', async () => {
    renderApp('/cards/new');
    await user.type(await screen.findByLabelText('Card name'), 'Bonus');
    await user.type(screen.getByLabelText('Credit limit'), '1,000');
    await user.type(screen.getByLabelText('Statement closing day'), '45');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a day between 1 and 31.')).toBeInTheDocument();
    expect(await cardsRepo.list()).toHaveLength(0);
  });

  it('validates the card form', async () => {
    renderApp('/cards/new');
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a limit greater than 0, e.g. 50.000,00.')).toBeInTheDocument();
    expect(screen.getByLabelText('Card name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('creates a card, blocks an installment purchase and applies a bank balance', async () => {
    // The columns read and how "used" is worked out show in the detailed view (D20).
    window.localStorage.setItem('financier.detailedView', 'on');
    await createCardThroughForm();
    expect(meter()).toHaveAttribute('aria-valuenow', '0');

    // 12,000 in 6 installments blocks the full 12,000 on day one (D11).
    await user.click(screen.getByRole('link', { name: 'Add entry' }));
    await user.type(await screen.findByLabelText('Description'), 'Laptop');
    await user.type(screen.getByLabelText('Amount'), '12,000');
    await user.selectOptions(screen.getByLabelText('Installments'), '6');
    expect(screen.getByText('6 × ₺2,000.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Laptop');
    expect(meter()).toHaveAttribute('aria-valuenow', '24');
    expect(screen.getByText('6 inst.')).toBeInTheDocument();
    expect(screen.getByText('Calculated from your entries')).toBeInTheDocument();

    // A bank balance as of today includes today's purchase.
    await user.click(screen.getByRole('button', { name: 'Update balance' }));
    await user.type(screen.getByLabelText('Current balance'), '7,500');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const date = formatDate(todayIso(), 'en');
    expect(await screen.findByText(`From your bank balance on ${date}`)).toBeInTheDocument();
    expect(meter()).toHaveAttribute('aria-valuenow', '15');
  });

  it('records refunds as negative amounts that lower used', async () => {
    await createCardThroughForm();
    for (const [kind, description, amount] of [
      ['Charge', 'Shoes', '1,000'],
      ['Refund', 'Shoes return', '400'],
    ] as const) {
      await user.click(screen.getByRole('link', { name: 'Add entry' }));
      await user.click(await screen.findByRole('button', { name: kind }));
      await user.type(screen.getByLabelText('Description'), description);
      await user.type(screen.getByLabelText('Amount'), amount);
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByText(description);
    }
    expect(screen.getByText('-₺400.00')).toBeInTheDocument();
    expect(screen.getAllByText('₺600.00').length).toBeGreaterThan(0);
  });

  it('offers archiving first and deletes only after typing the confirmation word', async () => {
    await createCardThroughForm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete Bonus?' });
    expect(within(dialog).getByRole('button', { name: 'Archive instead' })).toHaveFocus();
    const confirm = within(dialog).getByRole('button', { name: 'Delete permanently' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Type DELETE to delete permanently'), 'delete');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(await screen.findByText('You have not added any cards yet.')).toBeInTheDocument();
    expect(await cardsRepo.list({ includeArchived: true })).toEqual([]);
  });

  it('archives instead of deleting and keeps the card under Archived cards', async () => {
    await createCardThroughForm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Archive instead' }));

    expect(await screen.findByRole('heading', { name: 'Archived cards' })).toBeInTheDocument();
    expect(screen.getByText('You have not added any cards yet.')).toBeInTheDocument();
    expect(await cardsRepo.list({ includeArchived: true })).toHaveLength(1);
  });

  it('shows gauges on the detailed dashboard', async () => {
    window.localStorage.setItem('financier.detailedView', 'on');
    await cardsRepo.create({
      type: 'credit',
      name: 'World',
      bank: 'Yapı Kredi',
      last4: '',
      currency: 'TRY',
      limit: 1_000_000,
      statementDay: 5,
      dueDay: 15,
      color: '#38bdf8',
    });
    renderApp('/');
    expect(
      await screen.findByRole('meter', { name: 'World: 0% of limit used' }),
    ).toBeInTheDocument();
  });
});

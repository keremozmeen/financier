import { render } from '@testing-library/react';
import { BankMark } from './BankMark';

const card = { bank: '', name: '', color: '#17694a', type: 'credit' as const };

describe('BankMark (D21)', () => {
  it('shows a known bank’s initials on its brand color', () => {
    const { container } = render(<BankMark card={{ ...card, name: 'Axess' }} />);
    expect(container.textContent).toBe('AK');
    expect(container.firstElementChild).toHaveStyle({ backgroundColor: '#c8102e' });
  });

  it('shows an outline of the card type for a bank it does not know', () => {
    const credit = render(<BankMark card={{ ...card, name: 'Gold' }} />).container;
    expect(credit.textContent).toBe('');
    expect(credit.querySelector('svg.lucide-credit-card')).not.toBeNull();

    const debit = render(<BankMark card={{ ...card, name: 'Maaş', type: 'debit' }} />).container;
    expect(debit.querySelector('svg.lucide-wallet')).not.toBeNull();
    expect(debit.firstElementChild).toHaveStyle({ backgroundColor: '#17694a' });
  });
});

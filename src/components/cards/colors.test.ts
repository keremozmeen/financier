import { CARD_COLORS, cardColor, readableOnWhiteText } from './colors';

describe('card colors (D21)', () => {
  it('keeps the offered colors as they are: white text already reads on them', () => {
    for (const color of CARD_COLORS) expect(readableOnWhiteText(color)).toBe(color);
  });

  it('shows a color saved before D21 as its deep match', () => {
    expect(cardColor({ color: '#34D399' })).toBe('#17694a');
  });

  it('darkens any other light color until white text reads on it', () => {
    const darker = readableOnWhiteText('#60a5fa');
    expect(darker).not.toBe('#60a5fa');
    expect(parseInt(darker.slice(1, 3), 16)).toBeLessThan(0x60);
  });

  it('leaves text that is not a hex color alone', () => {
    expect(readableOnWhiteText('rebeccapurple')).toBe('rebeccapurple');
  });
});

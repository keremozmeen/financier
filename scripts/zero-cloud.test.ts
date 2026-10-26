import { checkIndexHtml, findRemoteCalls } from './zero-cloud.mjs';

const STRICT_CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self'" />`;

describe('findRemoteCalls', () => {
  it.each([
    `fetch('https://api.example.com/x')`,
    'fetch(`//cdn.example.com/a.js`)',
    `navigator.sendBeacon("https://t.example.com", data)`,
    `new WebSocket('wss://socket.example.com')`,
    `new EventSource("https://events.example.com")`,
    `xhr.open('POST', 'https://collect.example.com')`,
  ])('flags %s', (source) => {
    expect(findRemoteCalls(source)).toHaveLength(1);
  });

  it.each([
    `fetch('/financier/data.json')`,
    `fetch('./local.json')`,
    `fetch(url)`,
    `const docs = 'https://dexie.org'`,
  ])('allows %s', (source) => {
    expect(findRemoteCalls(source)).toEqual([]);
  });

  it('reports the line number', () => {
    expect(findRemoteCalls(`const a = 1;\n\nfetch('https://x.example.com')`)[0]?.line).toBe(3);
  });
});

describe('checkIndexHtml', () => {
  it('accepts a strict CSP with no remote URLs', () => {
    expect(checkIndexHtml(`<head>${STRICT_CSP}</head>`)).toEqual([]);
  });

  it('requires the CSP meta tag', () => {
    expect(checkIndexHtml('<head></head>')).toEqual(['Missing Content-Security-Policy meta tag.']);
  });

  it('rejects a widened connect-src', () => {
    const html = STRICT_CSP.replace(
      "connect-src 'self'",
      "connect-src 'self' https://api.example.com",
    );
    expect(checkIndexHtml(html).join()).toMatch(/connect-src/);
  });

  it('rejects remote fonts and scripts', () => {
    const html = `${STRICT_CSP}<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">`;
    expect(checkIndexHtml(html).join()).toMatch(/fonts\.googleapis\.com/);
  });
});

// Zero-Cloud rules (DECISIONS.md D8), kept free of I/O so they can be unit tested.

const NETWORK_CALL =
  /\b(fetch|navigator\.sendBeacon|new\s+(?:XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker))\s*\(\s*['"`]\s*((?:[a-z][a-z0-9+.-]*:)?\/\/[^'"`\s]*)/gi;
const XHR_OPEN =
  /\.open\s*\(\s*['"`][A-Z]+['"`]\s*,\s*['"`]\s*((?:[a-z][a-z0-9+.-]*:)?\/\/[^'"`\s]*)/gi;
const REMOTE_URL = /\b(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s'"`<>)]*/gi;
const ALLOWED_URLS = [/^http:\/\/www\.w3\.org\//];

/** Finds network calls in source code that target an absolute (cross-origin) URL. */
export function findRemoteCalls(source) {
  const hits = [];
  for (const pattern of [NETWORK_CALL, XHR_OPEN]) {
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      hits.push({ line, snippet: match[0].trim() });
    }
  }
  return hits;
}

/** Checks index.html for a strict CSP and for any remote asset URL. */
export function checkIndexHtml(html) {
  const problems = [];
  const csp = html.match(
    /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(["'])(.*?)\1/is,
  );
  if (!csp) {
    problems.push('Missing Content-Security-Policy meta tag.');
  } else {
    const policy = csp[2];
    for (const directive of ["default-src 'self'", "connect-src 'self'"]) {
      const name = directive.split(' ')[0];
      const actual = policy
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name} `));
      if (actual !== directive) {
        problems.push(`CSP must contain exactly "${directive}" (found "${actual ?? 'nothing'}").`);
      }
    }
  }
  for (const [url] of html.matchAll(REMOTE_URL)) {
    if (!ALLOWED_URLS.some((allowed) => allowed.test(url))) {
      problems.push(`Remote URL in index.html: ${url}`);
    }
  }
  return problems;
}

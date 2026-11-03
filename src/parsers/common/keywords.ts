// D16 keywords, as regex fragments over folded text (lower-case, Turkish accents removed).
// Each fragment must match whole words; suffixes are spelled out so that, for example,
// "faiz" matches "faizi" but not "faizsiz" (interest-free).

/** Balance and summary lines: never imported. */
export const SUMMARY_KEYWORDS = [
  'onceki (?:donem|ekstre)\\w*',
  'devreden (?:bakiye|borc)\\w*',
  'donem (?:borcu|toplami|ici harcama\\w*)',
  'toplam (?:borc|tutar|harcama|bakiye)\\w*',
  'asgari\\w*',
  'kalan (?:borc|bakiye)\\w*',
  'guncel (?:borc|bakiye)\\w*',
  'ekstre (?:borcu|tutari|bakiyesi)',
  'hesap kesim\\w*',
  'son odeme tarihi',
  'kullanilabilir limit\\w*',
  'previous balance',
  'opening balance',
  'closing balance',
  'statement balance',
  'new balance',
  'balance (?:brought )?forward',
  'minimum (?:payment|due|amount)\\w*',
  'total (?:due|amount|balance)',
  'payment due date',
];

/** Bill payments (on credit rows only): "ÖDEME", "HESAPTAN ÖDEME", "OTOMATİK ÖDEME"… */
export const PAYMENT_KEYWORDS = [
  'odeme\\w*',
  'tahsilat\\w*',
  'payments?',
  'payment received',
  'autopay',
  'auto pay',
  'thank you',
];

/** Refunds: raise the confidence of a credit row. */
export const REFUND_KEYWORDS = ['iade\\w*', 'refund\\w*', 'returns?', 'iptal\\w*', 'cancel\\w*'];

/** Interest and bank fees (on charge rows): imported as a charge marked as a fee. */
export const FEE_KEYWORDS = [
  'faiz(?:i|leri|ler)?',
  'gecikme\\w*',
  'bsmv',
  'kkdf',
  '(?:kart|uyelik|yillik|hizmet|islem|ekstre|aidat) ucret\\w*',
  'ucreti',
  'yillik uyelik\\w*',
  'kart aidat\\w*',
  'komisyon\\w*',
  'masraf\\w*',
  'interest',
  'late (?:fee|charge|payment fee)',
  'annual fee',
  'card fee',
  'finance charge',
  'fees?',
];

/** One regex that matches any of the fragments as whole words. */
export function keywordRegex(fragments: readonly string[]): RegExp {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${fragments.join('|')})(?=$|[^\\p{L}\\p{N}])`, 'u');
}

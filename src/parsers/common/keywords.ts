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

/**
 * Paying a credit card from a debit account: an outflow (positive) on the debit card,
 * already counted on the credit card it paid.
 */
export const CARD_PAYMENT_KEYWORDS = [
  'kredi karti\\w* (?:borcu? )?odeme\\w*',
  'kart borcu odeme\\w*',
  'kk odeme\\w*',
  'credit card payment\\w*',
  'card payment',
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

// ---- Bank account statements, hesap hareketleri (D17) ----
// Matched on "İşlem Türü" first, then "İşlem", then the description. Add a bank's new
// label as one line in the matching list.

/** Card purchases from the account: POS, internet, contactless. */
export const ACCOUNT_PURCHASE_KEYWORDS = [
  'pos\\w*',
  'sanal pos',
  'internet (?:alisveris|harcama)\\w*',
  'e ?ticaret',
  'temassiz\\w*',
  'kartli (?:islem|harcama)\\w*',
  'banka karti harcama\\w*',
  'alisveris\\w*',
  'harcama\\w*',
  'card purchase',
  'contactless',
  'purchase',
];

/** Incoming money: salary, incoming EFT/Havale/FAST. */
export const ACCOUNT_INCOME_KEYWORDS = [
  'maas\\w*',
  'gelen (?:eft|havale|fast|transfer)\\w*',
  '(?:eft|havale|fast) (?:gelen|alindi)',
  'ucret odemesi',
  'kira geliri',
  'mevduat faiz\\w*',
  'salary',
  'payroll',
  'incoming (?:transfer|eft)',
];

/** Outgoing transfers and cash withdrawals: skipped unless the user counts them as spending. */
export const ACCOUNT_TRANSFER_KEYWORDS = [
  'giden (?:eft|havale|fast|transfer)\\w*',
  'eft',
  'havale\\w*',
  'fast',
  'virman\\w*',
  'para transferi',
  'hesaba transfer',
  'atm\\w*',
  'bankamatik',
  'nakit cek\\w*',
  'para cek\\w*',
  'outgoing transfer',
  'cash withdrawal',
  'transfer',
  'withdrawal',
];

/** Automatic bill payments: utilities, internet, phone (fatura, otomatik ödeme talimatı). */
export const ACCOUNT_BILL_KEYWORDS = [
  'fatura\\w*',
  'otomatik odeme talimat\\w*',
  'talimatli odeme\\w*',
  'elektrik\\w*',
  'dogal ?gaz\\w*',
  'su (?:faturasi|bedeli)',
  'enerjisa',
  'ck enerji',
  'igdas',
  'baskentgaz',
  'iski',
  'aski',
  'turkcell',
  'vodafone',
  'turk telekom\\w*',
  'ttnet',
  'superonline',
  'utility',
  'bill payment',
];

// Synthetic statements shaped like Turkish bank exports. No real data (CLAUDE.md).

/** Semicolon-separated, Turkish numbers, account details above the header. */
export const CREDIT_CARD_CSV = `Kart Numarası;5555 **** **** 1234
Hesap Kesim Tarihi;10.10.2026

İşlem Tarihi;Açıklama;Taksit;Tutar (TL)
12.09.2026;ÖNCEKİ DÖNEM BAKİYESİ;;4.250,00
15.09.2026;MIGROS KADIKOY;;1.234,56
16.09.2026;HESAPTAN ÖDEME;;-4.250,00
18.09.2026;TEKNOSA ISTANBUL TAKSİT 3/6;3/6;500,00
20.09.2026;ZARA IADE;;-299,90
25.09.2026;NETFLIX.COM;;229,99
10.10.2026;BSMV;;12,40
10.10.2026;DÖNEM BORCU;;6.927,05
`;

/** Comma-separated, English numbers, separate debit and credit columns. */
export const DEBIT_CARD_CSV = `Date,Description,Debit,Credit
2026-09-03,STARBUCKS,95.00,
2026-09-03,STARBUCKS,95.00,
2026-09-05,SALARY REFUND,,1500.00
2026-09-07,KREDI KARTI ODEMESI,4250.00,
`;

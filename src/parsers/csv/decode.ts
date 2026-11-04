/**
 * Decodes an exported file. Banks export UTF-8 (often with a BOM) or the Turkish
 * Windows code page 1254, so UTF-8 is tried strictly first.
 */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1254').decode(bytes);
  }
}

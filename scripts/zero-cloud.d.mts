export interface RemoteCall {
  line: number;
  snippet: string;
}

export function findRemoteCalls(source: string): RemoteCall[];
export function checkIndexHtml(html: string): string[];

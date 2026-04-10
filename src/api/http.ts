import { getStoredToken } from '../features/auth/authStorage';

export class HttpError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function getApiBaseUrl(): string {
  const base = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL;
  return typeof base === 'string' ? base.replace(/\/+$/, '') : '';
}

export async function apiRequest<TResponse extends JsonValue>(
  input: string,
  init?: RequestInit & { json?: JsonValue }
): Promise<TResponse> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.json !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${getApiBaseUrl()}${input}`, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? ((await response.json()) as unknown) : await response.text();

  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'message' in body ? String((body as { message?: unknown }).message) : response.statusText;
    throw new HttpError(message || 'Request failed', response.status, body);
  }

  return body as TResponse;
}

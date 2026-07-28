import { serviceConfig } from '../../config/services';

type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider | null = null;

/** Supplies Clerk's current session token without coupling the service layer to React hooks. */
export function setApiTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider;
}

/** HTTP failure carrying the status and backend response for UI-level error handling. */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetches JSON from the REST API and throws a helpful error for failed responses.
 * The generic type lets callers declare the data shape they expect back.
 */
export async function apiFetch<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/** Sends a JSON request through the common backend error handling path. */
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  if (serviceConfig.apiAuthEnabled) {
    const token = await tokenProvider?.();
    if (!token) throw new ApiError(401, 'No Clerk session token is available for the API request.');
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${serviceConfig.apiBaseUrl}${path}`, { ...options, headers });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    const details = contentType.includes('application/json') ? await response.json() : await response.text();
    const message = typeof details === 'object' && details && 'detail' in details
      ? String(details.detail)
      : `API request failed with status ${response.status}.`;
    throw new ApiError(response.status, message, details);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

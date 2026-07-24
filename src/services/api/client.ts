/** Replace this placeholder with the production REST API base URL. */
const API_BASE_URL = 'https://api.example.com';

/**
 * Fetches JSON from the REST API and throws a helpful error for failed responses.
 * The generic type lets callers declare the data shape they expect back.
 */
export async function apiFetch<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/** Sends a JSON request through the common backend error handling path. */
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

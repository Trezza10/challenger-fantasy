/** Replace this placeholder with the production REST API base URL. */
const API_BASE_URL = 'https://api.example.com';

/**
 * Fetches JSON from the REST API and throws a helpful error for failed responses.
 * The generic type lets callers declare the data shape they expect back.
 */
export async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

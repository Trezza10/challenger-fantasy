/** Runtime service settings exposed through Expo's public environment variables. */
export const serviceConfig = {
  apiAuthEnabled: process.env.EXPO_PUBLIC_API_AUTH_ENABLED === 'true',
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5088').replace(/\/+$/, ''),
  useMockServices: process.env.EXPO_PUBLIC_USE_MOCK_SERVICES === 'true',
};

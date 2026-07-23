/**
 * Creates a WebSocket reserved for future live league-score updates.
 * The caller is responsible for subscribing to events and closing the socket.
 */
export function createLeagueSocket(leagueId: string) {
  // Connect this to the live scoring endpoint when it is available.
  return new WebSocket(`wss://api.example.com/leagues/${leagueId}`);
}

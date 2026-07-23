/** Converts a numeric score into the one-decimal-place display used in the app. */
export function formatPoints(points: number) {
  return points.toFixed(1);
}

/** Returns the first character of a name for the lightweight avatar fallback. */
export function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

/** Generates a stable placeholder profile image URL from a player's name. */
export function getAvatarUrl(name: string) {
  return `https://api.dicebear.com/10.x/adventurer-neutral/png?seed=${encodeURIComponent(name)}`;
}

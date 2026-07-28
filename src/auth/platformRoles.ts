/** Platform staff roles are separate from league commissioner/member roles. */
export type PlatformRole = 'admin' | 'game_data_manager';

type ClaimsLike = Record<string, unknown> | null | undefined;

/** Reads role claims defensively from both Clerk session claims and public metadata. */
export function getPlatformRoles(publicMetadata: ClaimsLike, sessionClaims: ClaimsLike): Set<PlatformRole> {
  const rawRoles = new Set<string>();
  collectRoles(rawRoles, publicMetadata);
  collectRoles(rawRoles, sessionClaims);

  const roles = new Set<PlatformRole>();
  rawRoles.forEach((rawRole) => {
    const role = rawRole.trim().toLowerCase().replaceAll('-', '_');
    if (role === 'admin' || role === 'platform_admin' || role === 'admin_game_data_manager') roles.add('admin');
    if (role === 'game_data_manager' || role === 'admin_game_data_manager') roles.add('game_data_manager');
  });
  return roles;
}

function collectRoles(target: Set<string>, source: ClaimsLike) {
  if (!source) return;
  addValue(target, source.role);
  addValue(target, source.roles);
  addValue(target, source.platform_role);
  addValue(target, source.platform_roles);
  addValue(target, source.platformRole);
  addValue(target, source.platformRoles);

  // Supports token templates that expose the user's metadata as one nested claim.
  const metadata = source.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata))
    collectRoles(target, metadata as Record<string, unknown>);
}

function addValue(target: Set<string>, value: unknown) {
  if (typeof value === 'string') target.add(value);
  if (Array.isArray(value))
    value.filter((item): item is string => typeof item === 'string').forEach((item) => target.add(item));
}

/** Auth endpoints have one public prefix; legacy /auth routes are not mounted. */
export function normalizeAuthPath(pathname: string): string {
  return pathname;
}

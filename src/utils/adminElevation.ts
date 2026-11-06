/** Only a confirmed pre-action elevation denial may replay a mutation once. */
export async function runWithAdminElevation(
  action: () => Promise<Response>,
  isElevated: () => boolean,
  requestElevation: () => Promise<boolean>,
  isCurrent: () => boolean,
): Promise<Response | null> {
  let verified = false;
  if (!isElevated()) {
    if (!await requestElevation() || !isCurrent()) return null;
    verified = true;
  }
  if (!isCurrent()) return null;
  const response = await action();
  if (!isCurrent()) return null;
  if (!verified && response.status === 403) {
    const denial = await response.clone().json().catch(() => ({}));
    if (denial.adminElevationRequired === true) {
      if (!await requestElevation() || !isCurrent()) return null;
      const retry = await action();
      return isCurrent() ? retry : null;
    }
  }
  return response;
}

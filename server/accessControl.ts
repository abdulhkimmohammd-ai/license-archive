export type AppRole = "user" | "archivist" | "admin";
export type AccountAccessStatus = "pending" | "approved" | "blocked";

export function isAccountApproved(status: AccountAccessStatus | string | null | undefined) {
  return status === "approved";
}

export function canManageLicenses(role: AppRole | string) {
  return role === "admin" || role === "archivist";
}

export function isSystemAdmin(role: AppRole | string) {
  return role === "admin";
}

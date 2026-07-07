// src/lib/session.ts
export async function getRequiredUserId() {
  // Local-first development: always return a local user ID
  // This will be replaced with proper auth later.
  return 'local-dev-user';
}
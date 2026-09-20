'use client';

export async function verifySalarAdmin() {
  return;
}

export function adminSignInError(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Admin session expired. Please log in again.';
}

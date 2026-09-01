/**
 * Shortest password the app will send to the server.
 *
 * Shared by every form that picks one — signup, reset, change — so a password
 * accepted on one screen is accepted on the others. It used to be spelled
 * `password.length > 6` inline in components/Auth/AuthContent.tsx, which is the
 * same number; the constant exists so the three cannot drift.
 *
 * The real gate is Django's AUTH_PASSWORD_VALIDATORS on the backend — this only
 * keeps the obviously-too-short from costing a round trip.
 */
export const MIN_PASSWORD_LENGTH = 7;

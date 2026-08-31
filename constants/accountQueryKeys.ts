/**
 * React Query keys for the account screens (e-mail addresses, linked
 * providers).
 *
 * A separate module with no imports, for the same reason as
 * `deepLinkScreens.ts`: `ConfirmEmailScreen` has to invalidate the e-mail list
 * after a second address is confirmed, and importing the key from
 * `EmailsScreen` would drag that whole screen — its layout, its fetches, the
 * bottom sheet — into every module graph that touches confirmation.
 */
export const EMAILS_QUERY_KEY = ["myEmails"];
export const SOCIAL_ACCOUNTS_QUERY_KEY = ["mySocialAccounts"];

/**
 * `has_usable_password` is read on two screens and changes the moment a
 * password is set, so both share one key and neither caches it.
 */
export const PASSWORD_PROFILE_QUERY_KEY = ["profileForPassword"];

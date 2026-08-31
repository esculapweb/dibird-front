import {
  getAnalytics,
  logEvent,
  setUserId,
  setUserProperties,
} from "@react-native-firebase/analytics";

import { logError } from "./errors";

/** How the user signs in / signs up. */
export type AuthMethod = "email" | "google" | "apple";

/** What the guest tried to do before hitting the signup sheet. */
export type GatedAction = "add_observation";

/** What exactly is being shared. */
export type ShareType =
  | "species"
  | "taxon_group"
  | "taxon_list"
  | "territory"
  | "territory_list"
  | "territory_compare"
  | "observation"
  | "diary"
  | "community_observation"
  | "rating"
  | "rating_compare"
  | "stat"
  | "user_stat"
  | "app";

/**
 * How the species page was reached. Fifteen-odd places lead there — the
 * catalogue, three country views, both stat screens, the observation screens,
 * the dashboard cards, a push and a shared link — and without this parameter
 * `species_viewed` says only that the page is popular, not which road carries
 * the traffic. Every caller passes it explicitly (the route param on
 * `SpeciesDetail`); `unknown` is the fallback for a route that predates the
 * parameter, e.g. one restored from a persisted navigation state.
 */
export type SpeciesEntryPoint =
  | "catalog"
  | "taxon_group"
  | "territory_species"
  | "territory_checklist"
  | "territory_compare"
  | "species_related"
  | "species_paging"
  | "observation"
  | "observation_list"
  | "observation_editor"
  | "community_observation"
  | "community_list"
  | "diary"
  | "stat"
  | "user_stat"
  | "rating_compare"
  | "bird_of_the_day"
  | "rare_nearby"
  | "new_species"
  | "notification"
  | "deep_link"
  | "unknown";

/** Where the alerts were enabled from — the entry point, not the fact of enabling. */
export type AlertsEnabledSource = "settings" | "main_card";

/** Where the donation page was opened from. */
export type DonateSource = "settings";

/** What a complaint is about — mirrors ReportTarget in types.ts. */
export type ReportTargetKind = "observation" | "photo" | "profile";

/**
 * The onboarding steps. A literal union rather than `number`: in Firebase the
 * parameter turns into a string anyway, and a "step 5" that does not exist in the
 * flow would only be discovered in a report a day later.
 */
export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

/**
 * The event names and their parameters. A union is needed because Firebase
 * accepts any string: a typo in a name does not fail, it quietly creates a second
 * event and is discovered a day later in the console, when the data is already
 * lost.
 *
 * `login`, `sign_up` and `screen_view` are standard Firebase events, they have
 * ready-made reports and funnels. Their names and the `method` parameter must not
 * be changed.
 */
type EventParams = {
  login: { method: AuthMethod };
  sign_up: { method: AuthMethod };
  screen_view: { screen_name: string; screen_class: string };
  /** The first screen of the app for a signed-out user — the top of the funnel. */
  welcome_viewed: undefined;
  /** A tap on a sign-in button. The difference from `login` = a drop-off in the provider. */
  auth_started: { method: AuthMethod };
  /** The guest went to the catalogue instead of signing up. */
  guest_browse_started: { source: "welcome" | "drawer" | "deep_link" };
  /** The guest was shown the "create an account" sheet. */
  auth_wall_shown: { action: GatedAction };
  /**
   * An external link opened in the app. It answers the question "does sharing
   * bring traffic" directly — `species_viewed`'s own `deep_link` source counts
   * the same arrivals from the receiving end, and the two are expected to
   * agree.
   */
  deep_link_opened: { screen: string; authed: "yes" | "no" };
  /**
   * A view of an onboarding step rather than a tap on "Next": a drop-off is a
   * step that was seen and abandoned, and it has to be counted by views.
   */
  onboarding_step: { step: OnboardingStep };
  onboarding_completed: undefined;
  /**
   * Which step they left on. Without it the `onboarding_step`/
   * `onboarding_completed` pair only answers "how many made it", while the
   * question about a five-step flow is "where exactly are we losing them".
   */
  onboarding_skipped: { step: OnboardingStep };
  /**
   * The coordinates reached the alert settings straight from the onboarding.
   * Separate from `location_permission`: that event is about the answer in the
   * system dialog, this one is about the "nearby" scope ending up configured for
   * the person (the permission could have been granted earlier, in a previous
   * installation).
   */
  onboarding_location_set: undefined;
  /**
   * The country was picked during onboarding. Separate from the `home_territory`
   * user property: the property shows the slice "how many people have a country
   * right now", the event shows whether a particular person passed this very step
   * and when.
   */
  onboarding_country_set: undefined;
  /**
   * The key page of the catalogue. `source` is the road that led here — see
   * SpeciesEntryPoint for why it is carried on the route rather than guessed
   * on the screen.
   */
  species_viewed: { source: SpeciesEntryPoint };
  territory_viewed: undefined;
  share_tapped: { type: ShareType };
  /**
   * A tap on "Support the project". The source is here for the same reason as in
   * `alerts_enabled`: the answer to "is the donation link worth its place"
   * depends on where it stands, and one number over all entry points hides that.
   */
  donate_tapped: { source: DonateSource };
  observation_created: undefined;
  /** The key activation point; sent once per installation. */
  first_observation_created: undefined;
  /**
   * The rare-bird alerts were turned on. The main selling point and the entry to
   * the retention loops, so the event carries the entry point: the card on the
   * main screen and the settings screen answer different questions — "did anyone
   * notice the hint" and "did anyone reach the settings on their own".
   */
  alerts_enabled: { source: AlertsEnabledSource };
  /**
   * The answer to the system dialog. Sent only when it was really shown: an event
   * on an already known status would count every launch as a new answer.
   */
  push_permission: { granted: "yes" | "no" };
  location_permission: { granted: "yes" | "no" };
  /** The file was picked and sent. The difference from `import_finished` = a drop-off in the parsing. */
  import_started: undefined;
  /**
   * `unmatched` — how many Latin names were not found in the taxonomy. This is a
   * metric of the mapping quality rather than of behaviour: a growing number means
   * it is the taxonomy that needs catching up, not the funnel.
   */
  import_finished: { imported: number; unmatched: number };
  /**
   * The reason sheet was opened, not the complaint that followed: the sheet can
   * be dismissed, and the gap between the two is what says whether people are
   * reaching for the button by mistake. `target` is what was being reported,
   * because a photo and a person are different problems.
   */
  report_opened: { target: ReportTargetKind };
};

export type AnalyticsEventName = keyof EventParams;

/**
 * The user properties every report is sliced by. Firebase stores them as strings,
 * so numbers are bucketed in advance — "how many species exactly" can be asked in
 * no report, while "0 / 1-10 / 11-100 / 100+" answers the question "did they reach
 * the value".
 */
export type UserProps = {
  guest_or_registered: "guest" | "registered";
  ui_language: string;
  /** The country id from the profile or "none" — whether the user picked one at all. */
  home_territory: string;
  /**
   * Three values rather than two: "never asked" is not the same as "refused".
   * Collapse them into "no" and the refusal rate in any report will be inflated by
   * exactly those the dialog simply never reached — and after moving the request
   * into context those became the majority.
   */
  has_push_token: "yes" | "no" | "not_asked";
  lifelist_bucket: "0" | "1-10" | "11-100" | "100+";
};

export const lifelistBucket = (count: number): UserProps["lifelist_bucket"] => {
  if (count <= 0) return "0";
  if (count <= 10) return "1-10";
  if (count <= 100) return "11-100";
  return "100+";
};

// Analytics has no right to break the scenario it is embedded in: logEvent
// returns a promise, and an unhandled reject in the middle of a login would take
// the sign-in down. So everything is swallowed here and goes to the shared
// logError.
const swallow = (tag: string) => (e: unknown) => logError(e, tag);

// Firebase types logEvent with a set of overloads: the reserved names (`login`,
// `sign_up`, `screen_view`) have signatures of their own, while
// `CustomEventName<K>` forbids them — a generic parameter fits none of them. Our
// union is stricter than any of them, so the name is passed as a string here, in
// a single place, rather than in every calling screen.
const send = logEvent as (
  analytics: ReturnType<typeof getAnalytics>,
  name: string,
  params?: Record<string, unknown>,
) => Promise<void>;

/**
 * The single point where events are sent. An event without parameters does not
 * accept a second argument, an event with parameters requires it.
 */
export const track = <K extends AnalyticsEventName>(
  name: K,
  ...[params]: EventParams[K] extends undefined ? [] : [EventParams[K]]
): void => {
  try {
    send(getAnalytics(), name, params ?? undefined).catch(
      swallow(`analytics:${name}`),
    );
  } catch (e) {
    logError(e, `analytics:${name}`);
  }
};

export const setUserProps = (props: Partial<UserProps>): void => {
  try {
    setUserProperties(getAnalytics(), props).catch(
      swallow("analytics:userProps"),
    );
  } catch (e) {
    logError(e, "analytics:userProps");
  }
};

/** `null` is a sign-out: further events must not stick to the previous id. */
export const setAnalyticsUserId = (userId: string | null): void => {
  try {
    setUserId(getAnalytics(), userId).catch(swallow("analytics:userId"));
  } catch (e) {
    logError(e, "analytics:userId");
  }
};

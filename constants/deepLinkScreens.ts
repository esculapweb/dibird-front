/**
 * The AppStack screens a shared https link can point at — the `/my` and
 * `/users` half of `linking.ts`, i.e. everything a guest cannot be shown right
 * away.
 *
 * Such a link bounces a guest to Welcome (the guest stack has no these
 * screens), and `services/authReturn` brings them back here once they have an
 * account — otherwise the link died at the bounce and the person landed on the
 * dashboard instead of the diary they were sent.
 *
 * A separate module with no imports, for the same reason as
 * `catalogScreens.ts`: the consumer needs the names, not the navigation config
 * with all its screens attached. That the list has not drifted apart from
 * `linking.ts` is watched by `__tests__/deepLinkScreens.test.ts`.
 *
 * `Main` is not here: the return puts the target on top of Main anyway, and
 * `Privacy`/`Terms` are not here because they open for a guest as they are.
 */
export const SHARED_LINK_SCREEN_NAMES = [
  "Profile",
  "Settings",
  "Stat",
  "Checklist",
  "Places",
  "PlaceDetail",
  "Observations",
  "ObservationDetail",
  "CommunityDetail",
  "Diaries",
  "DiaryDetail",
  "Rating",
  "RatingsCompare",
  "UserStat",
] as const;

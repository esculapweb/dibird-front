import { getCachedCountries } from "./referenceRepository";
import { Profile } from "../../types";

export const territoryDataFor = (territory: number | null | undefined) => {
  if (!territory) return { code: "", id: 0, name: "", segment: "" };
  const found = getCachedCountries("name").find((c) => c.value === territory);
  return { code: found?.code ?? "", id: territory, name: found?.label ?? "", segment: "" };
};

export const ownerFromProfile = (profile: Profile | null | undefined) => ({
  avatar: profile?.avatar ?? "",
  first_name: profile?.user_data?.first_name ?? "",
  last_name: profile?.user_data?.last_name ?? "",
  username: profile?.user_data?.username ?? "",
  private: profile?.private ?? false,
  id: profile?.user ?? 0,
  timezone_id: profile?.timezone ?? "",
});

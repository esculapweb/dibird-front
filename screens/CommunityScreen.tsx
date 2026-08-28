import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import { fetchCommunityObservations } from "../util/fetches";
import { useLocation } from "../store/location-context";
import { useLocationUnavailable } from "../hooks/useLocationUnavailable";
import CommunityCard from "../components/Community/CommunityCard";
import Tabs from "../components/ui/Tabs";
import { AppStackRouteProp, ObservationItem } from "../types";

type CommunityTab = "rare" | "all";

const CommunityScreen = () => {
  const { t } = useTranslation();
  const route = useRoute<AppStackRouteProp<"Community">>();
  const { locationCoords, locationAvailable } = useLocation();
  const highlightObsIds = route.params?.highlightObsIds;

  const handleLocationUnavailable = useLocationUnavailable();

  // The feed carries both the eBird rarities and every public dibird
  // observation with a place, so "rare" has to be asked for explicitly —
  // the server decides it by the country checklist (api/rarity.py).
  //
  // Deliberately not part of the screen's filters: those are synced to the
  // URL and to share links, and the tab is a way of looking at the list, not
  // a filter the user set.
  const [tab, setTab] = useState<CommunityTab>("rare");

  const tabOptions = useMemo(
    () => [
      {
        value: "rare" as const,
        icon: "star" as const,
        iconInactive: "star-outline" as const,
        labelKey: t("community_tab_rare"),
      },
      {
        value: "all" as const,
        icon: "apps" as const,
        iconInactive: "apps-outline" as const,
        labelKey: t("all"),
      },
    ],
    [t],
  );

  const noItems = {
    icon: "binoculars-outline" as const,
    message: t("no_observations_yet"),
    actions: [],
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: ObservationItem;
    index: number;
  }) => <CommunityCard item={item} index={index} highlightObsIds={highlightObsIds} />;

  return (
    <ListScreen
      route={route}
      fetchFunction={fetchCommunityObservations}
      errorTitle={t("observations_unavailable")}
      renderItem={renderItem}
      noItems={noItems}
      locationCoords={locationCoords}
      locationAvailable={locationAvailable}
      onLocationUnavailable={handleLocationUnavailable}
      title={t("community")}
      allowedFilters={["territory", "date", "species", "source", "radius"]}
      extraFilters={tab === "rare" ? { rare: true } : null}
      queryKeyExtra={tab}
      bottomEl={
        <Tabs
          tabOptions={tabOptions}
          tabsMode={tab}
          setTabsMode={(val) => setTab(val as CommunityTab)}
        />
      }
    />
  );
};

export default CommunityScreen;

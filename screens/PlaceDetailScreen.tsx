import { useLayoutEffect, useCallback, useMemo, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";

import { useTheme, ThemeColors } from "../store/theme-context";
import { isoToFlagEmoji, formatDate, formatDateTime } from "../util/helpers";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import IconsHeader from "../components/ui/IconsHeader";
import Layout from "../components/ui/Layout";
import StatCard from "../components/ui/StatCard";
import FilterChips from "../components/Filters/FilterChips";
import FailedEditBanner from "../components/Profile/FailedEditBanner";

import {
  usePlaceItem,
  useUpdatePlace,
  useDeletePlace,
} from "../hooks/Place/useOfflinePlace";
import * as placeRepository from "../hooks/repositories/placeRepository";
import { runPlaceSync } from "../services/sync/placeSync";
import { useFilters } from "../store/filters-context";
import { AppStackNavigationProp, AppStackRouteProp } from "../types";
import { BottomSheet } from "../services/bottomSheet";
import { buildDateParams } from "../util/helpers";
import { useApiError } from "../hooks/useApiError";
import MapL from "../components/Map/MapL";

const H_PAD = 12;

const PlaceDetailScreen = () => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"PlaceDetail">>();
  const { placeId, initialPlace } = route.params;
  const type = "Place";

  // Same defensive retry as PlacesScreen/DiaryDetailScreen: NetInfo's
  // reconnect event can be missed/racy, so opportunistically retry the queue
  // whenever this screen is focused rather than relying solely on that
  // background listener.
  useFocusEffect(
    useCallback(() => {
      runPlaceSync();
    }, []),
  );

  const updateMutation = useUpdatePlace(placeId);
  const deleteMutation = useDeletePlace();
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);
  const { showErrorToast } = useApiError();
  const { date, setDate } = useFilters();

  const queryClient = useQueryClient();

  const dateParams = useMemo(() => buildDateParams(date ?? undefined), [date]);

  const {
    data: place,
    isLoading,
    isError,
    error,
    refetch,
  } = usePlaceItem(
    placeId,
    Object.keys(dateParams).length ? dateParams : undefined,
    initialPlace,
  );

  // An offline create resolves to a real server id in the background; once
  // that happens, "graduate" this screen from the temp id to the real one so
  // any further edit/delete call targets the right id.
  useEffect(() => {
    if (place && place.id !== placeId) {
      navigation.setParams({ placeId: place.id });
    }
  }, [place, placeId, navigation]);

  const failedMutation = place?._syncError
    ? placeRepository.getFailedMutationFor(placeId)
    : null;

  const handleRetrySync = useCallback(async () => {
    if (!failedMutation) return;
    placeRepository.retryMutation(failedMutation.id, placeId);
    await runPlaceSync();
    await refetch();
  }, [failedMutation, placeId, refetch]);

  const handleDiscardSync = useCallback(() => {
    if (!failedMutation) return;
    placeRepository.discardMutation(failedMutation.id, placeId);
    refetch();
  }, [failedMutation, placeId, refetch]);

  const handleFavourite = useCallback(() => {
    if (!place) return;
    updateMutation.mutate(
      { favourite: !place.favourite },
      {
        onError: (e) => showErrorToast(e, `PlaceDetailScreen:toggleFavourite:${placeId}`),
      },
    );
  }, [place, updateMutation.mutate]);

  const headerRightBeginning = useMemo(
    () => [
      {
        condition: !!place,
        onPress: () => navigation.navigate("PlaceEditor", { place }),
        icon: "create-outline" as const,
        disabled: !place || updateMutation.isPending,
      },
      {
        condition: !!place,
        onPress: handleFavourite,
        icon: place?.favourite ? ("star" as const) : ("star-outline" as const),
        tintColor: Colors.yellow,
        disabled: updateMutation.isPending || !place,
        loading: updateMutation.isPending,
      },
    ],
    [
      place,
      handleFavourite,
      updateMutation.isPending,
      navigation,
      Colors.main100,
    ],
  );

  const handleDelete = useCallback(() => {
    if (!place) return;
    BottomSheet.show({
      title: t("delete_title"),
      description: t("delete_place_message"),
      confirmText: t("delete"),
      cancelText: t("cancel"),
      danger: true,
      onConfirm: () =>
        deleteMutation.mutate(placeId, {
          onSuccess: () => navigation.goBack(),
          onError: (e) => {
            showErrorToast(e, `PlaceDetailScreen:deletePlace:${placeId}`);
          },
        }),
    });
  }, [place, placeId, deleteMutation, navigation]);

  const filtersOverride = useMemo(() => {
    if (!place) return null;
    return {
      territory: place.territory,
      place: placeId,
      date: date ?? null,
    };
  }, [place, placeId, date]);

  const handleObservationsPress = useCallback(() => {
    if (place && filtersOverride)
      navigation.push("Observations", {
        filtersOverride,
      });
  }, [place, filtersOverride, navigation]);

  const handleSpeciesPress = useCallback(() => {
    if (place && filtersOverride)
      navigation.push("Stat", {
        filtersOverride,
        seenMode: "seen",
      });
  }, [place, filtersOverride, navigation]);

  const handleDiariesPress = useCallback(() => {
    if (place && filtersOverride)
      navigation.push("Diaries", {
        filtersOverride,
      });
  }, [place, filtersOverride, navigation]);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: [type, placeId], exact: false });
  }, [date]);

  useLayoutEffect(() => {
    if (!place) return;

    navigation.setOptions({
      headerRight: () => (
        <IconsHeader headerRightBeginning={headerRightBeginning} />
      ),
    });
  }, [navigation, headerRightBeginning, place]);

  if (isError && !place) {
    return (
      <ErrorOverlay
        title={t("places_unavailable")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );
  }

  if (isLoading || !place) {
    return <LoadingOverlay />;
  }

  const [lng, lat] = place.location.coordinates;

  const bottomEl = (
    <FlatButtonBottom
      textColor={Colors.error600}
      onPress={handleDelete}
      icon="trash-outline"
      loading={deleteMutation.isPending}
    >
      {t("delete_place")}
    </FlatButtonBottom>
  );

  return (
    <Layout withScroll={true} style={{ paddingBottom: 40 }} bottom={bottomEl}>
      {place._syncError && failedMutation && (
        <View style={{ paddingHorizontal: H_PAD, paddingTop: H_PAD }}>
          <FailedEditBanner
            failedEdit={{ message: place._syncError, createdAt: Date.now() }}
            onRetry={handleRetrySync}
            onDiscard={handleDiscardSync}
          />
        </View>
      )}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{place.name}</Text>
          <Text style={styles.subtitle}>
            {isoToFlagEmoji(place.territory_data.code)}{" "}
            {place.territory_data.name}
          </Text>
        </View>
      </View>

      <MapL currentCoords={[lng, lat]} mapHeight={410} showCoords={true} />
      <FilterChips
        filters={{ date: date ?? null }}
        onRemove={() => setDate(null)}
        allowed={["date"]}
        hints={{}}
      />
      <View style={styles.statsRow}>

        <StatCard
          value={place.species_count}
          label={t("species")}
          onPress={handleSpeciesPress}
        />
        <StatCard
          value={place.observation_count}
          label={t("observations")}
          onPress={handleObservationsPress}
        />
        <StatCard
          value={place.diary_count}
          label={t("diaries")}
          onPress={handleDiariesPress}
        />
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaText}>
          {t("created")}: {formatDateTime(place.created_at)}
        </Text>
        {formatDate(place.created_at) !== formatDate(place.updated_at) && (
          <Text style={styles.metaText}>
            {t("updated")}: {formatDateTime(place.updated_at)}
          </Text>
        )}
      </View>
    </Layout>
  );
};

export default PlaceDetailScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: H_PAD,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: Colors.textMain,
    },
    subtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginTop: 2,
      lineHeight: 28,
    },

    meta: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      padding: H_PAD,
    },
    metaText: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginBottom: 2,
    },

    statsRow: {
      flexDirection: "row",
      gap: H_PAD,
      padding: H_PAD,
    },
  });

import { useLayoutEffect, useCallback, useMemo, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";

import { useTheme, ThemeColors } from "../store/theme-context";
import { isoToFlagEmoji, formatDate, formatDateTime } from "../util/helpers";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import Map from "../components/Map/Map";
import IconsHeader from "../components/ui/IconsHeader";
import Layout from "../components/ui/Layout";
import StatCard from "../components/ui/StatCard";
import FilterChips from "../components/Filters/FilterChips";

import { useItem, useUpdateItem, useDeleteItem } from "../hooks/useItem";
import { showError } from "../services/api";
import { useFilters } from "../store/filters-context";
import { AppStackNavigationProp, AppStackRouteProp } from "../types";
import { BottomSheet } from "../services/bottomSheet";
import { buildDateParams } from "../util/helpers";

const H_PAD = 12;

const PlaceDetailScreen = () => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"PlaceDetail">>();
  const { placeId } = route.params;
  const type = "Place";

  const updateMutation = useUpdateItem(placeId, type);
  const deleteMutation = useDeleteItem(type);
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);
  const { date, setDate } = useFilters();

  const queryClient = useQueryClient();

  const dateParams = useMemo(() => buildDateParams(date ?? undefined), [date]);

  const {
    data: place,
    isLoading,
    isError,
    error,
    refetch,
  } = useItem(
    placeId,
    type,
    Object.keys(dateParams).length ? dateParams : undefined,
  );

  const handleFavourite = useCallback(() => {
    if (!place) return;
    updateMutation.mutate(
      { favourite: !place.favourite },
      {
        onError: (e) => showError(e),
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
            showError(e);
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

  if (isError) {
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
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{place.name}</Text>
          <Text style={styles.subtitle}>
            {isoToFlagEmoji(place.territory_data.code)}{" "}
            {place.territory_data.name}
          </Text>
        </View>
      </View>

      <Map currentCoords={[lng, lat]} mapHeight={410} showCoords={true} />
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

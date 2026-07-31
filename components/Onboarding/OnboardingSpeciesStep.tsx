import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import DropdownInput from "../ui/DropdownInput";
import SpeciesOptionRow from "../ui/SpeciesOptionRow";
import { BirdSVG } from "../ui/Svgs";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { useLanguage } from "../../store/language-context";
import { useFilters } from "../../store/filters-context";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { fetchCommunityObservations, fetchSpecies } from "../../util/fetches";
import { StaleTime } from "../../constants/staleTime";
import { Config } from "../../constants/config";
import {
  ObservationItem,
  PaginatedResponse,
  SpeciesDropdownItem,
} from "../../types";

const CARD_IMAGE = 56;
/** How many unique species the tiles show. */
const MAX_CARDS = 9;
/**
 * Below this threshold the tiles are not assembled and the step goes straight to
 * the search: two cards in place of the promised "pick from the list" look like
 * a breakage rather than a hint. That happens in countries where the app has no
 * community yet.
 */
const MIN_CARDS = 3;
/** Observations per request: they have to be taken with a margin — species repeat. */
const PER_PAGE = 40;

/**
 * The first success: tapping a bird creates an observation and the life list
 * stops being empty. The list is who was actually recorded in this country most
 * recently (`fetchCommunityObservations`, the same call as in `RareNearby`, only
 * without the radius and the alert settings). The backend has no data on species
 * frequency in a region, and common birds surface in such a list on their own.
 */
const OnboardingSpeciesStep = ({
  territory,
  onPick,
  isCreating,
  onLoadError,
}: {
  territory: number | null;
  onPick: (species: SpeciesDropdownItem) => void;
  isCreating: boolean;
  /**
   * Both lists live online only, and a new account has no cache yet. The screen
   * has to learn about a failure: until a record is created there is no "Next"
   * button on the step, and without this the only way out is "Skip" — a network
   * failure would land in `onboarding_skipped` next to a human's refusal.
   */
  onLoadError?: (failed: boolean) => void;
}) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { language } = useLanguage();
  const { date } = useFilters();

  const { data, isLoading, isError } = useQuery<
    PaginatedResponse<ObservationItem>
  >({
    // The language is in the key: the server localises species names, and the
    // staleTime here is long — without it a language switch would return the
    // previous version.
    queryKey: ["OnboardingNearbySpecies", territory, language],
    queryFn: () =>
      fetchCommunityObservations(
        { territory },
        "-date_time",
        "",
        1,
        null,
        PER_PAGE,
      ),
    enabled: !!territory,
    staleTime: StaleTime.ONE_HOUR,
  });

  const cards = useMemo(() => {
    const seen = new Set<number>();
    const result: SpeciesDropdownItem[] = [];

    for (const item of data?.results ?? []) {
      const species = item.species_data;
      if (!species || seen.has(species.id)) continue;
      seen.add(species.id);
      result.push({
        value: species.id,
        label: species.name_lang || species.name,
        name: species.name,
        name_lang: species.name_lang,
        thumb: species.thumb ?? undefined,
        segment: species.segment,
      });
      if (result.length >= MAX_CARDS) break;
    }

    return result;
  }, [data]);

  // The full species list of the country — both the fallback instead of the tiles
  // and the "pick another species" next to them. Loaded only once a territory is
  // selected.
  //
  // `date` is here not for filtering but for a shared cache with the editor
  // (`ObservationForm`): the shape of the key and the arguments of `fetchSpecies`
  // must match the ones over there, otherwise a newcomer downloads 2500 species
  // twice — on this step and when first opening the editor. The set of options
  // does not depend on the date (`Stat2ViewSet` builds the list from the
  // territory checklist, the date only touches the `seen` annotation), and `seen`
  // is zero for a new account anyway, so the "this year" scope from the global
  // filters changes nothing here.
  const { query: speciesQuery, sort, onSortChange } = useDropdownQuery<SpeciesDropdownItem>({
    type: "SpeciesDropdown",
    queryFn: (order) => fetchSpecies(territory, order, date),
    params: [territory, language, date],
    enabled: !!territory && date !== undefined,
  });

  const handleSearchPick = (value: number | null) => {
    const found = speciesQuery.data?.find((item) => item.value === value);
    if (found) onPick(found);
  };

  const showCards = cards.length >= MIN_CARDS;
  // The tiles are not a required source: if they are missing but the country
  // search is alive, the step still works. It is a dead end only when both
  // requests failed.
  const loadFailed = isError && speciesQuery.isError;

  useEffect(() => {
    onLoadError?.(loadFailed);
  }, [loadFailed]);

  if (loadFailed)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t("onboarding_species_title")}</Text>
        <Text style={styles.text} testID="onboarding-species-error">
          {t("onboarding_species_error")}
        </Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("onboarding_species_title")}</Text>
      <Text style={styles.text}>
        {showCards
          ? t("onboarding_species_text")
          : t("onboarding_species_text_search")}
      </Text>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={Colors.main100}
          style={styles.loader}
        />
      ) : showCards ? (
        <View style={styles.grid}>
          {cards.map((species) => (
            <TouchableOpacity
              key={species.value}
              style={styles.card}
              activeOpacity={0.8}
              // While a record is being created the neighbouring cards are
              // locked: two taps in a row would create two observations, and
              // after the first one the step moves to the success screen anyway.
              disabled={isCreating}
              onPress={() => onPick(species)}
              testID={`onboarding-species-${species.value}`}
            >
              {species.thumb ? (
                <Image
                  source={{ uri: `${Config.mediaUrl}/${species.thumb}` }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <BirdSVG size={26} color={Colors.textSecondary} />
                </View>
              )}
              <Text style={styles.cardName} numberOfLines={2}>
                {species.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {!isLoading && (
        <View style={styles.search}>
          <Text style={styles.searchLabel}>
            {showCards
              ? t("onboarding_species_other")
              : t("onboarding_species_pick")}
          </Text>
          <DropdownInput<number | null>
            placeholder={t("select_species")}
            value={null}
            setValue={handleSearchPick}
            query={speciesQuery}
            disabled={!territory || isCreating}
            type="SpeciesDropdown"
            useDefault
            sort={sort}
            onSortChange={onSortChange}
            renderOption={({ item, selected, onSelect, onClose, index }) => (
              <SpeciesOptionRow
                item={item}
                selected={selected}
                onSelect={onSelect}
                onClose={onClose}
                index={index}
              />
            )}
          />
        </View>
      )}
    </View>
  );
};

export default OnboardingSpeciesStep;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
      marginBottom: 10,
    },
    text: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      color: Colors.textSecondary,
      marginBottom: 20,
    },
    loader: { marginVertical: 40 },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 10,
      marginBottom: 20,
    },
    card: {
      width: "30%",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 14,
      backgroundColor: Colors.primary100,
    },
    image: {
      width: CARD_IMAGE,
      height: CARD_IMAGE,
      borderRadius: 14,
      backgroundColor: Colors.imageBg,
    },
    imagePlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    cardName: {
      fontSize: 12,
      lineHeight: 15,
      textAlign: "center",
      color: Colors.textMain,
      marginTop: 6,
    },
    search: { alignSelf: "stretch" },
    searchLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 6,
    },
  });

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import RenderHtml from "react-native-render-html";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { track } from "../services/analytics";

import Layout from "../components/ui/Layout";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import PhotoViewerModal from "../components/ui/PhotoViewerModal";
import Section from "../components/ui/Section";
import IconsHeader from "../components/ui/IconsHeader";
import Tabs from "../components/ui/Tabs";
import TaxonBreadcrumbs from "../components/Taxonomy/TaxonBreadcrumbs";
import TaxonSoundRow from "../components/Taxonomy/TaxonSoundRow";
import { BirdSVG } from "../components/ui/Svgs";
import { fetchTaxonDetail, fetchTaxonSegmentById } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import { isoToFlagEmoji } from "../util/helpers";
import { buildSpeciesDetailUrl } from "../util/taxonShareLink";
import {
  resolveTaxonImage,
  iucnColors,
  countryStatusKey,
} from "../util/taxonomy";
import { htmlBaseStyle, htmlTagsStyles } from "../util/htmlStyles";
import { useLanguage } from "../store/language-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useContentWidth } from "../hooks/useContentWidth";
import { useDefaultTerritory } from "../hooks/useDefaultTerritory";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { useProfile } from "../store/profile-context";
import {
  AppStackNavigationProp,
  CatalogNavigationProp,
  CatalogRouteProp,
  SpeciesDetailTab,
  TabOption,
  TaxonCountry,
  TaxonSpeciesDetail,
} from "../types";

const SpeciesDetailScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const width = useContentWidth();
  const { language } = useLanguage();
  const navigation = useNavigation<CatalogNavigationProp>();
  const route = useRoute<CatalogRouteProp<"SpeciesDetail">>();
  const requireAuth = useRequireAuth();
  const { profile, profileLoading, error: profileError } = useProfile();
  const styles = stylesFn(Colors);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [activeSoundId, setActiveSoundId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<SpeciesDetailTab>(
    route.params.initialTab ?? "overview",
  );
  const [tabsHeight, setTabsHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Tabs share one scroll view, so a tab opened while scrolled down would
  // otherwise start halfway through its own content.
  const handleTabChange = (tab: SpeciesDetailTab) => {
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const speciesId = "id" in route.params ? route.params.id : undefined;
  const initialSegment = "segment" in route.params ? route.params.segment : undefined;

  const segmentQuery = useQuery({
    queryKey: ["TaxonSegmentById", speciesId],
    queryFn: () => fetchTaxonSegmentById(speciesId as number),
    enabled: !initialSegment && speciesId != null,
    staleTime: StaleTime.ONE_DAY,
  });

  const segment = initialSegment ?? segmentQuery.data;

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    error,
    refetch,
  } = useQuery<TaxonSpeciesDetail>({
    queryKey: ["TaxonSpeciesDetail", segment, language],
    queryFn: () => fetchTaxonDetail<TaxonSpeciesDetail>(segment as string, 5),
    enabled: !!segment,
    staleTime: StaleTime.ONE_DAY,
  });

  const defaultTerritory = useDefaultTerritory(data?.countries);

  const openObservationEditor = () => {
    if (!data) return;
    (navigation as unknown as AppStackNavigationProp).navigate(
      "ObservationEditor",
      {
        defaultSpecies: data.taxon_id,
        // Unlike the observation/stat/rating screens this one has no country
        // of its own — it is reached from search, the taxonomy tree or a
        // deep link — so the editor used to open with its required country
        // field empty. Passed explicitly (null included) so that a country
        // ruled out by the species' range isn't re-added by the editor's own
        // fallback.
        defaultTerritory,
        returnMode: "back",
      },
    );
  };

  // The guest tapped "add observation", created an account in the sheet and came
  // back here (services/authReturn) — we replay what they came for instead of
  // making them press the same button a second time.
  //
  // Both the species data and the profile are awaited: `defaultTerritory` is
  // assembled from the filters and the profile country, and right after the login
  // they are not there yet — the editor would open with an empty required
  // country. For the same reason the action is replayed here rather than
  // substituted by a route at login time: the snapshot of the arguments would
  // then have been taken while still a guest, before the profile appeared.
  //
  // The parameter is cleared right away: it lives in the route, and without a
  // reset the editor would open again on every return to this screen.
  //
  // Through requireAuth rather than directly: by now the account exists and the
  // check passes straight through, but if the parameter somehow reached a guest,
  // they will see the same sheet rather than a silent navigation to nowhere —
  // there is no editor in the guest stack.
  const pendingAction = route.params.pendingAction;
  useEffect(() => {
    if (
      pendingAction !== "add_observation" ||
      profileLoading ||
      // The profile itself is awaited, not just a cleared `profileLoading`: the
      // flag goes off as soon as the sync request comes back, while the profile
      // itself arrives a render later — it comes from the mirror in SQLite via
      // useLiveQuery, whose notification arrives after the flag has changed. In
      // that gap `defaultTerritory` is assembled from nothing at all (the filters
      // have not been re-read by then either) and goes into the editor as null —
      // and null here means, by contract, "there is no country and nothing to
      // substitute", that is, the editor opened with an empty required country,
      // without a species and with the lists locked. Caught by the e2e scenario
      // .maestro/guest-login-return.yaml.
      //
      // `profileError` is there so that a failed load (offline right after the
      // login) does not hang the return forever: then we open with whatever is
      // available, as before.
      (!profile && !profileError) ||
      !data
    )
      return;

    navigation.setParams({ pendingAction: undefined });
    requireAuth("add_observation", openObservationEditor);
    // openObservationEditor is recreated on every render — the dependencies keep
    // what it actually depends on.
  }, [
    pendingAction,
    profileLoading,
    profile,
    profileError,
    data,
    defaultTerritory,
    requireAuth,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: data?.name_lang ?? t("species"),
      headerRight: () => (
        <IconsHeader
          headerRightBeginning={[
            {
              condition: !!segment,
              icon: "git-compare-outline",
              onPress: () =>
                navigation.navigate("SpeciesCompare", { segmentA: segment }),
              testID: "compare-species-button",
            },
          ]}
          onSharePress={
            segment
              ? async () => {
                  // The page is one long read split into tabs — a link shared
                  // from "Sounds" should open on sounds, not the overview.
                  const url = buildSpeciesDetailUrl(segment, activeTab);
                  track("share_tapped", { type: "species" });
                  await Share.share(
                    Platform.OS === "ios" ? { url } : { message: url },
                  );
                }
              : undefined
          }
        />
      ),
    });
  }, [navigation, data?.name_lang, segment, t, activeTab]);

  useEffect(() => {
    if (data?.redirect) {
      navigation.setParams({ segment: data.redirect });
    }
  }, [data?.redirect, navigation]);

  // A link with `?tab=sounds` opened while this very screen is on top updates
  // the route params instead of pushing a new screen (React Navigation matches
  // the focused route by name), so the tab has to follow the parameter and not
  // just seed the initial state.
  const initialTab = route.params.initialTab;
  useEffect(() => {
    if (initialTab) handleTabChange(initialTab);
  }, [initialTab]);

  // The key page of the catalogue: it measures whether a guest gets from the list
  // to a species — that is, whether they saw any value at all before signing up.
  // Once per species rather than on every re-render, hence segment in the
  // dependencies.
  //
  // `source` says which of the app's many roads led here. It rides on the route
  // because the screen has no way to work it out for itself — the catalogue, a
  // country checklist, an observation, a push and a shared link all land on the
  // same params. A route without it is one restored from a persisted navigation
  // state, from before the parameter existed.
  const source = route.params.source ?? "unknown";
  useEffect(() => {
    if (segment) track("species_viewed", { source });
    // `source` is deliberately out of the dependencies: it belongs to the same
    // arrival as the segment, and re-firing on it alone would double-count a
    // page whose params were merely updated.
  }, [segment]);

  const groupedCountries = useMemo(() => {
    const groups = new Map<string, TaxonCountry[]>();
    for (const c of data?.countries ?? []) {
      const key = c.region ?? t("other_region");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }
    return Array.from(groups.entries())
      .map(([region, countries]) => ({ region, countries }))
      .sort((a, b) => a.region.localeCompare(b.region));
  }, [data?.countries, t]);

  const translationEntries = useMemo(() => {
    // Defensive: a locally cached response fetched before the backend
    // started returning {label, names} (instead of a plain name array) can
    // still be sitting in the offline cache and get served on a failed
    // refetch — fall back to the code rather than crashing on it. `multilangs`
    // is also absent on the partial {redirect} response (a cross-language deep
    // link), which renders once before the redirect effect refetches — so
    // chain through it too, not just `data`.
    const entries = Object.entries(data?.multilangs?.langs ?? {}).map(
      ([code, entry]) => ({
        code,
        label: entry?.label || code.toUpperCase(),
        names: entry?.names ?? [],
      }),
    );
    return entries.sort((a, b) => a.label.localeCompare(b.label));
  }, [data?.multilangs?.langs]);

  if (segmentQuery.isError)
    return (
      <ErrorOverlay
        title={t("species_unavailable")}
        message={segmentQuery.error.message}
        onPress={async () => {
          await segmentQuery.refetch();
        }}
        logo
      />
    );

  if (isError && !data)
    return (
      <ErrorOverlay
        title={t("species_unavailable")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );

  if (isLoading || !data || data.redirect) return <LoadingOverlay />;

  // Down into another bird: a new page on top of this one, so "back" returns
  // to the bird it was reached from.
  const goToRelated = (targetSegment: string) =>
    navigation.push("SpeciesDetail", {
      segment: targetSegment,
      source: "species_related",
    });

  // Sideways to the neighbour in the listing. `replace`, not `push`: the strip
  // is meant for browsing, and pushing left someone who had stepped through ten
  // birds with ten screens to back out of.
  const goToNeighbour = (targetSegment: string) =>
    navigation.replace("SpeciesDetail", {
      segment: targetSegment,
      source: "species_paging",
    });

  // The only navigation from here beyond the reference: the observation editor
  // lives in AppStack only, so a guest gets the signup sheet instead. The types
  // are what enforces that — CatalogNavigationProp knows nothing about
  // ObservationEditor, hence the cast inside a branch already checked for an
  // account.
  const handleAddObservation = () => {
    requireAuth("add_observation", openObservationEditor);
  };

  // "Related" species are siblings within the same genus (see backend
  // get_related), so "show all" just points at that genus's own listing.
  const genusParent = data.parents.find((p) => p.depth === 4);

  const status = iucnColors(data.status?.status_id);

  // An authority is stored either bare ("Linnaeus, 1758") or already
  // parenthesized when the species was moved to another genus.
  const authority = data.authority
    ? data.authority.startsWith("(")
      ? ` ${data.authority}`
      : `, ${data.authority}`
    : "";

  const hasRange =
    data.breeding_regions.length > 0 ||
    !!data.breeding_subregion ||
    !!data.nonbreeding_region;

  const traitGroups = data.traits ?? [];
  const traitHighlights = data.trait_highlights ?? [];

  const hasNamesContent =
    data.multilangs.synonyms.length > 0 ||
    data.multilangs.protonyms.length > 0 ||
    translationEntries.length > 0;

  const tabOptions: TabOption<SpeciesDetailTab>[] = [
    {
      value: "overview",
      icon: "information-circle",
      iconInactive: "information-circle-outline",
      labelKey: t("overview"),
    },
    ...(traitGroups.length > 0
      ? [
          {
            value: "traits" as const,
            icon: "analytics" as const,
            iconInactive: "analytics-outline" as const,
            labelKey: t("biology"),
          },
        ]
      : []),
    ...(data.sounds.length > 0
      ? [
          {
            value: "sounds" as const,
            icon: "musical-notes" as const,
            iconInactive: "musical-notes-outline" as const,
            labelKey: t("sounds"),
          },
        ]
      : []),
    ...(groupedCountries.length > 0
      ? [
          {
            value: "countries" as const,
            icon: "globe" as const,
            iconInactive: "globe-outline" as const,
            labelKey: t("countries"),
          },
        ]
      : []),
    ...(hasNamesContent
      ? [
          {
            value: "names" as const,
            icon: "language" as const,
            iconInactive: "language-outline" as const,
            labelKey: t("names"),
          },
        ]
      : []),
  ];

  // Half the tabs only exist when the species has that content, so a shared
  // link asking for one this bird lacks (tab=sounds on a silent species, or a
  // link older than the data) would leave the page blank with nothing
  // selected. Fall back to the tab every species has.
  const visibleTab = tabOptions.some((o) => o.value === activeTab)
    ? activeTab
    : "overview";

  return (
    <Layout
      bottom={
        <>
          <Pressable
            style={[styles.fab, { bottom: tabsHeight + 16 }]}
            onPress={handleAddObservation}
            testID="add-observation-fab"
          >
            <Ionicons name="binoculars" size={24} color={Colors.textOpposite} />
          </Pressable>
          <View onLayout={(e) => setTabsHeight(e.nativeEvent.layout.height)}>
            <Tabs
              tabOptions={tabOptions}
              tabsMode={visibleTab}
              setTabsMode={handleTabChange}
            />
          </View>
        </>
      }
    >
      <ScrollView
        ref={scrollRef}
        testID="species-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          // Species data is cached for a day (and survives restarts through
          // the persisted query cache), so without this there is no way to
          // pull in a correction before then.
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.main100}
            colors={[Colors.main100]}
          />
        }
      >
        <View style={styles.header}>
          {data.photos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.gallery}
              contentContainerStyle={styles.galleryContent}
            >
              {data.photos.map((photo, i) => (
                <Pressable
                  key={`${photo.url}-${i}`}
                  style={styles.photoWrap}
                  onPress={() => setViewerIndex(i)}
                >
                  <Image
                    source={{ uri: resolveTaxonImage(photo.thumb) ?? undefined }}
                    style={styles.photo}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                  {!!photo.ownername && (
                    <View style={styles.photoCreditBar}>
                      <Ionicons name="camera-outline" size={11} color="#fff" />
                      <Text style={styles.photoCredit} numberOfLines={1}>
                        {photo.ownername}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.photoPlaceholder}>
              <BirdSVG size={64} color={Colors.textSecondary} />
            </View>
          )}

          <TaxonBreadcrumbs parents={data.parents} />

          <View style={styles.titleRow}>
            <View style={styles.titleTexts}>
              <Text style={styles.title}>{data.name_lang}</Text>
              <Text style={styles.latin}>
                {data.latin_name}
                {authority}
              </Text>
            </View>

            {!!data.status && (
              <View
                style={[
                  styles.statusBadge,
                  status && { backgroundColor: status.background },
                ]}
              >
                <Text
                  style={[styles.statusCode, status && { color: status.text }]}
                >
                  {data.status.status_id}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.badgesRow}>
            {!!data.status && (
              <Text style={styles.statusName}>{data.status.name}</Text>
            )}
            {data.extinct && (
              <View style={styles.extinctBadge}>
                <Text style={styles.extinctText}>{t("extinct")}</Text>
              </View>
            )}
          </View>

          {traitHighlights.length > 0 && (
            // The two or three numbers a birder can picture; the rest live
            // in the biology tab.
            <Pressable
              style={styles.highlights}
              onPress={() => handleTabChange("traits")}
            >
              {traitHighlights.map((highlight) => (
                <View key={highlight.key} style={styles.highlight}>
                  <Text style={styles.highlightValue}>{highlight.value}</Text>
                  <Text style={styles.highlightLabel} numberOfLines={1}>
                    {highlight.label}
                  </Text>
                </View>
              ))}
            </Pressable>
          )}
        </View>

        {visibleTab === "overview" && (
          <>
            {!!data.metadata?.short && (
              <Section title={t("description")}>
                <RenderHtml
                  contentWidth={width - 64}
                  source={{ html: data.metadata.short }}
                  baseStyle={htmlBaseStyle(Colors)}
                  tagsStyles={htmlTagsStyles(Colors)}
                />
              </Section>
            )}

            {hasRange && (
              <Section title={t("breeding_range")}>
                {data.breeding_regions.length > 0 && (
                  <View style={styles.chipsRow}>
                    {data.breeding_regions.map((region) => (
                      <View key={region} style={styles.chip}>
                        <Text style={styles.chipText}>{region}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {!!data.breeding_subregion && (
                  <Text style={styles.bodyText}>
                    {data.breeding_subregion_text || data.breeding_subregion}
                  </Text>
                )}
                {!!data.nonbreeding_region && (
                  <Text style={[styles.bodyText, styles.spacedText]}>
                    {t("nonbreeding_range")}:{" "}
                    {data.nonbreeding_region_text || data.nonbreeding_region}
                  </Text>
                )}
              </Section>
            )}

            {data.subspecies.length > 0 && (
              <Section
                title={t("subspecies")}
                hint={String(data.subspecies.length)}
                collapsible={data.subspecies.length > 6}
              >
                {data.subspecies.map((s) => (
                  <View key={s.name} style={styles.subspeciesRow}>
                    <Text style={styles.subspeciesText}>
                      {s.name}
                      {s.authority ? `, ${s.authority}` : ""}
                    </Text>
                    {!!s.breeding_subregion && (
                      <Text style={styles.subspeciesRange}>
                        {s.breeding_subregion_text || s.breeding_subregion}
                      </Text>
                    )}
                  </View>
                ))}
              </Section>
            )}

            {data.related.species.length > 0 && (
              <Section title={t("related_species")}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.relatedScroll}
                  contentContainerStyle={styles.relatedContent}
                >
                  {data.related.species.map((s) => {
                    const uri = resolveTaxonImage(s.thumb);
                    return (
                      <Pressable
                        key={s.segment}
                        style={styles.relatedCard}
                        onPress={() => goToRelated(s.segment)}
                      >
                        {uri ? (
                          <Image
                            source={{ uri }}
                            style={styles.relatedThumb}
                            contentFit="cover"
                            cachePolicy="disk"
                          />
                        ) : (
                          <View
                            style={[styles.relatedThumb, styles.relatedThumbEmpty]}
                          >
                            <BirdSVG size={28} color={Colors.textSecondary} />
                          </View>
                        )}
                        <Text style={styles.relatedName} numberOfLines={2}>
                          {s.name_lang}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {data.related.count > data.related.species.length &&
                    genusParent && (
                      <Pressable
                        style={styles.relatedCard}
                        onPress={() =>
                          navigation.navigate("TaxonGroupDetail", {
                            segment: genusParent.parent_segment,
                            rank: 4,
                          })
                        }
                      >
                        <View
                          style={[styles.relatedThumb, styles.relatedThumbEmpty]}
                        >
                          <Ionicons
                            name="arrow-forward"
                            size={24}
                            color={Colors.main100}
                          />
                        </View>
                        <Text style={styles.relatedName} numberOfLines={2}>
                          {t("all_related_species", {
                            count: data.related.count,
                          })}
                        </Text>
                      </Pressable>
                    )}
                </ScrollView>
              </Section>
            )}

            {(data.paging.prev || data.paging.next) && (
              <View style={styles.pagingStrip}>
                {data.paging.prev ? (
                  <Pressable
                    style={styles.pagingCard}
                    onPress={() => goToNeighbour(data.paging.prev!.segment)}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={16}
                      color={Colors.textSecondary}
                    />
                    <PagingThumb thumb={data.paging.prev.thumb} styles={styles} />
                    <Text style={styles.pagingName} numberOfLines={1}>
                      {data.paging.prev.name_lang}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.pagingCard} />
                )}

                {data.paging.next ? (
                  <Pressable
                    style={styles.pagingCard}
                    onPress={() => goToNeighbour(data.paging.next!.segment)}
                  >
                    <Text
                      style={[styles.pagingName, styles.pagingNameEnd]}
                      numberOfLines={1}
                    >
                      {data.paging.next.name_lang}
                    </Text>
                    <PagingThumb thumb={data.paging.next.thumb} styles={styles} />
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={Colors.textSecondary}
                    />
                  </Pressable>
                ) : (
                  <View style={styles.pagingCard} />
                )}
              </View>
            )}
          </>
        )}

        {visibleTab === "traits" &&
          traitGroups.map((group) => (
            <Section key={group.key} title={group.label}>
              {group.traits.map((trait) => (
                <View key={trait.key} style={styles.traitRow}>
                  <View style={styles.traitLabelWrap}>
                    <Text style={styles.traitLabel}>{trait.label}</Text>
                    {!!trait.source && (
                      <Text style={styles.traitSource} numberOfLines={1}>
                        {trait.source}
                      </Text>
                    )}
                  </View>
                  <View style={styles.traitValueWrap}>
                    <Text style={styles.traitValue}>{trait.value}</Text>
                    {(!!trait.male || !!trait.female) && (
                      <Text style={styles.traitBySex}>
                        {[
                          trait.male && `♂ ${trait.male}`,
                          trait.female && `♀ ${trait.female}`,
                        ]
                          .filter(Boolean)
                          .join("  ")}
                      </Text>
                    )}
                    {!!trait.sources_label && (
                      // An averaged figure says so, with how far the sources
                      // were apart — some traits are well established, others
                      // are one lab's estimate.
                      <Text style={styles.traitBySex}>
                        {[trait.spread, trait.sources_label]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </Section>
          ))}

        {visibleTab === "sounds" && (
          <Section title={t("sounds")} hint={String(data.sounds.length)}>
            {data.sounds.map((sound) => (
              // Active means "owns playback": it stays on the last recording
              // played so its scrub bar survives a pause or the end of the
              // clip, and only moves when another recording is started.
              <TaxonSoundRow
                key={sound.xeno_id}
                sound={sound}
                isActive={activeSoundId === sound.xeno_id}
                onPlay={() => setActiveSoundId(sound.xeno_id)}
              />
            ))}
          </Section>
        )}

        {visibleTab === "countries" &&
          groupedCountries.map((group) => (
            <Section
              key={group.region}
              title={group.region}
              hint={String(group.countries.length)}
            >
              <View style={styles.chipsRow}>
                {group.countries.map((c) => (
                  <View
                    key={c.segment}
                    style={[styles.chip, !!c.status && styles.chipRare]}
                  >
                    <Text style={styles.chipText}>
                      {isoToFlagEmoji(c.code)} {c.name}
                    </Text>
                    {!!c.status && (
                      <Text style={styles.chipStatus}>
                        {countryStatusKey(c.status)
                          ? t(countryStatusKey(c.status) as string)
                          : c.status}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </Section>
          ))}

        {visibleTab === "names" && (
          <>
            {data.multilangs.synonyms.length > 0 && (
              <Section title={t("synonyms")}>
                <Text style={styles.bodyText}>
                  {data.multilangs.synonyms.join(", ")}
                </Text>
              </Section>
            )}

            {data.multilangs.protonyms.length > 0 && (
              <Section title={t("scientific_synonyms")}>
                <Text style={[styles.bodyText, styles.protonymText]}>
                  {data.multilangs.protonyms.join(", ")}
                </Text>
              </Section>
            )}

            {translationEntries.length > 0 && (
              <Section
                title={t("translations")}
                hint={String(translationEntries.length)}
              >
                <View style={styles.translationsList}>
                  {translationEntries.map(({ code, label, names }) => (
                    <View key={code} style={styles.translationRow}>
                      <Text style={styles.translationLang}>{label}</Text>
                      <Text style={styles.translationNames}>
                        {names.join(", ")}
                      </Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}
          </>
        )}
      </ScrollView>

      <PhotoViewerModal
        visible={viewerIndex !== null}
        photos={data.photos.map((photo) => ({
          uri: resolveTaxonImage(photo.url) ?? "",
          credit: photo.ownername,
        }))}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </Layout>
  );
};

const PagingThumb = ({
  thumb,
  styles,
}: {
  thumb?: string | null;
  styles: ReturnType<typeof stylesFn>;
}) => {
  const { Colors } = useTheme();
  const uri = resolveTaxonImage(thumb);

  if (!uri)
    return (
      <View style={[styles.pagingThumb, styles.pagingThumbEmpty]}>
        <BirdSVG size={16} color={Colors.textSecondary} />
      </View>
    );

  return (
    <Image
      source={{ uri }}
      style={styles.pagingThumb}
      contentFit="cover"
      cachePolicy="disk"
    />
  );
};

export default SpeciesDetailScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1 },
    // The add-observation FAB floats over the last card, so the content needs
    // room to scroll clear of it.
    scrollContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 72 },
    header: { paddingHorizontal: 4, marginBottom: 8 },
    fab: {
      position: "absolute",
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.main100,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    gallery: { marginHorizontal: -12, marginBottom: 12 },
    galleryContent: { paddingHorizontal: 12, gap: 8 },
    photoWrap: {
      width: 150,
      height: 150,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: Colors.imageBg,
    },
    photo: { width: "100%", height: "100%" },
    photoCreditBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 4,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    photoCredit: { flex: 1, fontSize: 10, color: "#fff" },
    photoPlaceholder: {
      height: 150,
      borderRadius: 14,
      backgroundColor: Colors.primary200,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    titleTexts: { flex: 1 },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: Colors.textMain,
    },
    latin: {
      fontSize: 14,
      fontStyle: "italic",
      color: Colors.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      backgroundColor: Colors.primary200,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    statusCode: {
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.4,
      color: Colors.textMain,
    },
    badgesRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 6,
    },
    statusName: { fontSize: 12, color: Colors.textSecondary },
    extinctBadge: {
      backgroundColor: Colors.error100,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    extinctText: { fontSize: 11, fontWeight: "700", color: Colors.error600 },
    highlights: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    highlight: {
      backgroundColor: Colors.primary100,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      minWidth: 88,
    },
    highlightValue: {
      fontSize: 15,
      fontWeight: "700",
      color: Colors.textMain,
    },
    highlightLabel: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    traitRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.divider,
    },
    traitLabelWrap: { flex: 1 },
    traitLabel: { fontSize: 14, color: Colors.textMiddle },
    traitSource: {
      fontSize: 10,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    traitValueWrap: { alignItems: "flex-end" },
    traitValue: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
    },
    traitBySex: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    bodyText: {
      fontSize: 14,
      color: Colors.textMiddle,
      lineHeight: 20,
    },
    spacedText: { marginTop: 4 },
    subspeciesRow: { marginBottom: 8 },
    subspeciesText: {
      fontSize: 14,
      color: Colors.textMiddle,
      lineHeight: 20,
    },
    subspeciesRange: {
      fontSize: 12,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    protonymText: { fontStyle: "italic" },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      // Some territories have very long names ("Saint Helena, Ascension and
      // Tristan da Cunha") — the chip has to stay inside the card and let
      // its own text wrap instead of running off the screen.
      maxWidth: "100%",
      flexShrink: 1,
      flexWrap: "wrap",
      gap: 4,
      backgroundColor: Colors.primary300,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    chipRare: { backgroundColor: Colors.accent300 },
    chipText: { fontSize: 12, color: Colors.textMain, flexShrink: 1 },
    chipStatus: {
      fontSize: 10,
      fontStyle: "italic",
      color: Colors.textSecondary,
      flexShrink: 1,
    },
    translationsList: { gap: 12 },
    translationRow: {
      borderLeftWidth: 2,
      borderLeftColor: Colors.border,
      paddingLeft: 10,
    },
    translationLang: {
      fontSize: 12,
      fontWeight: "700",
      color: Colors.main100,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    translationNames: {
      fontSize: 14,
      color: Colors.textMiddle,
      lineHeight: 20,
    },
    relatedScroll: { marginHorizontal: -16 },
    relatedContent: { paddingHorizontal: 16, gap: 12 },
    relatedCard: { width: 96 },
    relatedThumb: {
      width: 96,
      height: 96,
      borderRadius: 10,
      backgroundColor: Colors.imageBg,
    },
    relatedThumbEmpty: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary200,
    },
    relatedName: {
      fontSize: 12,
      color: Colors.textMain,
      marginTop: 4,
    },
    pagingStrip: {
      flexDirection: "row",
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    pagingCard: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    pagingThumb: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: Colors.imageBg,
    },
    pagingThumbEmpty: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary200,
    },
    pagingName: {
      flex: 1,
      fontSize: 12,
      color: Colors.textMain,
    },
    pagingNameEnd: { textAlign: "right" },
  });

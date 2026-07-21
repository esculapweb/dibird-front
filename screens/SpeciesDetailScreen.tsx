import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import RenderHtml from "react-native-render-html";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import Layout from "../components/ui/Layout";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import PhotoViewerModal from "../components/ui/PhotoViewerModal";
import TaxonBreadcrumbs from "../components/Taxonomy/TaxonBreadcrumbs";
import TaxonSoundRow from "../components/Taxonomy/TaxonSoundRow";
import { BirdSVG } from "../components/ui/Svgs";
import { fetchTaxonDetail, fetchTaxonSegmentById } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import { Config } from "../constants/config";
import { isoToFlagEmoji } from "../util/helpers";
import { useLanguage } from "../store/language-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useContentWidth } from "../hooks/useContentWidth";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  TaxonCountry,
  TaxonSpeciesDetail,
} from "../types";

const resolveUri = (path: string) => {
  if (path.includes("://")) return path;
  // Server-absolute routes (e.g. /image_taxon/..., the full-size photo
  // proxy) live at the API host root, not under /media/ like stored files.
  if (path.startsWith("/")) return `${Config.baseUrl}${path}`;
  return `${Config.mediaUrl}/${path}`;
};

const SpeciesDetailScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const width = useContentWidth();
  const { language } = useLanguage();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"SpeciesDetail">>();
  const styles = stylesFn(Colors);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showTranslations, setShowTranslations] = useState(false);
  const [activeSoundId, setActiveSoundId] = useState<number | null>(null);

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
    error,
    refetch,
  } = useQuery<TaxonSpeciesDetail>({
    queryKey: ["TaxonSpeciesDetail", segment, language],
    queryFn: () => fetchTaxonDetail<TaxonSpeciesDetail>(segment as string, 5),
    enabled: !!segment,
    staleTime: StaleTime.ONE_DAY,
  });

  useLayoutEffect(() => {
    navigation.setOptions({ title: data?.name_lang ?? t("species") });
  }, [navigation, data?.name_lang, t]);

  useEffect(() => {
    if (data?.redirect) {
      navigation.setParams({ segment: data.redirect });
    }
  }, [data?.redirect, navigation]);

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

  const translationEntries = useMemo(
    () =>
      Object.entries(data?.multilangs.langs ?? {}).sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
    [data?.multilangs.langs],
  );

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

  if (isError)
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

  const goToSpecies = (targetSegment: string) =>
    navigation.push("SpeciesDetail", { segment: targetSegment });

  return (
    <Layout withScroll contentContainerStyle={styles.scroll}>
      {data.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
          {data.photos.map((photo, i) => (
            <View key={`${photo.url}-${i}`} style={styles.photoWrap}>
              <Pressable onPress={() => setViewerIndex(i)}>
                <Image
                  source={{ uri: resolveUri(photo.thumb) }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              </Pressable>
              {!!photo.ownername && (
                <Text style={styles.photoCredit} numberOfLines={1}>
                  {photo.ownername}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.photoPlaceholder}>
          <BirdSVG size={64} color={Colors.textSecondary} />
        </View>
      )}

      <TaxonBreadcrumbs parents={data.parents} />

      <Text style={styles.title}>{data.name_lang}</Text>
      <Text style={styles.latin}>
        {data.name}
        {data.authority ? `, ${data.authority}` : ""}
      </Text>

      {data.status && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{data.status.name}</Text>
        </View>
      )}

      {!!data.metadata?.short && (
        <RenderHtml
          contentWidth={width - 32}
          source={{ html: data.metadata.short }}
          tagsStyles={{
            p: { color: Colors.textMiddle, fontSize: 14, lineHeight: 22 },
          }}
        />
      )}

      {(data.breeding_regions.length > 0 ||
        data.breeding_subregion ||
        data.nonbreeding_region) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("breeding_range")}</Text>
          {data.breeding_regions.length > 0 && (
            <Text style={styles.sectionText}>
              {data.breeding_regions.join(", ")}
            </Text>
          )}
          {!!data.breeding_subregion && (
            <Text style={styles.sectionText}>{data.breeding_subregion}</Text>
          )}
          {!!data.nonbreeding_region && (
            <Text style={styles.sectionText}>
              {t("nonbreeding_range")}: {data.nonbreeding_region}
            </Text>
          )}
        </View>
      )}

      {data.sounds.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("sounds")}</Text>
          {data.sounds.map((sound) => (
            <TaxonSoundRow
              key={sound.xeno_id}
              sound={sound}
              isActive={activeSoundId === sound.xeno_id}
              onPlay={() => setActiveSoundId(sound.xeno_id)}
              onStop={() =>
                setActiveSoundId((id) => (id === sound.xeno_id ? null : id))
              }
            />
          ))}
        </View>
      )}

      {groupedCountries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("countries")}</Text>
          {groupedCountries.map((group) => (
            <View key={group.region} style={styles.countryGroup}>
              <Text style={styles.countryGroupTitle}>{group.region}</Text>
              <View style={styles.chipsRow}>
                {group.countries.map((c) => (
                  <View key={c.segment} style={styles.chip}>
                    <Text style={styles.chipText}>
                      {isoToFlagEmoji(c.code)} {c.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {(data.multilangs.synonyms.length > 0 ||
        data.multilangs.protonyms.length > 0) && (
        <View style={styles.section}>
          {data.multilangs.synonyms.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t("synonyms")}</Text>
              <Text style={styles.sectionText}>
                {data.multilangs.synonyms.join(", ")}
              </Text>
            </>
          )}
          {data.multilangs.protonyms.length > 0 && (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  data.multilangs.synonyms.length > 0 && styles.sectionTitleSpaced,
                ]}
              >
                {t("scientific_synonyms")}
              </Text>
              <Text style={[styles.sectionText, styles.protonymText]}>
                {data.multilangs.protonyms.join(", ")}
              </Text>
            </>
          )}
        </View>
      )}

      {translationEntries.length > 0 && (
        <View style={styles.section}>
          <Pressable
            style={styles.collapsibleHeader}
            onPress={() => setShowTranslations((v) => !v)}
            hitSlop={8}
          >
            <Text style={styles.sectionTitle}>
              {t("translations")} ({translationEntries.length})
            </Text>
            <Ionicons
              name={showTranslations ? "chevron-up" : "chevron-down"}
              size={16}
              color={Colors.textSecondary}
            />
          </Pressable>
          {showTranslations && (
            <View style={styles.translationsList}>
              {translationEntries.map(([lang, names]) => (
                <Text key={lang} style={styles.sectionText}>
                  <Text style={styles.translationLang}>{lang.toUpperCase()}</Text>
                  {": "}
                  {names.join(", ")}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {data.subspecies.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("subspecies")}</Text>
          {data.subspecies.map((s) => (
            <Text key={s.name} style={styles.sectionText}>
              {s.name}
              {s.authority ? `, ${s.authority}` : ""}
            </Text>
          ))}
        </View>
      )}

      {data.related.species.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("related_species")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {data.related.species.map((s) => (
              <Pressable
                key={s.segment}
                style={styles.relatedCard}
                onPress={() => goToSpecies(s.segment)}
              >
                {s.thumb ? (
                  <Image
                    source={{ uri: resolveUri(s.thumb) }}
                    style={styles.relatedThumb}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                ) : (
                  <View style={[styles.relatedThumb, styles.relatedThumbEmpty]}>
                    <BirdSVG size={28} color={Colors.textSecondary} />
                  </View>
                )}
                <Text style={styles.relatedName} numberOfLines={2}>
                  {s.name_lang}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {(data.paging.prev || data.paging.next) && (
        <View style={styles.paging}>
          {data.paging.prev ? (
            <Pressable onPress={() => goToSpecies(data.paging.prev!.segment)}>
              <Text style={styles.pagingLink}>← {data.paging.prev.name_lang}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {data.paging.next && (
            <Pressable onPress={() => goToSpecies(data.paging.next!.segment)}>
              <Text style={styles.pagingLink}>{data.paging.next.name_lang} →</Text>
            </Pressable>
          )}
        </View>
      )}
      <PhotoViewerModal
        visible={viewerIndex !== null}
        photos={data.photos.map((photo) => ({
          uri: resolveUri(photo.url),
          credit: photo.ownername,
        }))}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </Layout>
  );
};

export default SpeciesDetailScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { paddingHorizontal: 16, paddingBottom: 32 },
    gallery: { marginHorizontal: -16, marginBottom: 12 },
    photoWrap: { marginLeft: 16, width: 160 },
    photo: {
      width: 160,
      height: 160,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },
    photoCredit: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginTop: 4,
    },
    photoPlaceholder: {
      height: 160,
      borderRadius: 12,
      backgroundColor: Colors.primary200,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
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
      marginBottom: 8,
    },
    statusBadge: {
      alignSelf: "flex-start",
      backgroundColor: Colors.primary200,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginBottom: 8,
    },
    statusText: { fontSize: 12, color: Colors.main100, fontWeight: "600" },
    section: { marginTop: 16 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textSecondary,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    sectionTitleSpaced: { marginTop: 10 },
    sectionText: {
      fontSize: 14,
      color: Colors.textMiddle,
      lineHeight: 20,
    },
    protonymText: { fontStyle: "italic" },
    countryGroup: { marginBottom: 10 },
    countryGroupTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: Colors.textMiddle,
      marginBottom: 4,
    },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      backgroundColor: Colors.primary100,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    chipText: { fontSize: 12, color: Colors.textMain },
    collapsibleHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    translationsList: { marginTop: 4, gap: 2 },
    translationLang: {
      fontWeight: "600",
      color: Colors.textSecondary,
    },
    relatedCard: { width: 96, marginRight: 12 },
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
    paging: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 24,
    },
    pagingLink: { fontSize: 13, color: Colors.main100 },
  });

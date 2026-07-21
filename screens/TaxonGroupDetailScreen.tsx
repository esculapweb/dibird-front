import { useEffect, useLayoutEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import RenderHtml from "react-native-render-html";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import Layout from "../components/ui/Layout";
import TaxonChildrenList from "../components/Taxonomy/TaxonChildrenList";
import TaxonBreadcrumbs from "../components/Taxonomy/TaxonBreadcrumbs";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { fetchTaxonDetail } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import { useLanguage } from "../store/language-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useContentWidth } from "../hooks/useContentWidth";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  TaxonGroupDetail,
} from "../types";

const CHILD_RANK_TITLE_KEY: Record<number, string> = {
  3: "families",
  4: "genera",
  5: "species",
};

const TaxonGroupDetailScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const width = useContentWidth();
  const { language } = useLanguage();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"TaxonGroupDetail">>();
  const { segment, rank } = route.params;
  const styles = stylesFn(Colors);

  const { data, isLoading, isError, error, refetch } =
    useQuery<TaxonGroupDetail>({
      queryKey: ["TaxonGroupDetail", segment, rank, language],
      queryFn: () => fetchTaxonDetail<TaxonGroupDetail>(segment, rank),
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

  if (isError)
    return (
      <ErrorOverlay
        title={t("taxonomy_unavailable")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );

  if (isLoading || !data || data.redirect) return <LoadingOverlay />;

  return (
    <Layout>
      <TaxonChildrenList
        rank={(rank + 1) as 3 | 4 | 5}
        parent={{ segment, rank }}
        errorTitle={t("taxonomy_unavailable")}
        emptyMessage={t("no_species_found")}
        listHeader={
          <View style={styles.header}>
            <TaxonBreadcrumbs parents={data.parents ?? []} />

            {!!data.count?.[String(rank + 1)] && (
              <Text style={styles.count}>{data.count[String(rank + 1)]}</Text>
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

            <Text style={styles.childrenTitle}>
              {t(CHILD_RANK_TITLE_KEY[rank + 1])}
            </Text>
          </View>
        }
      />
    </Layout>
  );
};

export default TaxonGroupDetailScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: { marginBottom: 8 },
    count: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 6,
    },
    childrenTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textSecondary,
      textTransform: "uppercase",
      marginTop: 12,
      marginBottom: 4,
    },
  });

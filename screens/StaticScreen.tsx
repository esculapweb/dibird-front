import {
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import RenderHtml from "react-native-render-html";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import Layout from "../components/ui/Layout";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { fetchPage } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import { useLanguage } from "../store/language-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useContentWidth } from "../hooks/useContentWidth";

const H_PAD = 16;

const StaticScreen = () => {
  const { Colors } = useTheme();
  const width = useContentWidth();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, insets);
  const { language } = useLanguage();
  const route = useRoute();
  const { t } = useTranslation();
  const page = route.name as "Privacy" | "Terms";

  const slugs: Record<string, string> = {
    Privacy: "privacy",
    Terms: "terms",
  };

  const { data, isLoading, isError, isRefetching, error, refetch } = useQuery({
    queryKey: ["Page", page, language],
    queryFn: () => fetchPage(slugs?.[page]),
    enabled: !!page,
    staleTime: StaleTime.ONE_DAY,
  });

  // isError can be set by a failed background refetch even when cached data
  // is still showing (see fetchPage's cache fallback) — only show the
  // full-screen error when there's truly nothing to render.
  if (isError && !data)
    return (
      <ErrorOverlay
        title={t("page_unavailable")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );

  if (isLoading)
    return <ActivityIndicator testID="static-loading" size="large" style={styles.loader} />;

  if (!data) return null;

  return (
    <Layout
      withScroll={true}
      onRefresh={refetch}
      isRefreshing={isRefetching}
      style={styles.base}
      contentContainerStyle={styles.content}
    >
      <RenderHtml
        contentWidth={width - 32}
        source={{ html: data }}
        tagsStyles={{
          h2: {
            color: Colors.textMain,
            fontSize: 18,
            fontWeight: "600",
            marginTop: 24,
          },
          h3: {
            color: Colors.textMain,
            fontSize: 15,
            fontWeight: "500",
            marginTop: 16,
          },
          p: { color: Colors.textMiddle, fontSize: 14, lineHeight: 22 },
          li: { color: Colors.textMiddle, fontSize: 14, lineHeight: 22 },
          a: { color: Colors.main100 },
        }}
      />
    </Layout>
  );
};

export default StaticScreen;

const stylesFn = (Colors: ThemeColors, insets: EdgeInsets) =>
  StyleSheet.create({
    base: {
      paddingHorizontal: H_PAD,
      paddingTop: H_PAD,
    },
    content: {
      paddingBottom: insets.bottom + 24,
    },
    loader: {
      flex: 1,
    },
  });

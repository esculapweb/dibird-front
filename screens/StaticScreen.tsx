import {
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import RenderHtml from "react-native-render-html";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";

import Layout from "../components/ui/Layout";
import { fetchPage } from "../util/fetches";
import { useLanguage } from "../store/language-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import { RootStackScreenProps } from "../types";

const H_PAD = 16;

const StaticScreen = ({
  route,
}: RootStackScreenProps<"Privacy" | "Terms">) => {
  const { Colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, insets);
  const { language } = useLanguage();
  const page = route?.name;

  const slugs: Record<string, string> = {
    Privacy: "privacy",
    Terms: "cookie",
  };

  const { data, isLoading } = useQuery({
    queryKey: ["Page", page, language],
    queryFn: () => fetchPage(slugs?.[page]),
    enabled: !!page,
  });

  if (isLoading)
    return <ActivityIndicator size="large" style={styles.loader} />;

  if (!data) return null;

  return (
    <Layout
      withScroll={true}
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
    },
    content: {
      paddingBottom: insets.bottom + 24,
    },
    loader: {
      flex: 1,
    },
  });

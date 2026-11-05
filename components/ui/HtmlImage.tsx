import { useState } from "react";
import { Image } from "expo-image";
import {
  CustomBlockRenderer,
  CustomTagRendererRecord,
  useContentWidth,
} from "react-native-render-html";

// react-native-render-html draws <img> with react-native's own Image, which
// bypasses expo-image's disk cache used everywhere else in the app: pictures
// inside server HTML (species descriptions, static pages, territories) did
// not survive going offline and were never warmed by speciesImagePrefetch
// (#479). This renderer swaps in expo-image with the same cache policy as the
// rest of the app's thumbnails.

// Before the real size is known (no width/height attributes, not loaded yet)
// reserve a typical landscape box instead of a zero-height one, so the text
// below does not jump twice.
const FALLBACK_ASPECT_RATIO = 4 / 3;

const positiveNumber = (value: unknown): number | null => {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const HtmlImageRenderer: CustomBlockRenderer = ({ tnode }) => {
  const contentWidth = useContentWidth();
  const { src, alt, width, height } = tnode.attributes;

  const attrWidth = positiveNumber(width);
  const attrHeight = positiveNumber(height);
  const [loadedRatio, setLoadedRatio] = useState<number | null>(null);

  if (!src) return null;

  const aspectRatio =
    attrWidth && attrHeight
      ? attrWidth / attrHeight
      : (loadedRatio ?? FALLBACK_ASPECT_RATIO);

  return (
    <Image
      source={{ uri: src }}
      cachePolicy="disk"
      contentFit="contain"
      accessibilityLabel={alt || undefined}
      style={{ width: contentWidth, aspectRatio }}
      onLoad={({ source }) => {
        if (source.width > 0 && source.height > 0) {
          setLoadedRatio(source.width / source.height);
        }
      }}
      testID="html-image"
    />
  );
};

export const htmlRenderers: CustomTagRendererRecord = {
  img: HtmlImageRenderer,
};

import { createContext, ReactNode, useContext, useEffect } from "react";
import { DimensionValue, StyleProp, View, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../../../store/theme-context";

const PULSE_MIN = 0.45;
const PULSE_MS = 800;

// One shared value per group rather than one animation per bone: every
// placeholder on the screen pulses in step, and a list of 10 rows costs a
// single repeating animation instead of dozens.
const PulseContext = createContext<SharedValue<number> | null>(null);

export const SkeletonGroup = ({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) => {
  const pulse = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(PULSE_MIN, {
        duration: PULSE_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [reduceMotion]);

  return (
    <PulseContext.Provider value={pulse}>
      <View
        style={style}
        testID={testID}
        accessible
        accessibilityState={{ busy: true }}
      >
        {children}
      </View>
    </PulseContext.Provider>
  );
};

interface BoneProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  // A circle of `height` — avatars, icons.
  circle?: boolean;
  // Overrides the default placeholder colour, e.g. on accent-coloured cards
  // where the neutral grey would read as a hole.
  color?: string;
  // Multiplied into the pulse, so a bone can stay fainter than its
  // neighbours (secondary text lines) without breaking the shared rhythm.
  baseOpacity?: number;
  style?: StyleProp<ViewStyle>;
}

// A placeholder block. Outside a SkeletonGroup it simply doesn't pulse.
export const Bone = ({
  width = "100%",
  height = 14,
  radius = 6,
  circle = false,
  color,
  baseOpacity = 1,
  style,
}: BoneProps) => {
  const { Colors } = useTheme();
  const pulse = useContext(PulseContext);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: baseOpacity * (pulse ? pulse.value : 1),
  }));

  return (
    <Animated.View
      style={[
        {
          width: circle ? height : width,
          height,
          borderRadius: circle && typeof height === "number" ? height / 2 : radius,
          backgroundColor: color ?? Colors.imageBg,
        },
        style,
        animatedStyle,
      ]}
    />
  );
};

// Lines of text: full width except the last one, which is shorter so the
// block reads as a paragraph rather than a stack of bars.
export const SkeletonText = ({
  lines = 2,
  lineHeight = 13,
  gap = 6,
  lastWidth = "60%",
  style,
}: {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  lastWidth?: DimensionValue;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[{ gap }, style]}>
    {Array.from({ length: lines }).map((_, i) => (
      <Bone
        key={i}
        height={lineHeight}
        radius={4}
        width={i === lines - 1 && lines > 1 ? lastWidth : "100%"}
      />
    ))}
  </View>
);

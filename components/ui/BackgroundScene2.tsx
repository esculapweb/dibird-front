import { useState } from "react";
import { View, Dimensions } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme } from "../../store/theme-context";

const BackgroundScene2 = () => {
  const { isDark, Colors } = useTheme();
  const [size, setSize] = useState(() => {
    const { width, height } = Dimensions.get("window");
    return { width, height };
  });

  const W = size.width;
  const H = size.height;

  const hillsFar = `
    M0,${H}
    L0,${H * 0.82}
    Q${W * 0.25},${H * 0.68} ${W * 0.5},${H * 0.74}
    Q${W * 0.75},${H * 0.8} ${W},${H * 0.72}
    L${W},${H}
    Z
  `;

  const hillsMid = `
    M0,${H}
    L0,${H * 0.88}
    Q${W * 0.2},${H * 0.76} ${W * 0.45},${H * 0.82}
    Q${W * 0.72},${H * 0.88} ${W},${H * 0.79}
    L${W},${H}
    Z
  `;

  const hillsNear = `
    M0,${H}
    L0,${H * 0.93}
    Q${W * 0.3},${H * 0.84} ${W * 0.6},${H * 0.89}
    Q${W * 0.82},${H * 0.93} ${W},${H * 0.87}
    L${W},${H}
    Z
  `;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.backgroundMain,
      }}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      <Svg
        style={{ position: "absolute", top: 0, left: 0 }}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
      >
        {/* Stars — evenly spread over the whole height down to the hills */}
        {[
          // upper zone (as before)
          [0.08, 0.06],
          [0.18, 0.04],
          [0.3, 0.09],
          [0.42, 0.03],
          [0.55, 0.07],
          [0.65, 0.02],
          [0.75, 0.08],
          [0.88, 0.05],
          // middle zone
          [0.12, 0.18],
          [0.35, 0.22],
          [0.6, 0.16],
          [0.8, 0.2],
          [0.05, 0.3],
          [0.28, 0.35],
          [0.5, 0.28],
          [0.72, 0.33],
          [0.9, 0.27],
          [0.15, 0.42],
          [0.45, 0.4],
          [0.68, 0.45],
          // closer to the hills (smaller and dimmer)
          [0.22, 0.52],
          [0.58, 0.55],
          [0.85, 0.5],
          [0.38, 0.6],
        ].map(([fx, fy], i) => (
          <Circle
            key={i}
            cx={W * fx}
            cy={H * fy}
            r={fy > 0.45 ? 0.6 : 0.9 + (i % 3) * 0.3} // smaller towards the horizon
            fill={Colors.star}
            opacity={
              fy > 0.45
                ? 0.2 + (i % 3) * 0.08 // dimmer towards the horizon
                : 0.5 + (i % 4) * 0.12
            }
          />
        ))}

        {/* Hills — three depth layers */}
        <Path
          d={hillsFar}
          fill={Colors.main100}
          opacity={isDark ? 0.035 : 0.05}
        />
        <Path
          d={hillsMid}
          fill={Colors.main100}
          opacity={isDark ? 0.06 : 0.08}
        />
        <Path
          d={hillsNear}
          fill={Colors.main100}
          opacity={isDark ? 0.09 : 0.11}
        />

        {/* Birds */}
        <Path
          d={`M${W * 0.04} ${H * 0.18} Q${W * 0.07} ${H * 0.15} ${W * 0.1} ${H * 0.18} Q${W * 0.13} ${H * 0.15} ${W * 0.16} ${H * 0.18}`}
          stroke={Colors.main100}
          strokeWidth={1.4}
          fill="none"
          opacity={isDark ? 0.3 : 0.25}
          strokeLinecap="round"
        />
        <Path
          d={`M${W * 0.08} ${H * 0.26} Q${W * 0.1} ${H * 0.24} ${W * 0.12} ${H * 0.26} Q${W * 0.14} ${H * 0.24} ${W * 0.16} ${H * 0.26}`}
          stroke={Colors.main100}
          strokeWidth={1.0}
          fill="none"
          opacity={isDark ? 0.25 : 0.18}
          strokeLinecap="round"
        />
        <Path
          d={`M${W * 0.78} ${H * 0.14} Q${W * 0.81} ${H * 0.11} ${W * 0.84} ${H * 0.14} Q${W * 0.87} ${H * 0.11} ${W * 0.9} ${H * 0.14}`}
          stroke={Colors.main100}
          strokeWidth={1.4}
          fill="none"
          opacity={isDark ? 0.23 : 0.16}
          strokeLinecap="round"
        />
        <Path
          d={`M${W * 0.84} ${H * 0.22} Q${W * 0.86} ${H * 0.2} ${W * 0.88} ${H * 0.22} Q${W * 0.9} ${H * 0.2} ${W * 0.92} ${H * 0.22}`}
          stroke={Colors.main100}
          strokeWidth={1.0}
          fill="none"
          opacity={isDark ? 0.2 : 0.15}
          strokeLinecap="round"
        />
        {/* middle tier — smaller and dimmer */}
        <Path
          d={`M${W * 0.6} ${H * 0.38} Q${W * 0.62} ${H * 0.36} ${W * 0.64} ${H * 0.38} Q${W * 0.66} ${H * 0.36} ${W * 0.68} ${H * 0.38}`}
          stroke={Colors.main100}
          strokeWidth={0.9}
          fill="none"
          opacity={isDark ? 0.16 : 0.12}
          strokeLinecap="round"
        />
        <Path
          d={`M${W * 0.25} ${H * 0.44} Q${W * 0.27} ${H * 0.42} ${W * 0.29} ${H * 0.44} Q${W * 0.31} ${H * 0.42} ${W * 0.33} ${H * 0.44}`}
          stroke={Colors.main100}
          strokeWidth={0.8}
          fill="none"
          opacity={isDark ? 0.14 : 0.1}
          strokeLinecap="round"
        />

        {/* the far ones — near the horizon */}
        <Path
          d={`M${W * 0.5} ${H * 0.58} Q${W * 0.515} ${H * 0.565} ${W * 0.53} ${H * 0.58} Q${W * 0.545} ${H * 0.565} ${W * 0.56} ${H * 0.58}`}
          stroke={Colors.main100}
          strokeWidth={0.6}
          fill="none"
          opacity={isDark ? 0.1 : 0.08}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

export default BackgroundScene2;

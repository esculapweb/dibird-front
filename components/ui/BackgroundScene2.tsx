import { View, Dimensions } from "react-native";
import Svg, { Path, Polygon, Circle, Ellipse } from "react-native-svg";
import { useTheme } from "../../store/theme-context";

const { width, height } = Dimensions.get("screen");

const BackgroundScene2 = () => {
  const { isDark } = useTheme();

  const W = width;
  const H = height;

  const glowAmber = isDark ? "#F0C24B" : "#1d9e75";
  const treeColor = isDark ? "#F0C24B" : "#1d9e75";
  const starColor = "#E8D8B0";
  const birdColor = isDark ? "#F0C24B" : "#1d9e75";

  const trees = `
  0,${H}
  0,${H * 0.75}
  ${W * 0.05},${H * 0.6}
  ${W * 0.1},${H * 0.72}
  ${W * 0.15},${H * 0.55}
  ${W * 0.2},${H * 0.68}
  ${W * 0.26},${H * 0.52}
  ${W * 0.31},${H * 0.65}
  ${W * 0.37},${H * 0.57}
  ${W * 0.43},${H * 0.7}
  ${W * 0.5},${H * 0.53}
  ${W * 0.57},${H * 0.68}
  ${W * 0.63},${H * 0.56}
  ${W * 0.69},${H * 0.65}
  ${W * 0.74},${H * 0.51}
  ${W * 0.8},${H * 0.63}
  ${W * 0.86},${H * 0.55}
  ${W * 0.92},${H * 0.67}
  ${W},${H * 0.6}
  ${W},${H}
`.replace(/\n\s+/g, " ").trim();

  const treesFar = `
  0,${H}
  0,${H * 0.8}
  ${W * 0.08},${H * 0.7}
  ${W * 0.16},${H * 0.78}
  ${W * 0.25},${H * 0.67}
  ${W * 0.34},${H * 0.75}
  ${W * 0.43},${H * 0.69}
  ${W * 0.52},${H * 0.76}
  ${W * 0.61},${H * 0.68}
  ${W * 0.7},${H * 0.74}
  ${W * 0.79},${H * 0.67}
  ${W * 0.88},${H * 0.73}
  ${W},${H * 0.68}
  ${W},${H}
`.replace(/\n\s+/g, " ").trim();

  return (
    <View
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      pointerEvents="none"
    >
      <Svg
        style={{ position: "absolute", top: 0, left: 0, width: W, height: H }}
        viewBox={`0 0 ${W} ${H}`}
      >
        {/* Свечение горизонта */}
        <Ellipse
          cx={W / 2} cy={H * 0.72}
          rx={W * 0.9} ry={H * 0.18}
          fill={glowAmber}
          opacity={isDark ? 0.08 : 0.08}
        />
        <Ellipse
          cx={W / 2} cy={H * 0.75}
          rx={W * 0.6} ry={H * 0.1}
          fill={glowAmber}
          opacity={isDark ? 0.08 : 0.08}
        />

        {/* Звёзды */}
        {[
          [0.08, 0.06], [0.18, 0.04], [0.30, 0.09], [0.42, 0.03],
          [0.55, 0.07], [0.65, 0.02], [0.75, 0.08], [0.88, 0.05],
          [0.12, 0.15], [0.35, 0.18], [0.60, 0.13], [0.80, 0.16],
          [0.22, 0.24], [0.50, 0.22], [0.70, 0.20], [0.92, 0.18],
        ].map(([fx, fy], i) => (
          <Circle
            key={i}
            cx={W * fx} cy={H * fy}
            r={0.9 + (i % 3) * 0.3}
            fill={starColor}
            opacity={0.5 + (i % 4) * 0.12}
          />
        ))}

        {/* Дальний ряд деревьев */}
        <Polygon points={treesFar} fill={treeColor} opacity={isDark ? 0.03 : 0.05} />

        {/* Ближний ряд деревьев */}
        <Polygon points={trees} fill={treeColor} opacity={isDark ? 0.06 : 0.08} />

        {/* Птицы */}
        <Path
          d={`M${W * 0.04} ${H * 0.18} Q${W * 0.07} ${H * 0.15} ${W * 0.1} ${H * 0.18} Q${W * 0.13} ${H * 0.15} ${W * 0.16} ${H * 0.18}`}
          stroke={birdColor} strokeWidth={1.4} fill="none"
          opacity={isDark ? 0.3 : 0.25} strokeLinecap="round"
        />
        <Path
          d={`M${W * 0.08} ${H * 0.26} Q${W * 0.1} ${H * 0.24} ${W * 0.12} ${H * 0.26} Q${W * 0.14} ${H * 0.24} ${W * 0.16} ${H * 0.26}`}
          stroke={birdColor} strokeWidth={1.0} fill="none"
          opacity={isDark ? 0.25 : 0.18} strokeLinecap="round"
        />
        <Path
          d={`M${W * 0.78} ${H * 0.14} Q${W * 0.81} ${H * 0.11} ${W * 0.84} ${H * 0.14} Q${W * 0.87} ${H * 0.11} ${W * 0.9} ${H * 0.14}`}
          stroke={birdColor} strokeWidth={1.4} fill="none"
          opacity={isDark ? 0.23 : 0.16} strokeLinecap="round"
        />
        <Path
          d={`M${W * 0.84} ${H * 0.22} Q${W * 0.86} ${H * 0.2} ${W * 0.88} ${H * 0.22} Q${W * 0.9} ${H * 0.2} ${W * 0.92} ${H * 0.22}`}
          stroke={birdColor} strokeWidth={1.0} fill="none"
          opacity={isDark ? 0.2 : 0.15} strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

export default BackgroundScene2;
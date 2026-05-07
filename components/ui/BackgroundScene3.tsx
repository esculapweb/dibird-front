import { Fragment } from "react";
import { View, Dimensions } from "react-native";
import Svg, { Path, Rect, Ellipse, Line } from "react-native-svg";
import { useTheme } from "../../store/theme-context";

const { width, height } = Dimensions.get("screen");

const BackgroundScene3 = () => {
  const { isDark } = useTheme();

  const W = width;
  const H = height;

  const skyColor   = isDark ? "#1A2420" : "#E8EDE8";
  const mistColor  = isDark ? "#2A3530" : "#F0F3F0";
  const waterColor = isDark ? "#1E2E2A" : "#D4DEDE";
  const reedStem   = isDark ? "#8AAA78" : "#5A6A4A";
  const reedHead   = isDark ? "#4A6A3A" : "#3D4A2D";
  const ripple     = isDark ? "#4A6A60" : "#A8C0B8";

  const waterY = H * 0.62;

  // Reed helper
  const reeds = [
    { x: W * 0.04, stemH: H * 0.34, headY: H * 0.52, hW: 3.5, hH: 10, op: 0.85 },
    { x: W * 0.09, stemH: H * 0.30, headY: H * 0.49, hW: 3, hH: 9, op: 0.75 },
    { x: W * 0.14, stemH: H * 0.36, headY: H * 0.50, hW: 2.8, hH: 8, op: 0.65 },
    { x: W * 0.19, stemH: H * 0.28, headY: H * 0.51, hW: 3.5, hH: 9, op: 0.80 },
    { x: W * 0.24, stemH: H * 0.32, headY: H * 0.53, hW: 2.5, hH: 7, op: 0.60 },
    { x: W * 0.74, stemH: H * 0.33, headY: H * 0.51, hW: 3.5, hH: 10, op: 0.85 },
    { x: W * 0.79, stemH: H * 0.29, headY: H * 0.49, hW: 3, hH: 9, op: 0.75 },
    { x: W * 0.84, stemH: H * 0.36, headY: H * 0.52, hW: 2.8, hH: 8, op: 0.65 },
    { x: W * 0.89, stemH: H * 0.27, headY: H * 0.48, hW: 3.5, hH: 10, op: 0.85 },
    { x: W * 0.94, stemH: H * 0.31, headY: H * 0.50, hW: 2.5, hH: 7, op: 0.60 },
  ];

  return (
    <View
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      pointerEvents="none"
    >
      <Svg
        style={{ position: "absolute", top: 0, left: 0, width: W, height: H }}
        viewBox={`0 0 ${W} ${H}`}
      >
        {/* Sky */}
        <Rect x={0} y={0} width={W} height={waterY} fill={skyColor} />

        {/* Mist bands */}
        <Rect x={0} y={waterY * 0.72} width={W} height={waterY * 0.16} fill={mistColor} opacity={0.55} />
        <Rect x={0} y={waterY * 0.56} width={W} height={waterY * 0.18} fill={mistColor} opacity={0.3} />
        <Rect x={0} y={waterY * 0.38} width={W} height={waterY * 0.2} fill={mistColor} opacity={0.14} />

        {/* Water */}
        <Rect x={0} y={waterY} width={W} height={H - waterY} fill={waterColor} />

        {/* Shoreline curve */}
        <Path
          d={`M0 ${waterY} Q${W * 0.25} ${waterY - H * 0.015} ${W * 0.5} ${waterY} Q${W * 0.75} ${waterY + H * 0.015} ${W} ${waterY} L${W} ${waterY + 2} L0 ${waterY + 2} Z`}
          fill={isDark ? "#243028" : "#C8D8D0"}
          opacity={0.5}
        />

        {/* Reeds */}
        {reeds.map((r, i) => (
          <Fragment key={i}>
            <Line
              x1={r.x} y1={waterY + H * 0.06}
              x2={r.x + (i % 3 - 1) * W * 0.01} y2={waterY + H * 0.06 - r.stemH}
              stroke={reedStem} strokeWidth={1.5} opacity={r.op}
              strokeLinecap="round"
            />
            <Ellipse
              cx={r.x + (i % 3 - 1) * W * 0.01}
              cy={r.headY}
              rx={r.hW}
              ry={r.hH}
              fill={reedHead}
              opacity={r.op + 0.05}
            />
          </Fragment>
        ))}

        {/* Water ripples */}
        {[
          [0.5, 0.72, 0.2, 0.018, 0.45],
          [0.5, 0.72, 0.1, 0.010, 0.35],
          [0.28, 0.8, 0.14, 0.012, 0.35],
          [0.72, 0.85, 0.16, 0.014, 0.35],
          [0.5, 0.9, 0.08, 0.007, 0.25],
        ].map(([fx, fy, rx, ry, op], i) => (
          <Ellipse
            key={i}
            cx={W * fx} cy={H * fy}
            rx={W * rx} ry={H * ry}
            fill="none"
            stroke={ripple}
            strokeWidth={0.7}
            opacity={op}
          />
        ))}
      </Svg>
    </View>
  );
};

export default BackgroundScene3;
const { withAppBuildGradle, withGradleProperties } = require("@expo/config-plugins");

// Turns on the R8 *optimization* phase for release builds (Notion #470,
// PLAY_INSIGHTS_PLAN.md part 1).
//
// The prebuild template's app/build.gradle uses
// getDefaultProguardFile("proguard-android.txt"), and that file carries
// `-dontoptimize`: R8 runs in full mode and shrinks/obfuscates, but inlining,
// outlining, devirtualization and class merging stay off. That was the trigger
// of Play Console's "Improve your app's memory and performance with R8
// optimization" insight for 26.08.0. Google dropped support for that file for
// exactly this reason.
//
// `-dontoptimize` is a boolean flag — no rule appended through
// expo-build-properties' extraProguardRules can switch it back on. The only way
// is to swap the base file for proguard-android-optimize.txt, which is what
// this plugin does.
//
// The swap throws when the expected line is missing instead of skipping it: a
// silent no-op would ship an unoptimized build to Play, and nobody would know.
//
// Optimization is the one R8 phase that breaks reflection, and
// @maplibre/maplibre-react-native ships no consumer rules — so a release
// (preview APK) smoke run is required before production.

const DEFAULT_PROGUARD = 'getDefaultProguardFile("proguard-android.txt")';
const OPTIMIZE_PROGUARD = 'getDefaultProguardFile("proguard-android-optimize.txt")';

// Needed explicitly for AGP 8.12/8.13; AGP 9 turns it on together with
// shrinkResources.
const OPTIMIZED_RESOURCE_SHRINKING = "android.r8.optimizedResourceShrinking";

const withOptimizeProguardFile = (config) =>
  withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error(
        `withAndroidR8Optimization: expected a Groovy app/build.gradle, got ${config.modResults.language}.`,
      );
    }
    const contents = config.modResults.contents;
    if (contents.includes(OPTIMIZE_PROGUARD)) return config;
    if (!contents.includes(DEFAULT_PROGUARD)) {
      throw new Error(
        `withAndroidR8Optimization: ${DEFAULT_PROGUARD} not found in app/build.gradle — the prebuild template changed, check how the base ProGuard file is set now.`,
      );
    }
    config.modResults.contents = contents.replace(DEFAULT_PROGUARD, OPTIMIZE_PROGUARD);
    return config;
  });

const withOptimizedResourceShrinking = (config) =>
  withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (item) => item.type === "property" && item.key === OPTIMIZED_RESOURCE_SHRINKING,
    );
    if (existing) {
      existing.value = "true";
    } else {
      config.modResults.push({
        type: "property",
        key: OPTIMIZED_RESOURCE_SHRINKING,
        value: "true",
      });
    }
    return config;
  });

module.exports = function withAndroidR8Optimization(config) {
  return withOptimizedResourceShrinking(withOptimizeProguardFile(config));
};

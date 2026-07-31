const {
  AndroidConfig,
  withAndroidManifest,
  withInfoPlist,
} = require("@expo/config-plugins");

// The initial settings of the developer menu (expo-dev-menu) for the dev client.
//
// By default the dev client opens its menu on every launch and draws a floating
// gear on top of the app. The gear covers the buttons in the top right corner —
// in the observation editor that is the save button, and a tap on it opened the
// menu instead of submitting the form. The e2e scenarios had to sort this out by
// hand in every flow: `launchApp: clearState` wipes UserDefaults /
// SharedPreferences, where the menu keeps its state, so a gear switched off last
// time came back again.
//
// The keys are read by the native code as *default values* — from Info.plist on
// iOS (`DevMenuPreferences.setup`) and from the manifest <meta-data> on Android
// (`DevMenuDefaultPreferences.metaDataBool`). Toggling the switch in the menu
// itself still wins: this is a default, not a ban.
//
// The key names are the same on both platforms, which is why they are set here
// as a single list — drifting apart, they would give different behaviour on iOS
// and Android while silently producing no error.
//
// In preview/production builds there is no expo-dev-menu at all, there the keys
// simply lie around as dead weight — they need no separate branching by variant.
const DEV_MENU_DEFAULTS = {
  // The floating gear ("Tools button").
  EXDevMenuShowFloatingActionButton: false,
  // Whether to open the menu on start. This flag alone is not enough: both
  // platforms show the menu on `showsAtLaunch || !isOnboardingFinished`, so the
  // onboarding has to be marked as finished too — otherwise the menu would still
  // meet every clean launch, just with its welcome screen this time.
  EXDevMenuShowsAtLaunch: false,
  EXDevMenuIsOnboardingFinished: true,
};

module.exports = function withDevMenuDefaults(config) {
  const withIos = withInfoPlist(config, (config) => {
    Object.assign(config.modResults, DEV_MENU_DEFAULTS);
    return config;
  });

  return withAndroidManifest(withIos, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );

    for (const [name, value] of Object.entries(DEV_MENU_DEFAULTS)) {
      // As a string, not a boolean: it goes into the XML as text anyway, and
      // "true"/"false" is parsed back into a boolean by aapt — which is exactly
      // what getBoolean() expects on the other side.
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        name,
        String(value),
      );
    }

    return config;
  });
};

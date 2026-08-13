const variants = {
  development: {
    name: "DiBird (Dev)",
    bundleIdentifier: "com.dibird.app.dev",
    icon: "./assets/icon-dev.png",
    googleServicesFile: "./GoogleService-Info.dev.plist",
  },
  preview: {
    name: "DiBird (Preview)",
    bundleIdentifier: "com.dibird.app.preview",
    icon: "./assets/icon-preview.png",
    googleServicesFile: "./GoogleService-Info.preview.plist",
  },
  production: {
    name: "DiBird",
    bundleIdentifier: "com.dibird.app",
    icon: "./assets/icon.png",
    googleServicesFile: "./GoogleService-Info.plist",
  },
};

const env = process.env.EXPO_PUBLIC_ENV ?? "production";
const variant = variants[env];

// A typo'd or unexpected EXPO_PUBLIC_ENV used to blow up further down with a
// bare "cannot read property 'name' of undefined". Fail here instead, naming
// the culprit — silently falling back to a variant would be worse: it can ship
// production bundle ids and Google services into a dev build.
if (!variant) {
  throw new Error(
    `Unknown EXPO_PUBLIC_ENV "${env}". Expected one of: ${Object.keys(
      variants,
    ).join(", ")}.`,
  );
}

// Web paths the app claims as App Links / Universal Links. Must stay in sync
// with linking.ts (what getStateFromPath can resolve) AND with the backend's
// /.well-known/apple-app-site-association — a path missing from either side
// opens in the browser instead of the app.
const APP_LINK_PATHS = [
  "/accounts/confirm-email/",
  "/accounts/login/",
  "/accounts/signup/",
  "/my/",
  "/users/",
  // Legal pages — the same content the in-app StaticScreen renders.
  "/privacy/",
  "/terms/",
  // Countries catalogue and the two-country comparison.
  "/territory/",
  "/territory_compare/",
  // Taxonomy catalogue lists and the taxon detail pages.
  "/species/",
  "/extinct/",
  "/order/",
  "/family/",
  "/genus/",
];

// linking.ts strips the locale prefix before matching, so every path also has
// a Russian twin on the site.
const LOCALIZED_APP_LINK_PATHS = APP_LINK_PATHS.flatMap((path) => [
  path,
  `/ru${path}`,
]);

export default {
  expo: {
    name: variant.name,
    slug: "dibird",
    owner: "esculapweb",
    version: "26.08.0",
    orientation: "portrait",
    scheme: "dibird",
    userInterfaceStyle: "automatic",
    icon: variant.icon,
    updates: {
      fallbackToCacheTimeout: 0,
      url: "https://u.expo.dev/37f32021-5695-4c3a-a023-a5e8c07346ce",
    },
    ios: {
      bundleIdentifier: variant.bundleIdentifier,
      supportsTablet: true,
      requireFullScreen: true,
      associatedDomains: ["applinks:dibird.com"],
      googleServicesFile: variant.googleServicesFile,
      entitlements: {
        "aps-environment": env === "development" ? "development" : "production",
      },
      infoPlist: {
        NSFaceIDUsageDescription: "Used to sign in to DiBird using Face ID.",
        NSLocationWhenInUseUsageDescription:
          "DiBird uses your location to send you push alerts when rare birds are spotted nearby (your approximate coordinates are stored on our servers), to sort birdwatching spots by distance, and to display them on the map.",
        NSPhotoLibraryUsageDescription:
          "DiBird uses your photo library so you can select a profile picture. For example, you can choose an image from your gallery to set or update your avatar.",
        ITSAppUsesNonExemptEncryption: false,
        LSApplicationQueriesSchemes: ["mailto"],
        UIBackgroundModes: ["fetch", "remote-notification"],
      },
    },
    android: {
      package: "com.dibird.app",
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
        monochromeImage: "./assets/adaptive-icon-mono.png",
      },
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "POST_NOTIFICATIONS",
      ],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: LOCALIZED_APP_LINK_PATHS.map((pathPrefix) => ({
            scheme: "https",
            host: "dibird.com",
            pathPrefix,
          })),
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            // Expo 56 defaults to 35; Play stops accepting updates below 36
            // from the end of August 2026. Raised ahead of time — needs a run
            // on Android 16 (permissions, notifications, file picker).
            compileSdkVersion: 36,
            targetSdkVersion: 36,
          },
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          backgroundColor: "#ffffff",
          dark: {
            image: "./assets/splash-icon.png",
            backgroundColor: "#1b1b1b",
          },
          imageWidth: 150,
        },
      ],
      "expo-location",
      "expo-secure-store",
      "expo-localization",
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme:
            "com.googleusercontent.apps.135122891711-h2vjlr2ute6gtdfjk6ag8pb2bp2o1a71",
        },
      ],
      "@react-native-community/datetimepicker",
      "@maplibre/maplibre-react-native",
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          project: "react-native",
          organization: "dibirdcom",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#ffffff",
          sounds: [],
        },
      ],
      "./plugins/withLocationStrings",
      "./plugins/withModularHeaders",
      "./plugins/withDevMenuDefaults",
      "@react-native-firebase/app",
      [
        // The plugin is applied by autolinking even without this entry — it is
        // here only to switch the extras off. The picker takes photos from the
        // gallery only (components/Profile/Avatar.tsx, launchImageLibraryAsync),
        // yet by default it drags in RECORD_AUDIO and CAMERA (for video capture)
        // plus their default purpose strings in Info.plist. `false` does not
        // merely skip the permission, it blocks it — including from other
        // plugins, so RECORD_AUDIO will not come back via expo-audio.
        "expo-image-picker",
        {
          microphonePermission: false,
          cameraPermission: false,
        },
      ],
      [
        "expo-audio",
        {
          // Recordings are only played back
          // (components/Taxonomy/TaxonSoundRow.tsx), nothing is recorded. With
          // the default options the plugin puts RECORD_AUDIO into the manifest
          // and NSMicrophoneUsageDescription into Info.plist with its own
          // boilerplate "Allow DiBird to access your microphone": a permission
          // the app does not use, and a purpose string that explains nothing to
          // the reviewer.
          microphonePermission: false,
          recordAudioAndroid: false,
          // There is no background playback. Otherwise the plugin adds
          // FOREGROUND_SERVICE + FOREGROUND_SERVICE_MEDIA_PLAYBACK with its own
          // service (Play requires a separate declaration for those) and
          // UIBackgroundModes: audio (Apple 2.5.4 — a declared but unused
          // background mode).
          enableBackgroundPlayback: false,
        },
      ],
      "expo-font",
      "expo-image",
      "expo-sharing",
      "expo-sqlite",
      "expo-asset"
    ],
    extra: {
      eas: {
        projectId: "37f32021-5695-4c3a-a023-a5e8c07346ce",
      },
    },
    runtimeVersion: {
      policy: "appVersion",
    },
  },
};

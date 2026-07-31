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
    version: "26.07.2",
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
            // Expo 56 по умолчанию даёт 35; Play перестаёт принимать апдейты
            // ниже 36 с конца августа 2026. Поднято заранее — требует прогона
            // на Android 16 (разрешения, уведомления, выбор файла).
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
        // Плагин применяется автолинкингом и без этой записи — она нужна
        // только чтобы отключить лишнее. Пикер берёт исключительно фото из
        // галереи (components/Profile/Avatar.tsx, launchImageLibraryAsync), но
        // по умолчанию тянет за собой RECORD_AUDIO и CAMERA (для съёмки видео)
        // плюс их дефолтные purpose strings в Info.plist. `false` не просто не
        // добавляет разрешение, а блокирует его — в том числе от других
        // плагинов, поэтому RECORD_AUDIO не вернётся через expo-audio.
        "expo-image-picker",
        {
          microphonePermission: false,
          cameraPermission: false,
        },
      ],
      [
        "expo-audio",
        {
          // Записи только проигрываются (components/Taxonomy/TaxonSoundRow.tsx),
          // ничего не записывается. С дефолтными опциями плагин кладёт в
          // манифест RECORD_AUDIO, а в Info.plist — NSMicrophoneUsageDescription
          // со своей заготовкой «Allow DiBird to access your microphone»:
          // разрешение, которого приложение не использует, и purpose string,
          // который ничего не объясняет ревьюеру.
          microphonePermission: false,
          recordAudioAndroid: false,
          // Фонового воспроизведения нет. Иначе плагин добавляет
          // FOREGROUND_SERVICE + FOREGROUND_SERVICE_MEDIA_PLAYBACK со своим
          // сервисом (Play требует за них отдельную декларацию) и
          // UIBackgroundModes: audio (Apple 2.5.4 — заявленный, но
          // неиспользуемый background mode).
          enableBackgroundPlayback: false,
        },
      ],
      "expo-font",
      "expo-image",
      "expo-sharing",
      "expo-sqlite",
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

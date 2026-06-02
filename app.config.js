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

export default {
  expo: {
    name: variant.name,
    slug: "dibird",
    version: "26.06.0",
    orientation: "portrait",
    scheme: "dibird",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    icon: variant.icon,
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
      dark: {
        image: "./assets/splash-dark.png",
        resizeMode: "contain",
        backgroundColor: "#1b1b1b",
      },
    },
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
          "DiBird uses your location to sort bird watching spots by distance from you and save them on the map.",
        NSPhotoLibraryUsageDescription:
          "DiBird uses your photo library so you can select a profile picture. For example, you can choose an image from your gallery to set or update your avatar.",
        ITSAppUsesNonExemptEncryption: false,
        LSApplicationQueriesSchemes: ["mailto"],
        UIBackgroundModes: ["fetch", "remote-notification"],
      },
    },
    android: {
      package: "com.dibird.app",
      edgeToEdgeEnabled: true,
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
          data: [
            {
              scheme: "https",
              host: "dibird.com",
              pathPrefix: "/accounts/confirm-email/",
            },
            {
              scheme: "https",
              host: "dibird.com",
              pathPrefix: "/accounts/login/",
            },
            {
              scheme: "https",
              host: "dibird.com",
              pathPrefix: "/accounts/signup/",
            },
            {
              scheme: "https",
              host: "dibird.com",
              pathPrefix: "/my/",
            },
            {
              scheme: "https",
              host: "dibird.com",
              pathPrefix: "/users/",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    androidStatusBar: {
      backgroundColor: "#ffffff",
      barStyle: "dark-content",
      translucent: false,
    },
    plugins: [
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
        },
      ],
      "./plugins/withLocationStrings",
      "./plugins/withModularHeaders",
      "@react-native-firebase/app",
      "expo-font",
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

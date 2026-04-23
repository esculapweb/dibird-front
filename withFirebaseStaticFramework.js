const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withFirebaseStaticFramework(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      let contents = fs.readFileSync(podfilePath, "utf-8");

      if (!contents.includes("$RNFirebaseAsStaticFramework")) {
        contents = `$RNFirebaseAsStaticFramework = true\n` + contents;
      }

      if (!contents.includes("DEFINES_MODULE")) {
        contents = contents.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|
  installer.pods_project.targets.each do |target|
    if ['RNFBApp', 'RNFBCrashlytics', 'RNFBAnalytics'].include?(target.name)
      target.build_configurations.each do |config|
        config.build_settings['DEFINES_MODULE'] = 'YES'
      end
    end
  end`,
        );
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

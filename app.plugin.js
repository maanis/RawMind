// This Expo config plugin sets windowSoftInputMode=adjustResize on Android.
// This is the CORRECT fix for the keyboard layout bug — the OS resizes the
// window when keyboard opens, so React Native layout reflows naturally
// without any manual height adjustments or hacks.

const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidKeyboardFix(config) {
  return withAndroidManifest(config, (config) => {
    const mainActivity = config.modResults.manifest.application[0].activity.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      mainActivity.$['android:windowSoftInputMode'] = 'adjustResize';
    }

    return config;
  });
};

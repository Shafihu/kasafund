const baseConfig = require("./app.json").expo;

function googleIosUrlScheme(clientId) {
  const suffix = ".apps.googleusercontent.com";
  if (!clientId || !clientId.endsWith(suffix)) return "";
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

module.exports = () => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const iosUrlScheme = googleIosUrlScheme(iosClientId);

  return {
    ...baseConfig,
    ios: {
      ...baseConfig.ios,
      bundleIdentifier: "com.shafihu.kasafund",
    },
    android: {
      ...baseConfig.android,
      package: "com.shafihu.kasafund",
    },
    plugins: [
      ...baseConfig.plugins,
      ...(iosUrlScheme
        ? [
            [
              "@react-native-google-signin/google-signin",
              { iosUrlScheme },
            ],
          ]
        : []),
    ],
  };
};

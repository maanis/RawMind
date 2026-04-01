module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['@babel/plugin-syntax-import-meta']],
    env: {
      production: {
        plugins: ['react-native-web'],
      },
    },
  };
};

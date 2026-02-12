module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Necessário para WatermelonDB (decorators)
      // IMPORTANTE: decorators DEVE vir ANTES de class-properties
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      // Para WatermelonDB no web, precisamos de loose mode
      ['@babel/plugin-transform-class-properties', { loose: true }],
      // Para private methods no WatermelonDB
      ['@babel/plugin-transform-private-methods', { loose: true }],
      '@babel/plugin-transform-flow-strip-types',
    ],
  };
};

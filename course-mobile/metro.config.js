// The shared protocol package is synced into ./src/_shared (see
// scripts/sync-shared.js) so every bundled file lives under the project root —
// Metro's file map is unreliable for sources outside it on this RN version.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const sharedEntry = path.resolve(__dirname, 'src', '_shared', 'index.ts');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@courseneo/shared') {
    return { type: 'sourceFile', filePath: sharedEntry };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;

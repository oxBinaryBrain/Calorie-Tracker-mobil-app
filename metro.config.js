const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Serve the self-hosted Inter Variable font (assets/fonts) on web.
config.resolver.assetExts.push('woff2');

module.exports = config;

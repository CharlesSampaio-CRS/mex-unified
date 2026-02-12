const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Configure resolver for platform-specific extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'web.tsx', 'web.ts', 'web.jsx', 'web.js'];

// Ignore Next.js app directory on mobile platforms only
config.resolver.blockList = [
  // Ignore app directory (Next.js) on mobile
  /app\/.*\.tsx?$/,
  /app\/.*\.jsx?$/,
];

// Enable watchman for better performance
config.resolver.useWatchman = true;

module.exports = config;

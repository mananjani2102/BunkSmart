// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Cap Metro transform workers to avoid spawning excessive Node workers on high-core machines.
config.maxWorkers = 2;

module.exports = config;

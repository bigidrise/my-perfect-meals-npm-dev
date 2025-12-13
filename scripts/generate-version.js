#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get git commit hash (short)
let gitHash = 'dev';
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('⚠️  Could not get git hash, using "dev"');
}

// Get package version
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
);

// Generate version string: "1.0.0+2025.10.21.abc1234"
const date = new Date();
const dateStr = date.toISOString().split('T')[0].replace(/-/g, '.');
const version = `${packageJson.version}+${dateStr}.${gitHash}`;

// Create version object
const versionData = {
  version: version,
  builtAt: date.toISOString(),
  minSupported: '1.0.0', // Update this when you need to force updates
  changelogUrl: '/changelog' // Optional: link to changelog page
};

// Write to client/public/version.json
const outputPath = path.join(__dirname, '..', 'client', 'public', 'version.json');
fs.writeFileSync(outputPath, JSON.stringify(versionData, null, 2));

console.log(`✅ Generated version.json: ${version}`);
console.log(`   Path: ${outputPath}`);
console.log(`   Built at: ${versionData.builtAt}`);
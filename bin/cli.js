#!/usr/bin/env node

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateDir = resolve(__dirname, '..', 'template');

// Parse command line arguments
const args = process.argv.slice(2);
let projectName = null;
let configFile = null;
let appName = null;
let appSlug = null;
let engineUrl = null;
let orgPrefix = 'ai.ekka';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--config' || arg === '-c') {
    configFile = args[++i];
  } else if (arg === '--name' || arg === '-n') {
    appName = args[++i];
  } else if (arg === '--slug' || arg === '-s') {
    appSlug = args[++i];
  } else if (arg === '--engine-url' || arg === '-e') {
    engineUrl = args[++i];
  } else if (arg === '--org' || arg === '-o') {
    orgPrefix = args[++i];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: npx create-ekka-desktop-app [project-dir] [options]

Options:
  -c, --config <file>     Use config file (skips all prompts)
  -n, --name <name>       App display name
  -s, --slug <slug>       App identifier (lowercase, hyphens only)
  -e, --engine-url <url>  EKKA Engine URL (required)
  -o, --org <prefix>      Organization prefix (default: ai.ekka)
  -h, --help              Show this help

Examples:
  npx create-ekka-desktop-app my-app
  npx create-ekka-desktop-app my-app --engine-url https://api.ekka.ai
  npx create-ekka-desktop-app my-app --config ./app.config.json
`);
    process.exit(0);
  } else if (!arg.startsWith('-') && !projectName) {
    projectName = arg;
  }
}

// Helper to prompt for input
async function prompt(question, defaultValue = '') {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const displayDefault = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`${question}${displayDefault}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Helper to convert to title case
function titleCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper to slugify
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Validate slug
function isValidSlug(slug) {
  return /^[a-z][a-z0-9-]*$/.test(slug);
}

// Main
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  CREATE EKKA DESKTOP APP                     ║
╚══════════════════════════════════════════════════════════════╝
`);

  // If config file provided, load it and skip prompts
  let config = null;
  if (configFile) {
    if (!existsSync(configFile)) {
      console.error(`Error: Config file not found: ${configFile}`);
      process.exit(1);
    }
    try {
      config = JSON.parse(readFileSync(configFile, 'utf8'));
      console.log(`Using config from: ${configFile}\n`);
    } catch (e) {
      console.error(`Error: Invalid JSON in config file: ${e.message}`);
      process.exit(1);
    }
  }

  // Get project directory
  if (!projectName) {
    projectName = await prompt('Project directory', 'my-ekka-app');
  }

  const targetDir = resolve(process.cwd(), projectName);

  if (existsSync(targetDir)) {
    console.error(`\nError: Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  // Build config from flags, prompts, or config file
  if (!config) {
    // Get app name
    if (!appName) {
      appName = await prompt('App display name', titleCase(projectName));
    }

    // Get app slug
    if (!appSlug) {
      const defaultSlug = slugify(projectName);
      appSlug = await prompt('App identifier (lowercase, hyphens)', defaultSlug);
      while (!isValidSlug(appSlug)) {
        console.log('  ⚠ Must be lowercase letters, numbers, and hyphens only');
        appSlug = await prompt('App identifier (lowercase, hyphens)', defaultSlug);
      }
    }

    // Get engine URL
    if (!engineUrl) {
      engineUrl = await prompt('EKKA Engine URL', 'https://api.ekka.ai');
    }

    // Get org prefix (only prompt if not all values provided via flags)
    if (orgPrefix === 'ai.ekka' && !process.argv.includes('--engine-url') && !process.argv.includes('-e')) {
      const customOrg = await prompt('Organization prefix', 'ai.ekka');
      if (customOrg) orgPrefix = customOrg;
    }

    config = {
      app: {
        name: appName,
        slug: appSlug,
        identifier: `${orgPrefix}.${appSlug.replace(/-/g, '')}`
      },
      storage: {
        homeFolderName: `.${appSlug}`,
        keychainService: `${orgPrefix}.${appSlug.replace(/-/g, '')}`
      },
      engine: {
        url: engineUrl
      }
    };
  }

  // Validate config
  if (!config.app?.slug) {
    console.error('\nError: app.slug is required in config');
    process.exit(1);
  }
  if (!config.engine?.url) {
    console.error('\nError: engine.url is required in config');
    process.exit(1);
  }

  // Derive missing values
  config.app.name = config.app.name || titleCase(config.app.slug);
  config.app.identifier = config.app.identifier || `ai.ekka.${config.app.slug.replace(/-/g, '')}`;
  config.storage = config.storage || {};
  config.storage.homeFolderName = config.storage.homeFolderName || `.${config.app.slug}`;
  config.storage.keychainService = config.storage.keychainService || config.app.identifier;

  console.log(`
Creating EKKA desktop app in ${targetDir}...

  App Name:     ${config.app.name}
  App Slug:     ${config.app.slug}
  Identifier:   ${config.app.identifier}
  Home Folder:  ~/${config.storage.homeFolderName}
  Engine URL:   ${config.engine.url}
`);

  // Copy template
  mkdirSync(targetDir, { recursive: true });
  cpSync(templateDir, targetDir, { recursive: true });

  // Write app.config.json
  const appConfigPath = join(targetDir, 'app.config.json');
  writeFileSync(appConfigPath, JSON.stringify(config, null, 2) + '\n');

  // Update package.json with project name
  const pkgPath = join(targetDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = config.app.slug;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // Update branding/app.json
  const brandingPath = join(targetDir, 'branding', 'app.json');
  const branding = JSON.parse(readFileSync(brandingPath, 'utf8'));
  branding.name = config.app.name;
  branding.bundleId = config.app.identifier;
  writeFileSync(brandingPath, JSON.stringify(branding, null, 2) + '\n');

  // Update src-tauri/Cargo.toml crate name
  const cargoPath = join(targetDir, 'src-tauri', 'Cargo.toml');
  let cargoContent = readFileSync(cargoPath, 'utf8');
  cargoContent = cargoContent.replace(/^name = ".*"$/m, `name = "${config.app.slug}"`);
  cargoContent = cargoContent.replace(/^description = ".*"$/m, `description = "${config.app.name}"`);
  writeFileSync(cargoPath, cargoContent);

  // Update src-tauri/tauri.conf.json identifier
  const tauriConfPath = join(targetDir, 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  tauriConf.identifier = config.app.identifier;
  writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  SUCCESS! Your app is ready.                                 ║
╚══════════════════════════════════════════════════════════════╝

To get started:

  cd ${projectName}
  npm install
  npm run ekka:dev

Configuration:
  Edit app.config.json to change app identity or engine URL.

Build:
  npm run ekka:build
`);
}

main().catch(console.error);

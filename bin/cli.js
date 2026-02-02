#!/usr/bin/env node

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateDir = resolve(__dirname, '..', 'template');

const projectName = process.argv[2];

if (!projectName) {
  console.error('Usage: npx create-ekka-desktop-app <project-name>');
  process.exit(1);
}

const targetDir = resolve(process.cwd(), projectName);

if (existsSync(targetDir)) {
  console.error(`Error: Directory "${projectName}" already exists.`);
  process.exit(1);
}

console.log(`Creating EKKA desktop app in ${targetDir}...`);

// Copy template
mkdirSync(targetDir, { recursive: true });
cpSync(templateDir, targetDir, { recursive: true });

// Update package.json with project name
const pkgPath = join(targetDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.name = projectName;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Update branding/app.json with project name
const brandingPath = join(targetDir, 'branding', 'app.json');
const branding = JSON.parse(readFileSync(brandingPath, 'utf8'));
// Convert project-name to "Project Name" for display
const displayName = projectName
  .split('-')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');
// Convert project-name to ai.ekka.projectname for bundleId
const bundleId = `ai.ekka.${projectName.replace(/-/g, '')}`;
branding.name = displayName;
branding.bundleId = bundleId;
writeFileSync(brandingPath, JSON.stringify(branding, null, 2) + '\n');

// Update src-tauri/Cargo.toml crate name
const cargoPath = join(targetDir, 'src-tauri', 'Cargo.toml');
let cargoContent = readFileSync(cargoPath, 'utf8');
cargoContent = cargoContent.replace(/^name = ".*"$/m, `name = "${projectName}"`);
cargoContent = cargoContent.replace(/^description = ".*"$/m, `description = "${displayName}"`);
writeFileSync(cargoPath, cargoContent);

console.log(`
Done! To get started:

  cd ${projectName}
  npm install

Development:
  npm start            # Web (browser)
  npm run tauri:dev    # Desktop (native window)

Build:
  npm run tauri:build  # Create distributable app

Edit src/app/App.tsx to build your UI.
Delete src/demo/ when ready.
`);

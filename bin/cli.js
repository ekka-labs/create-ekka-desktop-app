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

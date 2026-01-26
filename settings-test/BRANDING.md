# Branding

All app branding is controlled from a single location: the `branding/` folder.

## How to Rebrand

1. **Edit `branding/app.json`** to change app metadata:
   ```json
   {
     "name": "Your App Name",
     "bundleId": "com.yourcompany.yourapp",
     "version": "1.0.0",
     "iconIcns": "branding/icon.icns"
   }
   ```

2. **Replace `branding/icon.icns`** with your own macOS icon file.

That's it. No code changes required.

## Fields

| Field | Description |
|-------|-------------|
| `name` | Display name shown in Finder, Dock, and menu bar |
| `bundleId` | Unique identifier (reverse-domain format) |
| `version` | Semantic version number |
| `iconIcns` | Path to macOS icon file (relative to project root) |

## Build Pipeline

The build pipeline reads branding exclusively from `branding/app.json` and `branding/icon.icns`.
If either file is missing, the build will fail.

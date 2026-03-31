# ColourMate

A mobile paint collection manager for artists. Track your physical paint inventory, identify colours from your camera, explore the full collection in a 3D Munsell colour space, and find mix recipes to match any colour.

Built with Expo (React Native) and runs on Android and iOS.

---

## Features

- **Inventory** — Browse the full paint catalogue, add colours to your personal inventory, search by name and filter by brand or inventory status
- **Colour Picker** — Sample a colour from your camera or photo library and find the closest matching paints in your collection
- **3D Colour Space** — Visualise all colours plotted in a Munsell-based 3D space; orbit with pan and pinch gestures, tap any point to open its detail
- **Colour Detail** — View hex, RGB, and Munsell notation for each colour; edit its name, brand, and tags; open the mix sheet
- **Mix Sheet** — Find two-paint mix recipes that approximate a target colour using perceptual distance in Munsell XYZ space; filter candidates to inventory-only paints

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Expo SDK / React Native |
| Navigation | Expo Router (file-based) |
| Database | expo-sqlite |
| Colour math | @texel/color (sRGB ↔ OKLCH) |
| 3D rendering | three.js via expo-three / expo-gl |
| Testing | Vitest |
| Language | TypeScript (strict) |

---

## Project Structure

```
src/
  colour/
    models/          # ColourPoint aggregate
    repositories/    # SQLite repository implementation
    services/        # Colour conversion, filtering, mix logic
    ui/
      components/    # FilterSheet, MixSheet, MunsellCanvas
      hooks/         # useMunsellScene (Three.js lifecycle)
  inventory/
    models/          # Inventory aggregate
    repositories/    # SQLite repository implementation
  infrastructure/
    db/
      migration/     # Versioned schema migrations
    seed/            # Seed data (swatches.json, orange.json)
  ui/
    components/      # Shared components (IconSymbol, ThemedText)
    hooks/           # useColorScheme
app/
  (tabs)/            # Tab screens: index, colourPicker, munsell3d
  colour/[id].tsx    # Colour detail screen
```

### Colour pipeline

Every `ColourPoint` stores the full conversion chain computed at creation time:

```
sRGB → OKLCH (@texel/color) → Munsell-like (hue°, value, chroma) → XYZ coordinate (3D position)
```

---

## Development

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- For Android builds: Android SDK + NDK

### Install

```bash
npm install
```

### Run

```bash
npm start          # Expo dev server (scan QR with Expo Go)
npm run android    # Android emulator
npm run ios        # iOS simulator
```

### Test

```bash
npm test           # Watch mode
npm run test:run   # Run once
npm run test:coverage
```

### Lint

```bash
npm run lint
```

---

## Building a Release APK (Android)

> Requires Android SDK at `~/android-sdk` and NDK installed.

```bash
# 1. Clean previous build artifacts
ANDROID_HOME=~/android-sdk ./android/gradlew -p android clean

# 2. Build release APK (JS bundle is generated automatically)
ANDROID_HOME=~/android-sdk ./android/gradlew -p android assembleRelease 2>&1 | tail -30
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

> If the build fails with a `ninja: error` after cleaning, delete the CMake cache and retry:
> ```bash
> rm -rf android/app/.cxx android/app/build
> ```

---

## Seed Data

Paint colours are bundled as JSON at `src/infrastructure/seed/swatches.json` and seeded into SQLite on first launch. To update the seed data:

1. Edit `swatches.json`
2. Clean and rebuild the APK (`gradlew clean assembleRelease`)
3. Uninstall the old app from your device
4. Install and launch the new APK — fresh seed runs automatically

---

## Database Migrations

Migrations live in `src/infrastructure/db/migration/` and run in order on app start via `migrateDb()`. The current schema version is tracked with `PRAGMA user_version`. To add a migration, create `00N_description.ts` exporting an `up(db)` function and register it in `migrate.ts`.

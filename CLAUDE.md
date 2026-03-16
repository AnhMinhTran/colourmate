# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ColourMate is an Expo React Native application focused on color management and conversion between different color spaces. The app handles color data conversion between sRGB, OKLCH, Munsell-like, and XYZ coordinate systems, with SQLite persistence for color data storage.

## Development Commands

### Core Development
- `npm install` - Install dependencies
- `npm start` or `npx expo start` - Start development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser
- `npm run reset-project` - Move current app to app-example and create blank app directory

### Code Quality & Testing
- `npm run lint` - Run ESLint using expo-config
- `npm test` - Run tests in watch mode using Vitest
- `npm run test:run` - Run all tests once
- `npm run test:coverage` - Generate test coverage reports

### Single Test Execution
- `npx vitest run tests/colour/models/colourPoint.test.ts` - Run specific test file
- `npx vitest run --reporter=verbose tests/path/to/test.ts` - Run with detailed output

## Architecture & Structure

### Domain-Driven Design Organization
The codebase follows domain-driven design patterns organized under `src/colour/`:

- **Models**: Core domain entities (e.g., `ColourPoint`) with business logic and validation
- **Services**: Color conversion logic and business operations
- **Repositories**: Data access interfaces (currently interface-only)
- **UI**: React Native components, hooks, and styling organized by feature

### Color Conversion Pipeline
The core domain revolves around `ColourPoint` which automatically converts colors through this pipeline:
1. Input: sRGB color values
2. Convert to OKLCH color space using `@texel/color` library
3. Derive Munsell-like representation for perceptual consistency
4. Calculate XYZ coordinates for 3D color space positioning

### Key Domain Services
- `colourConversion.ts` - sRGB ↔ OKLCH conversions using @texel/color
- `deriveMunsellFromOklch.ts` - OKLCH → Munsell-like color representation
- `munsellToXYZ.ts` - Munsell-like → XYZ coordinate conversion for spatial positioning

## File-Based Routing Structure

Uses Expo Router with these conventions:
- `app/(tabs)/` - Tab-based navigation screens
- `app/_layout.tsx` - Root layout with theme provider and navigation setup
- `app/modal.tsx` - Modal presentation screen
- Components use `@/` alias for absolute imports from project root

## Testing Patterns

### Vitest Configuration
- Tests located in `tests/` directory mirroring `src/` structure
- Node environment for unit tests, excludes UI components from coverage
- Mocks Expo dependencies (e.g., `expo-crypto` for UUID generation)
- Coverage reports in HTML, text, and LCOV formats

### Test Structure Example
```typescript
// Mock Expo dependencies at top of test files
vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-1234"),
}));

// Use describe blocks for logical grouping
describe("ColourPoint.create", () => {
  it("validates required fields and throws meaningful errors", () => {
    // Test validation logic
  });
});
```

## Data Layer

### Repository Pattern
- Interfaces defined in `repositories/` for data access abstraction
- SQLite database using `expo-sqlite` (schema in `src/infrastructure/db/`)
- Currently interface-only - implementations needed for full persistence

### Domain Model Rules
- `ColourPoint` uses factory method (`ColourPoint.create()`) for creation
- Automatic UUID generation for entities
- Input validation with meaningful error messages
- Immutable ID field, mutable properties for updates

## Theme & Styling

### Theme System
- Dark/light theme support via `@react-navigation/native`
- Custom themed components (`ThemedText`, `ThemedView`) in `src/colour/ui/components/`
- Platform-specific styling where needed
- Color scheme detection hook at `src/colour/ui/hooks/use-color-scheme`

## Dependencies & Libraries

### Core Dependencies
- **@texel/color**: Professional color space conversions (sRGB, OKLCH, etc.)
- **expo-sqlite**: Local data persistence
- **expo-router**: File-based navigation routing
- **react-native-reanimated**: Animations and interactions

### Development Dependencies
- **Vitest**: Testing framework with coverage
- **TypeScript**: Strict mode enabled for type safety
- **ESLint**: Code linting with Expo configuration

## Path Aliases
- `@/*` maps to project root for absolute imports
- Use `@/src/colour/...` for domain imports
- Use `@/components/...` for shared UI components
- Use `@/assets/...` for static resources
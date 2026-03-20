# Image Color Picker Feature Implementation Plan

## Context

The user wants to add functionality to their ColourMate Expo React Native app that allows users to:
1. Select an image from the device gallery
2. Move a cursor over the image to examine RGB colors at different points
3. Add those extracted RGB colors to their existing ColourPoint system

This feature will complement the existing manual RGB input functionality by allowing users to extract colors directly from real-world images. The app already has a solid domain-driven architecture with ColourPoint.create() handling automatic conversion from sRGB to OKLCH, Munsell-like, and XYZ coordinates.

## Current Architecture Analysis

### Existing ColourPoint Integration
- `ColourPoint.create({name, brand, rgb: {r, g, b}, tag: []})` in `src/colour/models/colourPoint.ts:45`
- Automatic color space conversions using `@texel/color` library
- SQLite persistence via repository pattern
- Current UI shows manual RGB input form in `app/(tabs)/index.tsx`

### Navigation Structure
- Tab-based navigation with "Home" and "Explore" tabs
- "Explore" tab currently shows placeholder content - perfect candidate for this feature
- Uses themed components (`ThemedText`, `ThemedView`) for consistency

### Available Dependencies
- `expo-image` already installed for image display
- `react-native-gesture-handler` and `react-native-reanimated` for interactions
- Need to add: `expo-image-picker` for gallery selection

## Implementation Approach

### 1. Add Required Dependencies
```bash
npx expo install expo-image-picker expo-gl expo-gl-cpp
```

### 2. Create Image Color Picker Components

#### Core Component: `ImageColorPicker.tsx`
Location: `src/colour/ui/components/image-color-picker.tsx`

**Purpose**: Main component that handles the complete image color picking workflow
**Key Features**:
- Image selection from gallery using `expo-image-picker`
- Image display with overlay for cursor interaction
- Touch/pan gesture handling for cursor movement
- Real-time RGB extraction at cursor position
- Integration with ColourPoint creation flow

**Technical Implementation**:
- Use `expo-image` for optimized image rendering
- Overlay a `View` with absolute positioning for the cursor
- Use `PanGestureHandler` from `react-native-gesture-handler` for smooth cursor movement
- Extract pixel data using Canvas approach or ImageData API via expo-gl/expo-gl-cpp

#### Supporting Component: `ColorCursor.tsx`
Location: `src/colour/ui/components/color-cursor.tsx`

**Purpose**: Draggable visual cursor/crosshair that shows current position and extracted color
**Features**:
- Crosshair design with center point indicator
- Real-time color preview (small swatch showing extracted RGB)
- Smooth drag interaction using `PanGestureHandler`
- Live color updates as user drags cursor around image

#### Supporting Component: `ColorExtractionForm.tsx`
Location: `src/colour/ui/components/color-extraction-form.tsx`

**Purpose**: Form to input name, brand, and tags for the extracted color
**Integration**: Pre-populates RGB values from cursor selection, allows user to add metadata

### 3. Pixel Color Extraction Strategy

**Approach**: expo-gl with GLView (chosen for future 3D Munsell rendering consistency)
- Load image as texture in GL context
- Use `gl.readPixels()` for direct pixel buffer access at cursor coordinates
- Extract RGBA values and convert to RGB (0-255 range) for ColourPoint.create()
- More performant for large images and real-time color extraction
- Provides foundation for future 3D color space visualization

### 4. Modal Integration on Home Tab
Add "Pick from Image" button on the Home tab (`app/(tabs)/index.tsx`) that opens the ImageColorPicker in a modal.
- Keeps all color creation options centralized on main screen
- Uses expo-router modal navigation pattern

### 5. Integration Workflow
1. User taps "Pick from Image" button on Home tab
2. Modal opens with ImageColorPicker component
3. `expo-image-picker` opens gallery selection
4. Selected image displays in expo-gl GLView
5. User drags cursor over image to explore colors with real-time preview
6. When satisfied with a color, user taps "Extract Color"
7. ColorExtractionForm appears with RGB pre-filled from cursor position
8. User adds name, brand, tags and saves
9. `ColourPoint.create()` handles conversion and persistence
10. Modal closes and new color appears in Home tab list

## Critical Files to Modify

### New Files to Create
- `src/colour/ui/components/image-color-picker.tsx` - Main component
- `src/colour/ui/components/color-cursor.tsx` - Cursor overlay
- `src/colour/ui/components/color-extraction-form.tsx` - Metadata input form

### Files to Modify
- `app/(tabs)/index.tsx` - Add "Pick from Image" button and modal navigation
- `app/modal.tsx` - Implement ImageColorPicker modal screen
- `package.json` - Add expo-image-picker, expo-gl, expo-gl-cpp dependencies

### Files to Reference
- `src/colour/models/colourPoint.ts` - Reuse ColourPoint.create() method
- `src/colour/repositories/sqliteColourPointRepository.ts` - Reuse persistence
- `src/colour/ui/components/themed-text.tsx` - Consistent styling
- `src/colour/ui/components/themed-view.tsx` - Consistent styling

## Testing Strategy

### Unit Tests
- Test color extraction logic with known pixel values
- Test RGB conversion accuracy
- Test ColourPoint integration with extracted values

### Integration Tests
- Test complete workflow from image selection to ColourPoint creation
- Test gesture handling and cursor positioning
- Test form validation and submission

### Manual Testing
- Test on various image formats (JPG, PNG, WEBP)
- Test with different image sizes and orientations
- Verify color accuracy by comparing with known color values
- Test on both iOS and Android platforms

## Technical Considerations

### Performance
- Large images may impact performance - consider image resizing
- Debounce color extraction during rapid cursor movement
- Optimize re-renders with proper React optimization

### User Experience
- Clear visual feedback for cursor position
- Smooth gesture handling without lag
- Intuitive color preview and confirmation flow
- Helpful instructions and error states

### Platform Compatibility
- Ensure expo-image-picker works on both iOS and Android
- Test permission handling for photo gallery access
- Verify color extraction accuracy across devices

## Architectural Considerations

### UI Structure Refactoring Recommendation
**Current Issue**: The UI components are currently located in `src/colour/ui/` but these are cross-cutting concerns used throughout the app, not domain-specific to colour functionality.

**Current Structure:**
```
src/colour/ui/
├── components/ (ThemedText, ThemedView, etc.)
├── hooks/ (use-theme-color, use-color-scheme)
└── constants/ (theme)
```

**Improved Structure:**
```
src/ui/ (or src/shared/ui/)
├── components/ (ThemedText, ThemedView, etc.)
├── hooks/ (use-theme-color, use-color-scheme)
└── constants/ (theme)

src/colour/
├── models/
├── services/
└── repositories/
```

**Benefits:**
- Better separation of concerns: Domain layer vs UI layer
- Cleaner imports: `@/src/ui/components/themed-text` instead of `@/src/colour/ui/components/themed-text`
- Better reflects that these are app-wide UI building blocks
- Follows proper layered architecture principles

### Alternative Pixel Extraction Approaches

**Option 1: expo-gl with GLView (Recommended)**
- Load image as texture in GL context
- Use `gl.readPixels()` for direct pixel buffer access
- More performant for large images and real-time extraction
- Provides foundation for future 3D color space visualization

**Option 2: react-native-canvas**
- Load image onto HTML5 canvas via WebView bridge
- Use `getImageData()` for pixel access
- Simpler implementation but less performant
- May have cross-platform consistency issues

**Option 3: Native Module Approach**
- Custom native modules for iOS/Android
- Direct access to platform image processing APIs
- Highest performance but requires native development
- More complex deployment and maintenance

## Security & Privacy Considerations

### Photo Gallery Permissions
- Request photo library access permissions properly
- Handle permission denied scenarios gracefully
- Follow platform-specific permission best practices (iOS Info.plist, Android manifest)

### Image Data Handling
- Process images locally only - no external uploads
- Respect user privacy by not storing original images
- Only extract and store RGB color values, not image data
- Clear temporary image data from memory after processing

### Error Handling
- Handle corrupted or unsupported image files gracefully
- Manage memory constraints with large images
- Provide user-friendly error messages for common issues

## Performance Optimizations

### Image Processing
- Implement image resizing for very large images (>2MB)
- Use image caching to avoid re-processing same images
- Debounce color extraction during rapid cursor movement (300ms delay)
- Optimize re-renders with React.memo and useMemo

### Memory Management
- Dispose of GL textures properly to prevent memory leaks
- Use weak references for image data where possible
- Implement proper cleanup in useEffect cleanup functions

### User Experience Optimizations
- Show loading states during image processing
- Provide visual feedback during color extraction
- Pre-load common UI elements for smooth interactions
- Implement haptic feedback for cursor interactions (iOS/Android)

## Future Enhancements

### Advanced Color Analysis
- Color palette extraction (dominant colors from image)
- Color harmony analysis based on extracted colors
- Integration with existing color theory features

### Export Capabilities
- Export color palettes as JSON or CSV
- Share extracted colors via system sharing
- Integration with design tools (Adobe, Figma)

### Image Enhancement
- Basic image adjustment tools (brightness, contrast)
- Color space visualization overlay on images
- Historical color extraction tracking

## Verification Plan

### End-to-End Testing
1. Install expo-image-picker dependency successfully
2. Navigate to Explore tab and see new image color picker interface
3. Select image from gallery using picker
4. Move cursor over image and observe real-time color changes
5. Extract a color and verify RGB values are accurate
6. Complete form with name/brand/tags and save
7. Verify color appears in Home tab list with correct color swatch
8. Verify all color space conversions (OKLCH, XYZ) are working correctly

### Code Quality Verification
- All new components follow existing theming patterns
- Proper TypeScript types throughout
- Comprehensive error handling for image loading and permissions
- Follows project's clean code and SOLID principles
- Adequate test coverage for new functionality

### Performance Testing
- Test with various image sizes (1MB to 10MB+)
- Verify smooth cursor movement on older devices
- Test memory usage during extended color extraction sessions
- Validate color extraction accuracy across different image formats

### Accessibility Testing
- Ensure components work with screen readers
- Test keyboard navigation support
- Verify color contrast ratios for UI elements
- Test with device accessibility features enabled
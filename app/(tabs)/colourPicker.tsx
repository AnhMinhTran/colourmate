import { GLView } from 'expo-gl';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColourPoint } from '@/src/colour/models/colourPoint';
import { SqliteColourPointRepository } from '@/src/colour/repositories/sqliteColourPointRepository';
import {
  ColourFilter,
  ColourMatch,
  EMPTY_FILTER,
  filterColours,
  findNearestColours,
  isFilterActive,
} from '@/src/colour/services/colourQueryService';
import { FilterSheet } from '@/src/colour/ui/components/filter-sheet';
import { MixSheet } from '@/src/colour/ui/components/mix-sheet';
import { PickerCursor } from '@/src/colour/ui/components/picker-cursor';
import { useGlColourSampler } from '@/src/colour/ui/hooks/use-gl-colour-sampler';
import { useImageTransform } from '@/src/colour/ui/hooks/use-image-transform';
import { ImageInfo } from '@/src/colour/ui/types';
import { SqliteInventoryRepository } from '@/src/inventory/repositories/sqliteInventoryRepository';
import { IconSymbol } from '@/src/ui/components/icon-symbol';
import { AppColors } from '@/src/ui/constants/theme';

const AnimatedImage = Animated.createAnimatedComponent(Image);

function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

// ---------------------------------------------------------------------------
// MatchCard
// ---------------------------------------------------------------------------
function MatchCard({ match, inInventory, onPress }: { match: ColourMatch; inInventory: boolean; onPress: () => void }) {
  const { colour } = match;
  const bg = `rgb(${colour.rgb.r}, ${colour.rgb.g}, ${colour.rgb.b})`;
  return (
    <Pressable style={s.matchCard} onPress={onPress}>
      <View style={s.matchCardTop}>
        <View style={[s.matchSwatch, { backgroundColor: bg }]} />
        <View style={s.matchInfo}>
          <View style={s.matchNameRow}>
            <Text style={s.matchName}>{colour.name}</Text>
            {inInventory && (
              <View style={s.inventoryBadge}>
                <Text style={s.inventoryBadgeText}>In Inventory</Text>
              </View>
            )}
          </View>
          <Text style={s.matchBrand}>{colour.brand}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// ColourPickerScreen
// ---------------------------------------------------------------------------
export default function ColourPickerScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const colourRepo = useMemo(() => new SqliteColourPointRepository(db), [db]);
  const inventoryRepo = useMemo(() => new SqliteInventoryRepository(db), [db]);
  const insets = useSafeAreaInsets();

  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const containerSizeRef = useRef({ width: 300, height: 225 });

  const { gesture, imageStyle, scale, translateX, translateY, resetTransform } =
    useImageTransform();
  const { onContextCreate, sampledColor } = useGlColourSampler({
    imageInfo,
    containerSizeRef,
    scale,
    translateX,
    translateY,
  });

  const [colours, setColours] = useState<ColourPoint[]>([]);
  const [inventoryIds, setInventoryIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ColourFilter>(EMPTY_FILTER);
  const [showFilter, setShowFilter] = useState(false);
  const [matches, setMatches] = useState<ColourMatch[] | null>(null);
  const [showMix, setShowMix] = useState(false);

  useEffect(() => {
    Promise.all([colourRepo.findAll(), inventoryRepo.findAll()]).then(
      ([allColours, allInventory]) => {
        setColours(allColours);
        setInventoryIds(new Set(allInventory.map((i) => i.colour_id)));
      },
    );
  }, [colourRepo, inventoryRepo]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Media library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      resetTransform();
      setImageInfo({ uri: asset.uri, width: asset.width, height: asset.height });
      setMatches(null);
    }
  };

  const findNearest = useCallback(() => {
    if (!sampledColor) return;
    const candidates = filterColours(colours, { ...filter, search: '' }, inventoryIds);
    setMatches(findNearestColours(sampledColor, candidates));
  }, [sampledColor, colours, filter, inventoryIds]);

  const allBrands = useMemo(
    () => [...new Set(colours.map((c) => c.brand))].sort(),
    [colours],
  );

  const filterActive = isFilterActive(filter);
  const hex = sampledColor ? toHex(sampledColor.r, sampledColor.g, sampledColor.b) : null;

  return (
    <ScrollView
      style={[s.screen, { paddingTop: insets.top }]}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.title}>Colourmate</Text>

      {/* How to use banner */}
      <View style={s.infoBanner}>
        <IconSymbol name="info.circle" size={18} color={AppColors.interactive} style={s.infoIcon} />
        <View style={s.infoTextBlock}>
          <Text style={s.infoTitle}>How to use:</Text>
          <Text style={s.infoBody}>
            Choose an image, then drag the cursor to sample the colour in your cursor. You can find nearest colour and filter the result below
          </Text>
        </View>
      </View>

      {/* Image header row */}
      <View style={s.imageHeaderRow}>
        <Text style={s.imageHeaderLabel}>
          {imageInfo ? 'Drag cursor sample color' : 'Upload an image to start'}
        </Text>
        <Pressable style={s.changeBtn} onPress={pickImage}>
          <IconSymbol name="square.and.arrow.up" size={14} color={AppColors.muted} />
          <Text style={s.changeBtnText}>Change</Text>
        </Pressable>
      </View>

      {/* Image container */}
      <Pressable
        style={s.imageContainer}
        onPress={!imageInfo ? pickImage : undefined}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          containerSizeRef.current = { width, height };
        }}
      >
        {imageInfo ? (
          <>
            <GestureDetector gesture={gesture}>
              <AnimatedImage
                source={{ uri: imageInfo.uri }}
                style={[StyleSheet.absoluteFill, imageStyle]}
                resizeMode="contain"
              />
            </GestureDetector>
            <GLView
              key={imageInfo.uri}
              style={[StyleSheet.absoluteFill, s.glHidden]}
              onContextCreate={onContextCreate}
              pointerEvents="none"
            />
            <PickerCursor />
          </>
        ) : (
          <View style={s.imagePlaceholder}>
            <IconSymbol name="photo" size={40} color={AppColors.muted} />
            <Text style={s.imagePlaceholderText}>Tap to upload image</Text>
          </View>
        )}
      </Pressable>

      {/* Sampled colour card */}
      {sampledColor && hex && (
        <View style={s.sampledCard}>
          <Text style={s.sampledTitle}>Sampled Color</Text>
          <View style={s.sampledRow}>
            <View style={[s.sampledSwatch, { backgroundColor: hex }]} />
            <View style={s.sampledDetails}>
              <Text style={s.sampledLabel}>Hex Code</Text>
              <Text style={s.sampledValue}>{hex}</Text>
              <Text style={[s.sampledLabel, { marginTop: 6 }]}>RGB</Text>
              <Text style={s.sampledValue}>
                {sampledColor.r}, {sampledColor.g}, {sampledColor.b}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Action buttons row */}
      {sampledColor && (
        <View style={s.actionRow}>
          <Pressable style={s.mixBtn} onPress={() => { setShowMix(true); setMatches(null); }}>
            <IconSymbol name="paintbrush.fill" size={16} color="#fff" />
            <Text style={s.mixBtnText}>Mix this colour</Text>
          </Pressable>
        </View>
      )}

      {/* Find nearest row */}
      {sampledColor && (
        <View style={s.findRow}>
          <Pressable style={s.findBtn} onPress={() => { findNearest(); setShowMix(false); }}>
            <IconSymbol name="magnifyingglass" size={16} color="#fff" />
            <Text style={s.findBtnText}>Find Nearest Colors</Text>
          </Pressable>
          <Pressable
            style={[s.filterBtn, filterActive && s.filterBtnActive]}
            onPress={() => setShowFilter(true)}
          >
            <IconSymbol
              name="line.3.horizontal.decrease"
              size={18}
              color={filterActive ? AppColors.interactive : AppColors.muted}
            />
            {filterActive && <View style={s.filterBadge} />}
          </Pressable>
        </View>
      )}

      {/* Nearest matches */}
      {matches !== null && (
        <View style={s.matchesSection}>
          <Text style={s.matchesTitle}>Nearest Matches ({matches.length} found)</Text>
          {matches.length === 0 ? (
            <Text style={s.noMatches}>No colours match the current filters.</Text>
          ) : (
            matches.map((m) => (
              <MatchCard key={m.colour.id} match={m} inInventory={inventoryIds.has(m.colour.id)} onPress={() => router.push({ pathname: '/colour/[id]' as any, params: { id: m.colour.id } })} />
            ))
          )}
        </View>
      )}

      <FilterSheet
        visible={showFilter}
        brands={allBrands}
        filter={filter}
        onApply={setFilter}
        onClose={() => setShowFilter(false)}
      />

      {sampledColor && (
        <MixSheet
          visible={showMix}
          goal={ColourPoint.create({ name: 'Sampled colour', brand: 'Sampled', rgb: sampledColor, tag: [] })}
          allColours={colours}
          inventoryIds={inventoryIds}
          onClose={() => setShowMix(false)}
        />
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: AppColors.text,
    marginBottom: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: AppColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoIcon: { marginTop: 1 },
  infoTextBlock: { flex: 1, gap: 2 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: AppColors.interactive },
  infoBody: { fontSize: 13, color: AppColors.muted, lineHeight: 18 },
  imageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageHeaderLabel: { fontSize: 15, fontWeight: '500', color: AppColors.text },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: AppColors.surface,
  },
  changeBtnText: { fontSize: 13, color: AppColors.muted },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: AppColors.surface,
  },
  glHidden: { opacity: 0 },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  imagePlaceholderText: { color: AppColors.muted, fontSize: 14 },
  sampledCard: {
    backgroundColor: AppColors.card,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  sampledTitle: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  sampledRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sampledSwatch: { width: 64, height: 64, borderRadius: 10 },
  sampledDetails: { flex: 1 },
  sampledLabel: { fontSize: 12, color: AppColors.muted },
  sampledValue: { fontSize: 15, fontWeight: '500', color: AppColors.text },
  findRow: { flexDirection: 'row', gap: 8 },
  findBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    paddingVertical: 14,
  },
  findBtnText: { color: AppColors.text, fontSize: 15, fontWeight: '600' },
  filterBtn: {
    width: 48,
    height: 48,
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: { borderColor: AppColors.interactive, backgroundColor: AppColors.card },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: AppColors.interactive,
  },
  matchesSection: { gap: 8 },
  matchesTitle: { fontSize: 15, fontWeight: '600', color: AppColors.text },
  noMatches: { fontSize: 14, color: AppColors.muted, textAlign: 'center', marginTop: 8 },
  matchCard: {
    backgroundColor: AppColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 12,
    gap: 10,
  },
  matchCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchSwatch: { width: 48, height: 48, borderRadius: 8 },
  matchInfo: { flex: 1, gap: 2 },
  matchNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  matchName: { fontSize: 15, fontWeight: '600', color: AppColors.text },
  inventoryBadge: {
    backgroundColor: AppColors.surface,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  inventoryBadgeText: { fontSize: 11, color: AppColors.interactive, fontWeight: '500' },
  matchBrand: { fontSize: 13, color: AppColors.muted },
  actionRow: { flexDirection: 'row' },
  mixBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppColors.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  mixBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

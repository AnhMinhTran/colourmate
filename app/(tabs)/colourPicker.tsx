import { GLView } from 'expo-gl';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColourPoint } from '@/src/colour/models/colourPoint';
import { SqliteColourPointRepository } from '@/src/colour/repositories/sqliteColourPointRepository';
import { convertSRGBToOKLCH } from '@/src/colour/services/colourConversion';
import { MixSheet } from '@/src/colour/ui/components/mix-sheet';
import { deriveMunsellLikeFromOKLCH } from '@/src/colour/services/deriveMunsellFromOklch';
import { munsellLikeToXYZ, Vec3 } from '@/src/colour/services/munsellToXYZ';
import { PickerCursor } from '@/src/colour/ui/components/picker-cursor';
import { useGlColourSampler } from '@/src/colour/ui/hooks/use-gl-colour-sampler';
import { useImageTransform } from '@/src/colour/ui/hooks/use-image-transform';
import { ImageInfo, RGB } from '@/src/colour/ui/types';
import { SqliteInventoryRepository } from '@/src/inventory/repositories/sqliteInventoryRepository';
import { IconSymbol } from '@/src/ui/components/icon-symbol';

const AnimatedImage = Animated.createAnimatedComponent(Image);

// Max possible distance in the XYZ coordinate space
// x∈[-1,1], y∈[0,1], z∈[-1,1] → max diff = √(4+1+4) = 3
const MAX_DIST = 3;
const TOP_N = 5;

function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

function rgbToCoordinate(rgb: RGB): Vec3 {
  const oklch = convertSRGBToOKLCH({ r: rgb.r, g: rgb.g, b: rgb.b });
  const munsell = deriveMunsellLikeFromOKLCH(oklch);
  return munsellLikeToXYZ(munsell);
}

function colourDistance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function toSimilarity(dist: number): number {
  return Math.max(0, (1 - dist / MAX_DIST)) * 100;
}

interface Filters {
  brands: Set<string>;
  inInventoryOnly: boolean;
}

const EMPTY_FILTERS: Filters = { brands: new Set(), inInventoryOnly: false };

function isActive(f: Filters) {
  return f.brands.size > 0 || f.inInventoryOnly;
}

interface Match {
  colour: ColourPoint;
  similarity: number;
}

// ---------------------------------------------------------------------------
// FilterSheet
// ---------------------------------------------------------------------------
function FilterSheet({
  visible,
  brands,
  filters,
  onApply,
  onClose,
}: {
  visible: boolean;
  brands: string[];
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Filters>(filters);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const toggleBrand = (brand: string) => {
    setDraft((prev) => {
      const next = new Set(prev.brands);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return { ...prev, brands: next };
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={sheet.backdrop} onPress={onClose} />
      <View style={[sheet.panel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={sheet.handle} />
        <View style={sheet.header}>
          <Text style={sheet.heading}>Filters</Text>
          <Pressable onPress={() => setDraft(EMPTY_FILTERS)}>
            <Text style={sheet.clearAll}>Clear all</Text>
          </Pressable>
        </View>
        <View style={sheet.row}>
          <Text style={sheet.rowLabel}>In inventory only</Text>
          <Switch
            value={draft.inInventoryOnly}
            onValueChange={(v) => setDraft((p) => ({ ...p, inInventoryOnly: v }))}
            trackColor={{ true: '#4A90D9' }}
          />
        </View>
        <Text style={sheet.sectionLabel}>Brand</Text>
        <ScrollView style={sheet.brandList} showsVerticalScrollIndicator={false}>
          {brands.map((brand) => {
            const selected = draft.brands.has(brand);
            return (
              <Pressable key={brand} style={sheet.brandRow} onPress={() => toggleBrand(brand)}>
                <View style={[sheet.checkbox, selected && sheet.checkboxActive]}>
                  {selected && <Text style={sheet.checkmark}>✓</Text>}
                </View>
                <Text style={sheet.brandLabel}>{brand}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={sheet.applyBtn} onPress={() => { onApply(draft); onClose(); }}>
          <Text style={sheet.applyBtnText}>Apply</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// MatchCard
// ---------------------------------------------------------------------------
function MatchCard({ match, inInventory, onPress }: { match: Match; inInventory: boolean; onPress: () => void }) {
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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilter, setShowFilter] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
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
    const coord = rgbToCoordinate(sampledColor);

    const candidates = colours.filter((c) => {
      if (filters.brands.size > 0 && !filters.brands.has(c.brand)) return false;
      if (filters.inInventoryOnly && !inventoryIds.has(c.id)) return false;
      return true;
    });

    const ranked = candidates
      .map((c) => ({ colour: c, similarity: toSimilarity(colourDistance(coord, c.coordinate)) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, TOP_N);

    setMatches(ranked);
  }, [sampledColor, colours, filters, inventoryIds]);

  const allBrands = useMemo(
    () => [...new Set(colours.map((c) => c.brand))].sort(),
    [colours],
  );

  const filterActive = isActive(filters);
  const hex = sampledColor ? toHex(sampledColor.r, sampledColor.g, sampledColor.b) : null;

  return (
    <ScrollView
      style={[s.screen, { paddingTop: insets.top }]}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.title}>Mini Paint Collection</Text>

      {/* How to use banner */}
      <View style={s.infoBanner}>
        <IconSymbol name="info.circle" size={18} color="#4A90D9" style={s.infoIcon} />
        <View style={s.infoTextBlock}>
          <Text style={s.infoTitle}>How to use:</Text>
          <Text style={s.infoBody}>
            Choose an image, then drag the colour to sample the colour in your cursor. You can find nearest colour and filter the result below
          </Text>
        </View>
      </View>

      {/* Image header row */}
      <View style={s.imageHeaderRow}>
        <Text style={s.imageHeaderLabel}>
          {imageInfo ? 'Tap to sample color' : 'Upload an image to start'}
        </Text>
        <Pressable style={s.changeBtn} onPress={pickImage}>
          <IconSymbol name="square.and.arrow.up" size={14} color="#555" />
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
            <IconSymbol name="photo" size={40} color="#666" />
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
              color={filterActive ? '#4A90D9' : '#555'}
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
        filters={filters}
        onApply={setFilters}
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
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111',
    marginBottom: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#EBF3FD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B8D4F5',
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoIcon: { marginTop: 1 },
  infoTextBlock: { flex: 1, gap: 2 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#2A6BB5' },
  infoBody: { fontSize: 13, color: '#3A5F8A', lineHeight: 18 },
  imageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageHeaderLabel: { fontSize: 15, fontWeight: '500', color: '#111' },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  changeBtnText: { fontSize: 13, color: '#555' },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#222',
  },
  glHidden: { opacity: 0 },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  imagePlaceholderText: { color: '#888', fontSize: 14 },
  sampledCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sampledTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  sampledRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sampledSwatch: { width: 64, height: 64, borderRadius: 10 },
  sampledDetails: { flex: 1 },
  sampledLabel: { fontSize: 12, color: '#888' },
  sampledValue: { fontSize: 15, fontWeight: '500', color: '#111' },
  findRow: { flexDirection: 'row', gap: 8 },
  findBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
  },
  findBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  filterBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: { borderColor: '#4A90D9', backgroundColor: '#EBF3FD' },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4A90D9',
  },
  matchesSection: { gap: 8 },
  matchesTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  noMatches: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8 },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    padding: 12,
    gap: 10,
  },
  matchCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchSwatch: { width: 48, height: 48, borderRadius: 8 },
  matchInfo: { flex: 1, gap: 2 },
  matchNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  matchName: { fontSize: 15, fontWeight: '600', color: '#111' },
  inventoryBadge: {
    backgroundColor: '#111',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  inventoryBadgeText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  matchBrand: { fontSize: 13, color: '#888' },
  matchPct: { fontSize: 14, fontWeight: '600', color: '#111', minWidth: 40, textAlign: 'right' },
  barTrack: { height: 5, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 4 },
  actionRow: { flexDirection: 'row' },
  mixBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6B4EFF',
    borderRadius: 12,
    paddingVertical: 14,
  },
  mixBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: { fontSize: 17, fontWeight: '700', color: '#111' },
  clearAll: { fontSize: 14, color: '#4A90D9' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 15, color: '#111' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  brandList: { maxHeight: 280 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  brandLabel: { fontSize: 15, color: '#111' },
  applyBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

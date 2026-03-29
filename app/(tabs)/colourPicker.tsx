import { GLView } from 'expo-gl';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
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
import { munsellXYZDistance } from '@/src/colour/services/colourPickerService';
import { ColourReadout } from '@/src/colour/ui/components/colour-readout';
import { PickerCursor } from '@/src/colour/ui/components/picker-cursor';
import { useGlColourSampler } from '@/src/colour/ui/hooks/use-gl-colour-sampler';
import { useImageTransform } from '@/src/colour/ui/hooks/use-image-transform';
import { ImageInfo, RGB } from '@/src/colour/ui/types';
import { SqliteInventoryRepository } from '@/src/inventory/repositories/sqliteInventoryRepository';
import { IconSymbol } from '@/src/ui/components/icon-symbol';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const TOP_N = 10;

interface Filters {
  brands: Set<string>;
  inInventoryOnly: boolean;
}

const EMPTY_FILTERS: Filters = { brands: new Set(), inInventoryOnly: false };

function isActive(f: Filters) {
  return f.brands.size > 0 || f.inInventoryOnly;
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
      <Pressable style={sh.backdrop} onPress={onClose} />
      <View style={[sh.panel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={sh.handle} />
        <View style={sh.header}>
          <Text style={sh.heading}>Filters</Text>
          <Pressable onPress={() => setDraft(EMPTY_FILTERS)}>
            <Text style={sh.clearAll}>Clear all</Text>
          </Pressable>
        </View>
        <View style={sh.row}>
          <Text style={sh.rowLabel}>In inventory only</Text>
          <Switch
            value={draft.inInventoryOnly}
            onValueChange={(v) => setDraft((p) => ({ ...p, inInventoryOnly: v }))}
            trackColor={{ true: '#4A90D9' }}
          />
        </View>
        <Text style={sh.sectionLabel}>Brand</Text>
        <ScrollView style={sh.brandList} showsVerticalScrollIndicator={false}>
          {brands.map((brand) => {
            const selected = draft.brands.has(brand);
            return (
              <Pressable key={brand} style={sh.brandRow} onPress={() => toggleBrand(brand)}>
                <View style={[sh.checkbox, selected && sh.checkboxActive]}>
                  {selected && <Text style={sh.checkmark}>✓</Text>}
                </View>
                <Text style={sh.brandLabel}>{brand}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={sh.applyBtn} onPress={() => { onApply(draft); onClose(); }}>
          <Text style={sh.applyBtnText}>Apply</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ColourPicker
// ---------------------------------------------------------------------------
export default function ColourPicker() {
  const db = useSQLiteContext();
  const colourRepo = useMemo(() => new SqliteColourPointRepository(db), [db]);
  const inventoryRepo = useMemo(() => new SqliteInventoryRepository(db), [db]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const containerSizeRef = useRef({ width: 300, height: 225 });

  const [allColours, setAllColours] = useState<ColourPoint[]>([]);
  const [inventoryIds, setInventoryIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilter, setShowFilter] = useState(false);
  const [rawMatches, setRawMatches] = useState<ColourPoint[]>([]);

  const { gesture, imageStyle, scale, translateX, translateY, resetTransform } =
    useImageTransform();

  const { onContextCreate, sampledColor } = useGlColourSampler({
    imageInfo,
    containerSizeRef,
    scale,
    translateX,
    translateY,
  });

  useEffect(() => {
    (async () => {
      const [colours, inventory] = await Promise.all([
        colourRepo.findAll(),
        inventoryRepo.findAll(),
      ]);
      setAllColours(colours);
      setInventoryIds(new Set(inventory.map((i) => i.colour_id)));
    })();
  }, [colourRepo, inventoryRepo]);

  const allBrands = useMemo(
    () => [...new Set(allColours.map((c) => c.brand))].sort(),
    [allColours],
  );

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
      setRawMatches([]);
      setImageInfo({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  };

  const findNearest = useCallback(
    (colour: RGB) => {
      const target = ColourPoint.create({ name: '_', brand: '_', rgb: colour, tag: [] });

      const sorted = [...allColours]
        .map((c) => ({ c, d: munsellXYZDistance(c.coordinate, target.coordinate) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, TOP_N)
        .map(({ c }) => c);

      setRawMatches(sorted);
    },
    [allColours],
  );

  const matches = useMemo(() => {
    return rawMatches.filter((c) => {
      if (filters.brands.size > 0 && !filters.brands.has(c.brand)) return false;
      if (filters.inInventoryOnly && !inventoryIds.has(c.id)) return false;
      return true;
    });
  }, [rawMatches, filters, inventoryIds]);

  const filterActive = isActive(filters);

  const renderMatch = ({ item }: { item: ColourPoint }) => {
    const bg = `rgb(${item.rgb.r}, ${item.rgb.g}, ${item.rgb.b})`;
    const inInventory = inventoryIds.has(item.id);
    return (
      <Pressable
        style={s.matchCard}
        onPress={() => router.push({ pathname: '/colour/[id]' as any, params: { id: item.id } })}
      >
        <View style={[s.matchSwatch, { backgroundColor: bg }]} />
        <View style={s.matchInfo}>
          <Text style={s.matchName}>{item.name}</Text>
          <Text style={s.matchBrand}>{item.brand}</Text>
        </View>
        {inInventory && (
          <View style={s.inventoryBadge}>
            <Text style={s.inventoryBadgeText}>In Inventory</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const listHeader = (
    
    <View style={s.header}>
        <Text style={s.title}>Colour Sampler</Text>
      {/* How to use banner */}
      <View style={s.howToUseBanner}>
        <IconSymbol name="scope" size={22} color="#4A90D9" />
        <View style={s.howToUseText}>
          <Text style={s.howToUseTitle}>How to use:</Text>
          <Text style={s.howToUseBody}>
            Upload an image, then tap on any area to sample the color. Find the nearest matching paints from your collection.
          </Text>
        </View>
      </View>

      <View style={s.topRow}>
        <Text style={s.topLabel}>
          {imageInfo ? 'Tap to sample color' : 'Pick an image to start'}
        </Text>
        {imageInfo && (
          <Pressable style={s.changeBtn} onPress={pickImage}>
            <IconSymbol name="square.and.arrow.up" size={16} color="#4A90D9" />
            <Text style={s.changeBtnText}>Change</Text>
          </Pressable>
        )}
      </View>

      {!imageInfo && (
        <Pressable style={s.pickBtn} onPress={pickImage}>
          <Text style={s.pickBtnText}>Pick Image</Text>
        </Pressable>
      )}

      {imageInfo && (
        <View
          style={s.imageContainer}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            containerSizeRef.current = { width, height };
          }}
        >
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
        </View>
      )}

      {sampledColor && (
        <View style={s.readoutWrapper}>
          <ColourReadout colour={sampledColor} />
        </View>
      )}

      {sampledColor && (
        <View style={s.actionRow}>
          <Pressable style={s.findBtn} onPress={() => findNearest(sampledColor)}>
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

      {rawMatches.length > 0 && (
        <Text style={s.resultsHeader}>
          Nearest Matches ({matches.length} found)
        </Text>
      )}
    </View>
  );

  return (
    <>
      <FlatList
        data={rawMatches.length > 0 ? matches : []}
        keyExtractor={(item) => item.id}
        renderItem={renderMatch}
        contentContainerStyle={[s.listContent, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          rawMatches.length > 0 ? (
            <Text style={s.empty}>No matches for current filters.</Text>
          ) : null
        }
      />
      <FilterSheet
        visible={showFilter}
        brands={allBrands}
        filters={filters}
        onApply={setFilters}
        onClose={() => setShowFilter(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  listContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
    title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    color: '#111',
  },
  header: {
    gap: 12,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLabel: {
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4A90D9',
  },
  changeBtnText: {
    color: '#4A90D9',
    fontSize: 14,
    fontWeight: '500',
  },
  pickBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  pickBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#222',
  },
  glHidden: { opacity: 0 },
  readoutWrapper: {
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
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
  findBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
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
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4A90D9',
  },
  resultsHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginTop: 4,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    padding: 12,
    gap: 12,
  },
  matchSwatch: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  matchInfo: {
    flex: 1,
    gap: 2,
  },
  matchName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  matchBrand: {
    fontSize: 13,
    color: '#888',
  },
  inventoryBadge: {
    backgroundColor: '#EBF3FD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#4A90D9',
  },
  inventoryBadgeText: {
    fontSize: 11,
    color: '#4A90D9',
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    marginTop: 24,
  },
  howToUseBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EBF3FD',
    borderRadius: 12,
    padding: 12,
  },
  howToUseText: { flex: 1, gap: 2 },
  howToUseTitle: { fontSize: 13, fontWeight: '700', color: '#4A90D9' },
  howToUseBody: { fontSize: 13, color: '#4A90D9', lineHeight: 18 },
});

const sh = StyleSheet.create({
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

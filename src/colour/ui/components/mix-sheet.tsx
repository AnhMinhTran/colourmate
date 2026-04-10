import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColourPoint } from '@/src/colour/models/colourPoint';
import { convertSRGBToOKLCH } from '@/src/colour/services/colourConversion';
import { filterColours } from '@/src/colour/services/colourQueryService';
import { deriveMunsellLikeFromOKLCH } from '@/src/colour/services/deriveMunsellFromOklch';
import { munsellLikeToXYZ } from '@/src/colour/services/munsellToXYZ';
import { findBestMix, mixPaints, munsellXYZDistance } from '@/src/colour/services/paintMixService';
import { RGB } from '@/src/colour/ui/types';
import { IconSymbol } from '@/src/ui/components/icon-symbol';
import {
  ACCENT_GOLD,
  ACCENT_GOLD_DARK,
  BG_ACTIVE,
  BG_CARD,
  BG_ELEVATED,
  BG_PRIMARY,
  BORDER_DEFAULT,
  SWATCH_BORDER,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/src/ui/constants/theme';

type Selector = 'A' | 'B';

function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

export function MixSheet({
  visible,
  goal,
  allColours,
  inventoryIds,
  onClose,
}: {
  visible: boolean;
  goal: ColourPoint;
  allColours: ColourPoint[];
  inventoryIds: Set<string>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selectedAId, setSelectedAId] = useState<string | null>(null);
  const [selectedBId, setSelectedBId] = useState<string | null>(null);
  const [activeSelector, setActiveSelector] = useState<Selector | null>(null);
  const [ratioA, setRatioA] = useState(0.5);
  const [computing, setComputing] = useState(false);
  const [filterBrands, setFilterBrands] = useState<Set<string>>(new Set());
  const [filterInventoryOnly, setFilterInventoryOnly] = useState(false);

  const allColoursRef = useRef(allColours);
  allColoursRef.current = allColours;
  const goalRef = useRef(goal);
  goalRef.current = goal;
  const filterBrandsRef = useRef(filterBrands);
  filterBrandsRef.current = filterBrands;
  const filterInventoryOnlyRef = useRef(filterInventoryOnly);
  filterInventoryOnlyRef.current = filterInventoryOnly;
  const inventoryIdsRef = useRef(inventoryIds);
  inventoryIdsRef.current = inventoryIds;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const runAutoSuggest = useCallback(() => {
    const g = goalRef.current;
    const colours = filterColours(
      allColoursRef.current.filter((c) => c.id !== g.id),
      { search: '', brands: filterBrandsRef.current, inInventoryOnly: filterInventoryOnlyRef.current },
      inventoryIdsRef.current
    );
    if (colours.length < 2) return;
    setComputing(true);
    setTimeout(() => {
      const xyzOf = (rgb: RGB) =>
        munsellLikeToXYZ(deriveMunsellLikeFromOKLCH(convertSRGBToOKLCH(rgb)));
      const candidates = colours
        .map((c) => ({ c, d: munsellXYZDistance(c.coordinate, g.coordinate) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 15)
        .map(({ c }) => c);
      const suggestion = findBestMix(candidates, g.coordinate, xyzOf);
      if (suggestion) {
        setSelectedAId(suggestion.idA);
        setSelectedBId(suggestion.idB);
        setRatioA(suggestion.ratio);
      }
      setComputing(false);
    }, 0);
  }, []);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setSelectedAId(null);
      setSelectedBId(null);
      setActiveSelector(null);
      setRatioA(0.5);
      setFilterBrands(new Set());
      setFilterInventoryOnly(false);
      return;
    }
    runAutoSuggest();
  }, [visible, runAutoSuggest]);

  useEffect(() => {
    if (visibleRef.current) runAutoSuggest();
  }, [filterBrands, filterInventoryOnly, runAutoSuggest]);

  const paintA = useMemo(() => allColours.find((c) => c.id === selectedAId) ?? null, [allColours, selectedAId]);
  const paintB = useMemo(() => allColours.find((c) => c.id === selectedBId) ?? null, [allColours, selectedBId]);

  const mixedRgb: RGB | null = useMemo(
    () => (paintA && paintB ? mixPaints(paintA.rgb, paintB.rgb, ratioA) : null),
    [paintA, paintB, ratioA]
  );

  const distanceToGoal = useMemo((): number | null => {
    if (!mixedRgb) return null;
    const mixXyz = munsellLikeToXYZ(deriveMunsellLikeFromOKLCH(convertSRGBToOKLCH(mixedRgb)));
    return munsellXYZDistance(mixXyz, goal.coordinate);
  }, [mixedRgb, goal]);

  const matchLabel = useMemo(() => {
    if (distanceToGoal === null) return null;
    if (distanceToGoal < 5) return { text: 'Excellent match', color: '#4CAF50' };
    if (distanceToGoal < 15) return { text: 'Good match', color: ACCENT_GOLD };
    if (distanceToGoal < 30) return { text: 'Moderate match', color: '#E09A00' };
    return { text: 'Far off', color: '#CC3300' };
  }, [distanceToGoal]);

  const brands = useMemo(
    () => [...new Set(allColours.filter((c) => c.id !== goal.id).map((c) => c.brand))].sort(),
    [allColours, goal.id]
  );

  const filtered = useMemo(() => {
    const excludeOther = activeSelector === 'A' ? selectedBId : selectedAId;
    const base = allColours.filter((c) => c.id !== goal.id && c.id !== excludeOther);
    return filterColours(
      base,
      { search, brands: filterBrands, inInventoryOnly: filterInventoryOnly },
      inventoryIds
    );
  }, [allColours, goal.id, activeSelector, selectedAId, selectedBId, filterBrands, filterInventoryOnly, inventoryIds, search]);

  const selectPaint = (id: string) => {
    if (activeSelector === 'A') setSelectedAId(id);
    else if (activeSelector === 'B') setSelectedBId(id);
    setActiveSelector(null);
    setSearch('');
  };

  const openSelector = (sel: Selector) => {
    setActiveSelector((prev) => (prev === sel ? null : sel));
    setSearch('');
  };

  const adjustRatio = (delta: number) => {
    setRatioA((prev) => Math.max(0.1, Math.min(0.9, parseFloat((prev + delta).toFixed(1)))));
  };

  const goalBg = `rgb(${goal.rgb.r}, ${goal.rgb.g}, ${goal.rgb.b})`;
  const aBg = paintA ? `rgb(${paintA.rgb.r}, ${paintA.rgb.g}, ${paintA.rgb.b})` : null;
  const bBg = paintB ? `rgb(${paintB.rgb.r}, ${paintB.rgb.g}, ${paintB.rgb.b})` : null;
  const mixBg = mixedRgb ? `rgb(${mixedRgb.r}, ${mixedRgb.g}, ${mixedRgb.b})` : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ms.backdrop} onPress={onClose} />
      <View style={[ms.panel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={ms.handle} />
        <View style={ms.titleRow}>
          <Text style={ms.title}>Mix to recreate</Text>
          <Pressable onPress={onClose}>
            <Text style={ms.closeBtn}>{'\u2715'}</Text>
          </Pressable>
        </View>

        {/* Goal */}
        <View style={ms.goalRow}>
          <View style={[ms.goalSwatch, { backgroundColor: goalBg }]} />
          <View style={ms.goalInfo}>
            <Text style={ms.goalHint}>Goal colour</Text>
            <Text style={ms.goalName}>{goal.name}</Text>
            <Text style={ms.goalBrand}>{goal.brand}</Text>
          </View>
          {matchLabel && (
            <View style={[ms.matchBadge, { borderColor: matchLabel.color, backgroundColor: matchLabel.color + '18' }]}>
              <Text style={[ms.matchBadgeText, { color: matchLabel.color }]}>{matchLabel.text}</Text>
            </View>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.filterRow} contentContainerStyle={ms.filterRowContent}>
          <Pressable
            style={[ms.filterChip, filterInventoryOnly && ms.filterChipActive]}
            onPress={() => setFilterInventoryOnly((v) => !v)}
          >
            <Text style={[ms.filterChipText, filterInventoryOnly && ms.filterChipTextActive]}>In inventory</Text>
          </Pressable>
          {brands.map((brand) => {
            const active = filterBrands.has(brand);
            return (
              <Pressable
                key={brand}
                style={[ms.filterChip, active && ms.filterChipActive]}
                onPress={() =>
                  setFilterBrands((prev) => {
                    const next = new Set(prev);
                    active ? next.delete(brand) : next.add(brand);
                    return next;
                  })
                }
              >
                <Text style={[ms.filterChipText, active && ms.filterChipTextActive]}>{brand}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {computing ? (
          <View style={ms.computingRow}>
            <Text style={ms.computingText}>Finding best combination\u2026</Text>
          </View>
        ) : (
          <>
            {/* Paint selectors */}
            <View style={ms.selectorRow}>
              <Pressable
                style={[ms.selectorBtn, activeSelector === 'A' && ms.selectorBtnActive]}
                onPress={() => openSelector('A')}
              >
                {aBg ? (
                  <View style={[ms.selectorSwatch, { backgroundColor: aBg }]} />
                ) : (
                  <View style={ms.selectorSwatchEmpty}>
                    <Text style={ms.selectorSwatchEmptyText}>A</Text>
                  </View>
                )}
                <View style={ms.selectorInfo}>
                  <Text style={ms.selectorLabel}>Paint A  (tap to change)</Text>
                  <Text style={ms.selectorName} numberOfLines={1}>{paintA ? paintA.name : 'Select\u2026'}</Text>
                  {paintA && <Text style={ms.selectorBrand} numberOfLines={1}>{paintA.brand}</Text>}
                </View>
              </Pressable>

              <Text style={ms.mixOp}>+</Text>

              <Pressable
                style={[ms.selectorBtn, activeSelector === 'B' && ms.selectorBtnActive]}
                onPress={() => openSelector('B')}
              >
                {bBg ? (
                  <View style={[ms.selectorSwatch, { backgroundColor: bBg }]} />
                ) : (
                  <View style={ms.selectorSwatchEmpty}>
                    <Text style={ms.selectorSwatchEmptyText}>B</Text>
                  </View>
                )}
                <View style={ms.selectorInfo}>
                  <Text style={ms.selectorLabel}>Paint B  (tap to change)</Text>
                  <Text style={ms.selectorName} numberOfLines={1}>{paintB ? paintB.name : 'Select\u2026'}</Text>
                  {paintB && <Text style={ms.selectorBrand} numberOfLines={1}>{paintB.brand}</Text>}
                </View>
              </Pressable>
            </View>

            {/* Ratio + result card */}
            {paintA && paintB && mixBg && (
              <View style={ms.mixResultCard}>
                <View style={ms.ratioRow}>
                  <Pressable style={ms.ratioBtn} onPress={() => adjustRatio(-0.1)}>
                    <Text style={ms.ratioBtnText}>{'\u2212'}</Text>
                  </Pressable>
                  <View style={ms.ratioTrack}>
                    <View style={[ms.ratioFillA, { flex: ratioA }]} />
                    <View style={[ms.ratioFillB, { flex: 1 - ratioA }]} />
                  </View>
                  <Pressable style={ms.ratioBtn} onPress={() => adjustRatio(0.1)}>
                    <Text style={ms.ratioBtnText}>+</Text>
                  </Pressable>
                </View>
                <Text style={ms.ratioLabel}>
                  {Math.round(ratioA * 100)}% {paintA.name.split(' ')[0]}
                  {'  \u00b7  '}
                  {Math.round((1 - ratioA) * 100)}% {paintB.name.split(' ')[0]}
                </Text>
                <View style={ms.presetRow}>
                  {[0.25, 0.5, 0.75].map((r) => (
                    <Pressable
                      key={r}
                      style={[ms.preset, ratioA === r && ms.presetActive]}
                      onPress={() => setRatioA(r)}
                    >
                      <Text style={[ms.presetText, ratioA === r && ms.presetTextActive]}>
                        {r === 0.25 ? '1:3' : r === 0.5 ? '1:1' : '3:1'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={ms.resultCompareRow}>
                  <View style={ms.resultBlock}>
                    <View style={[ms.resultSwatch, { backgroundColor: mixBg }]} />
                    <Text style={ms.resultSwatchLabel}>Mix result</Text>
                    <Text style={ms.resultHex}>{toHex(mixedRgb!.r, mixedRgb!.g, mixedRgb!.b)}</Text>
                  </View>
                  <IconSymbol name="arrow.right" size={16} color={TEXT_MUTED} />
                  <View style={ms.resultBlock}>
                    <View style={[ms.resultSwatch, { backgroundColor: goalBg }]} />
                    <Text style={ms.resultSwatchLabel}>Goal</Text>
                    <Text style={ms.resultHex}>{toHex(goal.rgb.r, goal.rgb.g, goal.rgb.b)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Colour picker list */}
            {activeSelector && (
              <>
                <Text style={ms.sectionLabel}>Select paint {activeSelector}:</Text>
                <TextInput
                  style={ms.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search colours..."
                  placeholderTextColor={TEXT_MUTED}
                  autoFocus
                />
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.id}
                  style={ms.list}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const bg = `rgb(${item.rgb.r}, ${item.rgb.g}, ${item.rgb.b})`;
                    const currentId = activeSelector === 'A' ? selectedAId : selectedBId;
                    const isSelected = item.id === currentId;
                    return (
                      <Pressable
                        style={[ms.colourRow, isSelected && ms.colourRowActive]}
                        onPress={() => selectPaint(item.id)}
                      >
                        <View style={[ms.colourSwatch, { backgroundColor: bg }]} />
                        <View style={ms.colourInfo}>
                          <Text style={ms.colourName}>{item.name}</Text>
                          <Text style={ms.colourBrand}>{item.brand}</Text>
                        </View>
                        {inventoryIds.has(item.id) && (
                          <View style={ms.inStockBadge}>
                            <Text style={ms.inStockText}>In inventory</Text>
                          </View>
                        )}
                        {isSelected && <Text style={ms.colourCheck}>{'\u2713'}</Text>}
                      </Pressable>
                    );
                  }}
                />
              </>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    backgroundColor: BG_ELEVATED,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER_DEFAULT, alignSelf: 'center', marginBottom: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY, fontFamily: 'Inter_Bold' },
  closeBtn: { fontSize: 18, color: TEXT_SECONDARY, padding: 4 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BG_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    padding: 12,
    marginBottom: 12,
  },
  goalSwatch: { width: 52, height: 52, borderRadius: 10, borderWidth: 1, borderColor: SWATCH_BORDER },
  goalInfo: { flex: 1 },
  goalHint: { fontSize: 11, color: TEXT_SECONDARY, marginBottom: 2, fontFamily: 'Inter' },
  goalName: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, fontFamily: 'Inter_Bold' },
  goalBrand: { fontSize: 12, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  matchBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  matchBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_Bold' },
  selectorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  selectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BG_CARD,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: BORDER_DEFAULT,
  },
  selectorBtnActive: { borderColor: ACCENT_GOLD, backgroundColor: BG_ACTIVE },
  selectorSwatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: SWATCH_BORDER },
  selectorSwatchEmpty: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: BORDER_DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorSwatchEmptyText: { fontSize: 14, fontWeight: '700', color: TEXT_MUTED },
  computingRow: { paddingVertical: 24, alignItems: 'center' },
  computingText: { fontSize: 14, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  selectorInfo: { flex: 1 },
  selectorLabel: { fontSize: 10, color: TEXT_SECONDARY, marginBottom: 2, fontFamily: 'Inter' },
  selectorName: { fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY, fontFamily: 'Inter_SemiBold' },
  selectorBrand: { fontSize: 11, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  mixOp: { fontSize: 20, color: TEXT_MUTED, fontWeight: '400' },
  mixResultCard: {
    backgroundColor: BG_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  ratioRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratioBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: BORDER_DEFAULT, justifyContent: 'center', alignItems: 'center' },
  ratioBtnText: { fontSize: 20, color: TEXT_PRIMARY, lineHeight: 24 },
  ratioTrack: { flex: 1, height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden' },
  ratioFillA: { backgroundColor: ACCENT_GOLD },
  ratioFillB: { backgroundColor: BORDER_DEFAULT },
  ratioLabel: { fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center', fontFamily: 'Inter' },
  presetRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  preset: { borderWidth: 1, borderColor: BORDER_DEFAULT, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: BG_PRIMARY },
  presetActive: { borderColor: ACCENT_GOLD, backgroundColor: BG_ACTIVE },
  presetText: { fontSize: 13, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  presetTextActive: { color: ACCENT_GOLD, fontWeight: '600' },
  resultCompareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  resultBlock: { alignItems: 'center', gap: 4 },
  resultSwatch: { width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: SWATCH_BORDER },
  resultSwatchLabel: { fontSize: 11, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  resultHex: { fontSize: 11, color: TEXT_PRIMARY, fontWeight: '500', fontFamily: 'Inter_Medium' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: ACCENT_GOLD, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontFamily: 'Inter_SemiBold' },
  searchInput: { borderWidth: 1, borderColor: BORDER_DEFAULT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: TEXT_PRIMARY, backgroundColor: BG_PRIMARY, marginBottom: 8, fontFamily: 'Inter' },
  list: { maxHeight: 200 },
  colourRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT },
  colourRowActive: { backgroundColor: BG_ACTIVE, borderRadius: 10, paddingHorizontal: 8 },
  colourSwatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: SWATCH_BORDER },
  colourInfo: { flex: 1 },
  colourName: { fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, fontFamily: 'Inter_Medium' },
  colourBrand: { fontSize: 12, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  colourCheck: { fontSize: 16, color: ACCENT_GOLD, fontWeight: '700' },
  inStockBadge: { backgroundColor: BG_ACTIVE, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: ACCENT_GOLD_DARK },
  inStockText: { fontSize: 11, color: ACCENT_GOLD, fontWeight: '600', fontFamily: 'Inter_SemiBold' },
  filterRow: { maxHeight: 40, marginBottom: 8 },
  filterRowContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, backgroundColor: BG_CARD },
  filterChipActive: { borderColor: ACCENT_GOLD, backgroundColor: BG_ACTIVE },
  filterChipText: { fontSize: 13, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  filterChipTextActive: { color: ACCENT_GOLD, fontWeight: '600' },
});

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { SqliteColourPointRepository } from '@/src/colour/repositories/sqliteColourPointRepository';
import { deriveMunsellLikeFromOKLCH } from '@/src/colour/services/deriveMunsellFromOklch';
import { ColourFilter, ColourMatch, EMPTY_FILTER, filterColours, findNearestColours, isFilterActive } from '@/src/colour/services/colourQueryService';
import { FilterSheet } from '@/src/colour/ui/components/filter-sheet';
import { MixSheet } from '@/src/colour/ui/components/mix-sheet';
import { SqliteInventoryRepository } from '@/src/inventory/repositories/sqliteInventoryRepository';
import { IconSymbol } from '@/src/ui/components/icon-symbol';
import {
  ACCENT_GOLD,
  ACCENT_GOLD_DARK,
  ACCENT_PURPLE,
  BG_ACTIVE,
  BG_CARD,
  BG_ELEVATED,
  BG_PRIMARY,
  BORDER_DEFAULT,
  DANGER,
  SWATCH_BORDER,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/src/ui/constants/theme';

const MUNSELL_HUES = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'];

function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

function munsellHueName(hueDeg: number): string {
  const normalized = ((hueDeg - 30) % 360 + 360) % 360;
  const sector = Math.floor(normalized / 36) % 10;
  const within = ((normalized % 36) / 36) * 10;
  const hueNum = within < 2.5 ? 2.5 : within < 7.5 ? 5 : 7.5;
  return `${hueNum}${MUNSELL_HUES[sector]}`;
}

function munsellLabel(c: ColourPoint): string {
  const m = deriveMunsellLikeFromOKLCH(c.oklch);
  const value = (m.value / 10).toFixed(1);
  if (c.oklch.c < 0.02) return `N ${value}`;
  const chroma = (m.chroma / 10).toFixed(0);
  const hue = munsellHueName(m.hueDeg);
  return `${hue} ${value}/${chroma}`;
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
// ColourDetailScreen
// ---------------------------------------------------------------------------
export default function ColourDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const colourRepo = useMemo(() => new SqliteColourPointRepository(db), [db]);
  const inventoryRepo = useMemo(() => new SqliteInventoryRepository(db), [db]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [colour, setColour] = useState<ColourPoint | null>(null);
  const [editing, setEditing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showMix, setShowMix] = useState(false);
  const [allColours, setAllColours] = useState<ColourPoint[]>([]);
  const [inventoryIds, setInventoryIds] = useState<Set<string>>(new Set());
  const [nearestFilter, setNearestFilter] = useState<ColourFilter>(EMPTY_FILTER);
  const [showNearestFilter, setShowNearestFilter] = useState(false);

  const allBrands = useMemo(() => [...new Set(allColours.map((c) => c.brand))].sort(), [allColours]);

  const nearest = useMemo<ColourMatch[]>(() => {
    if (!colour || allColours.length === 0) return [];
    const candidates = filterColours(
      allColours.filter((c) => c.id !== colour.id),
      { ...nearestFilter, search: '' },
      inventoryIds,
    );
    return findNearestColours({ r: colour.rgb.r, g: colour.rgb.g, b: colour.rgb.b }, candidates);
  }, [colour, allColours, nearestFilter, inventoryIds]);

  const [draftName, setDraftName] = useState('');
  const [draftBrand, setDraftBrand] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const load = useCallback(async () => {
    const [c, allC, allInv] = await Promise.all([
      colourRepo.findbyId(id),
      colourRepo.findAll(),
      inventoryRepo.findAll(),
    ]);
    setColour(c);
    setAllColours(allC);
    setInventoryIds(new Set(allInv.map((i) => i.colour_id)));
  }, [id, colourRepo, inventoryRepo]);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => {
    if (!colour) return;
    setDraftName(colour.name);
    setDraftBrand(colour.brand);
    setDraftTags([...colour.tag]);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setTagInput('');
  };

  const saveEdit = async () => {
    if (!colour) return;
    try {
      colour.update({ name: draftName, brand: draftBrand, tag: draftTags });
    } catch (e: any) {
      Alert.alert(e.message);
      return;
    }
    await colourRepo.update(colour);
    setColour({ ...colour } as ColourPoint);
    setEditing(false);
    setTagInput('');
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || draftTags.includes(t)) { setTagInput(''); return; }
    setDraftTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setDraftTags((prev) => prev.filter((t) => t !== tag));
  };

  if (!colour) return null;

  const bg = `rgb(${colour.rgb.r}, ${colour.rgb.g}, ${colour.rgb.b})`;
  const hex = toHex(colour.rgb.r, colour.rgb.g, colour.rgb.b);
  const munsell = munsellLabel(colour);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Color Details',
          headerStyle: { backgroundColor: BG_CARD },
          headerTintColor: ACCENT_GOLD,
          headerTitleStyle: { color: TEXT_PRIMARY },
          headerRight: () =>
            editing ? (
              <View style={s.headerBtns}>
                <Pressable onPress={cancelEdit} style={s.headerBtn}>
                  <Text style={s.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveEdit} style={s.headerBtn}>
                  <Text style={s.saveText}>Save</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startEdit} style={s.headerBtn}>
                <Text style={s.editText}>Edit</Text>
              </Pressable>
            ),
        }}
      />
      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={[s.swatch, { backgroundColor: bg }]} />

        {editing ? (
          <View style={s.nameBlock}>
            <TextInput style={s.nameInput} value={draftName} onChangeText={setDraftName} placeholder="Name" placeholderTextColor={TEXT_MUTED} />
            <TextInput style={s.brandInput} value={draftBrand} onChangeText={setDraftBrand} placeholder="Brand" placeholderTextColor={TEXT_MUTED} />
          </View>
        ) : (
          <View style={s.nameBlock}>
            <Text style={s.name}>{colour.name}</Text>
            <Text style={s.brand}>{colour.brand}</Text>
          </View>
        )}

        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.label}>Hex Code</Text>
            <Text style={s.value}>{hex}</Text>
          </View>
          <View style={s.divider} />
          <Text style={s.label}>RGB Values</Text>
          <View style={s.rgbRow}>
            {(['R', 'G', 'B'] as const).map((ch, i) => {
              const val = [colour.rgb.r, colour.rgb.g, colour.rgb.b][i];
              const bgColor = ch === 'R' ? '#2A1515' : ch === 'G' ? '#152A15' : '#15152A';
              const fg = ch === 'R' ? '#E06060' : ch === 'G' ? '#60C060' : '#6080E0';
              return (
                <View key={ch} style={[s.rgbBox, { backgroundColor: bgColor }]}>
                  <Text style={[s.rgbLabel, { color: fg }]}>{ch}</Text>
                  <Text style={s.rgbVal}>{val}</Text>
                </View>
              );
            })}
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Text style={s.label}>Munsell Notation</Text>
              <Pressable onPress={() => setShowTooltip(true)} style={s.tooltipBtn}>
                <Text style={s.tooltipBtnText}>?</Text>
              </Pressable>
            </View>
            <Text style={s.value}>{munsell}</Text>
          </View>
        </View>

        <Modal visible={showTooltip} transparent animationType="fade" onRequestClose={() => setShowTooltip(false)}>
          <Pressable style={s.tooltipBackdrop} onPress={() => setShowTooltip(false)}>
            <View style={s.tooltipBox}>
              <Text style={s.tooltipTitle}>Munsell Notation</Text>
              <Text style={s.tooltipBody}>Munsell describes a colour using three attributes:</Text>
              <Text style={s.tooltipItem}><Text style={s.tooltipBold}>Hue</Text> — There are five fundamental hues: yellow, red, green, blue, purple (e.g. 5R = mid Red, 5Y = mid Yellow, N = neutral grey)</Text>
              <Text style={s.tooltipItem}><Text style={s.tooltipBold}>Value</Text> — lightness on a scale of 0 (black) to 10 (white)</Text>
              <Text style={s.tooltipItem}><Text style={s.tooltipBold}>Chroma</Text> — saturation strength, starting at 0 (grey) with no upper bound</Text>
              <Text style={s.tooltipExample}>Format: <Text style={s.tooltipBold}>Hue Value/Chroma</Text>{'\n'}e.g. 5R 4/14 or N 1.5</Text>
              <Pressable style={s.tooltipClose} onPress={() => setShowTooltip(false)}>
                <Text style={s.tooltipCloseText}>Got it</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        <Text style={s.sectionTitle}>Tags</Text>
        <View style={s.tagRow}>
          {(editing ? draftTags : colour.tag).map((t) => (
            <Pressable
              key={t}
              style={[s.tag, editing && s.tagRemovable]}
              onPress={editing ? () => removeTag(t) : undefined}
            >
              <Text style={s.tagText}>{t}</Text>
              {editing && <Text style={s.tagX}> \u00d7</Text>}
            </Pressable>
          ))}
        </View>

        {editing && (
          <View style={s.tagInputRow}>
            <TextInput
              style={s.tagInput}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add tag..."
              placeholderTextColor={TEXT_MUTED}
              onSubmitEditing={addTag}
              returnKeyType="done"
            />
            <Pressable style={s.tagAddBtn} onPress={addTag}>
              <Text style={s.tagAddBtnText}>Add</Text>
            </Pressable>
          </View>
        )}

        {!editing && (
          <Pressable style={s.mixBtn} onPress={() => setShowMix(true)}>
            <IconSymbol name="paintbrush.fill" size={18} color="#fff" />
            <Text style={s.mixBtnText}>Mix this colour</Text>
          </Pressable>
        )}

        {!editing && (
          <>
            <View style={s.nearestHeader}>
              <Text style={s.sectionTitle}>Nearest Colours</Text>
              <Pressable
                style={[s.filterBtn, isFilterActive(nearestFilter) && s.filterBtnActive]}
                onPress={() => setShowNearestFilter(true)}
              >
                <IconSymbol
                  name="line.3.horizontal.decrease"
                  size={16}
                  color={isFilterActive(nearestFilter) ? ACCENT_GOLD : TEXT_MUTED}
                />
                {isFilterActive(nearestFilter) && <View style={s.filterBadge} />}
              </Pressable>
            </View>
            {nearest.length === 0 ? (
              <Text style={s.noMatches}>No colours match the current filters.</Text>
            ) : (
              nearest.map((m) => (
                <MatchCard
                  key={m.colour.id}
                  match={m}
                  inInventory={inventoryIds.has(m.colour.id)}
                  onPress={() => router.push({ pathname: '/colour/[id]' as any, params: { id: m.colour.id } })}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      <MixSheet
        visible={showMix}
        goal={colour}
        allColours={allColours}
        inventoryIds={inventoryIds}
        onClose={() => setShowMix(false)}
      />

      <FilterSheet
        visible={showNearestFilter}
        brands={allBrands}
        filter={nearestFilter}
        onApply={setNearestFilter}
        onClose={() => setShowNearestFilter(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles — main screen
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG_PRIMARY },
  content: { padding: 16, gap: 16 },
  swatch: {
    height: 200,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SWATCH_BORDER,
  },
  nameBlock: { gap: 4 },
  name: { fontSize: 26, fontWeight: '700', color: TEXT_PRIMARY, fontFamily: 'Cinzel_Bold' },
  brand: { fontSize: 15, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  nameInput: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    borderBottomWidth: 1.5,
    borderColor: ACCENT_GOLD,
    paddingVertical: 4,
    marginBottom: 4,
    fontFamily: 'Inter_Bold',
  },
  brandInput: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    borderBottomWidth: 1,
    borderColor: BORDER_DEFAULT,
    paddingVertical: 4,
    fontFamily: 'Inter',
  },
  card: {
    backgroundColor: BG_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  value: { fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, fontFamily: 'Inter_Medium' },
  divider: { height: 1, backgroundColor: BORDER_DEFAULT },
  rgbRow: { flexDirection: 'row', gap: 10 },
  rgbBox: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', gap: 4 },
  rgbLabel: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_SemiBold' },
  rgbVal: { fontSize: 18, fontWeight: '600', color: TEXT_PRIMARY, fontFamily: 'Inter_SemiBold' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: ACCENT_GOLD, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Inter_SemiBold' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: ACCENT_GOLD_DARK,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: BG_CARD,
  },
  tagRemovable: { borderColor: DANGER },
  tagText: { fontSize: 13, color: ACCENT_GOLD, fontFamily: 'Inter' },
  tagX: { fontSize: 13, color: DANGER, fontWeight: '700' },
  tagInputRow: { flexDirection: 'row', gap: 8 },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_PRIMARY,
    backgroundColor: BG_CARD,
    fontFamily: 'Inter',
  },
  tagAddBtn: { backgroundColor: ACCENT_GOLD, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  tagAddBtnText: { color: BG_PRIMARY, fontWeight: '600', fontFamily: 'Inter_SemiBold' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tooltipBtn: { width: 16, height: 16, borderRadius: 8, backgroundColor: ACCENT_GOLD_DARK, justifyContent: 'center', alignItems: 'center' },
  tooltipBtnText: { fontSize: 10, fontWeight: '700', color: TEXT_PRIMARY },
  tooltipBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  tooltipBox: { backgroundColor: BG_ELEVATED, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, padding: 20, gap: 10, width: '100%' },
  tooltipTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, fontFamily: 'Inter_Bold' },
  tooltipBody: { fontSize: 14, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  tooltipItem: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20, fontFamily: 'Inter' },
  tooltipBold: { fontWeight: '700', color: TEXT_PRIMARY },
  tooltipExample: { fontSize: 13, color: TEXT_SECONDARY, backgroundColor: BG_PRIMARY, borderRadius: 8, padding: 10, lineHeight: 20, fontFamily: 'Inter' },
  tooltipClose: { backgroundColor: ACCENT_GOLD, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  tooltipCloseText: { color: BG_PRIMARY, fontWeight: '600', fontSize: 15, fontFamily: 'Inter_SemiBold' },
  headerBtns: { flexDirection: 'row', gap: 12 },
  headerBtn: { paddingHorizontal: 4 },
  editText: { color: ACCENT_GOLD, fontSize: 16, fontFamily: 'Inter' },
  saveText: { color: ACCENT_GOLD, fontSize: 16, fontWeight: '600', fontFamily: 'Inter_SemiBold' },
  cancelText: { color: TEXT_SECONDARY, fontSize: 16, fontFamily: 'Inter' },
  matchCard: {
    backgroundColor: BG_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    padding: 12,
  },
  matchCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchSwatch: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: SWATCH_BORDER },
  matchInfo: { flex: 1, gap: 2 },
  matchNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  matchName: { fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, fontFamily: 'Inter_SemiBold' },
  inventoryBadge: { backgroundColor: ACCENT_GOLD_DARK, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  inventoryBadgeText: { fontSize: 11, color: TEXT_PRIMARY, fontWeight: '500', fontFamily: 'Inter_Medium' },
  matchBrand: { fontSize: 13, color: TEXT_SECONDARY, fontFamily: 'Inter' },
  nearestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterBtn: {
    width: 36,
    height: 36,
    backgroundColor: BG_CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: { borderColor: ACCENT_GOLD, backgroundColor: BG_ACTIVE },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT_GOLD,
  },
  noMatches: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', marginTop: 4, fontFamily: 'Inter' },
  mixBtn: {
    backgroundColor: ACCENT_PURPLE,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mixBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: 'Inter_SemiBold' },
});

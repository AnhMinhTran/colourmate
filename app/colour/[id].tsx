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
            <TextInput style={s.nameInput} value={draftName} onChangeText={setDraftName} placeholder="Name" />
            <TextInput style={s.brandInput} value={draftBrand} onChangeText={setDraftBrand} placeholder="Brand" />
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
              const bg = ch === 'R' ? '#FFF0F0' : ch === 'G' ? '#F0FFF0' : '#F0F0FF';
              const fg = ch === 'R' ? '#D00' : ch === 'G' ? '#0A0' : '#00C';
              return (
                <View key={ch} style={[s.rgbBox, { backgroundColor: bg }]}>
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
              {editing && <Text style={s.tagX}> ×</Text>}
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
                  color={isFilterActive(nearestFilter) ? '#4A90D9' : '#555'}
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
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, gap: 16 },
  swatch: {
    height: 200,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  nameBlock: { gap: 4 },
  name: { fontSize: 26, fontWeight: '700', color: '#111' },
  brand: { fontSize: 15, color: '#888' },
  nameInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    borderBottomWidth: 1.5,
    borderColor: '#4A90D9',
    paddingVertical: 4,
    marginBottom: 4,
  },
  brandInput: {
    fontSize: 15,
    color: '#555',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: '#888' },
  value: { fontSize: 14, fontWeight: '500', color: '#111' },
  divider: { height: 1, backgroundColor: '#f0f0f0' },
  rgbRow: { flexDirection: 'row', gap: 10 },
  rgbBox: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', gap: 4 },
  rgbLabel: { fontSize: 11, fontWeight: '600' },
  rgbVal: { fontSize: 18, fontWeight: '600', color: '#111' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  tagRemovable: { borderColor: '#e05' },
  tagText: { fontSize: 13, color: '#555' },
  tagX: { fontSize: 13, color: '#e05', fontWeight: '700' },
  tagInputRow: { flexDirection: 'row', gap: 8 },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  tagAddBtn: { backgroundColor: '#4A90D9', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  tagAddBtnText: { color: '#fff', fontWeight: '600' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tooltipBtn: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  tooltipBtnText: { fontSize: 10, fontWeight: '700', color: '#555' },
  tooltipBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  tooltipBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 10, width: '100%' },
  tooltipTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  tooltipBody: { fontSize: 14, color: '#555' },
  tooltipItem: { fontSize: 13, color: '#444', lineHeight: 20 },
  tooltipBold: { fontWeight: '700', color: '#111' },
  tooltipExample: { fontSize: 13, color: '#555', backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, lineHeight: 20 },
  tooltipClose: { backgroundColor: '#4A90D9', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  tooltipCloseText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  headerBtns: { flexDirection: 'row', gap: 12 },
  headerBtn: { paddingHorizontal: 4 },
  editText: { color: '#4A90D9', fontSize: 16 },
  saveText: { color: '#4A90D9', fontSize: 16, fontWeight: '600' },
  cancelText: { color: '#888', fontSize: 16 },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    padding: 12,
  },
  matchCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchSwatch: { width: 48, height: 48, borderRadius: 8 },
  matchInfo: { flex: 1, gap: 2 },
  matchNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  matchName: { fontSize: 15, fontWeight: '600', color: '#111' },
  inventoryBadge: { backgroundColor: '#111', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  inventoryBadgeText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  matchBrand: { fontSize: 13, color: '#888' },
  nearestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#fff',
    borderRadius: 10,
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4A90D9',
  },
  noMatches: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 4 },
  mixBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mixBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

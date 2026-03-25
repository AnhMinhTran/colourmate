import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { ColourPoint } from '@/src/colour/models/colourPoint';
import { SqliteColourPointRepository } from '@/src/colour/repositories/sqliteColourPointRepository';
import { Inventory } from '@/src/inventory/models/inventory';
import { SqliteInventoryRepository } from '@/src/inventory/repositories/sqliteInventoryRepository';
import { IconSymbol } from '@/src/ui/components/icon-symbol';

interface Filters {
  brands: Set<string>;
  inInventoryOnly: boolean;
}

const EMPTY_FILTERS: Filters = { brands: new Set(), inInventoryOnly: false };

function isActive(filters: Filters) {
  return filters.brands.size > 0 || filters.inInventoryOnly;
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

        {/* In inventory toggle */}
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
// InventoryScreen
// ---------------------------------------------------------------------------
export default function InventoryScreen() {
  const db = useSQLiteContext();
  const colourRepo = useMemo(() => new SqliteColourPointRepository(db), [db]);
  const inventoryRepo = useMemo(() => new SqliteInventoryRepository(db), [db]);

  const [colours, setColours] = useState<ColourPoint[]>([]);
  const [inventoryIds, setInventoryIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilter, setShowFilter] = useState(false);

  const loadData = useCallback(async () => {
    const [allColours, allInventory] = await Promise.all([
      colourRepo.findAll(),
      inventoryRepo.findAll(),
    ]);
    setColours(allColours);
    setInventoryIds(new Set(allInventory.map((i) => i.colour_id)));
  }, [colourRepo, inventoryRepo]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = useCallback(async (colour: ColourPoint) => {
    if (inventoryIds.has(colour.id)) return;
    const entry = Inventory.create({ id: '', colour_id: colour.id, quantity: 1 });
    await inventoryRepo.create(entry);
    setInventoryIds((prev) => new Set([...prev, colour.id]));
  }, [inventoryIds, inventoryRepo]);

  const allBrands = useMemo(
    () => [...new Set(colours.map((c) => c.brand))].sort(),
    [colours],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return colours.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.brand.toLowerCase().includes(q) && !c.tag.some((t) => t.toLowerCase().includes(q))) return false;
      if (filters.brands.size > 0 && !filters.brands.has(c.brand)) return false;
      if (filters.inInventoryOnly && !inventoryIds.has(c.id)) return false;
      return true;
    });
  }, [colours, search, filters, inventoryIds]);

  const renderItem = ({ item }: { item: ColourPoint }) => {
    const bg = `rgb(${item.rgb.r}, ${item.rgb.g}, ${item.rgb.b})`;
    const inInventory = inventoryIds.has(item.id);
    return (
      <View style={styles.card}>
        <View style={[styles.swatch, { backgroundColor: bg }]} />
        <View style={styles.cardInfo}>
          <Text style={styles.colourName}>{item.name}</Text>
          <Text style={styles.colourBrand}>{item.brand}</Text>
          {item.tag.length > 0 && (
            <View style={styles.tagRow}>
              {item.tag.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Pressable
          style={[styles.addBtn, inInventory && styles.addBtnActive]}
          onPress={() => handleAdd(item)}
        >
          <Text style={[styles.addBtnText, inInventory && styles.addBtnTextActive]}>
            {inInventory ? '✓' : '+'}
          </Text>
        </Pressable>
      </View>
    );
  };

  const insets = useSafeAreaInsets();
  const filterActive = isActive(filters);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Mini Paint Collection</Text>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={16} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search colors..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <Pressable
          style={[styles.filterBtn, filterActive && styles.filterBtnActive]}
          onPress={() => setShowFilter(true)}
        >
          <IconSymbol
            name="line.3.horizontal.decrease"
            size={18}
            color={filterActive ? '#4A90D9' : '#555'}
          />
          {filterActive && <View style={styles.filterBadge} />}
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>{filtered.length} colors</Text>
        <Text style={styles.stat}>{inventoryIds.size} in inventory</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No colours found.</Text>}
      />

      <FilterSheet
        visible={showFilter}
        brands={allBrands}
        filters={filters}
        onApply={setFilters}
        onClose={() => setShowFilter(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    color: '#111',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 10,
    height: 42,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: '#111' },
  filterBtn: {
    width: 42,
    height: 42,
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  stat: { fontSize: 13, color: '#4A90D9', fontWeight: '500' },
  list: { paddingHorizontal: 14, paddingBottom: 16, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    padding: 12,
  },
  swatch: { width: 56, height: 56, borderRadius: 10 },
  cardInfo: { flex: 1, marginLeft: 12, gap: 2 },
  colourName: { fontSize: 16, fontWeight: '600', color: '#111' },
  colourBrand: { fontSize: 13, color: '#888' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { fontSize: 11, color: '#555' },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addBtnActive: { borderColor: '#4A90D9', backgroundColor: '#EBF3FD' },
  addBtnText: { fontSize: 18, color: '#888', lineHeight: 20 },
  addBtnTextActive: { fontSize: 14, color: '#4A90D9' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});

const sheet = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
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

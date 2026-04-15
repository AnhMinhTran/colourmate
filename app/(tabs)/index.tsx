import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColourPoint } from '@/src/colour/models/colourPoint';
import { SqliteColourPointRepository } from '@/src/colour/repositories/sqliteColourPointRepository';
import {
  ColourFilter,
  EMPTY_FILTER,
  filterColours,
  isFilterActive,
} from '@/src/colour/services/colourQueryService';
import { FilterSheet } from '@/src/colour/ui/components/filter-sheet';
import { Inventory } from '@/src/inventory/models/inventory';
import { SqliteInventoryRepository } from '@/src/inventory/repositories/sqliteInventoryRepository';
import { IconSymbol } from '@/src/ui/components/icon-symbol';
import { AppColors } from '@/src/ui/constants/theme';

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
  const [filter, setFilter] = useState<ColourFilter>(EMPTY_FILTER);
  const [showFilter, setShowFilter] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    const [allColours, allInventory] = await Promise.all([
      colourRepo.findAll(),
      inventoryRepo.findAll(),
    ]);
    setColours(allColours);
    setInventoryIds(new Set(allInventory.map((i) => i.colour_id)));
  }, [colourRepo, inventoryRepo]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleToggle = useCallback(async (colour: ColourPoint) => {
    if (inventoryIds.has(colour.id)) {
      await inventoryRepo.deleteByColourId(colour.id);
      setInventoryIds((prev) => { const next = new Set(prev); next.delete(colour.id); return next; });
    } else {
      const entry = Inventory.create({ colour_id: colour.id, quantity: 1 });
      await inventoryRepo.create(entry);
      setInventoryIds((prev) => new Set([...prev, colour.id]));
    }
  }, [inventoryIds, inventoryRepo]);

  const allBrands = useMemo(
    () => [...new Set(colours.map((c) => c.brand))].sort(),
    [colours],
  );

  const filtered = useMemo(
    () => filterColours(colours, { ...filter, search }, inventoryIds),
    [colours, search, filter, inventoryIds],
  );

  const renderItem = ({ item }: { item: ColourPoint }) => {
    const bg = `rgb(${item.rgb.r}, ${item.rgb.g}, ${item.rgb.b})`;
    const inInventory = inventoryIds.has(item.id);
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push({ pathname: '/colour/[id]' as any, params: { id: item.id } })}
        onLongPress={() => handleToggle(item)}
      >
        <View style={[styles.swatch, { backgroundColor: bg }]}>
          <View style={[styles.ownershipDot, { backgroundColor: inInventory ? AppColors.success : AppColors.action }]} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.colourName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.colourBrand} numberOfLines={1}>{item.brand}</Text>
        </View>
      </Pressable>
    );
  };

  const insets = useSafeAreaInsets();
  const filterActive = isFilterActive(filter);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Colourmate</Text>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={16} color={AppColors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search colors..."
            placeholderTextColor={AppColors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={styles.clearBtn}>
              <IconSymbol name="xmark.circle.fill" size={16} color={AppColors.muted} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.filterBtn, filterActive && styles.filterBtnActive]}
          onPress={() => setShowFilter(true)}
        >
          <IconSymbol
            name="line.3.horizontal.decrease"
            size={18}
            color={filterActive ? AppColors.interactive : AppColors.muted}
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
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No colours found.</Text>}
      />

      <FilterSheet
        visible={showFilter}
        brands={allBrands}
        filter={filter}
        onApply={setFilter}
        onClose={() => setShowFilter(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.bg },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    color: AppColors.text,
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
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 10,
    height: 42,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: AppColors.text },
  clearBtn: { paddingHorizontal: 4 },
  filterBtn: {
    width: 42,
    height: 42,
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
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: AppColors.interactive,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  stat: { fontSize: 13, color: AppColors.interactive, fontWeight: '500' },
  list: { paddingHorizontal: 10, paddingBottom: 16 },
  columnWrapper: { gap: 10, marginBottom: 10 },
  card: {
    flex: 1,
    backgroundColor: AppColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  swatch: { width: '100%', height: 90, position: 'relative' },
  ownershipDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  cardInfo: { padding: 10, gap: 2 },
  colourName: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  colourBrand: { fontSize: 12, color: AppColors.muted },
  empty: { textAlign: 'center', color: AppColors.muted, marginTop: 40 },
});

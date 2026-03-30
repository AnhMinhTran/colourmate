import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ColourPoint } from "@/src/colour/models/colourPoint";
import { SqliteColourPointRepository } from "@/src/colour/repositories/sqliteColourPointRepository";
import { filterByBrands } from "@/src/colour/services/munsellSceneService";
import { ColourTooltip } from "@/src/colour/ui/components/colour-tooltip";
import { MunsellCanvas } from "@/src/colour/ui/components/munsell-canvas";
import { SqliteInventoryRepository } from "@/src/inventory/repositories/sqliteInventoryRepository";
import { IconSymbol } from "@/src/ui/components/icon-symbol";

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
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
            onValueChange={(v) => setDraft((prev) => ({ ...prev, inInventoryOnly: v }))}
            trackColor={{ true: "#4A90D9" }}
          />
        </View>

        <Text style={sheet.sectionLabel}>Brand</Text>
        <ScrollView style={sheet.brandList} showsVerticalScrollIndicator={false}>
          {brands.map((brand) => {
            const selected = draft.brands.has(brand);
            return (
              <Pressable
                key={brand}
                style={sheet.brandRow}
                onPress={() => toggleBrand(brand)}
              >
                <View style={[sheet.checkbox, selected && sheet.checkboxActive]}>
                  {selected && <Text style={sheet.checkmark}>✓</Text>}
                </View>
                <Text style={sheet.brandLabel}>{brand}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          style={sheet.applyBtn}
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        >
          <Text style={sheet.applyBtnText}>Apply</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Munsell3DScreen
// ---------------------------------------------------------------------------
export default function Munsell3DScreen() {
  const db = useSQLiteContext();
  const colourRepo = useMemo(() => new SqliteColourPointRepository(db), [db]);
  const inventoryRepo = useMemo(() => new SqliteInventoryRepository(db), [db]);

  const [colours, setColours] = useState<ColourPoint[]>([]);
  const [inventoryIds, setInventoryIds] = useState<Set<string>>(new Set());
  const [selectedColour, setSelectedColour] = useState<ColourPoint | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilter, setShowFilter] = useState(false);

  const loadData = useCallback(async () => {
    const [all, inventories] = await Promise.all([
      colourRepo.findAll(),
      inventoryRepo.findAll(),
    ]);
    setColours(all);
    setInventoryIds(new Set(inventories.map((inv) => inv.colour_id)));
  }, [colourRepo, inventoryRepo]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const allBrands = useMemo(
    () => [...new Set(colours.map((c) => c.brand))].sort(),
    [colours]
  );

  const filteredColours = useMemo(() => {
    let result = filterByBrands(colours, filters.brands);
    if (filters.inInventoryOnly) {
      result = result.filter((c) => inventoryIds.has(c.id));
    }
    return result;
  }, [colours, filters, inventoryIds]);

  const handleSelectColour = useCallback(
    (id: string) => {
      const found = colours.find((c) => c.id === id) ?? null;
      setSelectedColour(found);
    },
    [colours]
  );

  const insets = useSafeAreaInsets();
  const filterActive = isActive(filters);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>3D Munsell Colour View</Text>
        <Pressable
          style={[styles.filterBtn, filterActive && styles.filterBtnActive]}
          onPress={() => setShowFilter(true)}
        >
          <IconSymbol
            name="line.3.horizontal.decrease"
            size={18}
            color={filterActive ? "#4A90D9" : "#555"}
          />
          {filterActive && <View style={styles.filterBadge} />}
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>{filteredColours.length} colors</Text>
      </View>

      <View style={styles.canvasContainer}>
        <MunsellCanvas
          colours={filteredColours}
          onSelectColour={handleSelectColour}
        />
        <ColourTooltip
          colour={selectedColour}
          onDismiss={() => setSelectedColour(null)}
        />
      </View>

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
  screen: { flex: 1, backgroundColor: "#f5f5f5" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 14,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    color: "#111",
  },
  filterBtn: {
    width: 42,
    height: 42,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  filterBtnActive: { borderColor: "#4A90D9", backgroundColor: "#EBF3FD" },
  filterBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#4A90D9",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  stat: { fontSize: 13, color: "#4A90D9", fontWeight: "500" },
  canvasContainer: { flex: 1, position: "relative" },
});

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  panel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "75%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heading: { fontSize: 17, fontWeight: "700", color: "#111" },
  clearAll: { fontSize: 14, color: "#4A90D9" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginBottom: 8,
  },
  rowLabel: { fontSize: 15, color: "#111" },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  brandList: { maxHeight: 260 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: { backgroundColor: "#4A90D9", borderColor: "#4A90D9" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  brandLabel: { fontSize: 15, color: "#111" },
  applyBtn: {
    backgroundColor: "#4A90D9",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  applyBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

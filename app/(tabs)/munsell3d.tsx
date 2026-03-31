import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ColourPoint } from "@/src/colour/models/colourPoint";
import { SqliteColourPointRepository } from "@/src/colour/repositories/sqliteColourPointRepository";
import {
  ColourFilter,
  EMPTY_FILTER,
  computeSpectrumPath,
  filterColours,
  isFilterActive,
} from "@/src/colour/services/colourQueryService";
import { FilterSheet } from "@/src/colour/ui/components/filter-sheet";
import { ColourTooltip } from "@/src/colour/ui/components/colour-tooltip";
import { MunsellCanvas } from "@/src/colour/ui/components/munsell-canvas";
import { SpectrumSheet } from "@/src/colour/ui/components/spectrum-sheet";
import { SqliteInventoryRepository } from "@/src/inventory/repositories/sqliteInventoryRepository";
import { IconSymbol } from "@/src/ui/components/icon-symbol";

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
  const [filter, setFilter] = useState<ColourFilter>(EMPTY_FILTER);
  const [showFilter, setShowFilter] = useState(false);

  // Spectrum mode
  const [spectrumMode, setSpectrumMode] = useState(false);
  const [spectrumA, setSpectrumA] = useState<ColourPoint | null>(null);
  const [spectrumB, setSpectrumB] = useState<ColourPoint | null>(null);
  const [showSpectrum, setShowSpectrum] = useState(false);

  const spectrumPath = useMemo<ColourPoint[]>(() => {
    if (!spectrumA || !spectrumB) return [];
    return computeSpectrumPath(spectrumA, spectrumB, colours);
  }, [spectrumA, spectrumB, colours]);

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

  const filteredColours = useMemo(
    () => filterColours(colours, filter, inventoryIds),
    [colours, filter, inventoryIds]
  );

  const handleSelectColour = useCallback(
    (id: string) => {
      const found = colours.find((c) => c.id === id) ?? null;
      if (spectrumMode) {
        if (!spectrumA) {
          setSpectrumA(found);
        } else if (!spectrumB && found?.id !== spectrumA.id) {
          setSpectrumB(found);
          setShowSpectrum(true);
        }
        setSelectedColour(null);
      } else {
        setSelectedColour(found);
      }
    },
    [colours, spectrumMode, spectrumA]
  );

  const toggleSpectrumMode = useCallback(() => {
    setSpectrumMode((prev) => {
      if (prev) {
        setSpectrumA(null);
        setSpectrumB(null);
        setShowSpectrum(false);
        setSelectedColour(null);
      }
      return !prev;
    });
  }, []);

  const highlightIds = useMemo(() => {
    const ids: string[] = [];
    if (spectrumA) ids.push(spectrumA.id);
    if (spectrumB) ids.push(spectrumB.id);
    return ids;
  }, [spectrumA, spectrumB]);

  const insets = useSafeAreaInsets();
  const filterActive = isFilterActive(filter);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>3D Munsell Colour View</Text>
        <View style={styles.headerBtns}>
          <Pressable
            style={[styles.headerBtn, spectrumMode && styles.headerBtnActive]}
            onPress={toggleSpectrumMode}
          >
            <IconSymbol
              name="scope"
              size={18}
              color={spectrumMode ? "#4A90D9" : "#555"}
            />
          </Pressable>
          <Pressable
            style={[styles.headerBtn, filterActive && styles.filterBtnActive]}
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
      </View>

      <View style={styles.statsRow}>
        {spectrumMode ? (
          <>
            <Text style={styles.statSpectrum}>
              {!spectrumA
                ? "Tap a colour to set point A"
                : !spectrumB
                ? `A: ${spectrumA.name} — tap another for point B`
                : `A → B selected`}
            </Text>
            {spectrumA && (
              <Pressable
                style={styles.resetBtn}
                onPress={() => { setSpectrumA(null); setSpectrumB(null); setShowSpectrum(false); }}
              >
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.statsCenter}>
            <Text style={styles.stat}>{filteredColours.length} colors</Text>
          </View>
        )}
      </View>

      <View style={styles.canvasContainer}>
        <MunsellCanvas
          colours={filteredColours}
          onSelectColour={handleSelectColour}
          highlightIds={highlightIds}
          spectrumLineA={spectrumA?.coordinate ?? null}
          spectrumLineB={spectrumB?.coordinate ?? null}
        />
        {!spectrumMode && (
          <ColourTooltip
            colour={selectedColour}
            onDismiss={() => setSelectedColour(null)}
          />
        )}
      </View>

      <FilterSheet
        visible={showFilter}
        brands={allBrands}
        filter={filter}
        onApply={setFilter}
        onClose={() => setShowFilter(false)}
      />

      <SpectrumSheet
        visible={showSpectrum}
        path={spectrumPath}
        onClose={() => setShowSpectrum(false)}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  stat: { fontSize: 13, color: "#4A90D9", fontWeight: "500" },
  statSpectrum: { fontSize: 13, color: "#FF8800", fontWeight: "500" },
  canvasContainer: { flex: 1, position: "relative" },
  headerBtns: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 42,
    height: 42,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  headerBtnActive: { borderColor: "#4A90D9", backgroundColor: "#EBF3FD" },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#FF8800",
  },
  resetBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  statsCenter: { flex: 1, alignItems: "center" },
});

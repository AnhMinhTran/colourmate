import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { ColourTooltip } from "@/src/colour/ui/components/colour-tooltip";
import { FilterSheet } from "@/src/colour/ui/components/filter-sheet";
import { MunsellCanvas } from "@/src/colour/ui/components/munsell-canvas";
import { SpectrumSheet } from "@/src/colour/ui/components/spectrum-sheet";
import { SqliteInventoryRepository } from "@/src/inventory/repositories/sqliteInventoryRepository";
import { IconSymbol } from "@/src/ui/components/icon-symbol";
import {
  ACCENT_GOLD,
  BG_ACTIVE,
  BG_CARD,
  BG_PRIMARY,
  BORDER_DEFAULT,
  SWATCH_BORDER,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "@/src/ui/constants/theme";

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

  // Search
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Spectrum mode
  const [spectrumMode, setSpectrumMode] = useState(false);
  const [spectrumA, setSpectrumA] = useState<ColourPoint | null>(null);
  const [spectrumB, setSpectrumB] = useState<ColourPoint | null>(null);
  const [showSpectrum, setShowSpectrum] = useState(false);

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

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return filteredColours
      .filter((c) => c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q))
      .slice(0, 8);
  }, [filteredColours, searchQuery]);

  const canvasColours = useMemo(() => {
    if (searchMode && searchQuery.trim()) return searchResults;
    return filteredColours;
  }, [searchMode, searchQuery, searchResults, filteredColours]);

  const spectrumPath = useMemo<ColourPoint[]>(() => {
    if (!spectrumA || !spectrumB) return [];
    return computeSpectrumPath(spectrumA, spectrumB, filteredColours);
  }, [spectrumA, spectrumB, filteredColours]);

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

  const toggleSearchMode = useCallback(() => {
    setSearchMode((prev) => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  }, []);

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
    if (selectedColour) ids.push(selectedColour.id);
    if (spectrumA) ids.push(spectrumA.id);
    if (spectrumB) ids.push(spectrumB.id);
    return ids;
  }, [selectedColour, spectrumA, spectrumB]);

  const insets = useSafeAreaInsets();
  const filterActive = isFilterActive(filter);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>3D Munsell View</Text>
        <View style={styles.headerBtns}>
          <Pressable
            style={[styles.headerBtn, searchMode && styles.headerBtnActive]}
            onPress={toggleSearchMode}
          >
            <IconSymbol
              name="magnifyingglass"
              size={18}
              color={searchMode ? ACCENT_GOLD : TEXT_MUTED}
            />
          </Pressable>
          <Pressable
            style={[styles.headerBtn, spectrumMode && styles.headerBtnActive]}
            onPress={toggleSpectrumMode}
          >
            <IconSymbol
              name="scope"
              size={18}
              color={spectrumMode ? ACCENT_GOLD : TEXT_MUTED}
            />
          </Pressable>
          <Pressable
            style={[styles.headerBtn, filterActive && styles.filterBtnActive]}
            onPress={() => setShowFilter(true)}
          >
            <IconSymbol
              name="line.3.horizontal.decrease"
              size={18}
              color={filterActive ? ACCENT_GOLD : TEXT_MUTED}
            />
            {filterActive && <View style={styles.filterBadge} />}
          </Pressable>
        </View>
      </View>

      {searchMode && (
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={16} color={TEXT_MUTED} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or brand\u2026"
            placeholderTextColor={TEXT_MUTED}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={16} color={TEXT_MUTED} />
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.statsRow}>
        {spectrumMode ? (
          <>
            <Text style={styles.statSpectrum}>
              {!spectrumA
                ? "Tap a colour to set point A"
                : !spectrumB
                ? `A: ${spectrumA.name} \u2014 tap another for point B`
                : `A \u2192 B selected`}
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
            <Text style={styles.stat}>{canvasColours.length} colors</Text>
          </View>
        )}
      </View>

      <View style={styles.canvasContainer}>
        <MunsellCanvas
          colours={canvasColours}
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
        {searchMode && searchQuery.trim().length > 0 && (
          <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
            {searchResults.length === 0 ? (
              <Text style={styles.searchEmpty}>No colours found</Text>
            ) : (
              searchResults.map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.searchResultItem}
                  onPress={() => { setSelectedColour(c); setSearchQuery(''); setSearchMode(false); }}
                >
                  <View style={[styles.searchResultSwatch, { backgroundColor: `rgb(${c.rgb.r},${c.rgb.g},${c.rgb.b})` }]} />
                  <View style={styles.searchResultText}>
                    <Text style={styles.searchResultName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.searchResultBrand} numberOfLines={1}>{c.brand}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
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
  screen: { flex: 1, backgroundColor: BG_PRIMARY },
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
    fontFamily: "Cinzel_Bold",
    fontWeight: "700",
    textAlign: "center",
    color: ACCENT_GOLD,
    letterSpacing: 1,
  },
  filterBtnActive: { borderColor: ACCENT_GOLD, backgroundColor: BG_ACTIVE },
  filterBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ACCENT_GOLD,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  stat: { fontSize: 13, color: ACCENT_GOLD, fontWeight: "500", fontFamily: "Inter_Medium" },
  statSpectrum: { fontSize: 13, color: "#FF8800", fontWeight: "500", fontFamily: "Inter_Medium" },
  canvasContainer: { flex: 1, position: "relative" },
  headerBtns: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 42,
    height: 42,
    backgroundColor: BG_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBtnActive: { borderColor: ACCENT_GOLD, backgroundColor: BG_ACTIVE },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#FF8800",
  },
  resetBtnText: { fontSize: 12, fontWeight: "600", color: "#fff", fontFamily: "Inter_SemiBold" },
  statsCenter: { flex: 1, alignItems: "center" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: BG_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT_PRIMARY,
    paddingVertical: 0,
    fontFamily: "Inter",
  },
  searchResults: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    maxHeight: 320,
    backgroundColor: BG_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  searchEmpty: { padding: 16, fontSize: 14, color: TEXT_MUTED, textAlign: "center", fontFamily: "Inter" },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DEFAULT,
  },
  searchResultSwatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: SWATCH_BORDER },
  searchResultText: { flex: 1 },
  searchResultName: { fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY, fontFamily: "Inter_SemiBold" },
  searchResultBrand: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 1, fontFamily: "Inter" },
});

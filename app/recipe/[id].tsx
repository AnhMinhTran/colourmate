import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { randomUUID } from "expo-crypto";

import { ColourPoint } from "@/src/colour/models/colourPoint";
import { SqliteColourPointRepository } from "@/src/colour/repositories/sqliteColourPointRepository";
import { Recipe, RecipeProps, RecipeStepColourProps, RecipeStepProps } from "@/src/recipe/models/recipe";
import { SqliteRecipeRepository } from "@/src/recipe/repositories/sqliteRecipeRepository";
import { IconSymbol } from "@/src/ui/components/icon-symbol";

// ---------------------------------------------------------------------------
// Colour Picker Modal
// ---------------------------------------------------------------------------
function ColourPickerModal({
  visible,
  colours,
  onPick,
  onClose,
}: {
  visible: boolean;
  colours: ColourPoint[];
  onPick: (colour: ColourPoint) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    if (!query.trim()) return colours;
    const q = query.toLowerCase();
    return colours.filter(
      (c) => c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q)
    );
  }, [colours, query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ps.backdrop} onPress={onClose} />
      <View style={ps.panel}>
        <View style={ps.handle} />
        <View style={ps.header}>
          <Text style={ps.heading}>Pick a Colour</Text>
          <Pressable onPress={onClose}>
            <Text style={ps.closeText}>Cancel</Text>
          </Pressable>
        </View>
        <View style={ps.searchBar}>
          <IconSymbol name="magnifyingglass" size={16} color="#aaa" />
          <TextInput
            style={ps.searchInput}
            placeholder="Search…"
            placeholderTextColor="#aaa"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
        <FlatList
          data={results}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: c }) => (
            <Pressable
              style={ps.row}
              onPress={() => { onPick(c); setQuery(""); }}
            >
              <View style={[ps.swatch, { backgroundColor: `rgb(${c.rgb.r},${c.rgb.g},${c.rgb.b})` }]} />
              <View style={ps.rowText}>
                <Text style={ps.rowName} numberOfLines={1}>{c.name}</Text>
                <Text style={ps.rowBrand} numberOfLines={1}>{c.brand}</Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const recipeRepo = useMemo(() => new SqliteRecipeRepository(db), [db]);
  const colourRepo = useMemo(() => new SqliteColourPointRepository(db), [db]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Plain object state — no class instances, fully immutable updates
  const [recipe, setRecipe] = useState<RecipeProps | null>(null);
  const [allColours, setAllColours] = useState<ColourPoint[]>([]);
  const [colourMap, setColourMap] = useState<Map<string, ColourPoint>>(new Map());
  const [pickerStepId, setPickerStepId] = useState<string | null>(null);

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const [r, colours] = await Promise.all([
        recipeRepo.findById(id),
        colourRepo.findAll(),
      ]);
      if (r) {
        setRecipe({ id: r.id, name: r.name, created_at: r.created_at, steps: r.steps.map(stepToProps) });
      }
      setAllColours(colours);
      setColourMap(new Map(colours.map((c) => [c.id, c])));
    })();
  }, [id]);

  const scheduleSave = useCallback((data: RecipeProps) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      recipeRepo.save(Recipe.fromDatabase(data));
    }, 600);
  }, [recipeRepo]);

  // Single immutable updater — always produces a new RecipeProps object
  const updateRecipe = useCallback((updater: (r: RecipeProps) => RecipeProps) => {
    setRecipe((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const handleNameChange = useCallback((text: string) => {
    updateRecipe((r) => ({ ...r, name: text }));
  }, [updateRecipe]);

  const handleAddStep = useCallback(() => {
    updateRecipe((r) => {
      const newStep: RecipeStepProps = {
        id: randomUUID(),
        recipe_id: r.id,
        position: r.steps.length,
        comment: null,
        image_uri: null,
        colours: [],
      };
      return { ...r, steps: [...r.steps, newStep] };
    });
  }, [updateRecipe]);

  const handleDeleteStep = useCallback((stepId: string) => {
    updateRecipe((r) => ({
      ...r,
      steps: r.steps
        .filter((s) => s.id !== stepId)
        .map((s, i) => ({ ...s, position: i })),
    }));
  }, [updateRecipe]);

  const handleMoveStep = useCallback((stepId: string, dir: -1 | 1) => {
    updateRecipe((r) => {
      const idx = r.steps.findIndex((s) => s.id === stepId);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= r.steps.length) return r;
      const steps = [...r.steps];
      [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
      return { ...r, steps: steps.map((s, i) => ({ ...s, position: i })) };
    });
  }, [updateRecipe]);

  const handleCommentChange = useCallback((stepId: string, text: string) => {
    updateRecipe((r) => ({
      ...r,
      steps: r.steps.map((s) =>
        s.id === stepId ? { ...s, comment: text || null } : s
      ),
    }));
  }, [updateRecipe]);

  const handlePickImage = useCallback(async (stepId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      updateRecipe((r) => ({
        ...r,
        steps: r.steps.map((s) =>
          s.id === stepId ? { ...s, image_uri: uri } : s
        ),
      }));
    }
  }, [updateRecipe]);

  const handleRemoveImage = useCallback((stepId: string) => {
    updateRecipe((r) => ({
      ...r,
      steps: r.steps.map((s) =>
        s.id === stepId ? { ...s, image_uri: null } : s
      ),
    }));
  }, [updateRecipe]);

  const handlePickColour = useCallback((colour: ColourPoint) => {
    if (!pickerStepId) return;
    updateRecipe((r) => ({
      ...r,
      steps: r.steps.map((s) => {
        if (s.id !== pickerStepId) return s;
        if (s.colours.some((sc) => sc.colour_id === colour.id)) return s;
        const newSc: RecipeStepColourProps = {
          id: randomUUID(),
          step_id: s.id,
          colour_id: colour.id,
          position: s.colours.length,
        };
        return { ...s, colours: [...s.colours, newSc] };
      }),
    }));
    setPickerStepId(null);
  }, [pickerStepId, updateRecipe]);

  const handleRemoveColour = useCallback((stepId: string, colourId: string) => {
    updateRecipe((r) => ({
      ...r,
      steps: r.steps.map((s) => {
        if (s.id !== stepId) return s;
        return {
          ...s,
          colours: s.colours
            .filter((sc) => sc.colour_id !== colourId)
            .map((sc, i) => ({ ...sc, position: i })),
        };
      }),
    }));
  }, [updateRecipe]);

  if (!recipe) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Text style={styles.loading}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <IconSymbol name="chevron.left" size={24} color="#4A90D9" />
        </Pressable>
        <TextInput
          style={styles.nameInput}
          value={recipe.name}
          onChangeText={handleNameChange}
          placeholder="Recipe name"
          placeholderTextColor="#bbb"
          autoFocus={recipe.steps.length === 0}
          selectTextOnFocus
        />
      </View>

      {/* Steps */}
      <ScrollView contentContainerStyle={styles.stepList} keyboardShouldPersistTaps="handled">
        {recipe.steps.map((step, idx) => {
          const stepColours = step.colours
            .map((sc) => colourMap.get(sc.colour_id))
            .filter(Boolean) as ColourPoint[];

          return (
            <View key={step.id} style={styles.stepCard}>
              {/* Step header */}
              <View style={styles.stepHeader}>
                <Text style={styles.stepLabel}>Step {idx + 1}</Text>
                <View style={styles.stepHeaderActions}>
                  <Pressable
                    onPress={() => handleMoveStep(step.id, -1)}
                    disabled={idx === 0}
                    hitSlop={8}
                  >
                    <IconSymbol name="chevron.up" size={18} color={idx === 0 ? "#ccc" : "#555"} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleMoveStep(step.id, 1)}
                    disabled={idx === recipe.steps.length - 1}
                    hitSlop={8}
                  >
                    <IconSymbol name="chevron.down" size={18} color={idx === recipe.steps.length - 1 ? "#ccc" : "#555"} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteStep(step.id)} hitSlop={8}>
                    <IconSymbol name="trash" size={18} color="#e05252" />
                  </Pressable>
                </View>
              </View>

              {/* Colours */}
              <View style={styles.coloursRow}>
                {stepColours.map((c) => (
                  <Pressable
                    key={c.id}
                    style={styles.colourChipWrapper}
                    onLongPress={() => handleRemoveColour(step.id, c.id)}
                  >
                    <View style={[styles.colourChip, { backgroundColor: `rgb(${c.rgb.r},${c.rgb.g},${c.rgb.b})` }]} />
                    <Pressable
                      style={styles.colourChipRemove}
                      onPress={() => handleRemoveColour(step.id, c.id)}
                      hitSlop={6}
                    >
                      <IconSymbol name="xmark" size={10} color="#fff" />
                    </Pressable>
                  </Pressable>
                ))}
                <Pressable
                  style={styles.addColourBtn}
                  onPress={() => setPickerStepId(step.id)}
                >
                  <IconSymbol name="plus" size={16} color="#4A90D9" />
                </Pressable>
              </View>

              {/* Image */}
              {step.image_uri ? (
                <View style={styles.imageWrapper}>
                  <Image source={{ uri: step.image_uri }} style={styles.stepImage} resizeMode="cover" />
                  <Pressable style={styles.imageRemoveBtn} onPress={() => handleRemoveImage(step.id)}>
                    <IconSymbol name="xmark" size={12} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.imagePlaceholder} onPress={() => handlePickImage(step.id)}>
                  <IconSymbol name="photo.badge.plus" size={22} color="#aaa" />
                  <Text style={styles.imagePlaceholderText}>Add photo</Text>
                </Pressable>
              )}

              {/* Comment */}
              <TextInput
                style={styles.commentInput}
                placeholder="Add a note…"
                placeholderTextColor="#bbb"
                value={step.comment ?? ""}
                onChangeText={(t) => handleCommentChange(step.id, t)}
                multiline
              />
            </View>
          );
        })}

        <Pressable style={styles.addStepBtn} onPress={handleAddStep}>
          <IconSymbol name="plus" size={18} color="#4A90D9" />
          <Text style={styles.addStepText}>Add Step</Text>
        </Pressable>
      </ScrollView>

      <ColourPickerModal
        visible={pickerStepId !== null}
        colours={allColours}
        onPick={handlePickColour}
        onClose={() => setPickerStepId(null)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function stepToProps(s: import("@/src/recipe/models/recipe").RecipeStep): RecipeStepProps {
  return {
    id: s.id,
    recipe_id: s.recipe_id,
    position: s.position,
    comment: s.comment,
    image_uri: s.image_uri,
    colours: s.colours.map((c) => ({
      id: c.id,
      step_id: c.step_id,
      colour_id: c.colour_id,
      position: c.position,
    })),
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f5f5" },
  loading: { padding: 20, color: "#999" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backBtn: { padding: 4 },
  nameInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    paddingVertical: 0,
  },
  stepList: { padding: 16, gap: 14, paddingBottom: 40 },
  stepCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepLabel: { fontSize: 14, fontWeight: "700", color: "#555", textTransform: "uppercase", letterSpacing: 0.5 },
  stepHeaderActions: { flexDirection: "row", gap: 14, alignItems: "center" },
  coloursRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  colourChipWrapper: { position: "relative" },
  colourChip: { width: 36, height: 36, borderRadius: 10 },
  colourChipRemove: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  addColourBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#4A90D9",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: { position: "relative", borderRadius: 10, overflow: "hidden" },
  stepImage: { width: "100%", height: 160, borderRadius: 10 },
  imageRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholder: {
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fafafa",
  },
  imagePlaceholderText: { fontSize: 14, color: "#aaa" },
  commentInput: {
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
    backgroundColor: "#fafafa",
  },
  addStepBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#4A90D9",
    borderStyle: "dashed",
    backgroundColor: "#fff",
  },
  addStepText: { fontSize: 15, fontWeight: "600", color: "#4A90D9" },
});

const ps = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  panel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    height: "75%",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ddd", alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  heading: { fontSize: 17, fontWeight: "700", color: "#111" },
  closeText: { fontSize: 15, color: "#e05252", fontWeight: "600" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#111", paddingVertical: 0 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  swatch: { width: 36, height: 36, borderRadius: 8 },
  rowText: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: "600", color: "#111" },
  rowBrand: { fontSize: 12, color: "#999" },
});

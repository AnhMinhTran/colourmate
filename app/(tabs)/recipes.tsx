import { useRouter, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ColourPoint } from "@/src/colour/models/colourPoint";
import { SqliteColourPointRepository } from "@/src/colour/repositories/sqliteColourPointRepository";
import { Recipe } from "@/src/recipe/models/recipe";
import { SqliteRecipeRepository } from "@/src/recipe/repositories/sqliteRecipeRepository";
import { IconSymbol } from "@/src/ui/components/icon-symbol";
import {
  ACCENT_GOLD,
  BG_CARD,
  BG_PRIMARY,
  BORDER_DEFAULT,
  DANGER,
  SWATCH_BORDER,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "@/src/ui/constants/theme";

export default function RecipesScreen() {
  const db = useSQLiteContext();
  const recipeRepo = useMemo(() => new SqliteRecipeRepository(db), [db]);
  const colourRepo = useMemo(() => new SqliteColourPointRepository(db), [db]);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [colourMap, setColourMap] = useState<Map<string, ColourPoint>>(new Map());

  const loadData = useCallback(async () => {
    const [all, colours] = await Promise.all([
      recipeRepo.findAll(),
      colourRepo.findAll(),
    ]);
    setRecipes(all);
    setColourMap(new Map(colours.map((c) => [c.id, c])));
  }, [recipeRepo, colourRepo]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleCreate = useCallback(async () => {
    const recipe = Recipe.create("New Recipe");
    await recipeRepo.save(recipe);
    router.push({ pathname: '/recipe/[id]' as any, params: { id: recipe.id } });
  }, [recipeRepo, router]);

  const handleDelete = useCallback(async (id: string) => {
    await recipeRepo.delete(id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }, [recipeRepo]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Recipes</Text>
        <Pressable style={styles.addBtn} onPress={handleCreate}>
          <IconSymbol name="plus" size={20} color={BG_PRIMARY} />
        </Pressable>
      </View>

      <FlatList
        data={recipes}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No recipes yet.</Text>
            <Text style={styles.emptyHint}>Tap + to create your first recipe.</Text>
          </View>
        }
        renderItem={({ item: recipe }) => {
          const previewColours = recipe.steps
            .flatMap((s) => s.colours.map((sc) => colourMap.get(sc.colour_id)))
            .filter(Boolean)
            .filter((c, i, arr) => arr.findIndex((x) => x!.id === c!.id) === i) // dedupe
            .slice(0, 8) as ColourPoint[];

          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/recipe/[id]' as any, params: { id: recipe.id } })}
            >
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>{recipe.name}</Text>
                <Text style={styles.cardMeta}>
                  {recipe.steps.length} {recipe.steps.length === 1 ? "step" : "steps"}
                </Text>
                {previewColours.length > 0 && (
                  <View style={styles.swatchRow}>
                    {previewColours.map((c) => (
                      <View
                        key={c.id}
                        style={[styles.swatch, { backgroundColor: `rgb(${c.rgb.r},${c.rgb.g},${c.rgb.b})` }]}
                      />
                    ))}
                  </View>
                )}
              </View>
              <Pressable style={styles.deleteBtn} onPress={() => handleDelete(recipe.id)} hitSlop={8}>
                <IconSymbol name="trash" size={16} color={DANGER} />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG_PRIMARY },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontFamily: "Cinzel_Bold",
    fontWeight: "700",
    color: ACCENT_GOLD,
    letterSpacing: 1,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT_GOLD,
    justifyContent: "center",
    alignItems: "center",
  },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 17, fontWeight: "600", color: TEXT_SECONDARY, fontFamily: "Inter_SemiBold" },
  emptyHint: { fontSize: 14, color: TEXT_MUTED, fontFamily: "Inter" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    padding: 14,
  },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontSize: 16, fontWeight: "700", color: TEXT_PRIMARY, fontFamily: "Inter_Bold" },
  cardMeta: { fontSize: 13, color: TEXT_SECONDARY, fontFamily: "Inter" },
  swatchRow: { flexDirection: "row", gap: 4, marginTop: 4 },
  swatch: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: SWATCH_BORDER },
  deleteBtn: { padding: 6 },
});

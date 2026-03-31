import * as SQLite from "expo-sqlite";
import { Recipe, RecipeProps, RecipeStepColourProps, RecipeStepProps } from "../models/recipe";
import { RecipeRepository } from "./recipeRepository";

interface RecipeRow {
    id: string;
    name: string;
    created_at: number;
}

interface RecipeStepRow {
    id: string;
    recipe_id: string;
    position: number;
    comment: string | null;
    image_uri: string | null;
}

interface RecipeStepColourRow {
    id: string;
    step_id: string;
    colour_id: string;
    position: number;
}

export class SqliteRecipeRepository implements RecipeRepository {
    constructor(private readonly db: SQLite.SQLiteDatabase) {}

    async findAll(): Promise<Recipe[]> {
        const recipeRows = await this.db.getAllAsync<RecipeRow>(
            "SELECT * FROM recipes ORDER BY created_at DESC"
        );
        if (recipeRows.length === 0) return [];

        const ids = recipeRows.map((r) => r.id);
        const placeholders = ids.map(() => "?").join(",");

        const stepRows = await this.db.getAllAsync<RecipeStepRow>(
            `SELECT * FROM recipe_steps WHERE recipe_id IN (${placeholders}) ORDER BY position ASC`,
            ...ids
        );
        const stepIds = stepRows.map((s) => s.id);
        let colourRows: RecipeStepColourRow[] = [];
        if (stepIds.length > 0) {
            const stepPlaceholders = stepIds.map(() => "?").join(",");
            colourRows = await this.db.getAllAsync<RecipeStepColourRow>(
                `SELECT * FROM recipe_step_colours WHERE step_id IN (${stepPlaceholders}) ORDER BY position ASC`,
                ...stepIds
            );
        }

        return recipeRows.map((r) => this._assemble(r, stepRows, colourRows));
    }

    async findById(id: string): Promise<Recipe | null> {
        const row = await this.db.getFirstAsync<RecipeRow>(
            "SELECT * FROM recipes WHERE id = ?", id
        );
        if (!row) return null;

        const stepRows = await this.db.getAllAsync<RecipeStepRow>(
            "SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY position ASC", id
        );
        const stepIds = stepRows.map((s) => s.id);
        let colourRows: RecipeStepColourRow[] = [];
        if (stepIds.length > 0) {
            const placeholders = stepIds.map(() => "?").join(",");
            colourRows = await this.db.getAllAsync<RecipeStepColourRow>(
                `SELECT * FROM recipe_step_colours WHERE step_id IN (${placeholders}) ORDER BY position ASC`,
                ...stepIds
            );
        }

        return this._assemble(row, stepRows, colourRows);
    }

    async save(recipe: Recipe): Promise<void> {
        await this.db.withTransactionAsync(async () => {
            await this.db.runAsync(
                `INSERT INTO recipes (id, name, created_at) VALUES (?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
                recipe.id, recipe.name, recipe.created_at
            );

            const existingStepRows = await this.db.getAllAsync<{ id: string }>(
                "SELECT id FROM recipe_steps WHERE recipe_id = ?", recipe.id
            );
            const existingStepIds = new Set(existingStepRows.map((r) => r.id));
            const newStepIds = new Set(recipe.steps.map((s) => s.id));

            for (const oldId of existingStepIds) {
                if (!newStepIds.has(oldId)) {
                    await this.db.runAsync("DELETE FROM recipe_step_colours WHERE step_id = ?", oldId);
                    await this.db.runAsync("DELETE FROM recipe_steps WHERE id = ?", oldId);
                }
            }

            for (const step of recipe.steps) {
                await this.db.runAsync(
                    `INSERT INTO recipe_steps (id, recipe_id, position, comment, image_uri) VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET position = excluded.position, comment = excluded.comment, image_uri = excluded.image_uri`,
                    step.id, step.recipe_id, step.position, step.comment ?? null, step.image_uri ?? null
                );

                await this.db.runAsync(
                    "DELETE FROM recipe_step_colours WHERE step_id = ?", step.id
                );
                for (const sc of step.colours) {
                    await this.db.runAsync(
                        `INSERT INTO recipe_step_colours (id, step_id, colour_id, position) VALUES (?, ?, ?, ?)`,
                        sc.id, sc.step_id, sc.colour_id, sc.position
                    );
                }
            }
        });
    }

    async delete(id: string): Promise<void> {
        await this.db.withTransactionAsync(async () => {
            const stepRows = await this.db.getAllAsync<{ id: string }>(
                "SELECT id FROM recipe_steps WHERE recipe_id = ?", id
            );
            for (const s of stepRows) {
                await this.db.runAsync("DELETE FROM recipe_step_colours WHERE step_id = ?", s.id);
            }
            await this.db.runAsync("DELETE FROM recipe_steps WHERE recipe_id = ?", id);
            await this.db.runAsync("DELETE FROM recipes WHERE id = ?", id);
        });
    }

    private _assemble(
        row: RecipeRow,
        stepRows: RecipeStepRow[],
        colourRows: RecipeStepColourRow[]
    ): Recipe {
        const steps: RecipeStepProps[] = stepRows
            .filter((s) => s.recipe_id === row.id)
            .map((s): RecipeStepProps => ({
                id: s.id,
                recipe_id: s.recipe_id,
                position: s.position,
                comment: s.comment,
                image_uri: s.image_uri,
                colours: colourRows
                    .filter((c) => c.step_id === s.id)
                    .map((c): RecipeStepColourProps => ({
                        id: c.id,
                        step_id: c.step_id,
                        colour_id: c.colour_id,
                        position: c.position,
                    })),
            }));

        const props: RecipeProps = {
            id: row.id,
            name: row.name,
            created_at: row.created_at,
            steps,
        };
        return Recipe.fromDatabase(props);
    }
}

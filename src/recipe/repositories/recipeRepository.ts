import { Recipe } from "../models/recipe";

export interface RecipeRepository {
    findAll(): Promise<Recipe[]>;
    findById(id: string): Promise<Recipe | null>;
    save(recipe: Recipe): Promise<void>;
    delete(id: string): Promise<void>;
}

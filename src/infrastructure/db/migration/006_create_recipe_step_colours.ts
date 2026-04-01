import * as SQLite from "expo-sqlite";

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS recipe_step_colours (
            id TEXT PRIMARY KEY NOT NULL,
            step_id TEXT NOT NULL,
            colour_id TEXT NOT NULL,
            position INTEGER NOT NULL
        )
    `);
}

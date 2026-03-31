import * as SQLite from "expo-sqlite";

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS recipe_steps (
            id TEXT PRIMARY KEY NOT NULL,
            recipe_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            comment TEXT,
            image_uri TEXT
        )
    `);
}

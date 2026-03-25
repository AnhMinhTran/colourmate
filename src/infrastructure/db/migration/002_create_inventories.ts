import * as SQLite from "expo-sqlite";

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE colour_points IF NOT EXISTS(
            id TEXT PRIMARY KEY NOT NULL,
            colour_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]'
        )    
    `);
}
import * as SQLite from "expo-sqlite";

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_colour_points_brand_name
        ON colour_points (brand, name)
    `);
}

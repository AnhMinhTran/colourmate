import * as SQLite from "expo-sqlite";

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE colour_points(
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            brand TEXT NOT NULL,
            r INTEGER NOT NULL,
            g INTEGER NOT NULL,
            b INTEGER NOT NULL,
            oklch_l REAL NOT NULL,
            oklch_c REAL NOT NULL,
            oklch_h REAL NOT NULL,
            coord_x REAL NOT NULL,
            coord_y REAL NOT NULL,
            coord_Z REAL NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]'
        )    
    `);
}
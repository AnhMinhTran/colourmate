import * as SQLITE from "expo-sqlite";
import { up as migration001 } from './migration/001_create_colour_points';
import { up as migration002 } from './migration/002_create_inventories';
import { up as migration003 } from './migration/003_unique_colour_brand_name';
const migrations = [migration001, migration002, migration003];

export async function migrateDb(db: SQLITE.SQLiteDatabase) : Promise<void> {
    const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    const currentVersion = result?.user_version ?? 0;

    for (let i = currentVersion; i < migrations.length; i++) {
        await migrations[i](db);
    }

    await db.execAsync(`PRAGMA user_version= ${migrations.length}`);
}
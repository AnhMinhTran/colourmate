import * as SQLite from "expo-sqlite";
import { ColourPoint, ColourPointProps } from "../models/colourPoint";
import { ColourPointRepository } from "./colourPointRepository";

interface ColourPointRow {
  id: string;
  name: string;
  brand: string;
  r: number;
  g: number;
  b: number;
  oklch_l: number;
  oklch_c: number;
  oklch_h: number;
  coord_x: number;
  coord_y: number;
  coord_Z: number;
  tags: string;
}

/**
 * Converts a database row into ColourPointProps for domain model reconstruction.
 * @param row - Flat database row with individual colour columns
 * @returns ColourPointProps with nested RGB, OKLCH, and coordinate objects
 */
function rowToProps(row: ColourPointRow): ColourPointProps {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    rgb: { r: row.r, g: row.g, b: row.b },
    oklch: { l: row.oklch_l, c: row.oklch_c, h: row.oklch_h },
    coordinate: { x: row.coord_x, y: row.coord_y, z: row.coord_Z },
    tag: JSON.parse(row.tags),
  };
}

export class SqliteColourPointRepository implements ColourPointRepository {
  constructor(private readonly db: SQLite.SQLiteDatabase) {}

  /**
   * Inserts a ColourPoint into the database with flattened column values.
   * @param colourPoint - The domain entity to persist
   * @throws If the database insert fails (e.g. duplicate id)
   */
  async create(colourPoint: ColourPoint): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO colour_points (id, name, brand, r, g, b, oklch_l, oklch_c, oklch_h, coord_x, coord_y, coord_Z, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      colourPoint.id,
      colourPoint.name,
      colourPoint.brand,
      colourPoint.rgb.r,
      colourPoint.rgb.g,
      colourPoint.rgb.b,
      colourPoint.oklch.l,
      colourPoint.oklch.c,
      colourPoint.oklch.h,
      colourPoint.coordinate.x,
      colourPoint.coordinate.y,
      colourPoint.coordinate.z,
      JSON.stringify(colourPoint.tag)
    );
  }

  /**
   * Updates an existing ColourPoint in the database by id.
   * @param colourPoint - The domain entity with updated values
   * @throws If the database update fails
   */
  async update(colourPoint: ColourPoint): Promise<void> {
    await this.db.runAsync(
      `UPDATE colour_points
       SET name = ?, brand = ?, r = ?, g = ?, b = ?,
           oklch_l = ?, oklch_c = ?, oklch_h = ?,
           coord_x = ?, coord_y = ?, coord_Z = ?, tags = ?
       WHERE id = ?`,
      colourPoint.name,
      colourPoint.brand,
      colourPoint.rgb.r,
      colourPoint.rgb.g,
      colourPoint.rgb.b,
      colourPoint.oklch.l,
      colourPoint.oklch.c,
      colourPoint.oklch.h,
      colourPoint.coordinate.x,
      colourPoint.coordinate.y,
      colourPoint.coordinate.z,
      JSON.stringify(colourPoint.tag),
      colourPoint.id
    );
  }

  /**
   * Retrieves a single ColourPoint by its id.
   * @param id - The unique identifier to search for
   * @returns The matching ColourPoint, or null if not found
   */
  async findbyId(id: string): Promise<ColourPoint | null> {
    const row = await this.db.getFirstAsync<ColourPointRow>(
      "SELECT * FROM colour_points WHERE id = ?",
      id
    );
    if (!row) return null;
    return ColourPoint.fromDatabase(rowToProps(row));
  }

  /**
   * Retrieves all ColourPoints from the database.
   * @returns Array of all persisted ColourPoint entities
   */
  async findAll(): Promise<ColourPoint[]> {
    const rows = await this.db.getAllAsync<ColourPointRow>(
      "SELECT * FROM colour_points"
    );
    return rows.map((row) => ColourPoint.fromDatabase(rowToProps(row)));
  }

  /**
   * Deletes a ColourPoint by its id.
   * @param id - The unique identifier of the entity to remove
   * @throws If the database delete fails
   */
  async delete(id: string): Promise<void> {
    await this.db.runAsync("DELETE FROM colour_points WHERE id = ?", id);
  }
}

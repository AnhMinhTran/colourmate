import * as SQLite from "expo-sqlite";
import { Inventory, InventoryProps } from "../models/inventory";
import { InventoryRepository } from "./inventoryRepository";

interface InventoryRow {
    id: string;
    colour_id: string;
    quantity: number;
}

function rowToProps(row: InventoryRow): InventoryProps {
	return {
		id: row.id,
		colour_id: row.colour_id,
		quantity: row.quantity,
	}
}

export class SqliteInventoryRepository implements InventoryRepository {
	constructor(private readonly db: SQLite.SQLiteDatabase) {}
	
	async delete(id: string): Promise<void> {
		await this.db.runAsync(`DELETE FROM inventories WHERE id = ?`, id);
	}

	async deleteByColourId(colourId: string): Promise<void> {
		await this.db.runAsync(`DELETE FROM inventories WHERE colour_id = ?`, colourId);
	}

	async create(inventory: Inventory): Promise<void> {
		await this.db.runAsync(
			`INSERT INTO inventories (id, colour_id, quantity) VALUES (?, ?, ?)`,
			inventory.id,
			inventory.colour_id,
			inventory.quantity,
		);
	}

	async update(inventory: Inventory): Promise<void> {
		await this.db.runAsync(
			`UPDATE inventories SET colour_id = ?, quantity = ? WHERE id = ?`,
			inventory.colour_id,
			inventory.quantity,
			inventory.id,
		);
	}

	async findAll(): Promise<Inventory[]> {
			const rows = await this.db.getAllAsync<InventoryRow>(
				"SELECT * from inventories"
			);
		return rows.map((row) => Inventory.fromDatabase(rowToProps(row)))
	}

	async findbyId(id: string): Promise<Inventory | null> {
		const row = await this.db.getFirstAsync<InventoryRow>(
			"SELECT * FROM colour_points WHERE id = ?",
			id
		);
		if (!row) return null;
		return Inventory.fromDatabase(rowToProps(row));
	}
}
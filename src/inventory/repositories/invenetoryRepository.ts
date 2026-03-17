import { Inventory } from "../models/inventory";

export interface InventoryRepository {
    create(inventory: Inventory): Promise<void>;
    update(inventory: Inventory): Promise<void>;
    findbyId(id: string): Promise<Inventory | null>
    findAll(): Promise<Inventory[]>
    delete(id: string): Promise<void>
}
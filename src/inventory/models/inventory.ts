import { randomUUID } from "expo-crypto";

export interface InventoryProps {
    id: string;
    colour_id: string;
    quantity: number;
}

export class Inventory {
    readonly id: string;
    colour_id: string;
    quantity: number;

    private constructor(props: InventoryProps) {
        this.id = props.id;
        this.colour_id = props.colour_id;
        this.quantity = props.quantity;
    }

    static create(props: Omit<InventoryProps, 'id'>): Inventory {
        return new Inventory({
            id: randomUUID(),
            colour_id: props.colour_id,
            quantity: props.quantity,
        })
    }

    static fromDatabase(props: InventoryProps): Inventory {
        return new Inventory(props);
    }

    setQuantity(n: number): void {
        if (n < 0) throw new Error('Quantity cannot be negative');
        this.quantity = n;
    }
}
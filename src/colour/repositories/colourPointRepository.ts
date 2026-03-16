import { ColourPoint } from "../models/colourPoint";

export interface ColourPointRepository{
    create(colourPoint: ColourPoint): Promise<void>;
    update(colourPoint: ColourPoint): Promise<void>;
    findbyId(id: string): Promise<ColourPoint | null>
    findAll(): Promise<ColourPoint[]>
    delete(id: string): Promise<void>
}
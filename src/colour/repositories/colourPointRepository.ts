import { ColourPoint } from "../models/colourPoint";

interface ColourPointRepository{
    create(colourPoint: ColourPoint): Promise<ColourPoint>;
    update(colourPoint: ColourPoint): Promise<ColourPoint>;
    findbyId(id: string): Promise<ColourPoint | null>
    findAll(): Promise<ColourPoint[]>
    delete(id: string): Promise<void>
}
import { SRGB } from "../services/colourConversion";
import { OKLCHColour } from "../services/deriveMunsellFromOklch";
import { randomUUID } from "expo-crypto";

export interface ColourPointProps {
    id: string;
    name: string;
    brand: string;
    hex?: string;
    rgb: SRGB;
    oklch?: OKLCHColour
    tag?: string[];
}

export class ColourPoint {
    readonly id: string;
     name: string;
     brand: string;
     rgb: SRGB;

    private constructor(props: ColourPointProps) {
        if (!props.name.trim()) throw new Error("Name cannot be empty");
        if (!props.brand.trim()) throw new Error("Brand cannot be empty");

        this.id = props.id;
        this.name = props.name.trim();
        this.brand = props.brand.trim();
        this.rgb = props.rgb;
    }

    static create(props: Omit<ColourPointProps, "id">): ColourPoint {
        if (!props.name.trim()) throw new Error("Name cannot be empty");
        if (!props.brand.trim()) throw new Error("Brand cannot be empty");

        return new ColourPoint({
            id: randomUUID(),
            ...props,
        })
    }
}
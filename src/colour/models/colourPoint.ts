import { randomUUID } from "expo-crypto";
import { SRGB, convertSRGBToOKLCH } from "../services/colourConversion";
import { MunsellLike, OKLCHColour, deriveMunsellLikeFromOKLCH } from "../services/deriveMunsellFromOklch";
import { Vec3, munsellLikeToXYZ } from "../services/munsellToXYZ";

export interface ColourPointProps {
    id: string;
    name: string;
    brand: string;
    rgb: SRGB;
    oklch: OKLCHColour;
    coordinate: Vec3;
    tag: string[];
}

export interface CreateColourPointProps {
    name: string;
    brand: string;
    rgb: SRGB;
    tag: string[];
}

export class ColourPoint {
    readonly id: string;
     name: string;
     brand: string;
     rgb: SRGB;
     oklch: OKLCHColour;
     coordinate: Vec3;
     tag: string[]

    private constructor(props: ColourPointProps) {
        if (!props.name.trim()) throw new Error("Name cannot be empty");
        if (!props.brand.trim()) throw new Error("Brand cannot be empty");

        this.id = props.id;
        this.name = props.name.trim();
        this.brand = props.brand.trim();
        this.rgb = props.rgb;
        this.oklch = props.oklch;
        this.coordinate = props.coordinate;
        this.tag = props.tag.map(element => element.trim());
    }

    static create(props: CreateColourPointProps): ColourPoint {
        if (!props.name.trim()) throw new Error("Name cannot be empty");
        if (!props.brand.trim()) throw new Error("Brand cannot be empty");

        const oklch: OKLCHColour = convertSRGBToOKLCH(props.rgb);
        const munselConverted: MunsellLike = deriveMunsellLikeFromOKLCH(oklch);
        const coordinate: Vec3 = munsellLikeToXYZ(munselConverted);

        return new ColourPoint({
            id: randomUUID(),
            name: props.name,
            brand: props.brand,
            rgb: props.rgb,
            oklch: oklch,
            coordinate: coordinate,
            tag: props.tag,
        });
    }

    static fromDatabase(props: ColourPointProps): ColourPoint {
        return new ColourPoint(props);
    }
}
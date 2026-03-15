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

        let oklch : OKLCHColour = convertSRGBToOKLCH(props.rgb);
        let munselConverted : MunsellLike = deriveMunsellLikeFromOKLCH(oklch);
        let coordinate : Vec3 = munsellLikeToXYZ(munselConverted); 

        this.id = props.id;
        this.name = props.name.trim();
        this.brand = props.brand.trim();
        this.rgb = props.rgb;
        this.oklch = oklch;
        this.coordinate = coordinate;
        this.tag = props.tag.map(element => element.trim());
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
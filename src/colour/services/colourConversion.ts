import { convert, OKLCH as OKLCHSpace, sRGB } from "@texel/color";

export type SRGB ={
    r: number,
    g: number,
    b: number
};

type OKLCH = {
    l: number,
    c: number,
    h:number
};

export function convertSRGBToOKLCH(rgb: SRGB): OKLCH {
    const r = rgb.r / 255;
    const b = rgb.b / 255;
    const g = rgb.g / 255;

    const [l, c, h] = convert([r, g, b], sRGB, OKLCHSpace);
    return {l, c, h}
}
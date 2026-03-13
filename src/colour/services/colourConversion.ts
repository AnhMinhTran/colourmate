import { convert, OKLCH, sRGB } from "@texel/color";

export type SRGB ={
    r: number,
    g: number,
    b: number
};

type OKLCHColour = {
    l: number,
    c: number,
    h:number
};

export function convertSRGBToOKLCH(rgb: SRGB): OKLCHColour {
    const r = rgb.r / 255;
    const b = rgb.b / 255;
    const g = rgb.g / 255;

    const [l, c, h] = convert([r, g, b], sRGB, OKLCH);
    return {l, c, h}
}
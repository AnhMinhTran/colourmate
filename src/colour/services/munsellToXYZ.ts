import { degToRad } from "@texel/color";
import { MunsellLike } from "./deriveMunsellFromOklch";

export type Vec3 = {x:number, y:number, z:number}

export type MapOptions= {
    radius?: number,
    height?: number,
    hueOffsetDeg?: number
}

export function munsellLikeToXYZ(
  m: MunsellLike,
  options: MapOptions = {}
): Vec3 {
  const { radius = 1, height = 1, hueOffsetDeg = 0 } = options;

  const h = m.hueDeg + hueOffsetDeg;

  const theta = degToRad(h);
  const r = (m.chroma / 100) * radius;
  const y = (m.value / 100) * height;
  const x = r * Math.cos(theta);
  const z = r * Math.sin(theta);

  return { x, y, z };
}
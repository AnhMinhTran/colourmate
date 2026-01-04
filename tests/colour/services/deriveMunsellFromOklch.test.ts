import { deriveMunsellLikeFromOKLCH } from "@/src/colour/services/deriveMunsellFromOklch";
import { describe, expect, it } from "vitest";

describe("deriveMunsellLikeFromOKLCH", () => {
    it("gives Munsell like attribute", () =>{
        const result = deriveMunsellLikeFromOKLCH({l: 0.5, c: 1, h: 25});

        expect(result.chroma).toBeGreaterThanOrEqual(0);
        expect(result.hueDeg).toBeGreaterThanOrEqual(0);
        expect(result.value).toBeGreaterThanOrEqual(0);
    })
})
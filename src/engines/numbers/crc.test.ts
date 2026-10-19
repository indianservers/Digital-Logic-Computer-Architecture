import { describe, expect, it } from "vitest";
import { crcRemainder } from "./crc";
describe("CRC polynomial remainder", () => {
    it("encodes a standard CRC-4 example and validates the transmitted codeword", () => {
        const data = "1101011011";
        const remainder = crcRemainder(data + "0000", "10011");
        expect(remainder).toBe("1110");
        expect(crcRemainder(data + remainder, "10011")).toBe("0000");
        expect(crcRemainder("0101011011" + remainder, "10011")).not.toBe("0000");
    });
    it("preserves leading zeros and supports a different generator", () => {
        expect(crcRemainder("0000000", "10011")).toBe("0000");
        expect(crcRemainder("1101000", "1011")).toBe("001");
        expect(crcRemainder("1101001", "1011")).toBe("000");
    });
    it("rejects malformed binary data or generators", () => {
        expect(() => crcRemainder("12", "10011")).toThrow();
        expect(() => crcRemainder("101", "0011")).toThrow();
        expect(() => crcRemainder("101", "10010")).toThrow();
    });
});

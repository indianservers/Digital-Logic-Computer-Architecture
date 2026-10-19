/** Polynomial division over GF(2). The caller appends degree zero bits to encode data. */
export function crcRemainder(data: string, polynomial: string): string {
    if (!/^[01]+$/.test(data) || !/^1[01]*1$/.test(polynomial))
        throw new Error("CRC requires binary data and a generator with leading and trailing 1s.");
    const degree = polynomial.length - 1;
    const work = data.padStart(polynomial.length, "0").split("").map(Number);
    for (let i = 0; i <= work.length - polynomial.length; i += 1) {
        if (work[i] === 1) {
            for (let j = 0; j < polynomial.length; j += 1)
                work[i + j] = (work[i + j] ?? 0) ^ Number(polynomial[j]);
        }
    }
    return work.slice(-degree).join("");
}

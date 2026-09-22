export interface CacheGeometry {
  offsetBits: number;
  indexBits: number;
  tagBits: number;
  sets: number;
  lines: number;
  ways: number;
}

export interface CacheConfig {
  addressBits: number;
  memoryBytes: number;
  cacheBytes: number;
  blockBytes: number;
  associativity: number;
  replacement: "lru" | "fifo" | "random";
  writePolicy: "through" | "back";
  allocation: "allocate" | "no-allocate";
  seed: number;
}

export interface AddressParts {
  address: number;
  tag: number;
  index: number;
  offset: number;
  tagBits: string;
  indexBits: string;
  offsetBits: string;
  binary: string;
}

export function geometryOf(config: CacheConfig): CacheGeometry {
  const offsetBits = Math.round(Math.log2(config.blockBytes));
  const lines = Math.round(config.cacheBytes / config.blockBytes);
  const ways = Math.max(1, config.associativity);
  const sets = Math.max(1, Math.round(lines / ways));
  const indexBits = sets === 1 ? 0 : Math.round(Math.log2(sets));
  const tagBits = config.addressBits - indexBits - offsetBits;
  return { offsetBits, indexBits, tagBits, sets, lines, ways };
}

export function validGeometry(config: CacheConfig): boolean {
  const geo = geometryOf(config);
  return geo.tagBits >= 0
    && 2 ** geo.offsetBits === config.blockBytes
    && geo.lines * config.blockBytes === config.cacheBytes
    && geo.sets * geo.ways === geo.lines
    && (geo.sets === 1 || 2 ** geo.indexBits === geo.sets);
}

function field(value: number, bits: number): string {
  if (bits <= 0) return "";
  return (value >>> 0).toString(2).padStart(bits, "0").slice(-bits);
}

export function decompose(address: number, config: CacheConfig): AddressParts {
  const geo = geometryOf(config);
  const offsetMask = geo.offsetBits === 0 ? 0 : (1 << geo.offsetBits) - 1;
  const indexMask = geo.indexBits === 0 ? 0 : (1 << geo.indexBits) - 1;
  const offset = address & offsetMask;
  const index = (address >>> geo.offsetBits) & indexMask;
  const tag = address >>> (geo.offsetBits + geo.indexBits);
  return {
    address,
    tag,
    index,
    offset,
    tagBits: field(tag, geo.tagBits),
    indexBits: field(index, geo.indexBits),
    offsetBits: field(offset, geo.offsetBits),
    binary: field(address, config.addressBits),
  };
}

export function blockAddress(address: number, config: CacheConfig): number {
  const geo = geometryOf(config);
  return address >>> geo.offsetBits;
}

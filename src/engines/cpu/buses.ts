export interface BusDriver {
  name: string;
  enabled: boolean;
  value: number;
}

export interface BusResult {
  value: number | "Z" | "X";
  source: string | null;
  contention: boolean;
  explain: string;
}

export function driveBus(drivers: BusDriver[]): BusResult {
  const active = drivers.filter((driver) => driver.enabled);
  if (active.length === 0) {
    return { value: "Z", source: null, contention: false, explain: "No device is enabled, so the bus floats at Z." };
  }
  if (active.length > 1) {
    return {
      value: "X",
      source: null,
      contention: true,
      explain: `${active.map((driver) => driver.name).join(" and ")} are both driving the bus. The result is X.`,
    };
  }
  const driver = active[0];
  return {
    value: driver?.value ?? 0,
    source: driver?.name ?? null,
    contention: false,
    explain: `${driver?.name ?? "A device"} drives ${driver?.value ?? 0} onto the bus.`,
  };
}

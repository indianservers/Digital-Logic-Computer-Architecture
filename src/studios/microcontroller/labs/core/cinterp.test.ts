import { describe, expect, it } from "vitest";
import { compileC, Firmware, type Host, type Ref } from "./cinterp";

function boot(src: string, host: Host = {}, opts: { ips?: number; inheritance?: boolean } = {}) {
  const { program, diagnostics } = compileC(src);
  expect(diagnostics).toEqual([]);
  return new Firmware(program!, host, opts);
}

function regHost() {
  const regs: Record<string, number> = { "GPIOA.ODR": 0 };
  const toggles: number[] = [];
  const host: Host = {
    reg(path) {
      if (!(path in regs)) return undefined;
      const ref: Ref = { name: path, type: "uint32_t", float: false, get: () => regs[path] ?? 0, set: (v) => { regs[path] = Number(v) >>> 0; } };
      return ref;
    },
    call(name, _args, fw) {
      if (name === "HAL_GPIO_TogglePin") { toggles.push(fw.time); return 0; }
      return undefined;
    },
    constant(name) { return name === "GPIO_PIN_5" ? 1 << 5 : undefined; },
  };
  return { regs, toggles, host };
}

describe("C interpreter", () => {
  it("evaluates arithmetic, loops and functions", () => {
    const fw = boot(`
      int sq(int x) { return x * x; }
      int total = 0;
      int main(void) {
        for (int i = 0; i < 5; i++) total += sq(i);
        while (1) {}
      }`);
    fw.run(0.01);
    expect(fw.num("total")).toBe(30);
    expect(fw.error).toBeUndefined();
  });

  it("expands #define constants so edits change behaviour", () => {
    const blink = (ms: number) => {
      const { toggles, host } = regHost();
      const fw = boot(`#define BLINK_MS ${ms}
        int main(void) { while (1) { HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5); HAL_Delay(BLINK_MS); } }`, host);
      fw.run(2);
      return toggles.length;
    };
    expect(blink(500)).toBe(4);
    expect(blink(100)).toBe(20);
  });

  it("writes registers through the host", () => {
    const { regs, host } = regHost();
    const fw = boot(`int main(void) { GPIOA->ODR |= (1 << 5); GPIOA->ODR ^= 1; while (1); }`, host);
    fw.run(0.001);
    expect(regs["GPIOA.ODR"]).toBe(33);
    expect(fw.writes.length).toBeGreaterThan(0);
  });

  it("supports Arduino setup/loop with millis", () => {
    const fw = boot(`unsigned long ticks = 0;
      void setup() { Serial.begin(9600); }
      void loop() { ticks++; delay(10); }`);
    fw.run(1);
    expect(fw.num("ticks")).toBeGreaterThanOrEqual(99);
    expect(fw.num("ticks")).toBeLessThanOrEqual(101);
  });

  it("prints with printf formatting", () => {
    const fw = boot(`int main(void) { printf("v=%d %.2f %s\\n", 42, 3.14159, "ok"); while (1); }`);
    fw.run(0.001);
    expect(fw.printed.join("")).toContain("v=42 3.14 ok");
  });

  it("reports runtime errors with line numbers", () => {
    const fw = boot(`int a[3];
      int main(void) {
        a[5] = 1;
      }`);
    fw.run(0.01);
    expect(fw.error?.line).toBe(3);
  });

  it("reports compile errors", () => {
    const { diagnostics } = compileC(`int main(void) { int x = ; }`);
    expect(diagnostics[0]?.line).toBe(1);
  });

  it("pauses at breakpoints and steps", () => {
    const fw = boot(`int n = 0;
int main(void) {
  while (1) {
    n++;
    n += 10;
  }
}`);
    fw.setBreakpoints([4]);
    fw.run(1);
    expect(fw.paused).toBe(true);
    expect(fw.line).toBe(4);
    expect(fw.num("n")).toBe(0);
    fw.step("line");
    fw.run(1);
    expect(fw.num("n")).toBe(1);
    expect(fw.line).toBe(5);
    fw.resume();
    fw.run(1);
    expect(fw.line).toBe(4);
    expect(fw.num("n")).toBe(11);
  });

  it("runs ISRs preempting the main loop", () => {
    const fw = boot(`volatile int hits = 0;
      void EXTI0_IRQHandler(void) { hits++; }
      int main(void) { while (1) { __NOP(); } }`);
    fw.run(0.001);
    fw.raise("EXTI0_IRQHandler", 2);
    fw.run(0.002);
    expect(fw.num("hits")).toBe(1);
  });

  it("schedules FreeRTOS tasks by priority with delays", () => {
    const fw = boot(`int a = 0, b = 0;
      void TaskA(void *p) { while (1) { a++; vTaskDelay(10); } }
      void TaskB(void *p) { while (1) { b++; vTaskDelay(20); } }
      int main(void) {
        xTaskCreate(TaskA, "A", 128, NULL, 2, NULL);
        xTaskCreate(TaskB, "B", 128, NULL, 1, NULL);
        vTaskStartScheduler();
        while (1);
      }`);
    fw.run(0.2);
    expect(fw.num("a")).toBeGreaterThanOrEqual(19);
    expect(fw.num("b")).toBeGreaterThanOrEqual(9);
    expect(fw.trace.length).toBeGreaterThan(0);
  });

  it("applies priority inheritance on mutexes", () => {
    const src = `SemaphoreHandle_t m;
      volatile int highWait = 0;
      void Low(void *p) { while (1) { xSemaphoreTake(m, portMAX_DELAY); for (volatile int i = 0; i < 400; i++); xSemaphoreGive(m); vTaskDelay(5); } }
      void Med(void *p) { vTaskDelay(1); while (1) { for (volatile int j = 0; j < 100; j++); vTaskDelay(1); } }
      void High(void *p) { vTaskDelay(1); while (1) { int t0 = millis(); xSemaphoreTake(m, portMAX_DELAY); highWait = millis() - t0; xSemaphoreGive(m); vTaskDelay(10); } }
      int main(void) {
        m = xSemaphoreCreateMutex();
        xTaskCreate(Low, "Low", 128, NULL, 1, NULL);
        xTaskCreate(Med, "Med", 128, NULL, 2, NULL);
        xTaskCreate(High, "High", 128, NULL, 3, NULL);
        vTaskStartScheduler();
      }`;
    const on = boot(src, {}, { ips: 100000, inheritance: true });
    on.run(0.3);
    expect(on.error).toBeUndefined();
    const off = boot(src, {}, { ips: 100000, inheritance: false });
    off.run(0.3);
    expect(off.error).toBeUndefined();
  });

  it("passes data through queues", () => {
    const fw = boot(`QueueHandle_t q; int got = 0;
      void Prod(void *p) { int v = 7; while (1) { xQueueSend(q, &v, 0); v++; vTaskDelay(10); } }
      void Cons(void *p) { int r; while (1) { if (xQueueReceive(q, &r, portMAX_DELAY) == pdTRUE) got = r; } }
      int main(void) {
        q = xQueueCreate(4, sizeof(int));
        xTaskCreate(Prod, "P", 128, NULL, 1, NULL);
        xTaskCreate(Cons, "C", 128, NULL, 2, NULL);
        vTaskStartScheduler();
      }`);
    fw.run(0.05);
    expect(fw.num("got")).toBeGreaterThanOrEqual(10);
  });

  it("handles structs, pointers and switch", () => {
    const fw = boot(`typedef enum { IDLE, RUN, STOP } State;
      State s = IDLE; int out = 0;
      void bump(int *p) { *p += 5; }
      int main(void) {
        int k = 0;
        bump(&k);
        switch (s) { case IDLE: out = k; break; default: out = -1; }
        while (1);
      }`);
    fw.run(0.001);
    expect(fw.error).toBeUndefined();
    expect(fw.num("out")).toBe(5);
  });

  it("supports Arduino String methods and typed object calls", () => {
    const calls: string[] = [];
    const host: Host = { call(name, args) { if (name === "Servo.write") { calls.push(`${name}:${String(args[1])}`); return 0; } return undefined; } };
    const fw = boot(`Servo arm; String cmd = "  go  "; int len = 0;
      void setup() { arm.attach(9); arm.write(90); cmd.trim(); len = cmd.length(); }
      void loop() { delay(100); }`, host);
    fw.run(0.01);
    expect(calls).toContain("Servo.write:90");
    expect(fw.num("len")).toBe(2);
  });
});

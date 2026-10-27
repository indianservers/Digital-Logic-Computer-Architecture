import { polling, dma, watchdog } from "./acquisitionModels";
import { sleep, brownout, rtc } from "./powerModels";
import { fsm, cooperative, rtos, synchronization, inversion } from "./schedulerModels";
import { bootloader, debuggerModel } from "./firmwareModels";
import { logicAnalyzer, oscilloscope, powerAnalyzer } from "./instrumentModels";
import type { Model } from "./model";
export const MODELS: Model[] = [polling, dma, watchdog, sleep, brownout, rtc, fsm, cooperative, rtos, synchronization, inversion, bootloader, debuggerModel, logicAnalyzer, oscilloscope, powerAnalyzer];
export const modelByNumber = (number: number) => MODELS.find((model) => model.number === number);

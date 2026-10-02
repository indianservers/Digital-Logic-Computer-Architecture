import { genClockConfig, RCC_RESET, type RccConfig } from "./rcc";

const PLL72: RccConfig = { hseOn: true, hsiOn: true, pllOn: true, pllSrc: "HSE", pllMul: 9, sysSrc: "PLL", ahbDiv: 1, apb1Div: 2, apb2Div: 1, adcDiv: 6, latency: 2 };

const program = (title: string, cfg: RccConfig) => `// Core Lab 10 - Clock System
// ${title}
#include "stm32f1xx_hal.h"

#define HSE_VALUE 8000000U          // crystal X3 fitted on the board

uint32_t sysclk, hclk, pclk1, pclk2;
uint32_t loops = 0;

void SystemClock_Config(void);
void Error_Handler(void);

int main(void)
{
    HAL_Init();                      // after reset the core runs from HSI 8 MHz
    SystemClock_Config();
    HAL_RCC_EnableCSS();             // fall back to HSI if the crystal dies

    sysclk = HAL_RCC_GetSysClockFreq();
    hclk   = HAL_RCC_GetHCLKFreq();
    pclk1  = HAL_RCC_GetPCLK1Freq();
    pclk2  = HAL_RCC_GetPCLK2Freq();

    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_TIM2_CLK_ENABLE();
    __HAL_RCC_DMA1_CLK_ENABLE();
    GPIO_InitTypeDef led = {0};
    led.Pin = GPIO_PIN_5;
    led.Mode = GPIO_MODE_OUTPUT_PP;
    HAL_GPIO_Init(GPIOA, &led);

    // TIM2 is clocked by the APB1 timer clock (2 x PCLK1 when APB1 is divided)
    TIM2->PSC = 7199;                // 72 MHz / 7200 = 10 kHz
    TIM2->ARR = 4999;                // 10 kHz / 5000 = 2 Hz update rate
    TIM2->CR1 |= TIM_CR1_CEN;

    while (1)
    {
        if (TIM2->SR & TIM_SR_UIF)
        {
            TIM2->SR &= ~TIM_SR_UIF;
            HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);   // LD2 blinks at 1 Hz
        }
        loops++;                     // loop throughput scales with HCLK
    }
}

${genClockConfig(cfg, 8_000_000)}

void Error_Handler(void)
{
    __disable_irq();
    while (1)
    {
    }                                // clock setup failed: stop here
}
`;

export const DEMO = program("Configure HSE + PLL to 72 MHz, then measure every bus clock", PLL72);
export const HSI_ONLY = program("Run from the internal 8 MHz HSI only (no crystal, no PLL)", { ...RCC_RESET, hsiOn: true });

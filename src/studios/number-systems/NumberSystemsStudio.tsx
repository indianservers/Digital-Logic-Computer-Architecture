import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { NumbersChrome } from "./NumbersChrome";
import { ConvertLab, MathLab, SignedLab, FixedLab, IeeeLab, CodesLab, ParityLab, HammingLab } from "./NumberLabs";
const TABS = [
    { id: "convert", label: "Convert & Visualize" },
    { id: "math", label: "Binary Arithmetic" },
    { id: "signed", label: "Signed Numbers" },
    { id: "fixed", label: "Fixed Point" },
    { id: "ieee", label: "IEEE-754" },
    { id: "codes", label: "Digital Codes" },
    { id: "parity", label: "Error Detection" },
    { id: "hamming", label: "Hamming Code" },
];
const LESSONS: Record<string, {
    guide: string[];
    takeaways: string[];
    what: string;
    why: string;
    notice: string;
}> = {
    "convert": {
        "guide": [
            "Type a value in decimal (or choose another base).",
            "See the equivalent value in binary, octal, and hexadecimal update instantly.",
            "Understand how each digit contributes to the total value.",
            "Experiment with larger or smaller values and notice the patterns."
        ],
        "takeaways": [
            "The value of a digit depends on its position (place value).",
            "Binary, octal, decimal and hexadecimal are different ways to represent the same number.",
            "Grouping 3 bits (octal) or 4 bits (hexadecimal) makes conversion simple and consistent."
        ],
        "what": "All representations update automatically when you change the input number.",
        "why": "Each base uses a different positional value, but they represent the same quantity.",
        "notice": "Grouping binary digits into 3 or 4 bits makes conversion to octal or hexadecimal straightforward."
    },
    "math": {
        "guide": [
            "Type values for A and B. Change the word size if needed.",
            "Try addition, subtraction, multiplication, or division.",
            "See each column’s calculation, including carries or borrows.",
            "Experiment with larger numbers and watch how the steps change."
        ],
        "takeaways": [
            "Binary addition uses carries when the sum is 2 or more.",
            "Binary subtraction uses borrows when needed.",
            "Binary multiplication uses shifted partial products.",
            "Binary division finds the quotient using repeated subtraction or long division.",
            "The same column-by-column rules apply as in decimal, just with base 2."
        ],
        "what": "All representations update automatically when you change the inputs or operation.",
        "why": "Binary arithmetic is the foundation for how computers perform calculations in hardware.",
        "notice": "Carries move left in addition, borrows move left in subtraction, and multiplication uses shifted partial products."
    },
    "signed": {
        "guide": [
            "Type a decimal number (positive or negative) and choose a word size (4, 8, or 16 bits).",
            "See the sign-magnitude, one’s complement, and two’s complement forms update instantly.",
            "Notice how negative numbers are encoded differently in each method.",
            "Use the range visualization to understand the minimum and maximum values for the selected word size."
        ],
        "takeaways": [
            "The MSB indicates the sign (0 = positive, 1 = negative).",
            "Sign-magnitude and one’s complement have two zeros (+0 and −0).",
            "Two’s complement is the most common method and makes arithmetic straightforward."
        ],
        "what": "All representations update automatically when you change the input number or word size.",
        "why": "Different signed representations exist, but they represent the same numeric value.",
        "notice": "Sign-magnitude and one’s complement have two zeros (+0 and −0), while two’s complement has a single zero."
    },
    "fixed": {
        "guide": [
            "Choose integer bits and fractional bits (Q format).",
            "Type a decimal value (positive or negative) and see the encoded binary representation.",
            "See how each bit contributes to the value using fixed place values around the binary point.",
            "Change the number of fractional bits to see the effect on step size, range, and precision."
        ],
        "takeaways": [
            "A fixed binary point means values are multiples of a fixed step size (2⁻ᶠʳᵃᶜᵗⁱᵒⁿᵃˡ ᵇⁱᵗˢ).",
            "More fractional bits give finer resolution but a smaller integer range for a fixed total width.",
            "Fixed-point is widely used in embedded systems, DSP, and hardware where floating point is unnecessary."
        ],
        "what": "All representations update automatically when you change the format or input value.",
        "why": "The fractional bits fix the binary point position, so values represent multiples of a fixed step size.",
        "notice": "More fractional bits give finer resolution (smaller steps). With a fixed total width, they reduce the integer range."
    },
    "ieee": {
        "guide": [
            "Type a floating-point number (e.g., 13.625) and choose single or double precision.",
            "See how the value is split into sign, exponent, and fraction bits, and view the hexadecimal form.",
            "Learn about the exponent bias (127 for single, 1023 for double) and how it determines the actual exponent.",
            "Enter 0, a very small number, infinity, or NaN to see their bit patterns."
        ],
        "takeaways": [
            "IEEE-754 uses 1 sign bit, a biased exponent, and a fraction (mantissa).",
            "The exponent bias is 127 (single) or 1023 (double).",
            "Normalized numbers have an implicit leading 1 in the fraction.",
            "Special bit patterns represent zero, subnormal numbers, infinity, and NaN."
        ],
        "what": "When you change the decimal value or precision, all fields update automatically — sign, exponent, fraction, and hexadecimal.",
        "why": "IEEE-754 uses a biased exponent and an implicit leading 1 for normalized numbers, which increases range and precision.",
        "notice": "The same real number has different bit patterns in single and double precision due to different exponent and fraction sizes."
    },
    "codes": {
        "guide": [
            "Type a decimal number (e.g., 59) or a character (e.g., A).",
            "See how the value is encoded in BCD, Gray code, Excess-3, and ASCII instantly.",
            "Look at multiple examples to understand the differences between codes.",
            "Experiment with other numbers and characters to see patterns and when each code is useful."
        ],
        "takeaways": [
            "BCD encodes each decimal digit using 4 bits and is common in displays and calculators.",
            "Gray code changes only one bit between adjacent values, reducing errors in position sensing.",
            "Excess-3 is BCD with 3 added to each digit.",
            "ASCII encodes characters, numbers, and symbols for text representation in computers."
        ],
        "what": "All representations update automatically when you change the input value or code type.",
        "why": "Different codes are optimized for different uses such as displays, position sensing, error reduction, or representing text.",
        "notice": "Gray code changes only one bit between adjacent values, while Excess-3 and BCD are designed for decimal digits, and ASCII encodes text."
    },
    "parity": {
        "guide": [
            "Enter a bit string, choose even or odd parity, and see the resulting code word and checksum.",
            "Flip bits in the received stream and see whether the error is detected.",
            "See how polynomial division produces a small remainder used as a CRC.",
            "Experiment with different data and generators to build intuition."
        ],
        "takeaways": [
            "Parity adds one bit and detects all single-bit errors (but misses some multi-bit errors).",
            "Checksums add a small value computed from the data and can detect many common errors.",
            "CRC uses polynomial division to produce a remainder that detects a wide range of error patterns."
        ],
        "what": "This page focuses on error detection using parity, checksums, and CRC, with an interactive simulator and visual explanations.",
        "why": "Redundancy lets the receiver detect when bits have been altered during transmission or storage, increasing reliability.",
        "notice": "Error detection tells us that an error occurred, but it usually does not tell us which bit is wrong or fix it — that is the job of error correction codes."
    },
    "hamming": {
        "guide": [
            "Type a 4-bit data word (e.g., 1011). See parity bits placed at positions 1, 2, and 4.",
            "Flip a bit in the received word to simulate a single-bit error. Watch the parity checks and syndrome.",
            "Read the syndrome (s2 s1 s0) and see the decimal position of the error.",
            "The bit at the indicated position is flipped to recover the original data word."
        ],
        "takeaways": [
            "Parity bits are placed at positions 1, 2, 4, … (powers of 2).",
            "Each parity bit checks a specific set of positions based on the binary index.",
            "A non-zero syndrome gives the 1-based position of a single-bit error.",
            "Hamming code (7,4) corrects any single-bit error (SEC)."
        ],
        "what": "As you enter the data word or flip a received bit, parity bits, syndrome, and correction update automatically.",
        "why": "Each parity bit checks a different set of positions (1, 2, 4, …). The syndrome bits identify the index of a single-bit error in binary.",
        "notice": "A zero syndrome means no error is detected. A non-zero syndrome gives the 1-based position to flip, correcting a single-bit error."
    }
};
export function NumberSystemsStudio() {
    const [tab, setTab] = useStudioTab(TABS, "convert");
    const [resetKey, setResetKey] = useState(0);
    const lesson = LESSONS[tab] ?? LESSONS.convert!;
    return <NumbersChrome tab={tab} tabs={TABS} onTab={setTab} onReset={() => setResetKey(n => n + 1)} guide={lesson.guide} takeaways={lesson.takeaways} what={lesson.what} why={lesson.why} notice={lesson.notice}><div key={`${tab}-${resetKey}`} role="tabpanel" aria-label={TABS.find(t => t.id === tab)?.label}>{tab === "convert" ? <ConvertLab /> : tab === "math" ? <MathLab /> : tab === "signed" ? <SignedLab /> : tab === "fixed" ? <FixedLab /> : tab === "ieee" ? <IeeeLab /> : tab === "codes" ? <CodesLab /> : tab === "parity" ? <ParityLab /> : <HammingLab />}</div></NumbersChrome>;
}

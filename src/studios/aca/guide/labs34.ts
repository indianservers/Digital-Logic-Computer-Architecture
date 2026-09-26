import type { LabGuideContent } from "./types";

export const LABS_34: LabGuideContent[] = [
  {
    id: "booth-multiplier",
    labNumber: 34,
    title: "Booth's Multiplier",
    aim: "Follow Booth's radix-2 rule on signed two's-complement operands and read the product from the combined A and Q registers.",
    purpose: "Booth recoding treats a run of 1s as a pair of boundary operations. The same adder is reused for every bit, and an arithmetic right shift keeps the sign.",
    prerequisites: ["Two's-complement range for n bits", "Addition and subtraction of fixed-width signed values", "The difference between a logical shift and an arithmetic shift"],
    learningObjectives: ["Read the pair Q0, Q−1", "Choose add, subtract, or no operation", "Track the sign bit through an arithmetic right shift", "Explain why a run of 1s can skip arithmetic cycles"],
    theory: [
      "00 and 11 mean the scanned bits are the same, so A is left unchanged. 01 adds M. 10 subtracts M. Every cycle then shifts A, Q, and Q−1 together.",
      "The shift copies A's sign bit, moves A's least significant bit into Q, and moves Q's least significant bit into Q−1.",
      "Negating the minimum negative value needs one extra bit. The accumulator keeps that sign bit so the shift stays correct.",
    ],
    keyTerms: [
      { term: "Q−1", meaning: "The bit shifted out of Q on the previous cycle. It forms the Booth pair with Q0." },
      { term: "Arithmetic right shift", meaning: "A right shift that copies the sign bit instead of filling with zero." },
      { term: "Run of 1s", meaning: "A string of multiplier ones handled at its two boundaries rather than once per bit." },
    ],
    assumptions: ["Operands are signed two's-complement values inside the selected width.", "Widths are 4, 5, 6, or 8 bits.", "The product occupies twice that width."],
    setup: ["The example is M = −3 and Q = 5 at 4 bits. The product is −15.", "Q−1 starts at 0 and A starts at 0."],
    procedure: [
      "Read the example pair and the valid range −8 to +7.",
      "Press Step and read which row of the decision table is highlighted.",
      "Read A after the operation and A,Q after the shift.",
      "Continue until cycle 4 of 4 and read the product −15.",
      "Negate Q and compare the new operation count.",
      "Set M to −8 and read the extra bit on −M.",
    ],
    controls: ["Operand width", "Input mode", "Show signal values", "Random", "Swap", "Negate M", "Negate Q", "Clear", "Example", "Play", "Pause", "Step", "Previous", "Reset", "Simulation speed"],
    observations: ["The highlighted decision row", "Whether the arithmetic block is skipped", "The sign bit copied into A", "Q−1 receiving Q0", "The operation counts", "The 8-bit product of a 4-bit multiply"],
    formulas: [
      { name: "Booth pair", expression: "01 → A = A + M; 10 → A = A − M; 00 or 11 → no operation", note: "The shift follows every case." },
      { name: "Range", expression: "−2^(n−1) … 2^(n−1) − 1", note: "4 bits run from −8 to +7." },
      { name: "Product", expression: "A,Q after n cycles", note: "The word is 2n bits, sign-correct." },
    ],
    expectedBehavior: ["−3 × 5 produces −15.", "Changing the input mode rewrites the same integer.", "The minimum negative multiplicand still matches ordinary multiplication."],
    resultInterpretation: ["Correct means the final A,Q word equals the signed product.", "Additions, subtractions, and no-operation cycles count the decisions, not a claim about nanoseconds."],
    misconceptions: ["00 and 11 still shift. They only skip the add or subtract.", "Booth is not faster for every bit pattern.", "The minimum negative value cannot be negated inside the same width."],
    variations: ["Compare 5 × 3 with −3 × 5.", "Compare multipliers 0111 and 0101.", "Load the minimum negative value.", "Switch between 4-bit and 8-bit widths."],
    learningOutcomes: ["Execute one Booth cycle by hand", "Read a signed product from A and Q", "Compare Booth's sequential machine with a combinational array multiplier"],
    viva: [
      { question: "What does the pair 10 mean?", answer: "Subtract M from A, then arithmetic-right-shift." },
      { question: "What does the pair 01 mean?", answer: "Add M to A, then arithmetic-right-shift." },
      { question: "Why do 00 and 11 skip arithmetic?", answer: "The two bits match, so this position is inside a run rather than at a boundary." },
      { question: "Which bit is copied on the shift?", answer: "The sign bit of the accumulator, including the extra bit used for overflow." },
      { question: "Where is the product stored?", answer: "In A and Q together, a word of twice the operand width." },
    ],
    selfCheck: [
      { prompt: "Q0 = 1 and Q−1 = 0 means:", choices: ["Add M", "Subtract M", "No operation"], answer: 1, why: "10 is the start of a string of ones, which Booth treats as a subtraction." },
      { prompt: "An arithmetic right shift fills the top bit with:", choices: ["Zero", "The sign bit", "Q−1"], answer: 1, why: "The sign must be preserved." },
      { prompt: "A 4-bit Booth multiply finishes with:", choices: ["A 4-bit product", "An 8-bit product", "A 16-bit product"], answer: 1, why: "The product width is twice the operand width." },
    ],
    summary: "Pair Q0 with Q−1, add or subtract only at a run boundary, then arithmetic-right-shift A, Q, and Q−1 for n cycles.",
    walkthrough: {
      howToUse: [
        "Start from Example, M = −3 and Q = 5. The product line should read −15.",
        "Press Step to take one cycle. Reset restores the 4-bit example and signed-decimal entry.",
      ],
      observe: [
        "The decision table highlights the pair taken from Q0 and Q−1.",
        "The shift line shows the sign bit copied into A and Q0 moving into Q−1.",
        "Statistics count additions, subtractions, and no-operation cycles.",
      ],
      experiments: [
        { title: "−3 × 5", steps: ["Press Example.", "Press Step until the cycle counter reaches 4 of 4.", "Read the product −15."] },
        { title: "A positive pair", steps: ["Set M to 5 and Q to 3.", "Read the product 15 and the operation counts."] },
        { title: "Minimum negative", steps: ["Set M to −8.", "Read the note that −M needs an extra bit.", "Confirm the product still matches −8 times Q."] },
        { title: "Another width", steps: ["Set the operand width to 8-bit.", "Press Example.", "Confirm the cycle count is 8 and the product width is 16."] },
      ],
      expected: [
        "Every valid pair shows Correct and the same integer as ordinary signed multiplication.",
        "Binary and hexadecimal entry describe the same two's-complement value as signed decimal.",
      ],
      why: ["A run of ones equals a power of two at the top of the run minus a power of two at the bottom. Booth performs those two boundary operations and shifts through the bits in between."],
      challenge: "Use 4 bits. Record the arithmetic-operation count for multiplier 0111 and for multiplier 0101, with M = 1. Then set M to −8 and Q to −8 and record the 8-bit product.",
      check: [
        "Which decision row is highlighted on the first step of −3 × 5?",
        "What moves into Q−1 on the shift?",
        "Why does −M for −8 need five bits?",
      ],
      links: [
        { id: "operands", label: "Watch the operands" },
        { id: "results", label: "Watch the product" },
        { id: "stats", label: "Watch the operation counts" },
      ],
      checklist: [
        "Stepped −3 × 5 and read −15",
        "Read one add or subtract and the following shift",
        "Tried the minimum negative value",
        "Compared the operation counts of two multipliers",
      ],
    },
  },
];

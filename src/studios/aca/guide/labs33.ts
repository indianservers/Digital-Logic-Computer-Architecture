import type { LabGuideContent } from "./types";

export const LABS_33: LabGuideContent[] = [
  {
    id: "array-multiplier",
    labNumber: 33,
    title: "Combinational Multipliers",
    aim: "Understand a combinational binary multiplier built from AND gates and adder cells, and check that the product matches ordinary multiplication.",
    purpose: "An array multiplier forms every partial product at once and adds those rows with a fixed network of half adders and full adders. The result appears after the propagation delay.",
    prerequisites: ["AND of two bits", "Half adder sum and carry", "Full adder sum and majority carry", "Positional weight 2^(i+j)"],
    learningObjectives: ["Read PP(i,j) = A[i] AND B[j]", "Follow a shifted partial-product row", "Trace sum and carry through one adder cell", "Explain why the product can need m + n bits"],
    theory: [
      "Each multiplicand bit is ANDed with each multiplier bit. A 4×4 array contains 16 AND gates. The bit at row i and column j has weight 2^(i+j).",
      "The first partial-product row is wiring only. Each later row adds that partial product to the sum wires from above. The least-significant cell of a row is a half adder. The other cells are full adders.",
      "A zero multiplier bit forces its whole row to zero. The hardware is still present. The array does not step through clock cycles. Play, Step, and Previous only reveal the visualization.",
    ],
    keyTerms: [
      { term: "Partial product", meaning: "One multiplicand bit AND one multiplier bit, placed at weight i + j." },
      { term: "Array multiplier", meaning: "A regular combinational grid of AND gates and adder cells." },
      { term: "Product width", meaning: "Up to m + n bits for an m-bit multiplicand and an n-bit multiplier." },
    ],
    assumptions: ["Operands are unsigned.", "Widths are chosen independently from 2, 3, 4, 5, 6, and 8 bits.", "Delay figures are estimated gate stages, not measured nanoseconds."],
    setup: ["The example is A = 1011 (11) and B = 0110 (6) at 4×4. The product is 66.", "The Array view shows the AND matrix and the adder cells."],
    procedure: [
      "Select the widths and enter A and B.",
      "Inspect the AND matrix and confirm each cell is A[i] AND B[j].",
      "Read the shifted partial-product rows, including a row that is zero.",
      "Step through the adder rows and read one full adder’s inputs, sum, and carry.",
      "Verify the product in decimal, binary, and hexadecimal.",
      "Compare the gate counts at 2×2, 4×4, and 8×8.",
    ],
    controls: ["Multiplicand width", "Multiplier width", "Signedness", "Input format", "View", "Random", "A = 0", "B = 0", "Max", "Clear", "Example", "Play", "Pause", "Step", "Previous", "Reset", "Simulation speed", "Zoom"],
    observations: ["AND-gate count equals width A times width B", "A zero bit in B clears one row", "Carry moves to the next higher weight", "Product width is m + n", "Larger widths add adder cells quickly", "The numeric product matches A times B"],
    formulas: [
      { name: "Partial product", expression: "PP(i,j) = A[i] AND B[j]", note: "Weight is 2^(i+j)." },
      { name: "Half adder", expression: "sum = x XOR y; carry = x AND y", note: "Used at the low cell of each adder row." },
      { name: "Full adder", expression: "sum = x XOR y XOR cin; carry = majority(x, y, cin)", note: "Carry has the next higher weight." },
    ],
    expectedBehavior: ["11 × 6 shows product 66 when both widths are at least 4.", "Statistics change when either width changes.", "The truth table lists all 16 rows only for a 2×2 array."],
    resultInterpretation: ["Correct means the adder network and ordinary multiplication produced the same integer.", "The depth line counts an AND stage plus the adder stages along the array. It is not a silicon timing report."],
    misconceptions: ["This array is not the shift-and-add loop on the adder studio.", "The step controls do not clock the hardware.", "A zero partial-product row still occupies AND gates."],
    variations: ["Set B to a power of two and see which rows survive.", "Set one operand to zero.", "Set both operands to the maximum.", "Open the Wallace Tree lab and compare reduction depth with this array’s carry path."],
    learningOutcomes: ["Build an unsigned array multiplier for a chosen width pair", "Trace one AND gate into the adder that consumes it", "Compare array size with shift-and-add and with Wallace reduction"],
    viva: [
      { question: "How is one partial-product bit formed?", answer: "AND the chosen multiplicand bit with the chosen multiplier bit." },
      { question: "Why can a 4×4 product need 8 bits?", answer: "The largest product is 15 × 15 = 225, which needs eight bits." },
      { question: "Which cell starts an adder row?", answer: "A half adder. Later cells in that row are full adders." },
      { question: "What happens when a multiplier bit is 0?", answer: "Every AND in that row outputs 0, so the row adds nothing." },
      { question: "How does this differ from shift-and-add?", answer: "The array is a fixed combinational network. Shift-and-add reuses one adder across sequential steps." },
    ],
    selfCheck: [
      { prompt: "PP(i,j) equals:", choices: ["A[i] OR B[j]", "A[i] AND B[j]", "A[i] XOR B[j]"], answer: 1, why: "A partial product bit is the AND of one bit from each operand." },
      { prompt: "The product width of an m×n unsigned multiply is:", choices: ["max(m, n)", "m + n", "m × n"], answer: 1, why: "The highest weight is (m−1)+(n−1), so the word can be m+n bits." },
      { prompt: "Step on this page means:", choices: ["A hardware clock cycle", "A visualization of the combinational network", "A shift-and-add iteration"], answer: 1, why: "The circuit computes the product after propagation. The buttons reveal that structure." },
    ],
    summary: "AND every bit pair, place each result at weight i+j, add the rows with half and full adders, and read a product of up to m+n bits.",
    walkthrough: {
      howToUse: [
        "Start from Example, 4-bit by 4-bit. The product line should read 66.",
        "Press Step to reveal the AND gates, then each adder row. Reset restores 11 and 6.",
      ],
      observe: [
        "The matrix cell for A2 and B1 matches the AND gate with the same indexes.",
        "A multiplier bit of 0 is called out as a zero row in Partial Products.",
        "Statistics list AND gates, half adders, full adders, product width, and the depth line.",
      ],
      experiments: [
        { title: "11 × 6", steps: ["Press Example.", "Read the product 66 in decimal, binary, and hex."] },
        { title: "A power of two", steps: ["Set B to 8, which is 1000 in four bits.", "Open Partial Products and see which rows are zero."] },
        { title: "A zero operand", steps: ["Press A = 0.", "Confirm the product is 0 and the AND outputs are 0."] },
        { title: "Width and the truth table", steps: ["Set both widths to 2-bit and open Truth Table.", "Set both widths to 8-bit and read why the full table is withheld."] },
      ],
      expected: [
        "Every valid unsigned pair shows Correct and the same integer as A times B.",
        "AND-gate count is the product of the two widths.",
      ],
      why: ["Each AND emits a bit whose place value is a power of two. Adding those weighted bits is ordinary multiplication, performed here by a fixed adder array rather than by a loop."],
      challenge: "Compare 2×2, 4×4, and 8×8. Record the AND-gate count and the adder-cell count for each, then name the product bit whose logic cone is the largest on the 4×4 example.",
      check: [
        "Which gates use multiplicand bit A2?",
        "Why does a 4×4 array contain 12 adder cells?",
        "What stays the same when you only change the input format?",
      ],
      links: [
        { id: "operands", label: "Watch the operands" },
        { id: "results", label: "Watch the product" },
        { id: "stats", label: "Watch the gate counts" },
      ],
      checklist: [
        "Multiplied 1011 × 0110 and read 66",
        "Inspected an AND gate and a full adder",
        "Compared 2×2 with 8×8 gate counts",
        "Checked the product against A times B",
      ],
    },
  },
];

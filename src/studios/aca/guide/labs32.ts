import type { LabGuideContent } from "./types";

export const LABS_32: LabGuideContent[] = [
  {
    id: "wallace-tree",
    labNumber: 32,
    title: "Wallace Tree Adder",
    aim: "Reduce several binary operands with a Wallace tree of 3:2 compressors until two rows remain, then finish with a carry-propagate adder.",
    purpose: "Multi-operand addition shows up in multipliers as partial-product rows. Wallace reduction shortens that work compared with adding one operand at a time.",
    prerequisites: ["Full adder sum and carry", "The weight of a binary column", "Ripple carry and carry look-ahead as a final adder"],
    learningObjectives: ["Place bits into columns of equal weight", "Read a 3:2 compressor and a 2:2 compressor", "Explain why the carry moves one column toward the higher weight"],
    theory: [
      "A full adder is a 3:2 compressor. Sum = x XOR y XOR z stays in the same column. Carry = majority(x, y, z) has the next higher weight.",
      "A half adder is a 2:2 compressor for a leftover pair. Sum = x XOR y. Carry = x AND y.",
      "Each stage lowers the tallest column toward the next Wallace height. The weighted total of every stage equals the operand sum. The last two rows enter the selected final adder.",
    ],
    keyTerms: [
      { term: "3:2 compressor", meaning: "A full adder. Three bits in one column become a sum bit and a carry bit." },
      { term: "Carry-save", meaning: "The sum row and the carry row together still represent the same integer." },
      { term: "Final adder", meaning: "The ripple or carry look-ahead adder that turns the last two rows into one binary result." },
    ],
    assumptions: ["Operands are unsigned and fit the selected width.", "Widths are 4, 8, or 16 bits. Operand counts are 3 through 8.", "Delay figures are estimated gate stages, not measured nanoseconds."],
    setup: ["The example operands are 25, 13, 7, and 9 at 8 bits. Their sum is 54.", "Carry look-ahead is the starting final adder. All stages are visible and signal values are on."],
    procedure: [
      "Read the four example operands and the decimal sum 54.",
      "Step once and read the highlighted compressor’s inputs, sum, and carry.",
      "Follow the dashed carry wire into the next higher column.",
      "Continue until the final two rows appear, then read the final adder.",
      "Switch the final adder to ripple and compare the depth line.",
      "Set the operand count to 8 and count the Wallace levels.",
    ],
    controls: ["Operand width", "Number of operands", "Input representation", "Final adder", "Visualization detail", "Show signal values", "Random", "Clear", "Zero", "Maximum", "Example", "Play", "Pause", "Step", "Previous", "Reset", "Simulation speed", "Zoom"],
    observations: ["Which columns receive a compressor", "Sum staying in the column", "Carry moving one weight higher", "Wallace level count", "Full-adder and half-adder counts", "The depth line for ripple versus carry look-ahead"],
    formulas: [
      { name: "Full adder", expression: "sum = x XOR y XOR z; carry = majority(x, y, z)", note: "The carry’s weight is one column higher." },
      { name: "Half adder", expression: "sum = x XOR y; carry = x AND y", note: "Used when a column has a pair left to reduce." },
      { name: "Depth", expression: "levels × CSA delay + final-adder delay", note: "Serial ripple accumulation is counted separately as estimated full-adder delays." },
    ],
    expectedBehavior: ["The decimal, binary, and hex sums match ordinary addition.", "A stage’s decimal value matches the operand sum.", "Changing the final adder changes the depth line and leaves the numeric sum unchanged."],
    resultInterpretation: ["If the Correct line is present, the tree sum and the arithmetic sum are the same integer.", "A larger operand count adds Wallace levels. A larger width adds columns."],
    misconceptions: ["The carry does not stay in the column that produced it.", "Wallace reduction does not remove the final carry-propagate addition.", "The depth line is an estimate of gate stages, not a fabricated nanosecond measurement."],
    variations: ["Compare 3 operands with 8 operands.", "Compare 4-bit and 16-bit operands.", "Load Maximum and find a column that emits more than one carry."],
    learningOutcomes: ["Build a Wallace tree for a chosen width and operand count", "Trace one compressor’s sum and carry", "Compare tree depth with serial ripple accumulation"],
    viva: [
      { question: "What does a 3:2 compressor emit?", answer: "A sum bit in the same column and a carry bit in the next higher column." },
      { question: "Why can the tree stop at two rows?", answer: "Two rows are exactly what a carry-propagate adder accepts." },
      { question: "What does a half adder compress?", answer: "Two bits. Its carry still moves one column higher." },
      { question: "Does the numeric result depend on ripple versus carry look-ahead?", answer: "No. The depth estimate does." },
      { question: "What must stay constant at every stage?", answer: "The weighted value of all the bits." },
    ],
    selfCheck: [
      { prompt: "A full-adder carry belongs in:", choices: ["The same column", "The next higher weight", "The next lower weight"], answer: 1, why: "Carry has twice the weight of the sum." },
      { prompt: "The tree finishes by:", choices: ["Dropping the carry row", "Adding the last two rows", "Adding one operand at a time from the start"], answer: 1, why: "The final adder is a carry-propagate adder." },
      { prompt: "Eight operands versus three operands usually changes:", choices: ["Only the legend colors", "The number of Wallace levels", "The meaning of XOR"], answer: 1, why: "More rows take more compression stages." },
    ],
    summary: "Group equal weights, compress with full and half adders, keep the same integer at every stage, and add the last two rows once.",
    walkthrough: {
      howToUse: [
        "Start from the example 25, 13, 7, and 9. Press Step and read the compressor that lights up.",
        "Play runs the same compressor sequence. Reset restores those four operands, 8-bit width, and carry look-ahead.",
      ],
      observe: [
        "The dashed carry wire leaves a compressor for the next higher column.",
        "The stage table keeps one decimal value, the operand sum, on every level.",
        "Statistics list Wallace levels, full adders, half adders, and the depth line.",
      ],
      experiments: [
        { title: "Step one compressor", steps: ["Press Reset.", "Press Step.", "Read Inputs, Sum, and Carry on the highlighted node."] },
        { title: "Eight operands", steps: ["Set Number of operands to 8.", "Press Example.", "Read Wallace levels in Statistics."] },
        { title: "Final adder", steps: ["Set Final adder to Ripple Carry Adder.", "Read the depth line.", "Switch back to Carry Look-Ahead and compare the line. The decimal sum stays the same."] },
        { title: "A wide word", steps: ["Set Operand width to 16-bit.", "Press Maximum.", "Compare the compressor count with the 8-bit example."] },
      ],
      expected: [
        "Every valid tree shows Correct and the same integer as ordinary addition.",
        "Ripple and carry look-ahead disagree on the depth line and agree on the sum.",
      ],
      why: ["Three bits of weight 2^k become one sum of weight 2^k and one carry of weight 2^(k+1). Repeating that is faster than a chain of ripple additions, and the final adder still has to resolve the last carry chain."],
      challenge: "Use 8 operands at 8 bits, load Example, and record the Wallace level count. Then switch only the final adder and record which part of the depth line changes.",
      check: [
        "Which wire is the carry, and which column does it enter?",
        "Why does the stage decimal stay equal to the operand sum?",
        "What changes on the page when the final adder changes, and what stays the same?",
      ],
      links: [
        { id: "operands", label: "Watch the operands" },
        { id: "results", label: "Watch the sum" },
        { id: "stats", label: "Watch the depth" },
      ],
      checklist: [
        "Stepped a compressor and read its sum and carry",
        "Compared 3 operands with 8 operands",
        "Compared ripple with carry look-ahead",
        "Checked the sum against ordinary addition",
      ],
    },
  },
];

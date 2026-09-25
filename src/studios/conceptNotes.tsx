const NOTES: Record<string, Array<[string, string]>> = {
  "mips:overview": [
    ["What this studio simulates", "Classic five-stage MIPS: IF, ID, EX, MEM, WB. Only load and store touch memory. This studio does not simulate CP1 floating point or a cache."],
    ["Teaching subset versus MIPS32", "Delay slots and branch-likely are historical MIPS rules. A modern core does not expose a visible delay slot. The labs use the classic teaching rule."],
  ],
  "mips:instruction-formats": [
    ["Same registers, three encodings", "add $t0, $t1, $t2 is opcode 000000 plus funct 100000. lw $t0, 4($t1) is opcode 100011 with a 16-bit offset. beq $t0, $t1, 1 is opcode 000100. The opcode field is the difference; the register numbers stay in rs, rt, and rd."],
    ["Shifts and immediate extension", "sll uses shamt, not rs. addi sign-extends the 16-bit immediate. andi and ori zero-extend it, so a high bit does not become a negative mask."],
  ],
  "mips:register-file": [
    ["HI and LO", "Classic mult writes a 64-bit product to HI and LO. mfhi and mflo copy those into a general register. The product does not land in $t0 by itself."],
    ["A call uses aliases", "$a0–$a3 are arguments, $v0 is the return value and the syscall number, $ra is the return address, $sp is the stack. $s0–$s7 must be restored by the callee. $t registers may be overwritten."],
  ],
  "mips:assembler": [
    ["A pseudo-instruction expands", "move $t0, $t1 is really add $t0, $t1, $zero. li of a large constant becomes lui plus ori. The machine-code listing shows the real instructions, not the alias."],
    ["The branch delay slot", "In this teaching model the instruction after a branch still executes when the branch is taken. A nop is the safe filler. That slot is a classic MIPS rule, not how a modern pipeline advertises itself."],
  ],
  "mips:datapath": [
    ["Control for four instructions", "add: RegDst 1, ALUSrc 0, MemtoReg 0, RegWrite 1, MemRead 0, MemWrite 0, Branch 0. lw sets ALUSrc, MemtoReg, and MemRead. sw sets ALUSrc and MemWrite and does not write a register. beq sets Branch and compares in the ALU."],
    ["The address is an ALU add", "lw and sw compute the effective address as rs plus the sign-extended offset. There is no separate address adder in this datapath. Example: $t1 = 0x1000 and offset 4 produces 0x1004."],
  ],
  "mips:pipeline": [
    ["Ideal CPI after the pipe fills", "Five instructions with no hazards take 5 + 4 = 9 cycles: four to fill, then one result per cycle. Ideal CPI approaches 1. An empty pipe that runs them one at a time takes 25 cycles."],
    ["Name the collision", "On a chosen cycle, read the grid: the producer is in EX or MEM and the consumer wants that register in ID. Without forwarding those two instructions are a RAW. With forwarding, an ALU result can skip ahead; a load still cannot."],
  ],
  "mips:hazards": [
    ["Control hazard", "A taken beq must not let the fall-through instruction retire. With a delay slot, that next instruction runs anyway. Without one, the fetched successor is flushed. The cycle count is the difference between those two rules."],
    ["Load-use is one extra cycle", "lw $t0, 0($t1) then add $t2, $t0, $t3: forwarding cannot hide the load, because the data appears at the end of MEM. The add stalls one cycle even when forwarding is on."],
  ],
  "mips:memory-io": [
    ["Bytes versus words", "lw and sw require a multiple of 4. lb sign-extends a byte; lbu zero-extends it. 0xFF through lb becomes 0xFFFFFFFF. An unaligned lw is a fault in this model."],
    ["Store versus syscall", "sw writes a data word and leaves $v0 alone. syscall with $v0 = 1 prints $a0. Both leave the core, but only the syscall selects a service."],
  ],
  "mips:system-calls": [
    ["Services in this browser", "print integer is $v0 = 1, print string is $v0 = 4, exit is $v0 = 10. These are SPIM/MARS teaching numbers, not a Linux syscall ABI."],
    ["Print integer, step by step", "Set $v0 to 1, put the value in $a0, execute syscall. The console line appears, then the PC moves to the next instruction. Exit ($v0 = 10) halts instead."],
  ],
  "mips:practice": [
    ["Reason, then name", "Prefer questions that encode beq, count a delay slot, or count a load-use stall. Register-name recall is not enough."],
    ["A miss shows the field", "A wrong answer should point at the opcode, the funct field, or the pipeline stage that decided it, not only at the correct letter."],
  ],

  "riscv:overview": [
    ["RV32I boundary", "This lab is RV32I only: no C compressed extension, no M multiply, no F or D floating point, no Zicsr, and no privileged ISA."],
    ["x0 and $zero", "addi x1, x0, 5 and addi $t0, $zero, 5 are the same idea. The zero register is hardwired. A write to it is discarded."],
  ],
  "riscv:registers": [
    ["Calling convention", "a0–a7 are arguments, a0 also returns a small result, ra is the return address, sp is the stack. s0–s11 are callee-saved. t0–t6 are caller-saved. One jal uses ra; the callee must restore any s register it changes."],
    ["A write to x0 disappears", "The same step that writes 7 into x1 leaves x0 at 0. The bit pattern in x0 does not change."],
  ],
  "riscv:formats": [
    ["Rebuild a B or J immediate", "B-type and J-type scatter the immediate and leave bit 0 as an implicit 0, so the branch target stays 2-byte aligned. Sign-extend after the bits are gathered, not before."],
    ["sw versus lw", "The address is the same rs1 plus a 12-bit immediate. S-type splits that immediate around rs2. I-type keeps it in one field. That split is the only encoding difference for the same address."],
  ],
  "riscv:encoding": [
    ["Rebuild a B or J immediate", "B-type and J-type scatter the immediate and leave bit 0 as an implicit 0. Gather the bits, then sign-extend."],
    ["sw versus lw", "Same address, two layouts: S-type splits the immediate around the store data register. I-type holds the load immediate in one field."],
  ],
  "riscv:assembler": [
    ["li that does not fit", "A constant that fits in 12 bits is addi rd, x0, imm. A larger constant is auipc rd, upper then addi rd, rd, low12. The listing shows both real instructions."],
    ["A zero word is a teaching halt", "A following word of 0 stops this simulator. It is not ebreak and it is not ecall."],
  ],
  "riscv:arith": [
    ["slt versus sltu", "The same bits 0xFFFFFFFF are −1 when signed and the maximum unsigned value. slt against 1 writes 1. sltu against 1 writes 0."],
    ["Shift amount is five bits", "RV32 uses the low 5 bits of rs2. A shift amount of 33 is 33 & 31 = 1, so the register moves one bit, not 33."],
  ],
  "riscv:loadstore": [
    ["lb versus lbu", "The byte 0xFF through lb sign-extends to 0xFFFFFFFF. lbu zero-extends to 0x000000FF. The memory byte is the same."],
    ["Negative offset and alignment", "rs1 = 0x1000 and imm = −4 produce address 0xFFC. lw of an address that is not a multiple of 4 is rejected in this subset."],
  ],
  "riscv:branches": [
    ["Taken and not taken", "beq with equal registers goes to PC + imm. The same beq with unequal registers goes to PC + 4. Both addresses are byte addresses; the encoded immediate’s bit 0 is zero."],
    ["JAL versus JALR", "JAL target is PC + imm, and rd receives PC + 4. JALR target is (rs1 + imm) with bit 0 cleared. jalr x0, 0(ra) is a return."],
  ],
  "riscv:jal": [
    ["Taken and not taken", "A branch that compares equal uses PC + imm. A branch that falls through uses PC + 4."],
    ["JAL versus JALR", "JAL is PC-relative and writes the return address to rd. JALR adds rs1 and the immediate, then clears bit 0. A return is jalr with ra."],
  ],
  "riscv:lui": [
    ["Upper immediate", "LUI writes imm[31:12] and zeros the low 12 bits. AUIPC adds that word to the PC, so the same immediate is a pc-relative address."],
    ["Pair it with addi", "A constant wider than 12 bits is auipc plus addi. The addi immediate is sign-extended, so a low 12-bit field with the high bit set subtracts from the upper word."],
  ],
  "riscv:immgen": [
    ["Where the bits move", "I keeps imm[11:0]. S splits it. B and J also split it and force bit 0 to 0. U uses the top 20 bits. The generator sign-extends to 32 bits."],
    ["Same hardware, several clocks", "Multi-cycle reuses the ALU across fetch, decode, execute, memory, and write-back. It is not a second processor."],
  ],
  "riscv:datapath": [
    ["One instruction, four blocks", "ImmGen builds the immediate, the ALU adds or compares, the branch result picks the next PC, and a mux chooses ALU versus memory for write-back. Control here is implied by the opcode."],
    ["Multi-cycle is the same instruction", "Single-cycle finishes in one clock. Multi-cycle uses more clocks and reuses the ALU. It is not a second machine."],
  ],
  "riscv:multicycle": [
    ["Reuse, not a second core", "Fetch, decode, execute, memory, and write-back are clocks on the same units. The instruction does not change."],
    ["The ALU is busy more than once", "A load uses the ALU for the address, then memory, then write-back. An add uses the ALU once and skips memory."],
  ],
  "riscv:pipeline": [
    ["Forwarding versus load-use", "add then sub of that result: forwarding removes the RAW. lw then an instruction that reads the loaded register: one stall remains, because the data is not ready at the end of EX."],
    ["A taken branch flushes", "The instruction fetched on the wrong path is discarded. Count cycles with that flush and without it. The difference is the control penalty in this model."],
  ],
  "riscv:hazards": [
    ["Forwarding versus load-use", "An ALU result can forward. A load cannot forward to the very next instruction. That pair still stalls one cycle."],
    ["Flush the wrong path", "A taken branch throws away the instruction fetched after it. Younger work does not retire."],
  ],
  "riscv:program": [
    ["Sum 1 through 5", "The loop adds 1, 2, 3, 4, and 5. The destination register ends at 15. Watch PC, that register, and any memory word the preset uses for the total."],
    ["Hand-written, not compiled", "Presets are teaching sequences. They do not build a stack frame unless the text contains the stores and the sp updates."],
  ],

  "arm:overview": [
    ["AArch64 in one paragraph", "Instructions are a fixed 32 bits. There are 31 general X registers. Only LDR and STR touch memory. NZCV exists, but it is not a predicate on every instruction the way AArch32 condition codes were."],
    ["What this subset skips", "No SVE, no pointer authentication, no memory tagging, no exclusive monitors, and no barriers. Those are real AArch64 topics. They are outside this lab."],
  ],
  "arm:registers": [
    ["Wn zero-extends", "A 32-bit write to W0 writes the low half of X0 and zeros bits 63:32. That is not the x86 rule, where some 8-bit writes leave the rest of the register alone."],
    ["EL0–EL3 are privilege, not register files", "EL0 is the application, EL1 is typically the kernel, EL2 is a hypervisor, EL3 is a secure monitor. An exception saves the return address in ELR and the flags in SPSR. ERET copies them back. Not every chip implements EL2 and EL3."],
  ],
  "arm:instruction-set": [
    ["Three words, one width", "ADD (immediate), LDR, and B are all 32 bits. The field positions change: a data-processing word names Rd, Rn, and an immediate; LDR names a base and an offset; B carries a PC-relative displacement. The length does not change."],
    ["A logical immediate is a mask", "AND and ORR immediates are a repeated bit pattern, not a plain 12-bit field. Some 12-bit patterns are illegal and this model should reject them rather than invent a mask."],
  ],
  "arm:assembler": [
    ["Flags then a branch", "CMP or ADDS updates NZCV. B.EQ reads Z. If Z is 1 the branch is taken; if Z is 0 the next instruction runs. Show the four flags before and after the compare."],
    ["BL writes X30, RET reads it", "BL stores PC+4 in X30 and branches. RET copies X30 back to the PC. A return is not a second BL."],
  ],
  "arm:datapath": [
    ["The ALU builds the address", "LDR address = base + offset, or base + (index << scale). That add happens in the ALU. The memory stage only performs the access. Example: base 0x1000 and offset 16 produce 0x1010."],
    ["Two write-back sources", "An ADD writes the ALU result. An LDR writes the memory word. The mux between them is the MemtoReg idea, even when the signal has another name."],
  ],
  "arm:pipeline": [
    ["Where forwarding comes from", "A result can move from the end of EX or from MEM/WB into a later instruction’s EX inputs. A load-use still stalls: the loaded data is not available at the end of EX."],
    ["CPI with a penalty", "A clean five-instruction pipe is about 9 cycles. One load-use stall adds a cycle. One flushed branch adds the instructions that were fetched on the wrong path. Use the cycle counter on this page for both."],
  ],
  "arm:memory": [
    ["Pre-index and post-index, with numbers", "Base 0x2000 and offset 8. Pre-index accesses 0x2008 and leaves the base at 0x2008. Post-index accesses 0x2000 and then leaves the base at 0x2008. The AAPCS64 keeps SP 16-byte aligned. This model treats that as an ABI rule, not an automatic trap."],
    ["Scaled versus unscaled", "An unscaled immediate is base + offset. A scaled register offset is base + (index << scale). They are different addressing forms, even when the numeric result matches."],
  ],
  "arm:exceptions": [
    ["One synchronous exception", "From EL0, a supervisor call sets a cause, takes the vector, saves the faulting PC in ELR and PSTATE in SPSR, and enters a higher EL. ERET restores both. The handler is not a branch that forgets the saved state."],
    ["Exception, interrupt, and optional levels", "An exception is synchronous with an instruction. An interrupt is asynchronous. EL2 and EL3 are roles. A chip may omit them."],
  ],
  "arm:soc": [
    ["Agents on one interconnect", "CPU, GPU, and a display or DMA device share memory. A coherent read sees a CPU store. A device DMA is visible to the CPU only after the path this lab calls the interconnect. This is a sketch, not a vendor SoC."],
    ["DVFS and a thermal hold", "Frequency and voltage move together. If temperature crosses the limit, frequency stays down. Any watts or gigahertz on this page are illustrative."],
  ],
  "arm:practice": [
    ["Compute, don’t recite", "Ask for an address, a Wn zero-extend, or an ELR/SPSR restore. Naming EL0–EL3 is not the whole question."],
    ["A miss cites the rule", "Point at the field or the privilege rule that failed, and at the lab that demonstrates it."],
  ],

  "x86:overview": [
    ["Long mode in one sentence", "x86-64 uses 64-bit registers and mostly flat segments. Instructions are variable length and become µOps. Retirement is still in program order."],
    ["What this studio skips", "Paging, AVX, CET, the APIC, and vendor turbo are outside these labs. The pictures are a teaching core, not a complete processor."],
  ],
  "x86:registers-flags": [
    ["EAX zeros the top, AL does not", "Start from RAX = 0x1122334455667788. Writing EAX = 7 makes RAX = 0x0000000000000007. Writing AL = 0xFF changes only the low byte, so the upper bytes stay."],
    ["Four flags, not one sign bit", "A subtraction can set OF without CF, or CF without OF. ZF is a zero result. SF is the high bit of the result. Read them separately after the same instruction."],
  ],
  "x86:instruction-encoding": [
    ["Two instructions, byte by byte", "ADD RAX, RBX is REX, opcode, ModR/M. MOV RAX, [RBX+RCX*4+disp] adds SIB and a displacement. The length is the sum of those fields, not a fixed 4."],
    ["Fifteen bytes is the maximum", "A prefix pile past 15 bytes is rejected. This model does not truncate it into a legal instruction."],
  ],
  "x86:addressing-modes": [
    ["The address formula", "Effective address = base + index × scale + displacement. Scale is 1, 2, 4, or 8. RIP-relative uses the address of the next instruction plus a displacement."],
    ["LEA does not touch memory", "LEA RAX, [RBX+RCX*4+32] writes the address into RAX. MOV RAX, [RBX+RCX*4+32] reads the memory at that address. The arithmetic can match and the side effect does not."],
  ],
  "x86:assembler-disassembler": [
    ["Round trip", "Assemble one instruction, read the bytes, disassemble those bytes. A label becomes a relative displacement. The bytes, not the label text, are what the processor sees."],
    ["Intel syntax only here", "This simulator writes the destination first and prefixes immediates in Intel form. AT&T reverses the operands and marks immediates with $. The machine code can be the same."],
  ],
  "x86:decode-datapath": [
    ["Find the boundary, then the µOp", "A 1-byte instruction and a following 5-byte instruction share a fetch window. Decode must know where the second one starts before it can name ModR/M or the immediate. The result of decode is one or more µOps."],
    ["A bad prediction redirects fetch", "Younger µOps on the wrong path are discarded. Retirement still happens in program order, so the architectural registers do not show the discarded work."],
  ],
  "x86:micro-operations": [
    ["Crack a memory operand", "ADD RAX, [RBX] becomes a load, an add, and no extra store. ADD [RBX], RAX becomes a load, an add, and a store. ADD RAX, RBX stays one µOp."],
    ["Fusion and the µOp cache", "Macro-fusion can pair a compare and a branch into one µOp. Micro-fusion can keep an address and an operation together. A µOp-cache hit skips decode. None of that changes the architectural result."],
  ],
  "x86:out-of-order": [
    ["Renaming removes false dependencies", "A write-after-write and a write-after-read on the same architectural register can use different physical registers. The reorder buffer still retires the older instruction first."],
    ["Precise exceptions", "A faulting µOp waits until it is the oldest. Earlier instructions have retired. Later ones have not. The architectural state matches the instruction boundary."],
  ],
  "x86:memory-cache": [
    ["Line fill versus a TLB miss", "A data miss fills a cache line, not one byte. L1, then L2, then DRAM are data hits and misses. A TLB miss is a failed virtual-to-physical translation. It is not the same event as a data miss."],
    ["Inclusive is not a law", "Some last-level caches include the inner caches. Some do not. This lab does not claim one layout for every desktop chip."],
  ],
  "x86:practice": [
    ["Compute the answer", "Ask for an effective address, a REX plus ModR/M length, or which flags a subtraction sets. Naming a register is not enough."],
    ["Show the byte or the rename", "A wrong answer should show the byte that decided the length, or the renamed register, and say when the picture is this teaching model."],
  ],

  "compare:home": [
    ["The contract", "Same task, three encodings, no winner. The columns are RV32I, AArch64, and x86-64."],
    ["Trade-offs, not scores", "Code size, decode cost, and ecosystem role are compared. They are not ranked."],
  ],
  "compare:overview": [
    ["Fixed width changes fetch", "RISC-V and AArch64 instructions are 4 bytes, so the next PC is usually PC+4. x86 length is known only after decode. That is a fetch difference, not a verdict that one ISA is simpler."],
    ["Adding a memory value", "RISC-V and ARM load, then add. x86 can add a register and a memory operand in one instruction. The instruction count drops. The memory access does not disappear."],
  ],
  "compare:register-models": [
    ["One fictional call", "RISC-V passes arguments in a0–a7 and returns in a0. AArch64 uses X0–X7 and X0. x86-64 System V uses RDI, RSI, RDX, RCX, R8, R9 and returns in RAX. x0, XZR, and a discarded write are the zero registers. Caller-saved versus callee-saved differs by ABI, not by the ISA name alone."],
    ["Return address", "RISC-V writes ra explicitly with jal. ARM BL writes X30. An x86 call pushes the return address. The stack pointer is sp, SP, or RSP."],
  ],
  "compare:instruction-encoding": [
    ["Add immediate, three ways", "Count bits that are opcode, register fields, and immediate. RISC-V and ARM stay 32 bits. The x86 immediate grows the instruction."],
    ["Length moves only on x86", "A larger x86 immediate adds bytes. The RISC-V and ARM words stay 4 bytes, and a constant that does not fit becomes a second instruction."],
  ],
  "compare:instruction-length": [
    ["A window can split x86", "A fixed 32-bit instruction sits entirely inside or entirely outside a fetch window. An x86 instruction can start inside the window and end outside it. Decode cannot start until the boundary is known."],
    ["Shorter is not faster", "Fewer bytes or fewer instructions do not by themselves finish sooner. Dependencies, decode, and memory still dominate."],
  ],
  "compare:memory-access": [
    ["The same store", "Store a register to base+offset. RISC-V sw uses rs2 as the data. ARM STR uses a source register. x86 MOV [base+disp], reg puts the data in a memory operand. The address math is the shared idea."],
    ["Byte loads", "Sign-extending and zero-extending a byte exist in all three. The mnemonics differ: lb/lbu, LDRSB/LDRB, MOVSX/MOVZX."],
  ],
  "compare:addressing": [
    ["One address, three formulas", "Compute base + index×scale + displacement for x86, with scale in {1, 2, 4, 8}, and a RIP-relative form. RISC-V and ARM in this subset use base plus immediate. Say so when a scaled form is not implemented here."],
    ["Relative branches", "RISC-V and ARM branch immediates and an x86 relative displacement are all PC-relative. The packing of the immediate differs. The idea does not."],
  ],
  "compare:same-task": [
    ["Sum 1 through 5", "All three programs end with 15 in the result register. Count instructions and name every register written. Mark a pseudo-instruction if one appears."],
    ["A memory operand, without a winner", "A second task that adds a value from memory shows x86 using fewer instructions. That is a density difference, not a ranking."],
  ],
  "compare:decode-complexity": [
    ["Boundary before operands", "Variable length must find where the instruction ends before the operands are known. Fixed length can read the fields in parallel. Keep the comparison qualitative."],
    ["µOps belong to the implementation", "Cracking into µOps is an x86 microarchitecture idea in this lab. Do not describe RISC-V or ARM instructions as if they were already µOps."],
  ],
  "compare:ecosystem-roles": [
    ["Roles are examples", "Microcontroller, phone, and desktop are examples. Each ISA now shows up in more than one of those roles."],
    ["A technical reason, not a brand", "Tie a role to fixed length, variable length, or register count. Do not define the ISA by a vendor name."],
  ],

  "mobile:home": [
    ["One package, several engines", "The die in this lab is a CPU, a GPU, an NPU, an ISP, a memory system, and an interconnect. The blocks are conceptual. This is not a phone teardown."],
    ["Two jobs", "A photo walks the sensor, the ISP, then memory. A game walks the GPU and memory, with the CPU issuing the frame. The callouts are those jobs."],
  ],
  "mobile:overview": [
    ["One DRAM port", "When the CPU, GPU, and ISP all miss, they share a memory controller. They do not each own a private DRAM."],
    ["Label the assumption", "Any GB/s or milliwatts here are illustrative. Name the unit and the assumption, such as one channel and one workload."],
  ],
  "mobile:cpu-cores": [
    ["Migration has a cost", "A short interactive thread fits a performance core. A background thread fits an efficiency core. Moving a thread between them pays a warm-up cost. The scheduler is choosing, not the ISA."],
    ["P and E are common, not required", "Private L1 and L2 and a shared last-level cache are the stable idea. A separate efficiency core is a frequent mobile choice, not a rule."],
  ],
  "mobile:gpu": [
    ["A tile, then memory", "Many threads shade one tile while the working set stays on chip, then the tile is written out. A GPU stall here is usually memory, not a branch mispredict."],
    ["A teaching pipeline", "Vertex, raster, and fragment are stages in this sketch. The lab does not claim a shader-core count for every mobile GPU."],
  ],
  "mobile:npu": [
    ["MAC array, weak branches", "Quantized weights are small integers. A MAC array multiplies and accumulates them. That beats a CPU on this pattern. The same array is a poor match for general branches."],
    ["The classifier is a demo", "The color pass computes channels and a score on this canvas. It is not a trained model, and it does not report accuracy."],
  ],
  "mobile:isp": [
    ["Ordered stages", "Sensor samples are Bayer, not a photo. The path is demosaic to RGB, then tone map. Exposure or denoise strength is the control that changes pixels."],
    ["The ISP does the path", "RAW is the sensor’s samples. In this example the ISP, not the CPU, performs most of the stages."],
  ],
  "mobile:memory": [
    ["Miss order", "A miss walks L1, L2, the last-level cache, then LPDDR. The latencies are conceptual. They are not a phone datasheet. Channels are paths to DRAM, not extra cache levels."],
    ["Coherence is named", "A GPU write that the CPU must read is a coherence question. If this page does not simulate the snoop, it says coherence is assumed."],
  ],
  "mobile:connectivity": [
    ["Three different blocks", "The cellular modem, Wi-Fi, and the application CPU are separate. A packet walks radio, baseband, memory, then the CPU."],
    ["Illustrative link budget", "Throughput and power on the sliders are teaching figures. They are not a 3GPP or Wi-Fi calculation."],
  ],
  "mobile:power-thermal": [
    ["Voltage follows frequency", "DVFS lowers voltage when it lowers frequency. Crossing the thermal limit cuts frequency. That is the throttle."],
    ["A long job, not a one-second peak", "Skin temperature and sustained power matter for a camera or a game. A one-second burst can sit higher than the sustained point."],
  ],
  "mobile:integration": [
    ["Two scenarios", "Camera plus an on-device label lights the ISP, the NPU, and memory. A game lights the GPU and memory. The CPU issues both."],
    ["The bottleneck moves", "The same scenario at a higher intensity can leave the CPU and become memory-bound or thermally limited. The busy block is not fixed."],
  ],

  "desktop:home": [
    ["Package, then labs", "The package is a die, a heat spreader, and a substrate. Cores, cache, DDR, PCIe, boost, and thermals each have a lab."],
    ["P-cores and E-cores are optional", "The picture is an example mix. A desktop CPU can be all performance cores. The mix is not the definition of desktop."],
  ],
  "desktop:package": [
    ["Three layers, two jobs", "The IHS is metal and spreads heat. The die is silicon and holds the cores and controllers. The substrate routes signals to the contacts. Pads are the electrical interface, not the logic."],
    ["Examples stay examples", "Transistor count, die area, and base power on this page are labelled examples. They are not a vendor process."],
  ],
  "desktop:cores": [
    ["A sketch, not a product pipeline", "The performance-core sketch is predict, fetch, decode, rename, execute, load/store, and a private L2. The efficiency-core sketch has fewer ports and a smaller private cache. Both are teaching drawings."],
    ["The job picks the cores", "Compilation uses many cores. A game often wants fewer cores at a higher frequency. Background work prefers efficiency cores. Utilization should follow the selected job."],
  ],
  "desktop:cache": [
    ["Private, then shared, then DRAM", "L1 instruction and L1 data are private. L2 is a larger private cache. L3 is shared. A miss walks that order and then DRAM. Sizes are typical ranges, not a standard."],
    ["Streaming misses on purpose", "Sequential and repeated accesses hit. Random accesses hit less. Streaming misses even when the byte count looks small, because each line is used once and then replaced."],
  ],
  "desktop:memory": [
    ["The peak formula", "Bandwidth = transfers per second × 8 bytes × channels. DDR5-5200, two channels: 5200e6 × 8 × 2 = 83.2 GB/s. That is a peak, not what an application measures."],
    ["Clock, data rate, and CAS", "The data rate is twice the memory clock because data moves on both edges. CAS is the column wait in cycles. It is not the full trip from the core to the DIMM."],
  ],
  "desktop:pcie": [
    ["A budget of 16", "The root complex feeds the GPU, an NVMe SSD, a NIC, and the chipset. Lane widths are x1, x4, x8, and x16. If the sum exceeds 16, the allocation does not fit this example."],
    ["Rounded per-lane rates", "About 0.985, 1.969, and 3.938 GB/s per lane each direction for generations 3, 4, and 5. The classroom figures 1, 2, and 4 are that rounding."],
  ],
  "desktop:boost-power": [
    ["Burst, then settle", "A short burst can sit higher. A sustained load, or a low power limit, settles lower. This is not a vendor turbo algorithm."],
    ["All-core is below single-core", "P-core and E-core traces are separate. Many active cores share the power limit, so all-core frequency is below the single-core peak."],
  ],
  "desktop:thermal": [
    ["The heat path", "Die, thermal interface, heatsink, air. Equilibrium rises with workload and ambient temperature. It falls with fan speed and a stronger cooler."],
    ["Four states from the temperature", "Normal, Warm, Near limit, and Throttling come from the simulated temperature against the limit. At the limit, frequency is cut. The label is not fixed in advance."],
  ],
  "desktop:workloads": [
    ["Why each preset looks like that", "Gaming is GPU-heavy. Compilation is CPU-heavy. Content creation uses CPU, memory, and storage together. Idle stays near the floor."],
    ["Consequences, labelled illustrative", "Frequency, cache activity, memory bandwidth, package power, and temperature follow the preset. They are illustrations, not a benchmark."],
  ],
  "desktop:practice": [
    ["Keep the arithmetic", "Bandwidth, a lane sum over 16, burst versus sustained, and shared versus private cache are the reasoning questions."],
    ["A miss recomputes", "A wrong answer should show the formula or the lane sum again, not only the name of the correct block."],
  ],
};

export function ConceptNotes({ studio, lab }: { studio: string; lab: string }) {
  const items = NOTES[`${studio}:${lab}`];
  if (!items) return null;
  return (
    <section className="rvx-card" aria-label="Concept notes">
      <h3>Concept notes</h3>
      <div className="arm-notes">
        {items.map(([title, body]) => (
          <div key={title}><b>{title}</b><span>{body}</span></div>
        ))}
      </div>
    </section>
  );
}

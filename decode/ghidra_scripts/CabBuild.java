// CabBuild.java - build the overlay-aware Curse of the Azure Bonds program (resident START.EXE + 36 TPOV GAME.OVR units).
// Headless (see decode/tools/ghidra_build.sh):
//   analyzeHeadless <proj> cab -import resident.bin -loader BinaryLoader -processor "x86:LE:16:Real Mode"
//     -noanalysis -postScript CabBuild.java <bindir>
// <bindir> = output of decode/tools/ghidra_prep.py (resident.bin, ovNN.bin, layout.txt).
// Each resident segment and each overlay unit becomes its own memory block starting at seg:0000, so
// addresses keep the segment the code runs in. DS = 0C1C is set as context on every code block.
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import ghidra.program.model.mem.*;
import ghidra.program.model.lang.Register;
import ghidra.app.cmd.function.CreateFunctionCmd;
import java.io.*;
import java.math.BigInteger;
import java.nio.file.*;
import java.util.*;

public class CabBuild extends GhidraScript {
  Address A(String s) { return currentProgram.getAddressFactory().getAddress(s); }

  public void run() throws Exception {
    String bin = getScriptArgs()[0];
    byte[] res = Files.readAllBytes(Paths.get(bin, "resident.bin"));
    Memory mem = currentProgram.getMemory();
    for (MemoryBlock b : mem.getBlocks()) mem.removeBlock(b, monitor);
    List<String> lines = Files.readAllLines(Paths.get(bin, "layout.txt"));
    List<Address[]> code = new ArrayList<>();
    List<String[]> seeds = new ArrayList<>();
    SymbolTable st = currentProgram.getSymbolTable();
    for (String ln : lines) {
      String[] f = ln.trim().split(" ");
      if (f[0].equals("R") || f[0].equals("B")) {
        int seg = Integer.parseInt(f[1], 16), size = Integer.parseInt(f[2], 16);
        Address a = A(String.format("%04x:0000", seg));
        MemoryBlock b;
        if (f[0].equals("R")) {
          b = mem.createInitializedBlock(f[3], a, new ByteArrayInputStream(res, seg * 16, size), size, monitor, false);
        } else {
          b = mem.createUninitializedBlock(f[3], a, size, false);
        }
        b.setRead(true); b.setWrite(true);
        boolean isCode = f[0].equals("R") && !f[3].equals("dseg");
        b.setExecute(isCode);
        if (isCode) code.add(new Address[]{b.getStart(), b.getEnd()});
      } else if (f[0].equals("O")) {
        int idx = Integer.parseInt(f[1]); int seg = Integer.parseInt(f[2], 16); int size = Integer.parseInt(f[3], 16);
        byte[] ov = Files.readAllBytes(Paths.get(bin, String.format("ov%02d.bin", idx)));
        MemoryBlock b = mem.createInitializedBlock(String.format("ov%02d", idx), A(String.format("%04x:0000", seg)),
            new ByteArrayInputStream(ov), size, monitor, false);
        b.setRead(true); b.setWrite(true); b.setExecute(true);
        code.add(new Address[]{b.getStart(), b.getEnd()});
        String[] ents = f[5].split(",");
        int stub = Integer.parseInt(f[4], 16);
        for (int k = 0; k < ents.length; k++) {
          if (ents[k].equals("-")) {   // TPOV dead entry (offset FFFF): label only, nothing to resolve
            st.createLabel(A(String.format("%04x:%04x", stub, 0x20 + 5 * k)), String.format("stub_ov%02d_e%d_dead", idx, k), SourceType.ANALYSIS);
            continue;
          }
          int off = Integer.parseInt(ents[k], 16);
          String nm = k == 0 ? String.format("ov%02d_init", idx) : String.format("ov%02d_%04X", idx, off);
          seeds.add(new String[]{String.format("%04x:%04x", seg, off), nm});
          // stub entry (rewritten to JMP FAR by ghidra_prep.py) -> thunk
          seeds.add(new String[]{String.format("%04x:%04x", stub, 0x20 + 5 * k), String.format("stub_ov%02d_e%d", idx, k)});
        }
      } else if (f[0].equals("E")) {
        seeds.add(new String[]{f[1], f[2]});
      }
    }
    Register ds = currentProgram.getRegister("DS"), cs = currentProgram.getRegister("CS");
    ProgramContext ctx = currentProgram.getProgramContext();
    for (Address[] r : code) {
      ctx.setValue(ds, r[0], r[1], BigInteger.valueOf(0x0C1C));
      ctx.setValue(cs, r[0], r[1], BigInteger.valueOf(((SegmentedAddress) r[0]).getSegment()));
    }
    int made = 0;
    for (String[] s : seeds) {
      Address a = A(s[0]);
      disassemble(a);
      if (getFunctionAt(a) == null && new CreateFunctionCmd(a).applyTo(currentProgram, monitor)) made++;
      Function fn = getFunctionAt(a);
      if (fn != null && !fn.isThunk()) fn.setName(s[1], SourceType.ANALYSIS);
      else st.createLabel(a, s[1], SourceType.ANALYSIS);
    }
    println("seeded functions: " + made + " of " + seeds.size());
    analyzeAll(currentProgram);
    println("functions after analysis: " + currentProgram.getFunctionManager().getFunctionCount());
    // Ghidra x86 real-mode rel16 wraps near targets inside the LINEAR 64K page, not the segment: in a unit whose
    // linear range crosses a 64K boundary (Curse: ov08 2F00, ov23 5F00, ...) some E8/E9 targets land 64K off.
    // Replace those flows with override references to seg:((ip+len+rel)&FFFF) and repeat until stable.
    ReferenceManager rm = currentProgram.getReferenceManager();
    Listing listing = currentProgram.getListing();
    Set<Address> seedSet = new HashSet<>();
    for (String[] s : seeds) seedSet.add(A(s[0]));
    FunctionManager fm = currentProgram.getFunctionManager();
    for (int round = 0; round < 3; round++) {
    int removedTotal = 0;
    for (int pass = 0; pass < 6; pass++) {
      int fixed = 0, protos = 0;
      for (Address[] r : code) {
        InstructionIterator ii = listing.getInstructions(new AddressSet(r[0], r[1]), true);
        List<Instruction> todo = new ArrayList<>();
        while (ii.hasNext()) todo.add(ii.next());
        for (Instruction in : todo) {
          byte[] b = in.getBytes();
          if (b.length != 3 || ((b[0] & 0xff) != 0xE8 && (b[0] & 0xff) != 0xE9)) continue;
          SegmentedAddress sa = (SegmentedAddress) in.getAddress();
          int rel = (short) ((b[1] & 0xff) | (b[2] & 0xff) << 8);
          int toff = (sa.getSegmentOffset() + 3 + rel) & 0xffff;
          Address want = ((SegmentedAddressSpace) sa.getAddressSpace()).getAddress(sa.getSegment(), toff);
          boolean ok = false;
          for (Reference ref : rm.getReferencesFrom(in.getAddress()))
            if (ref.getReferenceType().isFlow() && ref.getToAddress().equals(want)) ok = true;
          if (ok) continue;
          boolean call = (b[0] & 0xff) == 0xE8;
          for (Reference ref : rm.getReferencesFrom(in.getAddress()))
            if (ref.getReferenceType().isFlow()) rm.delete(ref);
          Reference nr = rm.addMemoryReference(in.getAddress(), want,
              call ? RefType.CALL_OVERRIDE_UNCONDITIONAL : RefType.JUMP_OVERRIDE_UNCONDITIONAL, SourceType.USER_DEFINED, 0);
          rm.setPrimary(nr, true);
          disassemble(want);
          if (call && getFunctionAt(want) == null) new CreateFunctionCmd(want).applyTo(currentProgram, monitor);
          fixed++;
        }
        // TP procedure prologues (55 89 E5) in bytes no instruction covers
        Address p = r[0];
        while (p != null && p.compareTo(r[1]) <= 0) {
          Address hit = mem.findBytes(p, r[1], new byte[]{0x55, (byte) 0x89, (byte) 0xE5}, null, true, monitor);
          if (hit == null) break;
          if (listing.getInstructionContaining(hit) == null && listing.getDefinedDataContaining(hit) == null) {
            disassemble(hit);
            if (getFunctionAt(hit) == null && new CreateFunctionCmd(hit).applyTo(currentProgram, monitor)) protos++;
          }
          p = hit.add(1);
        }
      }
      println("pass " + pass + ": near-branch targets fixed " + fixed + ", prologue functions " + protos);
      if (fixed == 0 && protos == 0) break;
      analyzeAll(currentProgram);
    }
    // Orphan cleanup: a function nobody references, that is not a seed and does not start with a TP prologue,
    // is a split of its predecessor (e.g. 7F00:231A starting inside the instruction at 7F00:2318). Delete it,
    // clear its bytes, re-disassemble from the preceding function and recompute that function's body.
    for (int pass = 0; pass < 3; pass++) {
      List<Function> orphans = new ArrayList<>();
      for (Function f : fm.getFunctions(true)) {
        Address ep = f.getEntryPoint();
        if (seedSet.contains(ep) || f.isThunk()) continue;
        // only jump references (incl. self-jumps) = a split of the enclosing routine; calls or data refs = a real entry
        boolean realRef = false;
        for (Reference ref : rm.getReferencesTo(ep)) {
          RefType t = ref.getReferenceType();
          if (t.isCall() || t.isData() || !t.isFlow()) { realRef = true; break; }
        }
        if (realRef) continue;
        MemoryBlock b = mem.getBlock(ep);
        if (b == null || b.getName().startsWith("stub_")) continue;
        byte[] pro = new byte[3];
        mem.getBytes(ep, pro);
        if ((pro[0] & 0xff) == 0x55 && (pro[1] & 0xff) == 0x89 && (pro[2] & 0xff) == 0xE5) continue;
        orphans.add(f);
      }
      if (orphans.isEmpty()) break;
      for (Function f : orphans) {
        Address ep = f.getEntryPoint();
        AddressSetView body = f.getBody();
        Function prev = fm.getFunctionContaining(ep.subtract(1));
        if (prev == null) { FunctionIterator back = fm.getFunctions(ep.subtract(1), false); if (back.hasNext()) prev = back.next(); }
        println("orphan removed: " + ep + " (" + body.getNumAddresses() + " B), predecessor " + (prev == null ? "-" : prev.getEntryPoint().toString()));
        fm.removeFunction(ep);
        clearListing(body);
        removedTotal++;
        if (prev != null) {
          // re-disassemble every flow of the predecessor into the cleared range
          disassemble(prev.getEntryPoint());
          for (Instruction in : listing.getInstructions(prev.getBody(), true))
            for (Address t : in.getFlows()) if (body.contains(t)) disassemble(t);
          Instruction last = listing.getInstructionBefore(ep);
          if (last != null && last.getFallThrough() != null) disassemble(last.getFallThrough());
          CreateFunctionCmd.fixupFunctionBody(currentProgram, prev, monitor);
        }
      }
    }
    println("round " + round + ": orphans removed " + removedTotal);
    if (removedTotal == 0) break;
    analyzeAll(currentProgram);
    }
    println("CABBUILD_OK");
    println("functions after fixes: " + currentProgram.getFunctionManager().getFunctionCount());
  }
}

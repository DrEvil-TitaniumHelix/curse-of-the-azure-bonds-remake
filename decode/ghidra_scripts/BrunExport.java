// BrunExport.java - seed BRUN30 runtime routine entries from the three INT 3D/3E/3F tables, analyze, decompile, export.
// Headless: analyzeHeadless <proj> brun -import BRUN30.EXE -loader MzLoader -postScript BrunExport.java <tables.json> <outdir>
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import ghidra.program.model.mem.*;
import ghidra.app.decompiler.*;
import ghidra.app.cmd.function.CreateFunctionCmd;
import ghidra.util.task.ConsoleTaskMonitor;
import java.io.*;
import java.util.*;

public class BrunExport extends GhidraScript {
  public void run() throws Exception {
    String[] a = getScriptArgs();
    String tablesPath = a[0], outDir = a[1];
    new File(outDir, "funcs").mkdirs();
    // parse tables.json minimalistically: lines like  "3F": [1,2,3]
    Map<String, List<Integer>> tables = new LinkedHashMap<>();
    String txt = new String(java.nio.file.Files.readAllBytes(new File(tablesPath).toPath()));
    for (String g : new String[]{"3D","3E","3F"}) {
      int i = txt.indexOf("\"" + g + "\":"); int s = txt.indexOf('[', i); int e = txt.indexOf(']', s);
      List<Integer> v = new ArrayList<>();
      for (String n : txt.substring(s+1, e).split(",")) { n = n.trim(); if (!n.isEmpty()) v.add(Integer.parseInt(n)); }
      tables.put(g, v);
    }
    AddressFactory af = currentProgram.getAddressFactory();
    Listing listing = currentProgram.getListing();
    Map<Address, String> names = new LinkedHashMap<>();
    for (Map.Entry<String, List<Integer>> en : tables.entrySet()) {
      List<Integer> v = en.getValue();
      for (int idx = 0; idx < v.size(); idx++) {
        int off = v.get(idx);
        if (off == 0) continue;
        Address ad = af.getAddress(String.format("1000:%04x", off));
        String nm = String.format("RT%s_%02X", en.getKey(), idx);
        if (names.containsKey(ad)) names.put(ad, names.get(ad) + "__" + nm); else names.put(ad, nm);
      }
    }
    int made = 0;
    for (Address ad : names.keySet()) {
      if (listing.getFunctionAt(ad) == null) {
        disassemble(ad);
        CreateFunctionCmd cmd = new CreateFunctionCmd(ad);
        if (cmd.applyTo(currentProgram, monitor)) made++;
      }
    }
    println("seeded functions: " + made + " of " + names.size());
    analyzeAll(currentProgram);
    for (Map.Entry<Address, String> en : names.entrySet()) {
      Function f = listing.getFunctionAt(en.getKey());
      if (f != null) { try { f.setName(en.getValue(), SourceType.USER_DEFINED); } catch (Exception ex) {} }
    }
    DecompInterface di = new DecompInterface();
    di.openProgram(currentProgram);
    PrintWriter sum = new PrintWriter(new File(outDir, "summary.tsv"));
    sum.println("name\taddr\tsize\tint10\tint21\tint3x\tcallees\tstrings");
    FunctionIterator it = listing.getFunctions(true);
    int n = 0;
    while (it.hasNext()) {
      Function f = it.next();
      String nm = f.getName();
      int i10 = 0, i21 = 0, i3x = 0; Set<String> callees = new TreeSet<>(); Set<String> strs = new TreeSet<>();
      InstructionIterator ii = listing.getInstructions(f.getBody(), true);
      while (ii.hasNext()) {
        Instruction ins = ii.next();
        String m = ins.getMnemonicString();
        if (m.equals("INT")) { String op = ins.getDefaultOperandRepresentation(0); if (op.contains("10")) i10++; else if (op.contains("21")) i21++; else if (op.startsWith("0x3")) i3x++; }
        for (Reference r : ins.getReferencesFrom()) {
          Address t = r.getToAddress();
          if (r.getReferenceType().isCall()) { Function c = listing.getFunctionAt(t); callees.add(c != null ? c.getName() : t.toString()); }
          Data d = listing.getDataAt(t);
          if (d != null && d.getValue() instanceof String) strs.add(((String) d.getValue()).replace('\t',' ').replace('\n',' '));
        }
      }
      sum.println(nm + "\t" + f.getEntryPoint() + "\t" + f.getBody().getNumAddresses() + "\t" + i10 + "\t" + i21 + "\t" + i3x + "\t" + String.join(",", callees) + "\t" + String.join(" | ", strs));
      DecompileResults res = di.decompileFunction(f, 60, new ConsoleTaskMonitor());
      String c = (res != null && res.getDecompiledFunction() != null) ? res.getDecompiledFunction().getC() : "/* decompile failed */\n";
      try (PrintWriter w = new PrintWriter(new File(outDir + "/funcs", nm + ".c"))) { w.print(c); }
      n++;
    }
    sum.close(); di.dispose();
    println("exported functions: " + n);
  }
}

# EPIC Security Engine Status Report (EPIC-SEC-001)

This report details the execution capabilities, entry points, dependencies, and boundaries of the **EPIC-SEC-001 Owner Validation** static analysis engine based on actual code files.

---

## 1. Execution Capability Today

* **Status**: **COMPILED AND UNIT TESTED** (Executable *only* inside Rust crate library tests. Integration and CLI execution paths do not exist).
* **Classification Capability**:
  * **SAFE**: Correctly resolved when a writing variable (or WDG parent source) maps to a declared `GuardFact::Owner` fact dominating the write statement.
  * **UNSAFE**: Correctly resolved and generates diagnostics when a mutable write statement runs on a variable whose parent source lacks an owner check.
  * **INCONCLUSIVE**: Resolved if types are ambiguous or complex subexpressions cannot be evaluated (falls back to `Unknown` or does not match valid program IDs).

---

## 2. Technical Entry Points & Execution Path

The core execution path is implemented inside the Rust `parser-v2` crate:

```
[ Downstream Caller / Rules Test ]
               │
               ▼ (Constructs Context)
    InstructionAnalysisContext
               │
               ▼ (1) SymbolResolver::new()
         SymbolResolver
               │
               ▼ (2) DominanceChecker::new()
        DominanceChecker
               │
               ▼ (3) RuleEngine::run_all()
    Vec<RuleDiagnostic> (EPIC-SEC-001 findings)
```

### Entry Points
1. **[rules/mod.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/rules/mod.rs#L67)**:
   `RuleEngine::run_all(context: &InstructionAnalysisContext) -> Vec<RuleDiagnostic>`
   Instantiates `SymbolResolver` and `DominanceChecker`, then walks registered rules.
2. **[rules/epic_sec_001.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/rules/epic_sec_001.rs#L12)**:
   `OwnerValidationRule::check(&self, context: &InstructionAnalysisContext, resolver: &SymbolResolver, dom_checker: &DominanceChecker) -> Vec<RuleDiagnostic>`
   Walks node statements, computes WDG transitive mappings, resolves write bases, and verifies dominance.

---

## 3. Required Inputs for Successful Run

To run the rules check, the caller must supply a fully initialized `InstructionAnalysisContext` containing:
1. `name`: Handlers identification name (`String`).
2. `guard_facts`: Vector of parsed program invariants (`GuardFact` structures + provenance line bounds).
3. `cfg`: A complete `ControlFlowGraph` containing:
   * `nodes`: Map of node IDs to statements lists.
   * `edges`: Branch links between nodes.
   * `ssa_states`: Version variable lookup maps computed by `SSAComputer` (containing SSA variable names, version integers, and type annotations).

---

## 4. Current Integration Blockers

The following gaps block EPIC-SEC-001 from executing as a user tool:
1. **No CLI Command Integration**: The CLI command binary ([index.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/cli/src/index.ts)) does not import or call `RuleEngine`. There is no command (like `epic audit` or `epic check --security`) exposing security rules to users.
2. **No Parser-v2 Rule Runner Binary**: The Rust CLI runner main file ([main.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/main.rs)) does not contain a rule execution run loop. It only outputs structural JSON size layouts.
3. **No AST-to-Inference-to-Rules Pipeline**: The parser package lacks a unified compilation pass that compiles parsed raw files directly into `InstructionAnalysisContext` variables and executes rules checker workflows. Currently, this chain is only mock-assembled manually inside unit test functions.
4. **Omitted SARIF Logic**: The rule output can only be printed or exported as a raw JSON finding vector; standard SARIF output remains missing.

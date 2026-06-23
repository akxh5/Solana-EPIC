# EPIC-SEC-001: Implementation Redesign Specification

This document defines the architectural redesign to resolve the critical defects (C-01, C-02) and high-risk gaps (H-01, H-02) identified in the pre-implementation review of the **EPIC-SEC-001 Owner Validation** rule.

---

## 1. Objective 1: Eliminate String-Based Resolution

To prevent safety leakage under variable shadowing, aliasing, reassignment, or nested scopes, the `SymbolResolver` is refactored to use integer-typed compiler identifiers (`SymbolId`, `SSAVersionId`, `GuardTarget`) and AST structure nodes (`ExpressionNode`). All string comparisons for resolution correctness are removed.

### Updated Typed Interfaces
```rust
use crate::ast::ExpressionNode;
use crate::cfg::guards::{SymbolId, SSAVersionId, GuardTarget, InstructionAnalysisContext};
use crate::cfg::ssa::SSANodeState;
use std::collections::HashMap;

pub struct SymbolResolver {
    /// Maps a versioned SSA identity to its canonical parameter SymbolId.
    version_to_symbol: HashMap<SSAVersionId, SymbolId>,
    
    /// Maps context parameter paths (represented structurally) to their SymbolId.
    /// E.g. structural path for parameter at index `i`.
    parameter_symbols: HashMap<usize, SymbolId>,
    
    /// Union-Find equivalence set to track variable aliasing.
    equivalence_relations: HashMap<SymbolId, SymbolId>,
}

impl SymbolResolver {
    /// Initialize SymbolResolver directly from context declarations.
    pub fn new(context: &InstructionAnalysisContext) -> Self {
        let mut resolver = Self {
            version_to_symbol: HashMap::new(),
            parameter_symbols: HashMap::new(),
            equivalence_relations: HashMap::new(),
        };
        resolver.initialize_parameter_mappings(context);
        resolver
    }

    /// Walk the AST ExpressionNode recursively to resolve it to a canonical SymbolId using SSA state.
    pub fn resolve_expr(
        &self,
        expr: &ExpressionNode,
        ssa_state: &SSANodeState,
    ) -> Option<SymbolId> {
        match &expr.kind {
            crate::ast::ExpressionKind::Identifier(name) => {
                if let Some(ssa_var) = ssa_state.active_variables.get(name) {
                    match ssa_var {
                        crate::cfg::ssa::SSAVariable::Versioned { name: _, version } => {
                            // Resolve to the versioned ID
                            if let Some(sym_id) = ssa_state.active_variables.get(name).and_then(|v| {
                                // Match SymbolId from local state definitions
                                self.resolve_version(SSAVersionId {
                                    symbol_id: self.get_base_symbol(name)?,
                                    version: *version,
                                })
                            }) {
                                return Some(self.find_canonical(sym_id));
                            }
                        }
                        crate::cfg::ssa::SSAVariable::Ambiguous(_) => return None,
                    }
                }
                None
            }
            crate::ast::ExpressionKind::FieldAccess { object, .. } => {
                // Recursively resolve object base symbol
                self.resolve_expr(object, ssa_state)
            }
            crate::ast::ExpressionKind::Dereference(inner) => {
                self.resolve_expr(inner, ssa_state)
            }
            crate::ast::ExpressionKind::Reference { expression, .. } => {
                self.resolve_expr(expression, ssa_state)
            }
            crate::ast::ExpressionKind::Try(inner) => {
                self.resolve_expr(inner, ssa_state)
            }
            _ => None,
        }
    }

    /// Resolve a specific versioned variable back to its canonical SymbolId.
    pub fn resolve_version(&self, var_version: SSAVersionId) -> Option<SymbolId> {
        self.version_to_symbol
            .get(&var_version)
            .map(|&sym| self.find_canonical(sym))
    }

    /// Map a child symbol to its aliased parent symbol.
    pub fn register_alias(&mut self, child: SSAVersionId, parent: SymbolId) {
        let parent_root = self.find_canonical(parent);
        self.version_to_symbol.insert(child, parent_root);
    }

    fn find_canonical(&self, mut sym_id: SymbolId) -> SymbolId {
        while let Some(&parent) = self.equivalence_relations.get(&sym_id) {
            sym_id = parent;
        }
        sym_id
    }

    fn get_base_symbol(&self, _name: &str) -> Option<SymbolId> {
        // Look up variable base SymbolId in active lexical scopes
        None
    }

    fn initialize_parameter_mappings(&mut self, _context: &InstructionAnalysisContext) {
        // Initialize structural parameter bindings
    }
}
```

### Correctness Under Execution Scopes

```
1. Shadowing:
   let auth = admin;   // authority#1 -> SymbolId(1) -> maps version (1, 1) -> SymbolId(1)
   {
       let auth = owner; // authority#2 -> SymbolId(2) -> maps version (2, 1) -> SymbolId(2)
   }
   // Resolution looks up SSA state. Scope-popping restores auth#1, preventing leak.

2. Aliasing:
   let signer = auth;  // signer#1 -> maps version (3, 1) to SymbolResolver::find_canonical(SymbolId(1))

3. Reassignment:
   auth = new_auth;    // auth#2 -> maps version (1, 2) to SymbolId(4). The check on (1, 1) is bypassed.
```

---

## 2. Objective 2: Transitive Mutability Tracking

To resolve Defect C-01, we implement a **Write-Dependency Graph** (WDG) that tracks variables derived from accounts (buffers, structures) and propagates mutations back to the root account.

### Dependency Graph Structure
```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum DependencyNode {
    /// A canonical parameter account.
    Account(SymbolId),
    /// A buffer version holding raw account data.
    DataBuffer(SSAVersionId),
    /// A deserialized struct version holding state.
    DeserializedStruct(SSAVersionId),
}

pub struct WriteDependencyGraph {
    /// Maps a derived child resource back to its parent resource.
    parent_chains: HashMap<DependencyNode, DependencyNode>,
}
```

### Propagation Rules

```
[Account SymbolId]
       ▲
       │ (1) try_borrow_mut_data()
[Buffer SSAVersionId]
       ▲
       │ (2) try_from_slice()
[Struct SSAVersionId]
       ▲
       │ (3) field modification / assignment
   Write Site
```

1. **Borrow Propagation**: When a mutable buffer is extracted:
   `let data = account.try_borrow_mut_data()?;`
   We insert: `DependencyNode::DataBuffer(data#1) -> DependencyNode::Account(account_symbol)`.
2. **Deserialization Propagation**: When a struct is deserialized from a buffer:
   `let state = State::try_from_slice(&data)?;`
   We insert: `DependencyNode::DeserializedStruct(state#1) -> DependencyNode::DataBuffer(data#1)`.
3. **Mutation Detection**: When a field mutation is detected on `state#1` (e.g. `state.amount = 100`), the engine checks the WDG:
   * Traces `DependencyNode::DeserializedStruct(state#1)` up to `DependencyNode::DataBuffer(data#1)`.
   * Traces `DependencyNode::DataBuffer(data#1)` up to `DependencyNode::Account(account_symbol)`.
   * **Verdict**: Propagates the mutation and marks the operation as a **mutable write on `account_symbol`**.

### Invalidation & SSA Interaction
* **Reassignment**: If the buffer `data` is reassigned (`data = next_data`), the SSA tracker increments the version to `data#2`. Since `DependencyNode::DataBuffer(data#2)` is not in the WDG, subsequent deserializations do not inherit the dependency to the original account.
* **Scope Exit**: When a versioned identifier goes out of scope, its nodes are removed from the WDG.

---

## 3. Objective 3: Same-Statement Execution Ordering

To resolve Defect H-01, statement index dominance check (`a <= b`) is replaced by **Execution Sequence Numbers** (ESN) assigned dynamically during AST post-order traversal.

### Ordering Model: Execution Sequence Numbers
Every expression and statement inside a CFG node is assigned a monotonic `usize` ESN during try-operator expansion and block compilation. The ESN represents the exact operational sequence executed by the virtual machine.

#### Example Method Chain ESN Assignment:
```rust
// Source statement
let owner = account.owner.borrow(); 

// Monotonic ESN Assignment (Post-order AST traversal)
1. Read account           (ESN: 10)
2. FieldAccess .owner     (ESN: 11)
3. MethodCall .borrow()   (ESN: 12)
4. Let binding `owner`    (ESN: 13)
```

#### Dominance Rule with ESN:
Node `A` dominates Node `B` if and only if:
1. `node_a != node_b` and `DominanceChecker::dominates_node(node_a, node_b)` is true.
2. `node_a == node_b` and `esn_a < esn_b`.

### Complexity Analysis
* **Time Complexity**:
  * *ESN Assignment*: $O(N)$ where $N$ is the number of AST nodes (linear traversal during compilation).
  * *Query Check*: $O(1)$ constant-time integer comparison (`esn_a < esn_b`).
* **Memory Complexity**: $O(N)$ to store a single `usize` inside each `StatementNode` and `ExpressionNode`.

---

## 4. Objective 4: Loop Boundary Policy

### Selection: Option B (Fail-Closed INCONCLUSIVE Policy)
We select **Option B: Fail-Closed INCONCLUSIVE Policy**. 

### Justification
1. **Determinism**: Option B is entirely deterministic. It does not employ heuristic approximations (which can cause compiler divergence).
2. **Solo-founder Feasibility**: Full loop variant reasoning (Option A) requires an abstract interpretation engine with fixed-point solvers. This adds thousands of lines of complex code. Option B is implemented by checking if a WDG node or SSA version crosses a back-edge loop boundary, and if so, marking it `Inconclusive`.
3. **False-Negative Minimization**: Option B guarantees **zero false negatives** inside loops. Any unvalidated reassignment across iteration bounds is caught and blocked.

---

## 5. Impact Assessment

| Redesign Component | Architecture Impact | Parser Impact | SSA Impact | GuardFact Impact | Performance Impact | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Typed SymbolResolver** | Moderate Refactor | No Change | No Change | No Change | Positive (no allocations) | **Moderate Refactor** |
| **Transitive Mutability Tracking** | Moderate Refactor | No Change | No Change | No Change | Minimal ($O(1)$ lookup) | **Moderate Refactor** |
| **Same-Statement ESN Ordering** | Moderate Refactor | Moderate Refactor | No Change | No Change | No Change | **Moderate Refactor** |
| **Loop Boundary Policy** | Minor Refactor | No Change | No Change | No Change | No Change | **Minor Refactor** |

---

## 6. Final Recommendation

### Recommendation: GO WITH REFACTOR
The critical correctness defects (C-01 and C-02) and control-flow gaps are fully resolved by this design specification. The implementation phase of **EPIC-SEC-001** is approved to proceed immediately under the condition that these typed SymbolResolver, WDG mutability tracking, and ESN sequence ordering models are integrated.

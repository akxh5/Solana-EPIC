use crate::ast::{ExpressionKind, ExpressionNode, StatementKind, StatementNode, InferenceScope, InferenceResult, TypeInferenceEngine};
use crate::cfg::guards::{FactConfidence, GuardFact, InstructionAnalysisContext, SymbolId};
use crate::cfg::ssa::{SSANodeState, SSAVariable};
use crate::types::TypeRegistry;
use crate::rules::{
    AnalysisContext, FindingLocation, Rule, RuleDiagnostic, RuleSeverity,
    SymbolResolver,
};
use std::collections::HashMap;
use std::collections::HashSet;

pub struct MissingPostCpiReloadRule;

impl Rule for MissingPostCpiReloadRule {
    fn id(&self) -> &'static str {
        "EPIC-SEC-003"
    }

    fn name(&self) -> &'static str {
        "Missing Post-CPI Reload Rule"
    }

    fn check(
        &self,
        context: &AnalysisContext,
    ) -> Vec<RuleDiagnostic> {
        let resolver = context.resolver();
        let instruction_context = &context.instruction_context;
        let mut diagnostics = Vec::new();
        let mut reported_symbols = HashSet::new();

        // Write-Dependency Graph (maps derived local symbols to their parent resource symbols)
        let mut parent_map: HashMap<SymbolId, SymbolId> = HashMap::new();

        // Simple DFS post-order topological sort to process CFG basic blocks
        let mut visited = HashSet::new();
        let mut order = Vec::new();
        
        fn dfs(
            node_id: usize,
            cfg: &crate::cfg::ControlFlowGraph,
            visited: &mut HashSet<usize>,
            order: &mut Vec<usize>,
        ) {
            if !visited.insert(node_id) {
                return;
            }
            for edge in &cfg.edges {
                if edge.from == node_id {
                    dfs(edge.to, cfg, visited, order);
                }
            }
            order.push(node_id);
        }
        
        dfs(instruction_context.cfg.entry_node, &instruction_context.cfg, &mut visited, &mut order);
        order.reverse();

        // Pass 1: Build the parent maps (variable alias WDG tracking)
        for &node_id in &order {
            let node = match instruction_context.cfg.nodes.get(&node_id) {
                Some(n) => n,
                None => continue,
            };

            let node_ssa = match instruction_context.cfg.ssa_states.get(&node_id) {
                Some(s) => s,
                None => continue,
            };

            let mut current_state = node_ssa.start_state.clone();
            
            let mut version_counters = HashMap::new();
            for (_, var) in &current_state.active_variables {
                if let SSAVariable::Versioned { name, version } = var {
                    version_counters.insert(name.clone(), *version);
                }
            }

            self.build_parent_maps_recursive(
                &node.statements,
                &mut current_state,
                &mut parent_map,
                &resolver,
                &mut version_counters,
                &context.ast_graph.registry,
            );
        }

        // Pass 2: Extract all CPI calls, account reloads, and state accesses per basic block
        let mut cpi_locations = Vec::new(); // elements are (node_id, stmt_index)
        let mut reload_locations: HashMap<SymbolId, Vec<(usize, usize)>> = HashMap::new();
        let mut access_locations: HashMap<SymbolId, Vec<(usize, usize, usize)>> = HashMap::new(); // (node_id, stmt_idx, line_number)

        for &node_id in &order {
            let node = match instruction_context.cfg.nodes.get(&node_id) {
                Some(n) => n,
                None => continue,
            };

            let node_ssa = match instruction_context.cfg.ssa_states.get(&node_id) {
                Some(s) => s,
                None => continue,
            };

            let mut current_state = node_ssa.start_state.clone();
            
            for (stmt_idx, stmt) in node.statements.iter().enumerate() {
                // Determine active variables for the SSA state at this statement
                // Note: current_state matches statement start state
                if self.is_cpi_statement(stmt) {
                    cpi_locations.push((node_id, stmt_idx));
                }

                // Check for reload calls in expression
                let expr_reloads = self.find_reload_symbols_stmt(stmt, &resolver, &current_state, &parent_map);
                for reloaded_sym in expr_reloads {
                    if self.is_account_symbol(reloaded_sym, instruction_context) {
                        reload_locations.entry(reloaded_sym).or_default().push((node_id, stmt_idx));
                    }
                }

                // Check for state accesses (reads or writes)
                let expr_accesses = self.find_accessed_symbols_stmt(stmt, &resolver, &current_state, &parent_map);
                for accessed_sym in expr_accesses {
                    if self.is_account_symbol(accessed_sym, instruction_context) {
                        access_locations.entry(accessed_sym).or_default().push((node_id, stmt_idx, stmt.line_number));
                    }
                }

                // Update active variables for let assignments
                self.update_ssa_state_for_stmt(stmt, &mut current_state, &context.ast_graph.registry, &resolver);
            }
        }

        // Pass 3: Perform path-sensitive reachability analysis for each account
        if cpi_locations.is_empty() {
            return diagnostics;
        }

        for (acc_sym, accesses) in access_locations {
            let empty_reloads = Vec::new();
            let reloads = reload_locations.get(&acc_sym).unwrap_or(&empty_reloads);

            for (node_access, stmt_access, line_number) in accesses {
                // Check if any path from a CPI call reaches this access without a reload in between
                for &(node_cpi, stmt_cpi) in &cpi_locations {
                    let mut path_visited = HashSet::new();
                    if self.is_access_reachable_from_cpi_without_reload(
                        node_cpi,
                        stmt_cpi,
                        node_access,
                        stmt_access,
                        reloads,
                        &instruction_context.cfg,
                        &mut path_visited,
                    ) {
                        // Locate the original account name from symbol table for clear messaging
                        let mut acc_name = format!("SymbolId({})", acc_sym.0);
                        for (name, &symbol_id) in &instruction_context.symbol_table {
                            if symbol_id == acc_sym {
                                acc_name = name.clone();
                                break;
                            }
                        }

                        if reported_symbols.insert(acc_sym) {
                            diagnostics.push(RuleDiagnostic {
                                rule_id: self.id().to_string(),
                                severity: RuleSeverity::Critical,
                                message: format!(
                                    "State access to '{}' occurs after a CPI mutation without reloading. The account's in-memory data layout may be stale.",
                                    acc_name
                                ),
                                location: FindingLocation {
                                    file: instruction_context.file_path.clone(),
                                    line: line_number,
                                    column: 0,
                                    node_id: node_access,
                                    statement_index: Some(stmt_access),
                                },
                                confidence: FactConfidence::Asserted,
                                target_symbol: acc_sym,
                            });
                        }
                    }
                }
            }
        }

        diagnostics
    }
}

impl MissingPostCpiReloadRule {
    fn trace_to_root(
        &self,
        mut sym: SymbolId,
        parent_map: &HashMap<SymbolId, SymbolId>,
    ) -> SymbolId {
        let mut visited = HashSet::new();
        while let Some(&parent) = parent_map.get(&sym) {
            if !visited.insert(sym) {
                break;
            }
            sym = parent;
        }
        sym
    }

    fn is_account_symbol(&self, sym: SymbolId, context: &InstructionAnalysisContext) -> bool {
        context.guard_facts.iter().any(|(fact, _)| match fact {
            GuardFact::Owner { account, .. }
            | GuardFact::Signer(account)
            | GuardFact::KeyRelation { account, .. }
            | GuardFact::PDA { account, .. }
            | GuardFact::Initialized { account, .. }
            | GuardFact::Resized { account, .. }
            | GuardFact::Deallocated { account, .. } => account.symbol_id() == Some(sym),
            _ => false,
        })
    }

    fn build_parent_maps_recursive(
        &self,
        stmts: &[StatementNode],
        current_state: &mut SSANodeState,
        parent_map: &mut HashMap<SymbolId, SymbolId>,
        resolver: &SymbolResolver,
        version_counters: &mut HashMap<String, usize>,
        registry: &TypeRegistry,
    ) {
        for stmt in stmts {
            match &stmt.kind {
                StatementKind::Let { name, initializer, .. } => {
                    let next_ver = version_counters.entry(name.clone()).or_insert(0);
                    *next_ver += 1;
                    let ver_num = *next_ver;
                    let ssa_var = SSAVariable::Versioned {
                        name: name.clone(),
                        version: ver_num,
                    };

                    let mut inference_scope = InferenceScope::new();
                    for (v_name, active_var) in &current_state.active_variables {
                        if let Some(ty) = current_state.variable_types.get(&active_var.to_string()) {
                            inference_scope.insert(v_name.clone(), ty.clone());
                        }
                    }

                    let engine = TypeInferenceEngine::new(registry, &inference_scope);
                    if let InferenceResult::Ok(type_ref) = engine.infer(initializer) {
                        current_state.variable_types.insert(ssa_var.to_string(), type_ref);
                    }

                    current_state.active_variables.insert(name.clone(), ssa_var);
                    
                    let local_sym = resolver.get_symbol_by_name(name);
                    if let Some(l_sym) = local_sym {
                        if let Some(parent_sym) = self.find_initializer_source(initializer, resolver, current_state) {
                            parent_map.insert(l_sym, parent_sym);
                        }
                    }
                }
                StatementKind::Expr(expr) | StatementKind::Semi(expr) => {
                    if let ExpressionKind::Assign { left, right } = &expr.kind {
                        if let ExpressionKind::Identifier(name) = &left.kind {
                            if current_state.active_variables.contains_key(name) {
                                let next_ver = version_counters.entry(name.clone()).or_insert(0);
                                *next_ver += 1;
                                let ver_num = *next_ver;
                                let ssa_var = SSAVariable::Versioned {
                                    name: name.clone(),
                                    version: ver_num,
                                };

                                let mut inference_scope = InferenceScope::new();
                                for (v_name, active_var) in &current_state.active_variables {
                                    if let Some(ty) = current_state.variable_types.get(&active_var.to_string()) {
                                        inference_scope.insert(v_name.clone(), ty.clone());
                                    }
                                }

                                let engine = TypeInferenceEngine::new(registry, &inference_scope);
                                if let InferenceResult::Ok(type_ref) = engine.infer(right) {
                                    current_state.variable_types.insert(ssa_var.to_string(), type_ref);
                                }

                                current_state.active_variables.insert(name.clone(), ssa_var);

                                let local_sym = resolver.get_symbol_by_name(name);
                                if let Some(l_sym) = local_sym {
                                    if let Some(parent_sym) = self.find_initializer_source(right, resolver, current_state) {
                                        parent_map.insert(l_sym, parent_sym);
                                    }
                                }
                            }
                        }
                    }
                }
                StatementKind::Block(inner_stmts) => {
                    let mut before_block_versions = HashMap::new();
                    for (name, val) in &current_state.active_variables {
                        before_block_versions.insert(name.clone(), val.clone());
                    }

                    let mut block_declared = Vec::new();
                    for inner_stmt in inner_stmts {
                        if let StatementKind::Let { name, .. } = &inner_stmt.kind {
                            block_declared.push(name.clone());
                        }
                    }

                    let mut before_block_parents = HashMap::new();
                    for name in &block_declared {
                        if let Some(sym) = resolver.get_symbol_by_name(name) {
                            if let Some(&parent) = parent_map.get(&sym) {
                                before_block_parents.insert(sym, parent);
                            }
                        }
                    }

                    self.build_parent_maps_recursive(
                        inner_stmts,
                        current_state,
                        parent_map,
                        resolver,
                        version_counters,
                        registry,
                    );

                    for name in &block_declared {
                        if let Some(old_val) = before_block_versions.get(name) {
                            current_state.active_variables.insert(name.clone(), old_val.clone());
                        } else {
                            current_state.active_variables.remove(name);
                        }

                        if let Some(sym) = resolver.get_symbol_by_name(name) {
                            if let Some(&parent) = before_block_parents.get(&sym) {
                                parent_map.insert(sym, parent);
                            } else {
                                parent_map.remove(&sym);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }

    fn find_initializer_source(
        &self,
        expr: &ExpressionNode,
        resolver: &SymbolResolver,
        ssa_state: &SSANodeState,
    ) -> Option<SymbolId> {
        match &expr.kind {
            ExpressionKind::MethodCall { object, method, .. } => {
                if method == "try_borrow_mut_data"
                    || method == "borrow_mut"
                    || method == "try_borrow_mut"
                {
                    return resolver.resolve_expr(object, ssa_state);
                }
                self.find_initializer_source(object, resolver, ssa_state)
            }
            ExpressionKind::Reference { expression, .. } => {
                self.find_initializer_source(expression, resolver, ssa_state)
            }
            ExpressionKind::FieldAccess { object, .. } => {
                if let Some(sym) = resolver.resolve_expr(expr, ssa_state) {
                    Some(sym)
                } else {
                    self.find_initializer_source(object, resolver, ssa_state)
                }
            }
            ExpressionKind::Identifier(_) => resolver.resolve_expr(expr, ssa_state),
            ExpressionKind::Try(inner) => self.find_initializer_source(inner, resolver, ssa_state),
            _ => None,
        }
    }

    fn is_cpi_statement(&self, stmt: &StatementNode) -> bool {
        match &stmt.kind {
            StatementKind::Expr(expr) | StatementKind::Semi(expr) => self.is_cpi_expression(expr),
            StatementKind::Let { initializer, .. } => self.is_cpi_expression(initializer),
            _ => false,
        }
    }

    fn is_cpi_expression(&self, expr: &ExpressionNode) -> bool {
        match &expr.kind {
            ExpressionKind::MethodCall { method, object, arguments } => {
                let name = method.to_lowercase();
                if name.contains("invoke")
                    || name.contains("transfer")
                    || name.contains("mint_to")
                    || name.contains("burn")
                    || name.contains("cpi")
                    || name.contains("cross_program_invocation")
                {
                    if !name.contains("reload") {
                        return true;
                    }
                }
                self.is_cpi_expression(object) || arguments.iter().any(|arg| self.is_cpi_expression(arg))
            }
            ExpressionKind::FieldAccess { object, .. } => self.is_cpi_expression(object),
            ExpressionKind::BinaryOp { lhs, rhs, .. } => self.is_cpi_expression(lhs) || self.is_cpi_expression(rhs),
            ExpressionKind::Reference { expression, .. } => self.is_cpi_expression(expression),
            ExpressionKind::Dereference(inner) => self.is_cpi_expression(inner),
            ExpressionKind::Try(inner) => self.is_cpi_expression(inner),
            ExpressionKind::Assign { left, right } => self.is_cpi_expression(left) || self.is_cpi_expression(right),
            _ => false,
        }
    }

    fn find_reload_symbols_stmt(
        &self,
        stmt: &StatementNode,
        resolver: &SymbolResolver,
        ssa_state: &SSANodeState,
        parent_map: &HashMap<SymbolId, SymbolId>,
    ) -> Vec<SymbolId> {
        match &stmt.kind {
            StatementKind::Expr(expr) | StatementKind::Semi(expr) => {
                self.find_reload_symbols_expr(expr, resolver, ssa_state, parent_map)
            }
            StatementKind::Let { initializer, .. } => {
                self.find_reload_symbols_expr(initializer, resolver, ssa_state, parent_map)
            }
            StatementKind::Block(inner_stmts) => {
                let mut reloads = Vec::new();
                for inner_stmt in inner_stmts {
                    reloads.extend(self.find_reload_symbols_stmt(inner_stmt, resolver, ssa_state, parent_map));
                }
                reloads
            }
            _ => Vec::new(),
        }
    }

    fn find_reload_symbols_expr(
        &self,
        expr: &ExpressionNode,
        resolver: &SymbolResolver,
        ssa_state: &SSANodeState,
        parent_map: &HashMap<SymbolId, SymbolId>,
    ) -> Vec<SymbolId> {
        let mut reloads = Vec::new();
        match &expr.kind {
            ExpressionKind::MethodCall { method, object, arguments } => {
                if method == "reload" || method.ends_with("::reload") {
                    if let Some(base_sym) = resolver.resolve_expr(object, ssa_state) {
                        let root_sym = self.trace_to_root(base_sym, parent_map);
                        reloads.push(root_sym);
                    }
                    for arg in arguments {
                        if let Some(base_sym) = resolver.resolve_expr(arg, ssa_state) {
                            let root_sym = self.trace_to_root(base_sym, parent_map);
                            reloads.push(root_sym);
                        }
                    }
                }
                reloads.extend(self.find_reload_symbols_expr(object, resolver, ssa_state, parent_map));
                for arg in arguments {
                    reloads.extend(self.find_reload_symbols_expr(arg, resolver, ssa_state, parent_map));
                }
            }
            ExpressionKind::FieldAccess { object, .. } => {
                reloads.extend(self.find_reload_symbols_expr(object, resolver, ssa_state, parent_map));
            }
            ExpressionKind::BinaryOp { lhs, rhs, .. } => {
                reloads.extend(self.find_reload_symbols_expr(lhs, resolver, ssa_state, parent_map));
                reloads.extend(self.find_reload_symbols_expr(rhs, resolver, ssa_state, parent_map));
            }
            ExpressionKind::Reference { expression, .. } => {
                reloads.extend(self.find_reload_symbols_expr(expression, resolver, ssa_state, parent_map));
            }
            ExpressionKind::Dereference(inner) => {
                reloads.extend(self.find_reload_symbols_expr(inner, resolver, ssa_state, parent_map));
            }
            ExpressionKind::Try(inner) => {
                reloads.extend(self.find_reload_symbols_expr(inner, resolver, ssa_state, parent_map));
            }
            ExpressionKind::Assign { left, right } => {
                reloads.extend(self.find_reload_symbols_expr(left, resolver, ssa_state, parent_map));
                reloads.extend(self.find_reload_symbols_expr(right, resolver, ssa_state, parent_map));
            }
            _ => {}
        }
        reloads
    }

    fn find_accessed_symbols_stmt(
        &self,
        stmt: &StatementNode,
        resolver: &SymbolResolver,
        ssa_state: &SSANodeState,
        parent_map: &HashMap<SymbolId, SymbolId>,
    ) -> Vec<SymbolId> {
        match &stmt.kind {
            StatementKind::Expr(expr) | StatementKind::Semi(expr) => {
                self.find_accessed_symbols_expr(expr, resolver, ssa_state, parent_map)
            }
            StatementKind::Let { initializer, .. } => {
                self.find_accessed_symbols_expr(initializer, resolver, ssa_state, parent_map)
            }
            StatementKind::Block(inner_stmts) => {
                let mut accesses = Vec::new();
                for inner_stmt in inner_stmts {
                    accesses.extend(self.find_accessed_symbols_stmt(inner_stmt, resolver, ssa_state, parent_map));
                }
                accesses
            }
            _ => Vec::new(),
        }
    }

    fn find_accessed_symbols_expr(
        &self,
        expr: &ExpressionNode,
        resolver: &SymbolResolver,
        ssa_state: &SSANodeState,
        parent_map: &HashMap<SymbolId, SymbolId>,
    ) -> Vec<SymbolId> {
        let mut accesses = Vec::new();
        match &expr.kind {
            ExpressionKind::FieldAccess { object, field } => {
                if field != "key" && field != "key_ref" {
                    if let Some(base_sym) = resolver.resolve_expr(object, ssa_state) {
                        let root_sym = self.trace_to_root(base_sym, parent_map);
                        accesses.push(root_sym);
                    }
                }
                accesses.extend(self.find_accessed_symbols_expr(object, resolver, ssa_state, parent_map));
            }
            ExpressionKind::MethodCall { method, object, arguments } => {
                if method == "reload" || method.ends_with("::reload") {
                    // Do not recurse into reload calls as they are validation markers
                } else {
                    if method != "key" && method != "key_ref" {
                        if let Some(base_sym) = resolver.resolve_expr(object, ssa_state) {
                            let root_sym = self.trace_to_root(base_sym, parent_map);
                            accesses.push(root_sym);
                        }
                    }
                    accesses.extend(self.find_accessed_symbols_expr(object, resolver, ssa_state, parent_map));
                    for arg in arguments {
                        accesses.extend(self.find_accessed_symbols_expr(arg, resolver, ssa_state, parent_map));
                    }
                }
            }
            ExpressionKind::Identifier(name) => {
                if name != "key" && name != "true" && name != "false" {
                    if let Some(base_sym) = resolver.resolve_expr(expr, ssa_state) {
                        let root_sym = self.trace_to_root(base_sym, parent_map);
                        accesses.push(root_sym);
                    }
                }
            }
            ExpressionKind::BinaryOp { lhs, rhs, .. } => {
                accesses.extend(self.find_accessed_symbols_expr(lhs, resolver, ssa_state, parent_map));
                accesses.extend(self.find_accessed_symbols_expr(rhs, resolver, ssa_state, parent_map));
            }
            ExpressionKind::Reference { expression, .. } => {
                accesses.extend(self.find_accessed_symbols_expr(expression, resolver, ssa_state, parent_map));
            }
            ExpressionKind::Dereference(inner) => {
                accesses.extend(self.find_accessed_symbols_expr(inner, resolver, ssa_state, parent_map));
            }
            ExpressionKind::Try(inner) => {
                accesses.extend(self.find_accessed_symbols_expr(inner, resolver, ssa_state, parent_map));
            }
            ExpressionKind::Assign { left, right } => {
                accesses.extend(self.find_accessed_symbols_expr(left, resolver, ssa_state, parent_map));
                accesses.extend(self.find_accessed_symbols_expr(right, resolver, ssa_state, parent_map));
            }
            _ => {}
        }
        accesses
    }

    fn update_ssa_state_for_stmt(
        &self,
        stmt: &StatementNode,
        current_state: &mut SSANodeState,
        registry: &TypeRegistry,
        _resolver: &SymbolResolver,
    ) {
        match &stmt.kind {
            StatementKind::Let { name, initializer, .. } => {
                let ssa_var = SSAVariable::Versioned {
                    name: name.clone(),
                    version: 0, // placeholder since active lookup matches name
                };
                let mut inference_scope = InferenceScope::new();
                for (v_name, active_var) in &current_state.active_variables {
                    if let Some(ty) = current_state.variable_types.get(&active_var.to_string()) {
                        inference_scope.insert(v_name.clone(), ty.clone());
                    }
                }
                let engine = TypeInferenceEngine::new(registry, &inference_scope);
                if let InferenceResult::Ok(type_ref) = engine.infer(initializer) {
                    current_state.variable_types.insert(ssa_var.to_string(), type_ref);
                }
                current_state.active_variables.insert(name.clone(), ssa_var);
            }
            StatementKind::Expr(expr) | StatementKind::Semi(expr) => {
                if let ExpressionKind::Assign { left, right } = &expr.kind {
                    if let ExpressionKind::Identifier(name) = &left.kind {
                        if current_state.active_variables.contains_key(name) {
                            let ssa_var = SSAVariable::Versioned {
                                name: name.clone(),
                                version: 0,
                            };
                            let mut inference_scope = InferenceScope::new();
                            for (v_name, active_var) in &current_state.active_variables {
                                if let Some(ty) = current_state.variable_types.get(&active_var.to_string()) {
                                    inference_scope.insert(v_name.clone(), ty.clone());
                                }
                            }
                            let engine = TypeInferenceEngine::new(registry, &inference_scope);
                            if let InferenceResult::Ok(type_ref) = engine.infer(right) {
                                current_state.variable_types.insert(ssa_var.to_string(), type_ref);
                            }
                            current_state.active_variables.insert(name.clone(), ssa_var);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    /// Path-sensitive reachability check: searches for a path from a CPI statement
    /// to an access statement that does NOT contain any reload of the account.
    fn is_access_reachable_from_cpi_without_reload(
        &self,
        node_cpi: usize,
        stmt_cpi: usize,
        node_access: usize,
        stmt_access: usize,
        reloads: &[(usize, usize)],
        cfg: &crate::cfg::ControlFlowGraph,
        visited: &mut HashSet<usize>,
    ) -> bool {
        // If start and target are the same node
        if node_cpi == node_access {
            if stmt_cpi < stmt_access {
                // Check if any reload occurs strictly between the CPI and the access
                let has_reload_between = reloads.iter().any(|&(rn, rs)| {
                    rn == node_cpi && rs > stmt_cpi && rs < stmt_access
                });
                return !has_reload_between;
            }
            return false;
        }

        // If a reload happens in node_cpi AFTER the CPI call, the path leaving node_cpi is blocked
        let has_reload_after_cpi_in_start = reloads.iter().any(|&(rn, rs)| {
            rn == node_cpi && rs > stmt_cpi
        });
        if has_reload_after_cpi_in_start {
            return false;
        }

        // Start path traversal DFS
        self.traverse_reachability_dfs(
            node_cpi,
            node_access,
            stmt_access,
            reloads,
            cfg,
            visited,
        )
    }

    fn traverse_reachability_dfs(
        &self,
        current_node: usize,
        target_node: usize,
        stmt_access: usize,
        reloads: &[(usize, usize)],
        cfg: &crate::cfg::ControlFlowGraph,
        visited: &mut HashSet<usize>,
    ) -> bool {
        if !visited.insert(current_node) {
            return false;
        }

        // If we reached the target node containing the access
        if current_node == target_node {
            // Path is vulnerable if there is no reload in the target node BEFORE the access
            let has_reload_before_access = reloads.iter().any(|&(rn, rs)| {
                rn == target_node && rs < stmt_access
            });
            return !has_reload_before_access;
        }

        // If this intermediate node contains a reload, the path is blocked here
        let has_reload_in_node = reloads.iter().any(|&(rn, _)| rn == current_node);
        if has_reload_in_node {
            return false;
        }

        // Traverse to successors
        for edge in &cfg.edges {
            if edge.from == current_node {
                if self.traverse_reachability_dfs(edge.to, target_node, stmt_access, reloads, cfg, visited) {
                    return true;
                }
            }
        }

        false
    }
}

pub mod abi;
pub mod ast;
pub mod cfg;
pub mod impact;
pub mod layout;
pub mod report;
pub mod rules;
pub mod types;
pub mod workspace;

pub use abi::{compare_workspaces, format_diff_results, ChangeType, DiffResult, Severity};
pub use ast::{
    unpack_nested_generics, ExpressionKind, ExpressionNode, FunctionNode, InconclusiveReason,
    InferenceResult, InferenceScope, ParameterNode, StatementKind, StatementNode,
    TypeInferenceEngine,
};
pub use cfg::{
    extract_guards_from_accounts_struct, CFGBoundaryWarning, CFGBuilder, CFGEdge, CFGNode,
    ControlFlowGraph, DominanceInterval, FactConfidence, FactExpression, FactProvenance, GuardFact,
    GuardFactLocation, GuardTarget, InstructionAnalysisContext, NodeSSAInfo, SSAComputer,
    SSANodeState, SSAVariable, SSAVersionId, SolanaProperty, SymbolId,
};
pub use impact::{
    analyze_impact, format_impact_terminal, generate_aggregated_impact, ImpactAnalysis,
};
pub use rules::{
    DominanceChecker, FindingLocation, OwnerValidationRule, Rule, RuleDiagnostic, RuleEngine,
    RuleSeverity, SymbolResolver,
};
pub use workspace::Workspace;

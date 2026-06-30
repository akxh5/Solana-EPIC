export type {
  DiffFinding,
  DiffFindingKind,
  DiffReport,
  FieldChange,
  Severity
} from "./compare.js";
export type {
  AffectedSurface,
  RiskCategory,
  UpgradeIntelligenceItem,
  UpgradeIntelligenceReport
} from "./intelligence.js";
export { analyzePrograms, compareAccountLayouts, compareAnchorPrograms } from "./compare.js";
export { resolveFindingsWithConfig, findProgramName } from "./resolve.js";
export { classifyFindings, highestSeverity } from "./classify.js";
export { createUpgradeIntelligence, createUpgradeIntelligenceItem } from "./intelligence.js";
export { formatHumanReport, recommendationForFinding, riskForFinding } from "./report.js";
export type {
  AccountCompatibility,
  AffectedOffsetRange,
  ByteReasoning,
  Certainty,
  CompatibilityReport,
  CompatibilityStatus,
  FieldOffset
} from "./compatibility.js";
export { simulateCompatibility } from "./compatibility.js";

import * as path from "path";
import { 
  analyzePrograms, 
  compareAccountLayouts, 
  simulateCompatibility,
  createUpgradeIntelligence,
  CompatibilityReport,
  DiffReport
} from "@solana-epic/diff-engine";
import { config } from "@solana-epic/parser";

export interface UpgradeReport {
  programName: string;
  compatibility: CompatibilityReport;
  report: DiffReport;
  intelligence: any;
  epicConfig: config.ResolvedEpicConfig;
}

export async function runCheck(oldPath: string, newPath: string, epicConfig: config.ResolvedEpicConfig): Promise<UpgradeReport> {
  const resolvedOldPath = path.resolve(oldPath);
  const resolvedNewPath = path.resolve(newPath);

  const { oldProgram, newProgram } = await analyzePrograms(resolvedOldPath, resolvedNewPath, epicConfig);
  const compatibility = simulateCompatibility(oldProgram, newProgram, epicConfig);
  const report = compareAccountLayouts(oldProgram, newProgram, epicConfig);
  const intelligence = createUpgradeIntelligence(report);
  const programName = compatibility.accounts[0]?.account || report.findings[0]?.account || path.basename(resolvedNewPath);

  return {
    programName,
    compatibility,
    report,
    intelligence,
    epicConfig
  };
}

export { formatMarkdown, formatSarif } from "./formatters.js";

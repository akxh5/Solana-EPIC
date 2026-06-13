import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AccountStruct, AnalyzeResult } from "./index.js";
import { parseAccountStructs } from "./rust.js";

const RUST_EXTENSION = ".rs";

export async function analyzeAnchorProject(projectPath: string): Promise<AnalyzeResult> {
  const resolvedProjectPath = path.resolve(projectPath);
  const rustFiles = await findRustFiles(resolvedProjectPath);
  const accounts: AccountStruct[] = [];

  for (const filePath of rustFiles) {
    const source = await readFile(filePath, "utf8");
    accounts.push(...parseAccountStructs(source, filePath));
  }

  return {
    projectPath: resolvedProjectPath,
    accounts: accounts.sort((left, right) => {
      if (left.filePath === right.filePath) {
        return left.name.localeCompare(right.name);
      }

      return left.filePath.localeCompare(right.filePath);
    })
  };
}

async function findRustFiles(rootPath: string): Promise<string[]> {
  const rootStats = await stat(rootPath);

  if (rootStats.isFile()) {
    return path.extname(rootPath) === RUST_EXTENSION ? [rootPath] : [];
  }

  const files: string[] = [];
  await walk(rootPath, files);
  return files;
}

async function walk(currentPath: string, files: string[]): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "target" || entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }

    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      await walk(entryPath, files);
      continue;
    }

    if (entry.isFile() && path.extname(entry.name) === RUST_EXTENSION) {
      files.push(entryPath);
    }
  }
}

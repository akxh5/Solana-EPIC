#!/usr/bin/env node
import { Command } from "commander";
import { analyzeAnchorProject } from "@epic/parser";

const program = new Command();

program
  .name("epic")
  .description("EPIC CLI foundation for analyzing Anchor projects.")
  .version("0.1.0");

program
  .command("analyze")
  .description("Analyze an Anchor project and report #[account] struct sizes.")
  .argument("<path>", "Path to an Anchor project, Rust source directory, or Rust file")
  .action(async (targetPath: string) => {
    try {
      const result = await analyzeAnchorProject(targetPath);

      if (result.accounts.length === 0) {
        console.log("No #[account] structs found.");
        return;
      }

      for (const account of result.accounts) {
        console.log(`${account.name}: ${account.byteSize} bytes`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`epic analyze failed: ${message}`);
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);

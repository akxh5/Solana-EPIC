import os

files_to_modify = [
    "packages/cli-win32-x64/package.json",
    "packages/cli-darwin-arm64/package.json",
    "packages/cli-darwin-x64/package.json",
    "packages/cli-linux-x64/package.json",
    "packages/parser/package.json",
    "packages/diff-engine/package.json",
    "packages/cli/package.json",
    "packages/github-action/package.json",
    "packages/cli/src/loader.ts",
    "packages/cli/src/index.ts",
    "packages/diff-engine/src/compare.ts",
    "packages/diff-engine/src/resolve.ts",
    "packages/github-action/src/index.ts",
    "packages/github-action/src/report.ts",
    "packages/diff-engine/test/verification.test.mjs",
    "scripts/publish.sh",
    "scripts/test-local-install.mjs"
]

root_dir = "/Users/aksh/Documents/Solana EPIC"
old_scope = "@epic/"
new_scope = "@epic-security/"

print(f"Starting scope migration from '{old_scope}' to '{new_scope}'...")

for rel_path in files_to_modify:
    abs_path = os.path.join(root_dir, rel_path)
    if not os.path.exists(abs_path):
        print(f"Skipping (not found): {rel_path}")
        continue
    
    with open(abs_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    if old_scope in content:
        new_content = content.replace(old_scope, new_scope)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated: {rel_path}")
    else:
        print(f"Already updated or no match: {rel_path}")

print("Migration completed successfully.")

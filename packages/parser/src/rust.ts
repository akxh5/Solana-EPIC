import type { AccountField, AccountStruct } from "./index.js";
import { sizeOfRustType } from "./sizes.js";

const ACCOUNT_DISCRIMINATOR_BYTES = 8;

type StructBlock = {
  name: string;
  body: string;
  endIndex: number;
};

export function parseAccountStructs(source: string, filePath: string): AccountStruct[] {
  const cleanSource = stripRustComments(source);
  const accountStructs: AccountStruct[] = [];
  let searchIndex = 0;

  while (searchIndex < cleanSource.length) {
    const accountAttributeIndex = cleanSource.indexOf("#[account", searchIndex);

    if (accountAttributeIndex === -1) {
      break;
    }

    const structBlock = findNextStructBlock(cleanSource, accountAttributeIndex);

    if (!structBlock) {
      searchIndex = accountAttributeIndex + "#[account".length;
      continue;
    }

    const fields = parseNamedFields(structBlock.body);
    const fieldBytes = fields.reduce((sum, field) => sum + (field.byteSize ?? 0), 0);

    accountStructs.push({
      name: structBlock.name,
      byteSize: ACCOUNT_DISCRIMINATOR_BYTES + fieldBytes,
      byteSizeIncludesDiscriminator: true,
      fields,
      filePath
    });

    searchIndex = structBlock.endIndex + 1;
  }

  return accountStructs;
}

function findNextStructBlock(source: string, fromIndex: number): StructBlock | null {
  const structMatch = /\b(?:pub\s+)?struct\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
  structMatch.lastIndex = fromIndex;
  const match = structMatch.exec(source);

  if (!match || match.index === undefined) {
    return null;
  }

  const bodyStart = source.indexOf("{", match.index);
  const bodyEnd = findMatchingBrace(source, bodyStart);

  if (bodyStart === -1 || bodyEnd === -1) {
    return null;
  }

  return {
    name: match[1],
    body: source.slice(bodyStart + 1, bodyEnd),
    endIndex: bodyEnd
  };
}

function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 0;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    const character = source[index];

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function parseNamedFields(body: string): AccountField[] {
  const fields: AccountField[] = [];

  for (const fieldSource of splitTopLevel(body, ",")) {
    const withoutAttributes = fieldSource
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#["))
      .join("\n")
      .trim();

    if (!withoutAttributes) {
      continue;
    }

    const fieldMatch = /^(?:pub(?:\([^)]+\))?\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/.exec(withoutAttributes);

    if (!fieldMatch) {
      continue;
    }

    const type = normalizeRustType(fieldMatch[2]);
    const sized = sizeOfRustType(type);

    fields.push({
      name: fieldMatch[1],
      type,
      byteSize: sized.byteSize,
      ...(sized.note ? { note: sized.note } : {})
    });
  }

  return fields;
}

function splitTopLevel(source: string, delimiter: string): string[] {
  const parts: string[] = [];
  let startIndex = 0;
  let angleDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === "<") {
      angleDepth += 1;
    } else if (character === ">") {
      angleDepth = Math.max(0, angleDepth - 1);
    } else if (character === "[") {
      bracketDepth += 1;
    } else if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (character === "(") {
      parenDepth += 1;
    } else if (character === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
    } else if (
      character === delimiter &&
      angleDepth === 0 &&
      bracketDepth === 0 &&
      parenDepth === 0
    ) {
      parts.push(source.slice(startIndex, index));
      startIndex = index + 1;
    }
  }

  parts.push(source.slice(startIndex));
  return parts;
}

function normalizeRustType(type: string): string {
  return type.replace(/\s+/g, " ").trim();
}

function stripRustComments(source: string): string {
  let output = "";
  let index = 0;

  while (index < source.length) {
    if (source[index] === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (source[index] === "/" && source[index + 1] === "*") {
      index += 2;
      let depth = 1;

      while (index < source.length && depth > 0) {
        if (source[index] === "/" && source[index + 1] === "*") {
          depth += 1;
          index += 2;
        } else if (source[index] === "*" && source[index + 1] === "/") {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      continue;
    }

    output += source[index];
    index += 1;
  }

  return output;
}

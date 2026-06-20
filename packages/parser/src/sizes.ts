type SizedType = {
  byteSize: number | null;
  dynamic: boolean;
  note?: string;
};

const PRIMITIVE_SIZES = new Map<string, number>([
  ["bool", 1],
  ["u8", 1],
  ["i8", 1],
  ["u16", 2],
  ["i16", 2],
  ["u32", 4],
  ["i32", 4],
  ["f32", 4],
  ["u64", 8],
  ["i64", 8],
  ["f64", 8],
  ["u128", 16],
  ["i128", 16],
  ["Pubkey", 32],
  ["publicKey", 32]
]);

export function sizeOfRustType(
  type: string,
  typesRegistry?: Map<string, any>,
  resolving: Set<string> = new Set()
): SizedType {
  const normalizedType = unwrapWhitespace(type);
  const primitiveSize = PRIMITIVE_SIZES.get(normalizedType);

  if (primitiveSize !== undefined) {
    return { byteSize: primitiveSize, dynamic: false };
  }

  // Handle custom types from the registry
  if (typesRegistry && typesRegistry.has(normalizedType)) {
    return resolveStructSize(normalizedType, typesRegistry, resolving);
  }

  const array = parseArrayType(normalizedType);

  if (array) {
    const inner = sizeOfRustType(array.innerType, typesRegistry, resolving);
    return inner.byteSize === null
      ? { byteSize: null, dynamic: inner.dynamic, note: `unsupported array element type: ${array.innerType}` }
      : {
          byteSize: inner.byteSize * array.length,
          dynamic: inner.dynamic,
          ...(inner.note ? { note: inner.note } : {})
        };
  }

  const optionInner = parseGenericType(normalizedType, "Option");

  if (optionInner) {
    const inner = sizeOfRustType(optionInner, typesRegistry, resolving);
    return inner.byteSize === null
      ? { byteSize: null, dynamic: inner.dynamic, note: `unsupported Option inner type: ${optionInner}` }
      : {
          byteSize: 1 + inner.byteSize,
          dynamic: inner.dynamic,
          ...(inner.note ? { note: inner.note } : {})
        };
  }

  const vecInner = parseGenericType(normalizedType, "Vec");

  if (vecInner) {
    return { byteSize: 4, dynamic: true, note: `Vec<${vecInner}> is dynamically sized; counted 4-byte length prefix only` };
  }

  if (normalizedType === "String") {
    return { byteSize: 4, dynamic: true, note: "String is dynamically sized; counted 4-byte length prefix only" };
  }

  const hashMapInner = parseGenericType(normalizedType, "HashMap");

  if (hashMapInner) {
    return { byteSize: 4, dynamic: true, note: `HashMap<${hashMapInner}> is dynamically sized; counted 4-byte length prefix only` };
  }

  const hashSetInner = parseGenericType(normalizedType, "HashSet");

  if (hashSetInner) {
    return { byteSize: 4, dynamic: true, note: `HashSet<${hashSetInner}> is dynamically sized; counted 4-byte length prefix only` };
  }

  const bTreeMapInner = parseGenericType(normalizedType, "BTreeMap");

  if (bTreeMapInner) {
    return { byteSize: 4, dynamic: true, note: `BTreeMap<${bTreeMapInner}> is dynamically sized; counted 4-byte length prefix only` };
  }

  const bTreeSetInner = parseGenericType(normalizedType, "BTreeSet");

  if (bTreeSetInner) {
    return { byteSize: 4, dynamic: true, note: `BTreeSet<${bTreeSetInner}> is dynamically sized; counted 4-byte length prefix only` };
  }

  return { byteSize: null, dynamic: false, note: `unsupported fixed size type: ${normalizedType}` };
}

function resolveStructSize(
  typeName: string,
  typesRegistry: Map<string, any>,
  resolving: Set<string>
): SizedType {
  if (resolving.has(typeName)) {
    return { byteSize: null, dynamic: true, note: `circular dependency detected: ${typeName}` };
  }

  const structDef = typesRegistry.get(typeName);
  if (!structDef) {
    return { byteSize: null, dynamic: false, note: `type definition not found: ${typeName}` };
  }

  resolving.add(typeName);
  let totalSize = 0;
  let dynamic = false;
  const notes: string[] = [];

  for (const field of structDef.fields) {
    const res = sizeOfRustType(field.type, typesRegistry, resolving);
    if (res.byteSize === null) {
      resolving.delete(typeName);
      return { byteSize: null, dynamic: false, note: `unresolved nested type "${field.type}" in "${typeName}"` };
    }
    totalSize += res.byteSize;
    if (res.dynamic) {
      dynamic = true;
    }
    if (res.note) {
      notes.push(res.note);
    }
  }

  resolving.delete(typeName);
  return {
    byteSize: totalSize,
    dynamic,
    ...(notes.length > 0 ? { note: notes.join("; ") } : {})
  };
}

function parseArrayType(type: string): { innerType: string; length: number } | null {
  const match = /^\[(.+);\s*(\d+)\]$/.exec(type);

  if (!match) {
    return null;
  }

  return {
    innerType: unwrapWhitespace(match[1]),
    length: Number(match[2])
  };
}

function parseGenericType(type: string, genericName: string): string | null {
  const prefix = `${genericName}<`;

  if (!type.startsWith(prefix) || !type.endsWith(">")) {
    return null;
  }

  return unwrapWhitespace(type.slice(prefix.length, -1));
}

function unwrapWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

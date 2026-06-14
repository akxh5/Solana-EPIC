use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TypeDef {
    Struct(StructDef),
    Enum(EnumDef),
    Alias(AliasDef),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StructDef {
    pub name: String,
    pub is_account: bool,
    pub fields: Vec<FieldDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FieldDef {
    pub name: String,
    pub type_ref: TypeRef,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TypeRef {
    Primitive(String),
    Array(Box<TypeRef>, usize),
    Vec(Box<TypeRef>),
    Option(Box<TypeRef>),
    Result(Box<TypeRef>, Box<TypeRef>),
    HashMap(Box<TypeRef>, Box<TypeRef>),
    BTreeMap(Box<TypeRef>, Box<TypeRef>),
    HashSet(Box<TypeRef>),
    BTreeSet(Box<TypeRef>),
    Tuple(Vec<TypeRef>),
    String,
    Pubkey,
    Custom(String), // The raw string parsed
    Resolved(String), // The absolute path after resolution
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EnumDef {
    pub name: String,
    pub variants: Vec<VariantDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VariantDef {
    pub name: String,
    pub fields: Vec<FieldDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AliasDef {
    pub name: String,
    pub target: TypeRef,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TypeRegistry {
    // absolute_path -> TypeDef
    pub definitions: HashMap<String, TypeDef>,
}

impl TypeRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, absolute_path: String, def: TypeDef) {
        self.definitions.insert(absolute_path, def);
    }
    
    pub fn get(&self, absolute_path: &str) -> Option<&TypeDef> {
        self.definitions.get(absolute_path)
    }
}

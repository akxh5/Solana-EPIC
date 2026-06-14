use crate::types::{TypeDef, TypeRef, TypeRegistry};
use anyhow::{anyhow, bail, Result};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub struct AbiEngine<'a> {
    pub registry: &'a TypeRegistry,
    pub resolving: Vec<String>,
    pub hash_cache: HashMap<String, String>,
}

impl<'a> AbiEngine<'a> {
    pub fn new(registry: &'a TypeRegistry) -> Self {
        Self {
            registry,
            resolving: Vec::new(),
            hash_cache: HashMap::new(),
        }
    }

    pub fn resolve_absolute_path(&self, current_module: &str, ident: &str) -> Result<String> {
        let direct_path = format!("{}::{}", current_module, ident);
        if self.registry.definitions.contains_key(&direct_path) {
            return Ok(direct_path);
        }

        let mut matches = Vec::new();
        for key in self.registry.definitions.keys() {
            if key.ends_with(&format!("::{}", ident)) || key == ident {
                matches.push(key.clone());
            }
        }

        if matches.is_empty() {
            bail!("Unknown type: {}", ident);
        } else if matches.len() > 1 {
            bail!("Ambiguous type: {} matches {:?}", ident, matches);
        } else {
            Ok(matches[0].clone())
        }
    }

    pub fn hash_of_type_ref(&mut self, current_module: &str, ty: &TypeRef) -> Result<String> {
        let mut hasher = Sha256::new();
        match ty {
            TypeRef::Primitive(p) => {
                hasher.update(b"Primitive");
                hasher.update(p.as_bytes());
            }
            TypeRef::String => hasher.update(b"String"),
            TypeRef::Pubkey => hasher.update(b"Pubkey"),
            TypeRef::Array(inner, len) => {
                hasher.update(b"Array");
                hasher.update(self.hash_of_type_ref(current_module, inner)?.as_bytes());
                hasher.update(len.to_string().as_bytes());
            }
            TypeRef::Vec(inner) => {
                hasher.update(b"Vec");
                hasher.update(self.hash_of_type_ref(current_module, inner)?.as_bytes());
            }
            TypeRef::Option(inner) => {
                hasher.update(b"Option");
                hasher.update(self.hash_of_type_ref(current_module, inner)?.as_bytes());
            }
            TypeRef::Custom(ident) => {
                let abs_path = self.resolve_absolute_path(current_module, ident)?;
                hasher.update(self.hash_of_absolute_path(&abs_path)?.as_bytes());
            }
            TypeRef::Resolved(abs_path) => {
                hasher.update(self.hash_of_absolute_path(abs_path)?.as_bytes());
            }
            _ => bail!("Unsupported type ref for hashing: {:?}", ty),
        }
        Ok(hex::encode(hasher.finalize()))
    }

    pub fn hash_of_absolute_path(&mut self, abs_path: &str) -> Result<String> {
        if let Some(cached) = self.hash_cache.get(abs_path) {
            return Ok(cached.clone());
        }

        if self.resolving.contains(&abs_path.to_string()) {
            bail!("Cyclic dependency detected for {}", abs_path);
        }

        self.resolving.push(abs_path.to_string());

        let def = self.registry.get(abs_path).ok_or_else(|| anyhow!("Definition missing for {}", abs_path))?.clone();

        let current_module = if let Some(idx) = abs_path.rfind("::") {
            &abs_path[..idx]
        } else {
            ""
        };

        let mut hasher = Sha256::new();
        match def {
            TypeDef::Struct(s) => {
                hasher.update(b"Struct");
                if s.is_account {
                    hasher.update(b"Account");
                }
                for field in &s.fields {
                    hasher.update(field.name.as_bytes());
                    hasher.update(self.hash_of_type_ref(current_module, &field.type_ref)?.as_bytes());
                }
            }
            TypeDef::Enum(e) => {
                hasher.update(b"Enum");
                for variant in &e.variants {
                    hasher.update(variant.name.as_bytes());
                    for field in &variant.fields {
                        hasher.update(field.name.as_bytes());
                        hasher.update(self.hash_of_type_ref(current_module, &field.type_ref)?.as_bytes());
                    }
                }
            }
            TypeDef::Alias(a) => {
                hasher.update(b"Alias");
                hasher.update(self.hash_of_type_ref(current_module, &a.target)?.as_bytes());
            }
        };

        let hash_str = hex::encode(hasher.finalize());
        self.resolving.pop();
        self.hash_cache.insert(abs_path.to_string(), hash_str.clone());

        Ok(hash_str)
    }
}

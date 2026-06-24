use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Item {
    pub id: String,                 // e.g. "brew:eza" / "cask:ghostty"
    pub name: String,
    pub source: String,             // "brew" | "cask"
    pub source_detail: Option<String>,
    pub version: Option<String>,
    pub exec_path: Option<String>,
    pub homepage: Option<String>,
    pub raw_desc: Option<String>,
    pub installed_on_request: Option<bool>,
}

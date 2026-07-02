use crate::{read_json_or_default, write_json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct MindMapNodeRef {
    pub id: String,
    pub section: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MindMapNodePos {
    pub x: f64,
    pub y: f64,
    pub pinned: bool,
}

impl Default for MindMapNodePos {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            pinned: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MindMapLink {
    pub id: String,
    pub from: MindMapNodeRef,
    pub to: MindMapNodeRef,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MindMapViewState {
    pub pan_x: f64,
    pub pan_y: f64,
    pub zoom: f64,
}

impl Default for MindMapViewState {
    fn default() -> Self {
        Self {
            pan_x: 0.0,
            pan_y: 0.0,
            zoom: 1.0,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MindMapData {
    pub version: u32,
    pub global_pinned: bool,
    pub nodes: HashMap<String, MindMapNodePos>,
    pub links: Vec<MindMapLink>,
    pub view: MindMapViewState,
}

impl Default for MindMapData {
    fn default() -> Self {
        Self {
            version: 1,
            global_pinned: false,
            nodes: HashMap::new(),
            links: Vec::new(),
            view: MindMapViewState::default(),
        }
    }
}

pub fn mindmap_path(library_path: &Path) -> std::path::PathBuf {
    crate::paths::LibraryPaths::detect_or_legacy(library_path).mindmap()
}

pub fn node_key(section: &str, id: &str) -> String {
    format!("{section}:{id}")
}

pub fn read_mindmap(library_path: &Path) -> Result<MindMapData, String> {
    read_json_or_default(&mindmap_path(library_path))
}

pub fn write_mindmap(library_path: &Path, data: &MindMapData) -> Result<(), String> {
    write_json(&mindmap_path(library_path), data)
}

pub fn remove_node(library_path: &Path, section: &str, id: &str) -> Result<(), String> {
    let mut data = read_mindmap(library_path)?;
    let key = node_key(section, id);
    data.nodes.remove(&key);
    data.links.retain(|link| {
        !(link.from.id == id && link.from.section == section
            || link.to.id == id && link.to.section == section)
    });
    write_mindmap(library_path, &data)
}
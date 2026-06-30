use crate::library::{read_json_or_default, write_json, CHAPTERS, CHARACTERS, RESEARCH};
use crate::models::ChapterMeta;
use crate::paths::{LayoutVersion, LibraryPaths};
use std::path::Path;

#[derive(Debug, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SectionIndex {
    pub version: u32,
    pub items: Vec<ChapterMeta>,
}

impl SectionIndex {
    fn new(items: Vec<ChapterMeta>) -> Self {
        Self { version: 1, items }
    }
}

pub fn read_section_index(library_path: &Path, section: &str) -> Result<Vec<ChapterMeta>, String> {
    let paths = LibraryPaths::detect(library_path)?;
    if paths.layout() == LayoutVersion::Legacy {
        return crate::library::load_section_chapters_legacy(library_path, section);
    }
    if section == CHAPTERS {
        let manifest = crate::library::read_manifest(library_path)?;
        return Ok(manifest.chapters);
    }
    let index_path = match section {
        RESEARCH => paths.research_index(),
        CHARACTERS => paths.characters_index(),
        _ => return Err(format!("Unknown section: {section}")),
    };
    let index: SectionIndex = read_json_or_default(&index_path)?;
    Ok(index.items)
}

pub fn write_section_index(
    library_path: &Path,
    section: &str,
    items: &[ChapterMeta],
) -> Result<(), String> {
    let paths = LibraryPaths::detect(library_path)?;
    if paths.layout() == LayoutVersion::Legacy {
        return Err("Section index write requires v2 layout".into());
    }
    let index_path = match section {
        RESEARCH => paths.research_index(),
        CHARACTERS => paths.characters_index(),
        _ => return Err(format!("Unknown section: {section}")),
    };
    write_json(&index_path, &SectionIndex::new(items.to_vec()))
}

pub fn write_index_file(path: &Path, items: &[ChapterMeta]) -> Result<(), String> {
    write_json(path, &SectionIndex::new(items.to_vec()))
}
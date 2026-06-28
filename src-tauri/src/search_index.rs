use crate::compile::{html_to_text, read_chapter_html, strip_review_marks};
use crate::library::{
    load_section_chapters, read_json, read_manifest, CHAPTERS, CHARACTERS, RESEARCH,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

const INDEX_VERSION: u32 = 1;
const INDEX_FILE: &str = "search-index.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchIndexEntry {
    pub chapter_id: String,
    pub section: String,
    pub title: String,
    pub updated_at: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct SearchIndex {
    version: u32,
    entries: HashMap<String, SearchIndexEntry>,
}

static SEARCH_INDEX_CACHE: LazyLock<Mutex<HashMap<PathBuf, SearchIndex>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn index_key(section: &str, chapter_id: &str) -> String {
    format!("{section}:{chapter_id}")
}

fn index_path(library_path: &Path) -> PathBuf {
    library_path.join(INDEX_FILE)
}

fn cache_key(library_path: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(library_path).map_err(|e| format!("Invalid library path: {e}"))
}

fn load_index_from_disk(library_path: &Path) -> Result<SearchIndex, String> {
    let path = index_path(library_path);
    if !path.exists() {
        return Ok(SearchIndex {
            version: INDEX_VERSION,
            entries: HashMap::new(),
        });
    }
    read_json(&path).map_err(|e| format!("Invalid search index: {e}"))
}

fn read_index(library_path: &Path) -> Result<SearchIndex, String> {
    let key = cache_key(library_path)?;
    let mut cache = SEARCH_INDEX_CACHE
        .lock()
        .map_err(|e| format!("Search cache lock error: {e}"))?;
    if let Some(index) = cache.get(&key) {
        return Ok(index.clone());
    }
    let index = load_index_from_disk(library_path)?;
    cache.insert(key, index.clone());
    Ok(index)
}

fn write_index(library_path: &Path, index: &SearchIndex) -> Result<(), String> {
    let key = cache_key(library_path)?;
    let mut cache = SEARCH_INDEX_CACHE
        .lock()
        .map_err(|e| format!("Search cache lock error: {e}"))?;
    cache.insert(key, index.clone());
    Ok(())
}

pub fn clear_search_index_cache() {
    if let Ok(mut cache) = SEARCH_INDEX_CACHE.lock() {
        cache.clear();
    }
}

pub fn plain_text_from_html(html: &str) -> String {
    html_to_text(&strip_review_marks(html))
}

pub fn upsert_search_entry(
    library_path: &Path,
    section: &str,
    meta: &crate::models::ChapterMeta,
    html: &str,
) -> Result<(), String> {
    let mut index = read_index(library_path)?;
    index.version = INDEX_VERSION;
    let key = index_key(section, &meta.id);
    index.entries.insert(
        key,
        SearchIndexEntry {
            chapter_id: meta.id.clone(),
            section: section.to_string(),
            title: meta.title.clone(),
            updated_at: meta.updated_at.clone(),
            text: plain_text_from_html(html),
        },
    );
    write_index(library_path, &index)
}

pub fn remove_search_entry(
    library_path: &Path,
    section: &str,
    chapter_id: &str,
) -> Result<(), String> {
    let mut index = read_index(library_path)?;
    index.entries.remove(&index_key(section, chapter_id));
    write_index(library_path, &index)
}

fn load_entry_from_disk(
    library_path: &Path,
    section: &str,
    meta: &crate::models::ChapterMeta,
) -> Result<SearchIndexEntry, String> {
    let html = if section == CHAPTERS {
        read_chapter_html(library_path, &meta.id)?
    } else {
        crate::compile::read_section_html(library_path, &meta.id, section)?
    };
    Ok(SearchIndexEntry {
        chapter_id: meta.id.clone(),
        section: section.to_string(),
        title: meta.title.clone(),
        updated_at: meta.updated_at.clone(),
        text: plain_text_from_html(&html),
    })
}

fn ensure_entry(
    library_path: &Path,
    index: &mut SearchIndex,
    section: &str,
    meta: &crate::models::ChapterMeta,
) -> Result<(SearchIndexEntry, bool), String> {
    let key = index_key(section, &meta.id);
    if let Some(entry) = index.entries.get(&key) {
        if entry.updated_at == meta.updated_at {
            return Ok((entry.clone(), false));
        }
    }
    let entry = load_entry_from_disk(library_path, section, meta)?;
    index.entries.insert(key, entry.clone());
    Ok((entry, true))
}

pub fn search_indexed(
    library_path: &Path,
    query: &str,
    max: usize,
) -> Result<Vec<SearchIndexEntry>, String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(vec![]);
    }

    let mut index = read_index(library_path)?;
    let mut hits = Vec::new();
    let mut index_changed = false;

    let manifest = read_manifest(library_path)?;
    for meta in &manifest.chapters {
        if hits.len() >= max {
            break;
        }
        let (entry, changed) = ensure_entry(library_path, &mut index, CHAPTERS, meta)?;
        index_changed |= changed;
        if entry.text.to_lowercase().contains(&q) {
            hits.push(entry);
        }
    }

    for section in [RESEARCH, CHARACTERS] {
        let items = load_section_chapters(library_path, section)?;
        for meta in items {
            if hits.len() >= max {
                break;
            }
            let (entry, changed) = ensure_entry(library_path, &mut index, section, &meta)?;
            index_changed |= changed;
            if entry.text.to_lowercase().contains(&q) {
                hits.push(entry);
            }
        }
    }

    if index_changed {
        write_index(library_path, &index)?;
    }

    Ok(hits)
}

#[allow(dead_code)]
pub fn rebuild_search_index(library_path: &Path) -> Result<(), String> {
    let mut index = SearchIndex {
        version: INDEX_VERSION,
        entries: HashMap::new(),
    };

    let manifest = read_manifest(library_path)?;
    for meta in &manifest.chapters {
        let entry = load_entry_from_disk(library_path, CHAPTERS, meta)?;
        index
            .entries
            .insert(index_key(CHAPTERS, &meta.id), entry);
    }

    for section in [RESEARCH, CHARACTERS] {
        let items = load_section_chapters(library_path, section)?;
        for meta in items {
            let entry = load_entry_from_disk(library_path, section, &meta)?;
            index
                .entries
                .insert(index_key(section, &meta.id), entry);
        }
    }

    write_index(library_path, &index)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::{create_library, write_chapter_files, CHAPTERS};
    use serial_test::serial;
    use std::fs;
    use uuid::Uuid;

    #[test]
    #[serial(active_library)]
    fn search_index_finds_saved_chapter() {
        let dir = std::env::temp_dir().join(format!("darktext-idx-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.as_path();
        create_library(dir.to_string_lossy().to_string(), "Test".to_string()).unwrap();
        let content =
            crate::chapters::create_chapter(dir.to_string_lossy().to_string(), Some("Alpha".into()), None)
                .unwrap();
        write_chapter_files(
            path,
            CHAPTERS,
            &content.meta,
            "<p>unique zebra keyword</p>",
        )
        .unwrap();

        let hits = search_indexed(path, "zebra", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert!(hits[0].text.contains("zebra"));
        assert!(
            !index_path(path).exists(),
            "search index should stay in memory, not on disk"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn ensure_entry_detects_body_change_via_updated_at_not_title() {
        let dir = std::env::temp_dir().join(format!("darktext-idx-stale-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.as_path();
        create_library(dir.to_string_lossy().to_string(), "Test".to_string()).unwrap();
        let content = crate::chapters::create_chapter(
            dir.to_string_lossy().to_string(),
            Some("Same Title".into()),
            None,
        )
        .unwrap();

        let mut index = SearchIndex {
            version: INDEX_VERSION,
            entries: HashMap::new(),
        };
        let (first, changed) =
            ensure_entry(path, &mut index, CHAPTERS, &content.meta).unwrap();
        assert!(changed);
        assert!(!first.text.contains("giraffe"));

        // Title is unchanged, but the body and updated_at change underneath it.
        let mut newer_meta = content.meta.clone();
        newer_meta.updated_at = "2099-01-01T00:00:00Z".to_string();
        write_chapter_files(path, CHAPTERS, &newer_meta, "<p>a giraffe appears</p>").unwrap();

        let (second, changed) = ensure_entry(path, &mut index, CHAPTERS, &newer_meta).unwrap();
        assert!(changed, "stale cache entry should be refreshed when updated_at differs");
        assert!(second.text.contains("giraffe"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn legacy_on_disk_index_is_loaded_into_memory_once() {
        let dir = std::env::temp_dir().join(format!("darktext-idx-legacy-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.as_path();
        create_library(dir.to_string_lossy().to_string(), "Test".to_string()).unwrap();
        let content =
            crate::chapters::create_chapter(dir.to_string_lossy().to_string(), Some("Legacy".into()), None)
                .unwrap();
        write_chapter_files(path, CHAPTERS, &content.meta, "<p>ancient keyword</p>").unwrap();

        let mut legacy = SearchIndex {
            version: INDEX_VERSION,
            entries: HashMap::new(),
        };
        legacy.entries.insert(
            index_key(CHAPTERS, &content.meta.id),
            SearchIndexEntry {
                chapter_id: content.meta.id.clone(),
                section: CHAPTERS.to_string(),
                title: content.meta.title.clone(),
                updated_at: content.meta.updated_at.clone(),
                text: "ancient keyword".to_string(),
            },
        );
        crate::library::write_json(&index_path(path), &legacy).unwrap();
        clear_search_index_cache();

        let hits = search_indexed(path, "ancient", 10).unwrap();
        assert_eq!(hits.len(), 1);

        let _ = fs::remove_dir_all(&dir);
    }
}
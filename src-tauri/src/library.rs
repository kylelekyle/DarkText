use crate::compile::{
    load_final_chapters, read_book_settings, write_book_settings, BookSettings,
};
use crate::migrate::migrate_library_if_needed;
use crate::models::{ChapterMeta, LibraryManifest};
use crate::paths::{LayoutVersion, LibraryPaths, MANIFEST_VERSION_V2};
use crate::section_index::{read_section_index, write_section_index};
use chrono::Utc;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

static LIBRARY_OPS: Mutex<()> = Mutex::new(());

pub(crate) fn with_library_lock<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String>,
{
    let _guard = LIBRARY_OPS
        .lock()
        .map_err(|e| format!("Library lock error: {e}"))?;
    f()
}

static ACTIVE_LIBRARY: Mutex<Option<PathBuf>> = Mutex::new(None);

pub(crate) fn set_active_library(path: &Path) -> Result<(), String> {
    let canonical = fs::canonicalize(path).map_err(|e| format!("Invalid library path: {e}"))?;
    let mut guard = ACTIVE_LIBRARY
        .lock()
        .map_err(|e| format!("Library lock error: {e}"))?;
    *guard = Some(canonical);
    Ok(())
}

pub(crate) fn clear_active_library() {
    if let Ok(mut guard) = ACTIVE_LIBRARY.lock() {
        *guard = None;
    }
}

pub(crate) fn require_active_library(path: &Path) -> Result<(), String> {
    let canonical = fs::canonicalize(path).map_err(|_| "Library not found".to_string())?;
    let guard = ACTIVE_LIBRARY
        .lock()
        .map_err(|e| format!("Library lock error: {e}"))?;
    match &*guard {
        Some(active) if *active == canonical => Ok(()),
        _ => Err("This library is not currently open".to_string()),
    }
}

#[tauri::command]
pub fn close_library() {
    crate::search_index::clear_search_index_cache();
    clear_active_library();
}

pub(crate) fn validate_chapter_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id == "."
        || id == ".."
        || id.contains('/')
        || id.contains('\\')
        || id.contains('\0')
    {
        return Err("Invalid chapter id".into());
    }
    Ok(())
}

pub(crate) fn validate_snapshot_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id == "."
        || id == ".."
        || id.contains('/')
        || id.contains('\\')
        || id.contains('\0')
    {
        return Err("Invalid snapshot id".into());
    }
    Ok(())
}

pub(crate) fn validate_status(status: &str) -> Result<(), String> {
    const VALID_STATUSES: &[&str] = &["draft", "needs-refine", "final"];
    if VALID_STATUSES.contains(&status) {
        Ok(())
    } else {
        Err(format!("Invalid status: {status}"))
    }
}

pub fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn read_json_or_default<T: serde::de::DeserializeOwned + Default>(
    path: &Path,
) -> Result<T, String> {
    if !path.exists() {
        return Ok(T::default());
    }
    read_json(path)
}

pub fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    atomic_write(path, json.as_bytes())
}

pub const CHAPTERS: &str = "chapters";
pub(crate) const RESEARCH: &str = "research";
pub(crate) const CHARACTERS: &str = "characters";

pub(crate) const RESEARCH_TEMPLATE: &str = "<h2>Research Topic</h2><p><strong>Source:</strong> </p><p><strong>Summary:</strong></p><p></p><p><strong>Key points:</strong></p><ul><li></li></ul><p><strong>Links &amp; references:</strong></p><p></p>";
pub(crate) const CHARACTER_TEMPLATE: &str = "<h2>Character Name</h2><p><strong>Role:</strong> </p><p><strong>Age / Appearance:</strong></p><p></p><p><strong>Personality:</strong></p><p></p><p><strong>Background:</strong></p><p></p><p><strong>Goals &amp; motivation:</strong></p><p></p><p><strong>Notes:</strong></p><p></p>";

pub fn library_paths(library_path: &Path) -> Result<LibraryPaths, String> {
    LibraryPaths::detect(library_path)
}

pub fn section_dir(library_path: &Path, section: &str) -> PathBuf {
    LibraryPaths::detect_or_legacy(library_path).content_dir(section)
}

pub fn meta_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.meta.json"))
}

pub(crate) fn html_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.html"))
}

pub(crate) fn ensure_library_structure(library_path: &Path) -> Result<(), String> {
    let paths = LibraryPaths::new_v2(library_path.to_path_buf());
    paths.ensure_v2_structure()
}

pub fn read_manifest(library_path: &Path) -> Result<LibraryManifest, String> {
    let paths = library_paths(library_path)?;
    let manifest_path = paths.library_manifest();
    if !manifest_path.exists() {
        return Err("Not a valid Library: library.json not found".to_string());
    }
    read_json(&manifest_path)
}

pub(crate) fn write_manifest(library_path: &Path, manifest: &LibraryManifest) -> Result<(), String> {
    let paths = library_paths(library_path)?;
    write_json(&paths.library_manifest(), manifest)
}

pub(crate) fn read_meta_file(path: &Path) -> Result<ChapterMeta, String> {
    read_json(path)
}

pub fn read_chapter_meta(
    library_path: &Path,
    section: &str,
    id: &str,
) -> Result<ChapterMeta, String> {
    validate_chapter_id(id)?;
    let paths = library_paths(library_path)?;
    match paths.layout() {
        LayoutVersion::Legacy => read_meta_file(&paths.meta_json(section, id)),
        LayoutVersion::V2 => {
            if section == CHAPTERS {
                let manifest = read_manifest(library_path)?;
                manifest
                    .chapters
                    .into_iter()
                    .find(|c| c.id == id)
                    .ok_or_else(|| "Chapter not found".to_string())
            } else {
                let items = read_section_index(library_path, section)?;
                items
                    .into_iter()
                    .find(|c| c.id == id)
                    .ok_or_else(|| "Chapter not found".to_string())
            }
        }
    }
}

pub fn chapter_exists(library_path: &Path, section: &str, id: &str) -> bool {
    library_paths(library_path)
        .map(|p| p.chapter_html(section, id).exists())
        .unwrap_or(false)
}

pub fn load_section_chapters_legacy(
    library_path: &Path,
    section: &str,
) -> Result<Vec<ChapterMeta>, String> {
    let paths = library_paths(library_path)?;
    let dir = paths.legacy_content_dir(section);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut chapters = Vec::new();
    let mut seen_ids = HashSet::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if file_name.ends_with(".meta.json") {
            let meta = read_meta_file(&path)?;
            seen_ids.insert(meta.id.clone());
            chapters.push(meta);
        } else if section == CHAPTERS
            && path.extension().and_then(|e| e.to_str()) == Some("json")
            && !file_name.ends_with(".meta.json")
            && !file_name.ends_with(".comments.json")
        {
            let meta = read_meta_file(&path)?;
            if seen_ids.contains(&meta.id) {
                let _ = fs::remove_file(&path);
                continue;
            }
            let id = meta.id.clone();
            let html_src = html_path(&dir, &id);
            let html = fs::read_to_string(&html_src).unwrap_or_else(|_| "<p></p>".to_string());
            write_chapter_files(library_path, section, &meta, &html)?;
            let _ = fs::remove_file(&path);
            seen_ids.insert(meta.id.clone());
            chapters.push(meta);
        }
    }

    chapters.sort_by_key(|c| c.order);
    Ok(chapters)
}

pub fn load_section_chapters(library_path: &Path, section: &str) -> Result<Vec<ChapterMeta>, String> {
    let paths = library_paths(library_path)?;
    if paths.layout() == LayoutVersion::Legacy {
        return load_section_chapters_legacy(library_path, section);
    }

    let mut items = read_section_index(library_path, section)?;
    items.retain(|c| paths.chapter_html(section, &c.id).exists());
    items.sort_by_key(|c| c.order);
    Ok(items)
}

fn reconcile_manifest_chapters(library_path: &Path, manifest: &mut LibraryManifest) -> Result<(), String> {
    let paths = library_paths(library_path)?;
    if paths.layout() == LayoutVersion::Legacy {
        manifest.chapters = load_section_chapters_legacy(library_path, CHAPTERS)?;
        return Ok(());
    }

    let content_dir = paths.content_dir(CHAPTERS);
    let mut by_id: HashMap<String, ChapterMeta> = manifest
        .chapters
        .drain(..)
        .map(|c| (c.id.clone(), c))
        .collect();

    if content_dir.exists() {
        let mut orphans: Vec<(String, std::time::SystemTime)> = Vec::new();
        for entry in fs::read_dir(&content_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("html") {
                continue;
            }
            let id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            if !by_id.contains_key(&id) {
                let modified = entry
                    .metadata()
                    .map_err(|e| e.to_string())?
                    .modified()
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                orphans.push((id, modified));
            }
        }
        orphans.sort_by_key(|(_, t)| *t);
        let base_order = by_id.len() as u32;
        for (i, (id, _)) in orphans.into_iter().enumerate() {
            by_id.insert(
                id.clone(),
                ChapterMeta {
                    id,
                    title: "Recovered".to_string(),
                    status: "draft".to_string(),
                    order: base_order + i as u32,
                    updated_at: Utc::now().to_rfc3339(),
                    word_count: 0,
                    char_count: 0,
                },
            );
        }
    }

    manifest.chapters = by_id.into_values().collect();
    manifest.chapters.retain(|c| paths.chapter_html(CHAPTERS, &c.id).exists());
    manifest.chapters.sort_by_key(|c| c.order);
    for (i, ch) in manifest.chapters.iter_mut().enumerate() {
        ch.order = i as u32;
    }
    Ok(())
}

pub(crate) fn write_chapter_files(
    library_path: &Path,
    section: &str,
    meta: &ChapterMeta,
    html: &str,
) -> Result<ChapterMeta, String> {
    validate_chapter_id(&meta.id)?;
    let mut meta = meta.clone();
    let (words, chars) = crate::compile::stats_from_html(html);
    meta.word_count = words;
    meta.char_count = chars;
    let paths = library_paths(library_path)?;
    let dir = paths.content_dir(section);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    match paths.layout() {
        LayoutVersion::Legacy => {
            write_json(&paths.meta_json(section, &meta.id), &meta)?;
        }
        LayoutVersion::V2 if section != CHAPTERS => {
            let mut items = read_section_index(library_path, section)?;
            if let Some(existing) = items.iter_mut().find(|c| c.id == meta.id) {
                *existing = meta.clone();
            } else {
                items.push(meta.clone());
            }
            write_section_index(library_path, section, &items)?;
        }
        LayoutVersion::V2 => {}
    }

    atomic_write(&paths.chapter_html(section, &meta.id), html.as_bytes())?;
    let _ = crate::search_index::upsert_search_entry(library_path, section, &meta, html);
    Ok(meta)
}

pub(crate) fn write_chapter_meta_only(
    library_path: &Path,
    section: &str,
    meta: &ChapterMeta,
) -> Result<(), String> {
    validate_chapter_id(&meta.id)?;
    let paths = library_paths(library_path)?;
    match paths.layout() {
        LayoutVersion::Legacy => {
            write_json(&paths.meta_json(section, &meta.id), meta)
        }
        LayoutVersion::V2 if section == CHAPTERS => Ok(()),
        LayoutVersion::V2 => {
            let mut items = read_section_index(library_path, section)?;
            if let Some(existing) = items.iter_mut().find(|c| c.id == meta.id) {
                *existing = meta.clone();
            } else {
                return Err("Chapter not found".to_string());
            }
            write_section_index(library_path, section, &items)
        }
    }
}

pub(crate) fn resolve_section(section: Option<String>) -> Result<String, String> {
    match section.as_deref() {
        None | Some(CHAPTERS) => Ok(CHAPTERS.to_string()),
        Some(RESEARCH) => Ok(RESEARCH.to_string()),
        Some(CHARACTERS) => Ok(CHARACTERS.to_string()),
        Some(other) => Err(format!("Unknown section: {other}")),
    }
}

pub(crate) fn is_sidecar_section(section: &str) -> bool {
    section == RESEARCH || section == CHARACTERS
}

pub(crate) fn reload_library_manifest(library_path: &Path, path: String) -> Result<LibraryManifest, String> {
    let mut manifest = read_manifest(library_path)?;
    manifest.path = path;
    reconcile_manifest_chapters(library_path, &mut manifest)?;
    if library_paths(library_path)?.layout() == LayoutVersion::V2 {
        write_manifest(library_path, &manifest)?;
    }
    Ok(manifest)
}

pub(crate) fn reorder_section(
    library_path: &Path,
    section: &str,
    chapter_ids: &[String],
) -> Result<(), String> {
    let existing = load_section_chapters(library_path, section)?;
    if chapter_ids.len() != existing.len() {
        return Err("Reorder must include every item".into());
    }
    for ch in &existing {
        if !chapter_ids.contains(&ch.id) {
            return Err(format!("Missing item id: {}", ch.id));
        }
    }

    let paths = library_paths(library_path)?;
    let now = Utc::now().to_rfc3339();

    if paths.layout() == LayoutVersion::Legacy {
        let dir = paths.content_dir(section);
        for (order, id) in chapter_ids.iter().enumerate() {
            validate_chapter_id(id)?;
            let meta_file = meta_path(&dir, id);
            if !meta_file.exists() {
                return Err(format!("Item not found: {id}"));
            }
            let mut meta = read_meta_file(&meta_file)?;
            meta.order = order as u32;
            meta.updated_at = now.clone();
            write_chapter_meta_only(library_path, section, &meta)?;
        }
        return Ok(());
    }

    let mut items: Vec<ChapterMeta> = Vec::new();
    for (order, id) in chapter_ids.iter().enumerate() {
        validate_chapter_id(id)?;
        let mut meta = existing
            .iter()
            .find(|c| &c.id == id)
            .cloned()
            .ok_or_else(|| format!("Item not found: {id}"))?;
        meta.order = order as u32;
        meta.updated_at = now.clone();
        items.push(meta);
    }

    if section == CHAPTERS {
        let mut manifest = read_manifest(library_path)?;
        manifest.chapters = items;
        write_manifest(library_path, &manifest)?;
    } else {
        write_section_index(library_path, section, &items)?;
    }
    Ok(())
}

#[tauri::command]
pub fn create_library(path: String, name: String) -> Result<LibraryManifest, String> {
    let library_path = PathBuf::from(&path);
    if LibraryPaths::is_valid_library(&library_path) {
        return Err("A library already exists at this path. Use Open Library instead.".into());
    }
    let paths = LibraryPaths::new_v2(library_path.clone());
    paths.ensure_v2_structure()?;

    let manifest = LibraryManifest {
        name,
        version: MANIFEST_VERSION_V2,
        path: path.clone(),
        chapters: vec![],
    };

    write_json(&paths.library_manifest(), &manifest)?;
    set_active_library(&library_path)?;
    Ok(manifest)
}

#[tauri::command]
pub fn is_library_path(path: String) -> bool {
    LibraryPaths::is_valid_library(Path::new(&path))
}

#[tauri::command]
pub fn trash_library_folder(path: String) -> Result<(), String> {
    let library_path = PathBuf::from(&path);
    if !LibraryPaths::is_valid_library(&library_path) {
        return Err("Not a valid library folder".into());
    }
    let canonical = fs::canonicalize(&library_path)
        .map_err(|e| format!("Library folder not found: {e}"))?;
    if !canonical.is_dir() {
        return Err("Not a valid library folder".into());
    }
    clear_active_library();
    trash::delete(&canonical).map_err(|e| format!("Could not move to Recycle Bin: {e}"))
}

#[tauri::command]
pub fn open_library(path: String) -> Result<LibraryManifest, String> {
    let library_path = PathBuf::from(&path);
    with_library_lock(|| {
        migrate_library_if_needed(&library_path)?;
        let manifest = reload_library_manifest(&library_path, path)?;
        set_active_library(&library_path)?;
        Ok(manifest)
    })
}

#[tauri::command]
pub fn save_library_manifest(manifest: LibraryManifest) -> Result<LibraryManifest, String> {
    let path = PathBuf::from(&manifest.path);
    require_active_library(&path)?;
    if !library_paths(&path)?.library_manifest().exists() {
        return Err("Library not found".into());
    }
    with_library_lock(|| {
        write_manifest(&path, &manifest)?;
        Ok(manifest)
    })
}

#[tauri::command]
pub fn list_research_chapters(library_path: String) -> Result<Vec<ChapterMeta>, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    load_section_chapters(&path, RESEARCH)
}

#[tauri::command]
pub fn list_character_chapters(library_path: String) -> Result<Vec<ChapterMeta>, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    load_section_chapters(&path, CHARACTERS)
}

#[tauri::command]
pub fn get_compile_chapters(library_path: String) -> Result<Vec<ChapterMeta>, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    load_final_chapters(&path)
}

#[tauri::command]
pub fn get_book_settings(library_path: String) -> Result<BookSettings, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    read_book_settings(&path)
}

#[tauri::command]
pub fn save_book_settings(library_path: String, settings: BookSettings) -> Result<BookSettings, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    write_book_settings(&path, &settings)?;
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::paths::{FOLDER_CHAPTERS, FOLDER_RESEARCH};
    use serial_test::serial;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn validate_chapter_id_rejects_empty() {
        assert!(validate_chapter_id("").is_err());
    }

    #[test]
    fn validate_chapter_id_rejects_dot_segments() {
        assert!(validate_chapter_id(".").is_err());
        assert!(validate_chapter_id("..").is_err());
    }

    #[test]
    fn validate_chapter_id_rejects_path_separators() {
        assert!(validate_chapter_id("foo/bar").is_err());
        assert!(validate_chapter_id(r"foo\bar").is_err());
    }

    #[test]
    fn validate_chapter_id_rejects_null_byte() {
        assert!(validate_chapter_id("id\0bad").is_err());
    }

    #[test]
    fn validate_chapter_id_accepts_valid_uuid() {
        assert!(validate_chapter_id("550e8400-e29b-41d4-a716-446655440000").is_ok());
    }

    #[test]
    fn validate_snapshot_id_rejects_path_traversal() {
        assert!(validate_snapshot_id("..").is_err());
        assert!(validate_snapshot_id("snap/id").is_err());
        assert!(validate_snapshot_id("2026-01-01T00-00-00Z").is_ok());
    }

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("darktext-{label}-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    #[serial(active_library)]
    fn opening_library_a_rejects_commands_against_library_b() {
        let dir_a = temp_dir("active-a");
        let dir_b = temp_dir("active-b");
        create_library(dir_a.to_string_lossy().to_string(), "A".to_string()).unwrap();
        create_library(dir_b.to_string_lossy().to_string(), "B".to_string()).unwrap();

        open_library(dir_a.to_string_lossy().to_string()).unwrap();

        assert!(get_book_settings(dir_a.to_string_lossy().to_string()).is_ok());
        let err = get_book_settings(dir_b.to_string_lossy().to_string()).unwrap_err();
        assert!(err.contains("not currently open"));

        let _ = fs::remove_dir_all(&dir_a);
        let _ = fs::remove_dir_all(&dir_b);
    }

    #[test]
    fn trash_library_folder_rejects_missing_manifest() {
        let dir = temp_dir("trash-invalid");
        let err = trash_library_folder(dir.to_string_lossy().to_string()).unwrap_err();
        assert!(err.contains("Not a valid library"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn is_library_path_requires_directory_with_manifest() {
        let dir = temp_dir("is-library");
        let path = dir.to_string_lossy().to_string();

        assert!(!is_library_path(path.clone()));
        create_library(path.clone(), "Check".to_string()).unwrap();
        assert!(is_library_path(path.clone()));

        let paths = library_paths(&dir).unwrap();
        fs::remove_file(paths.library_manifest()).unwrap();
        assert!(!is_library_path(path));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn create_library_only_creates_v2_structure() {
        let dir = temp_dir("minimal-create");
        let path = dir.as_path();
        create_library(dir.to_string_lossy().to_string(), "Minimal".to_string()).unwrap();

        let paths = library_paths(path).unwrap();
        assert!(paths.library_manifest().exists());
        assert!(path.join(FOLDER_CHAPTERS).is_dir());
        assert!(paths.config_dir().is_dir());
        assert!(!path.join(FOLDER_RESEARCH).exists());
        assert!(!path.join(crate::paths::FOLDER_CHARACTERS).exists());
        assert!(!crate::compile::exports_dir(path).exists());
        assert!(!crate::fonts::fonts_dir(path).exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn close_library_rejects_subsequent_commands_until_reopened() {
        let dir = temp_dir("active-close");
        let path = dir.to_string_lossy().to_string();
        create_library(path.clone(), "Test".to_string()).unwrap();
        assert!(get_book_settings(path.clone()).is_ok());

        close_library();
        let err = get_book_settings(path.clone()).unwrap_err();
        assert!(err.contains("not currently open"));

        open_library(path.clone()).unwrap();
        assert!(get_book_settings(path).is_ok());

        let _ = fs::remove_dir_all(&dir);
    }
}
use crate::compile::{
    load_final_chapters, read_book_settings, write_book_settings, BookSettings,
};
use crate::models::{ChapterMeta, LibraryManifest};
use chrono::Utc;
use std::collections::HashSet;
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

/// The single library the frontend currently has open. Every command that
/// takes a `library_path` must match this (via `require_active_library`) so
/// a buggy or compromised frontend can't operate on an arbitrary directory
/// just by passing a different path string.
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

/// Reads and parses a JSON file. Errors if the file is missing or invalid.
pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

/// Reads and parses a JSON file, returning `T::default()` if it doesn't exist yet.
pub fn read_json_or_default<T: serde::de::DeserializeOwned + Default>(
    path: &Path,
) -> Result<T, String> {
    if !path.exists() {
        return Ok(T::default());
    }
    read_json(path)
}

/// Serializes a value as pretty JSON and writes it atomically.
pub fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    atomic_write(path, json.as_bytes())
}

pub const CHAPTERS: &str = "chapters";
pub(crate) const RESEARCH: &str = "research";
pub(crate) const CHARACTERS: &str = "characters";

pub(crate) const RESEARCH_TEMPLATE: &str = "<h2>Research Topic</h2><p><strong>Source:</strong> </p><p><strong>Summary:</strong></p><p></p><p><strong>Key points:</strong></p><ul><li></li></ul><p><strong>Links &amp; references:</strong></p><p></p>";
pub(crate) const CHARACTER_TEMPLATE: &str = "<h2>Character Name</h2><p><strong>Role:</strong> </p><p><strong>Age / Appearance:</strong></p><p></p><p><strong>Personality:</strong></p><p></p><p><strong>Background:</strong></p><p></p><p><strong>Goals &amp; motivation:</strong></p><p></p><p><strong>Notes:</strong></p><p></p>";

fn library_manifest_path(library_path: &Path) -> PathBuf {
    library_path.join("library.json")
}

pub fn section_dir(library_path: &Path, section: &str) -> PathBuf {
    library_path.join(section)
}

pub fn meta_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.meta.json"))
}

pub(crate) fn html_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.html"))
}

/// Ensures only the manuscript folder exists. Research, characters, exports, and
/// fonts folders are created lazily when those features are first used.
pub(crate) fn ensure_library_structure(library_path: &Path) -> Result<(), String> {
    fs::create_dir_all(section_dir(library_path, CHAPTERS)).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn read_manifest(library_path: &Path) -> Result<LibraryManifest, String> {
    let manifest_path = library_manifest_path(library_path);
    if !manifest_path.exists() {
        return Err("Not a valid Library: library.json not found".to_string());
    }
    read_json(&manifest_path)
}

pub(crate) fn write_manifest(library_path: &Path, manifest: &LibraryManifest) -> Result<(), String> {
    write_json(&library_manifest_path(library_path), manifest)
}

pub(crate) fn read_meta_file(path: &Path) -> Result<ChapterMeta, String> {
    read_json(path)
}

pub fn load_section_chapters(library_path: &Path, section: &str) -> Result<Vec<ChapterMeta>, String> {
    let dir = section_dir(library_path, section);
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
            // Migrate legacy .json sidecars from older layouts (not comments or other sidecars)
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

fn load_chapters_from_disk(library_path: &Path) -> Result<Vec<ChapterMeta>, String> {
    load_section_chapters(library_path, CHAPTERS)
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
    let dir = section_dir(library_path, section);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    write_json(&meta_path(&dir, &meta.id), &meta)?;
    atomic_write(&html_path(&dir, &meta.id), html.as_bytes())?;
    let _ = crate::search_index::upsert_search_entry(library_path, section, &meta, html);
    Ok(meta)
}

pub(crate) fn write_chapter_meta_only(
    library_path: &Path,
    section: &str,
    meta: &ChapterMeta,
) -> Result<(), String> {
    validate_chapter_id(&meta.id)?;
    let dir = section_dir(library_path, section);
    write_json(&meta_path(&dir, &meta.id), meta)
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
    manifest.chapters = load_chapters_from_disk(library_path)?;
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

    let dir = section_dir(library_path, section);
    for (order, id) in chapter_ids.iter().enumerate() {
        validate_chapter_id(id)?;
        let meta_file = meta_path(&dir, id);
        if !meta_file.exists() {
            return Err(format!("Item not found: {id}"));
        }
        let mut meta = read_meta_file(&meta_file)?;
        meta.order = order as u32;
        meta.updated_at = Utc::now().to_rfc3339();
        write_chapter_meta_only(library_path, section, &meta)?;
    }
    Ok(())
}

#[tauri::command]
pub fn create_library(path: String, name: String) -> Result<LibraryManifest, String> {
    let library_path = PathBuf::from(&path);
    if library_manifest_path(&library_path).exists() {
        return Err("A library already exists at this path. Use Open Library instead.".into());
    }
    ensure_library_structure(&library_path)?;

    let manifest = LibraryManifest {
        name,
        version: 1,
        path: path.clone(),
        chapters: vec![],
    };

    write_manifest(&library_path, &manifest)?;
    set_active_library(&library_path)?;
    Ok(manifest)
}

#[tauri::command]
pub fn open_library(path: String) -> Result<LibraryManifest, String> {
    let library_path = PathBuf::from(&path);
    let manifest = reload_library_manifest(&library_path, path)?;
    set_active_library(&library_path)?;
    Ok(manifest)
}

#[tauri::command]
pub fn save_library_manifest(manifest: LibraryManifest) -> Result<LibraryManifest, String> {
    let path = PathBuf::from(&manifest.path);
    require_active_library(&path)?;
    if !library_manifest_path(&path).exists() {
        return Err("Library not found".into());
    }
    with_library_lock(|| {
        write_manifest(&path, &manifest)?;

        let dir = section_dir(&path, CHAPTERS);
        for chapter in &manifest.chapters {
            validate_chapter_id(&chapter.id)?;
            let meta_file = meta_path(&dir, &chapter.id);
            if meta_file.exists() {
                let json = serde_json::to_string_pretty(chapter).map_err(|e| e.to_string())?;
                atomic_write(&meta_file, json.as_bytes())?;
            }
        }

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

        // Creating B made it active; opening A should make A active again.
        open_library(dir_a.to_string_lossy().to_string()).unwrap();

        assert!(get_book_settings(dir_a.to_string_lossy().to_string()).is_ok());
        let err = get_book_settings(dir_b.to_string_lossy().to_string()).unwrap_err();
        assert!(err.contains("not currently open"));

        let _ = fs::remove_dir_all(&dir_a);
        let _ = fs::remove_dir_all(&dir_b);
    }

    #[test]
    #[serial(active_library)]
    fn create_library_only_creates_manifest_and_chapters_folder() {
        let dir = temp_dir("minimal-create");
        let path = dir.as_path();
        create_library(dir.to_string_lossy().to_string(), "Minimal".to_string()).unwrap();

        assert!(library_manifest_path(path).exists());
        assert!(section_dir(path, CHAPTERS).is_dir());
        assert!(!section_dir(path, RESEARCH).exists());
        assert!(!section_dir(path, CHARACTERS).exists());
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
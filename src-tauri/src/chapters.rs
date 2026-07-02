use crate::compile::{html_to_text, load_final_chapters, read_book_settings, read_chapter_html};
use crate::library::{
    chapter_exists, ensure_library_structure, is_sidecar_section, library_paths,
    load_section_chapters, read_chapter_meta, read_manifest, reload_library_manifest,
    reorder_section, require_active_library, resolve_section, validate_chapter_id,
    validate_status, with_library_lock, write_chapter_files, write_chapter_meta_only,
    write_manifest, CHARACTER_TEMPLATE, CHAPTERS, CHARACTERS, RESEARCH, RESEARCH_TEMPLATE,
};
use crate::section_index::write_section_index;
use crate::models::{ChapterContent, ChapterMeta, LibraryImage, LibraryManifest};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// Maximum chapter HTML size (32 MiB) to avoid hanging on corrupt/huge files.
const MAX_CHAPTER_BYTES: u64 = 32 * 1024 * 1024;
/// Maximum number of chapters a single bulk-read request may ask for.
const MAX_BULK_CHAPTERS: usize = 500;

fn read_html_capped(path: &Path) -> Result<String, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_CHAPTER_BYTES {
        return Err(format!(
            "Chapter file exceeds {} MB limit",
            MAX_CHAPTER_BYTES / 1024 / 1024
        ));
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_chapter(
    library_path: String,
    title: Option<String>,
    section: Option<String>,
) -> Result<ChapterContent, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;
    ensure_library_structure(&path)?;

    let id = Uuid::new_v4().to_string();
    let title = title.unwrap_or_else(|| {
        if section == RESEARCH {
            "Untitled Research".to_string()
        } else if section == CHARACTERS {
            "New Character".to_string()
        } else {
            "Untitled Chapter".to_string()
        }
    });
    let now = Utc::now().to_rfc3339();

    let order = if section == CHAPTERS {
        read_manifest(&path)?.chapters.len() as u32
    } else {
        load_section_chapters(&path, &section)?.len() as u32
    };

    let meta = ChapterMeta {
        id,
        title,
        status: "draft".to_string(),
        order,
        updated_at: now,
        word_count: 0,
        char_count: 0,
    };

    let html = if section == CHARACTERS {
        CHARACTER_TEMPLATE.to_string()
    } else if section == RESEARCH {
        RESEARCH_TEMPLATE.to_string()
    } else {
        "<p></p>".to_string()
    };
    let meta = write_chapter_files(&path, &section, &meta, &html)?;

    if section == CHAPTERS {
        let mut manifest = read_manifest(&path)?;
        manifest.chapters.push(meta.clone());
        write_manifest(&path, &manifest)?;
    }

    Ok(ChapterContent {
        meta,
        html,
        section,
    })
}

#[tauri::command]
pub fn read_chapter(
    library_path: String,
    chapter_id: String,
    section: Option<String>,
) -> Result<ChapterContent, String> {
    validate_chapter_id(&chapter_id)?;
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;
    let paths = library_paths(&path)?;

    let html = read_html_capped(&paths.chapter_html(&section, &chapter_id))?;
    let meta = read_chapter_meta(&path, &section, &chapter_id)?;

    Ok(ChapterContent {
        meta,
        html,
        section,
    })
}

#[tauri::command]
pub fn read_chapters_bulk(
    library_path: String,
    chapter_ids: Vec<String>,
    section: Option<String>,
) -> Result<Vec<ChapterContent>, String> {
    if chapter_ids.len() > MAX_BULK_CHAPTERS {
        return Err(format!(
            "Too many chapters requested at once (max {MAX_BULK_CHAPTERS})"
        ));
    }
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;
    let paths = library_paths(&path)?;
    let mut out = Vec::with_capacity(chapter_ids.len());
    for chapter_id in chapter_ids {
        validate_chapter_id(&chapter_id)?;
        let html = read_html_capped(&paths.chapter_html(&section, &chapter_id))?;
        let meta = read_chapter_meta(&path, &section, &chapter_id)?;
        out.push(ChapterContent {
            meta,
            html,
            section: section.clone(),
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn read_comments_bulk(
    library_path: String,
    chapter_ids: Vec<String>,
    section: Option<String>,
) -> Result<Vec<crate::models::BulkChapterComments>, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;
    let mut out = Vec::with_capacity(chapter_ids.len());
    for chapter_id in chapter_ids {
        validate_chapter_id(&chapter_id)?;
        let comments = crate::comments::read_chapter_comments(&path, &chapter_id, &section)?;
        out.push(crate::models::BulkChapterComments {
            chapter_id,
            section: section.clone(),
            comments,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn save_chapter(
    library_path: String,
    meta: ChapterMeta,
    html: String,
    section: Option<String>,
) -> Result<ChapterMeta, String> {
    validate_chapter_id(&meta.id)?;
    validate_status(&meta.status)?;
    if html.len() as u64 > MAX_CHAPTER_BYTES {
        return Err(format!(
            "Chapter content exceeds {} MB limit (maximum {} MB)",
            MAX_CHAPTER_BYTES / 1024 / 1024,
            MAX_CHAPTER_BYTES / 1024 / 1024
        ));
    }
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;

    with_library_lock(|| {
        if !chapter_exists(&path, &section, &meta.id) {
            return Err("Chapter not found".to_string());
        }

        let mut meta = meta;
        meta.updated_at = Utc::now().to_rfc3339();
        meta = write_chapter_files(&path, &section, &meta, &html)?;

        if section == CHAPTERS {
            let mut manifest = read_manifest(&path)?;
            if let Some(ch) = manifest.chapters.iter_mut().find(|c| c.id == meta.id) {
                *ch = meta.clone();
            }
            write_manifest(&path, &manifest)?;
        }

        Ok(meta)
    })
}

fn apply_chapter_meta_update(
    library_path: &Path,
    chapter_id: &str,
    section: &str,
    mutate: impl FnOnce(&mut ChapterMeta),
) -> Result<ChapterMeta, String> {
    let paths = library_paths(library_path)?;
    let mut meta = read_chapter_meta(library_path, section, chapter_id)?;
    mutate(&mut meta);
    meta.updated_at = Utc::now().to_rfc3339();

    let html = fs::read_to_string(paths.chapter_html(section, chapter_id)).map_err(|e| e.to_string())?;
    let meta = write_chapter_files(library_path, section, &meta, &html)?;

    if section == CHAPTERS {
        let mut manifest = read_manifest(library_path)?;
        if let Some(ch) = manifest.chapters.iter_mut().find(|c| c.id == chapter_id) {
            *ch = meta.clone();
        }
        write_manifest(library_path, &manifest)?;
    }

    Ok(meta)
}

#[tauri::command]
pub fn update_chapter_status(
    library_path: String,
    chapter_id: String,
    status: String,
    section: Option<String>,
) -> Result<ChapterMeta, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;

    validate_chapter_id(&chapter_id)?;
    validate_status(&status)?;
    apply_chapter_meta_update(&path, &chapter_id, &section, |meta| meta.status = status)
}

#[tauri::command]
pub fn update_chapter_title(
    library_path: String,
    chapter_id: String,
    title: String,
    section: Option<String>,
) -> Result<ChapterMeta, String> {
    validate_chapter_id(&chapter_id)?;
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;

    apply_chapter_meta_update(&path, &chapter_id, &section, |meta| meta.title = title)
}

#[tauri::command]
pub fn reorder_chapters(
    library_path: String,
    chapter_ids: Vec<String>,
    section: Option<String>,
) -> Result<LibraryManifest, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;

    if is_sidecar_section(&section) {
        return with_library_lock(|| {
            reorder_section(&path, &section, &chapter_ids)?;
            reload_library_manifest(&path, library_path)
        });
    }

    with_library_lock(|| {
        let mut manifest = read_manifest(&path)?;
        if chapter_ids.len() != manifest.chapters.len() {
            return Err("Reorder must include every chapter".into());
        }
        for ch in &manifest.chapters {
            if !chapter_ids.contains(&ch.id) {
                return Err(format!("Missing chapter id: {}", ch.id));
            }
        }

        let mut reordered = Vec::new();
        for (order, id) in chapter_ids.iter().enumerate() {
            validate_chapter_id(id)?;
            let mut ch = manifest
                .chapters
                .iter()
                .find(|c| &c.id == id)
                .cloned()
                .ok_or_else(|| format!("Chapter not found: {id}"))?;
            ch.order = order as u32;
            ch.updated_at = Utc::now().to_rfc3339();
            write_chapter_meta_only(&path, CHAPTERS, &ch)?;
            reordered.push(ch);
        }

        manifest.chapters = reordered;
        write_manifest(&path, &manifest)?;
        Ok(manifest)
    })
}

#[tauri::command]
pub fn delete_chapter(
    library_path: String,
    chapter_id: String,
    section: Option<String>,
) -> Result<LibraryManifest, String> {
    validate_chapter_id(&chapter_id)?;
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;

    with_library_lock(|| {
        let paths = library_paths(&path)?;
        let html_file = paths.chapter_html(&section, &chapter_id);

        if html_file.exists() {
            fs::remove_file(&html_file).map_err(|e| e.to_string())?;
        }
        if paths.layout() == crate::paths::LayoutVersion::Legacy {
            let meta_file = paths.meta_json(&section, &chapter_id);
            if meta_file.exists() {
                fs::remove_file(&meta_file).map_err(|e| e.to_string())?;
            }
        }
        crate::search_index::remove_search_entry(&path, &section, &chapter_id)?;
        crate::comments::delete_chapter_comments(&path, &chapter_id, &section)?;
        crate::mindmap::remove_node(&path, &section, &chapter_id)?;
        crate::snapshots::delete_chapter_snapshots(&path, &chapter_id, &section)?;

        if section == CHAPTERS {
            let mut manifest = read_manifest(&path)?;
            manifest.chapters.retain(|c| c.id != chapter_id);
            for (i, ch) in manifest.chapters.iter_mut().enumerate() {
                ch.order = i as u32;
            }
            write_manifest(&path, &manifest)?;
            return Ok(manifest);
        }

        let mut items = load_section_chapters(&path, &section)?;
        items.retain(|c| c.id != chapter_id);
        for (i, ch) in items.iter_mut().enumerate() {
            ch.order = i as u32;
        }
        write_section_index(&path, &section, &items)?;
        reload_library_manifest(&path, library_path)
    })
}

#[tauri::command]
pub fn duplicate_chapter(
    library_path: String,
    chapter_id: String,
    section: Option<String>,
) -> Result<ChapterContent, String> {
    validate_chapter_id(&chapter_id)?;
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;
    let content = read_chapter(
        library_path.clone(),
        chapter_id.clone(),
        Some(section.clone()),
    )?;

    let new_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let order = if section == CHAPTERS {
        read_manifest(&path)?.chapters.len() as u32
    } else {
        load_section_chapters(&path, &section)?.len() as u32
    };

    let new_id_copy = new_id.clone();
    let meta = ChapterMeta {
        id: new_id,
        title: format!("{} (copy)", content.meta.title),
        status: "draft".to_string(),
        order,
        updated_at: now,
        word_count: 0,
        char_count: 0,
    };

    let meta = write_chapter_files(&path, &section, &meta, &content.html)?;

    let source_comments =
        crate::comments::read_chapter_comments(&path, &chapter_id, &section)?;
    if !source_comments.threads.is_empty() || !source_comments.changes.is_empty() {
        crate::comments::write_chapter_comments(&path, &new_id_copy, &section, &source_comments)?;
    }

    if section == CHAPTERS {
        let mut manifest = read_manifest(&path)?;
        manifest.chapters.push(meta.clone());
        write_manifest(&path, &manifest)?;
    }

    Ok(ChapterContent {
        meta,
        html: content.html,
        section,
    })
}

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp"];

fn images_dir(library_path: &Path) -> PathBuf {
    crate::paths::LibraryPaths::detect_or_legacy(library_path).images_dir()
}

#[tauri::command]
pub fn import_library_image(
    library_path: String,
    source_path: String,
) -> Result<LibraryImage, String> {
    let lib = PathBuf::from(&library_path);
    require_active_library(&lib)?;
    let source = PathBuf::from(&source_path);
    if !source.is_file() {
        return Err("Image file not found".into());
    }
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if !IMAGE_EXTENSIONS.contains(&ext.as_str()) {
        return Err("Unsupported image format".into());
    }
    let dir = images_dir(&lib);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let filename = format!("{}.{}", Uuid::new_v4(), ext);
    let dest = dir.join(&filename);
    fs::copy(&source, &dest).map_err(|e| format!("Could not copy image: {e}"))?;
    let relative_path = format!("images/{filename}");
    Ok(LibraryImage {
        relative_path: relative_path.clone(),
        path: dest.to_string_lossy().to_string(),
        filename,
    })
}

#[tauri::command]
pub fn save_chapter_snapshot(
    library_path: String,
    chapter_id: String,
    section: Option<String>,
) -> Result<crate::models::ChapterSnapshot, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;
    with_library_lock(|| crate::snapshots::save_chapter_snapshot(&path, &chapter_id, &section))
}

#[tauri::command]
pub fn list_chapter_snapshots(
    library_path: String,
    chapter_id: String,
    section: Option<String>,
) -> Result<Vec<crate::models::ChapterSnapshot>, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;
    crate::snapshots::list_chapter_snapshots(&path, &chapter_id, &section)
}

#[tauri::command]
pub fn restore_chapter_snapshot(
    library_path: String,
    chapter_id: String,
    section: Option<String>,
    snapshot_id: String,
) -> Result<ChapterContent, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;
    with_library_lock(|| {
        crate::snapshots::restore_chapter_snapshot(&path, &chapter_id, &section, &snapshot_id)
    })
}

#[tauri::command]
pub fn read_chapter_comments(
    library_path: String,
    chapter_id: String,
    section: Option<String>,
) -> Result<crate::comments::ChapterComments, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;
    crate::comments::read_chapter_comments(&path, &chapter_id, &section)
}

#[tauri::command]
pub fn save_chapter_comments(
    library_path: String,
    chapter_id: String,
    section: Option<String>,
    data: crate::comments::ChapterComments,
) -> Result<crate::comments::ChapterComments, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = resolve_section(section)?;
    with_library_lock(|| {
        crate::comments::write_chapter_comments(&path, &chapter_id, &section, &data)?;
        Ok(data)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::comments::{write_chapter_comments, ChapterComments, CommentThread, CommentReply};
    use crate::library::{create_library, library_paths};

    use serial_test::serial;
    use std::fs;
    use uuid::Uuid;

    fn temp_library_with_chapter() -> (PathBuf, String, String) {
        let dir = std::env::temp_dir().join(format!("darktext-ch-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.to_string_lossy().to_string();
        create_library(path.clone(), "Test".to_string()).unwrap();
        let content = create_chapter(path.clone(), Some("Original".to_string()), Some(CHAPTERS.to_string()))
            .unwrap();
        (dir, path, content.meta.id)
    }

    #[test]
    #[serial(active_library)]
    fn delete_chapter_removes_content_sidecars_and_snapshots() {
        use crate::comments::{write_chapter_comments, ChapterComments, CommentThread, CommentReply};
        use crate::snapshots::{list_chapter_snapshots, save_chapter_snapshot};

        let (dir, path, id) = temp_library_with_chapter();
        write_chapter_files(
            &dir,
            CHAPTERS,
            &read_chapter(path.clone(), id.clone(), Some(CHAPTERS.to_string()))
                .unwrap()
                .meta,
            "<p>Delete me</p>",
        )
        .unwrap();
        write_chapter_comments(
            &dir,
            &id,
            CHAPTERS,
            &ChapterComments {
                threads: vec![CommentThread {
                    id: "t1".to_string(),
                    mark_id: "m1".to_string(),
                    anchor_text: "anchor".to_string(),
                    resolved: false,
                    replies: vec![CommentReply {
                        id: "r1".to_string(),
                        text: "note".to_string(),
                        author: "Author".to_string(),
                        created_at: Utc::now().to_rfc3339(),
                    }],
                }],
                changes: vec![],
            },
        )
        .unwrap();
        save_chapter_snapshot(&dir, &id, CHAPTERS).unwrap();

        let manifest = delete_chapter(path.clone(), id.clone(), Some(CHAPTERS.to_string())).unwrap();
        assert!(!manifest.chapters.iter().any(|c| c.id == id));
        let paths = library_paths(&dir).unwrap();
        assert!(!paths.chapter_html(CHAPTERS, &id).exists());
        assert!(!paths.comments_json(CHAPTERS, &id).exists());
        assert!(list_chapter_snapshots(&dir, &id, CHAPTERS).unwrap().is_empty());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn create_chapter_after_deleting_all_succeeds() {
        let (dir, path, id) = temp_library_with_chapter();
        delete_chapter(path.clone(), id, Some(CHAPTERS.to_string())).unwrap();

        let manifest = read_manifest(&dir).unwrap();
        assert!(manifest.chapters.is_empty());

        let created =
            create_chapter(path.clone(), Some("Fresh start".to_string()), Some(CHAPTERS.to_string()))
                .unwrap();
        assert_eq!(created.meta.title, "Fresh start");

        let manifest = read_manifest(&dir).unwrap();
        assert_eq!(manifest.chapters.len(), 1);
        assert_eq!(manifest.chapters[0].id, created.meta.id);
        assert!(library_paths(&dir)
            .unwrap()
            .chapter_html(CHAPTERS, &created.meta.id)
            .exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn save_chapter_after_delete_does_not_recreate_chapter() {
        let (dir, path, id) = temp_library_with_chapter();
        let meta = read_chapter(path.clone(), id.clone(), Some(CHAPTERS.to_string()))
            .unwrap()
            .meta;
        delete_chapter(path.clone(), id.clone(), Some(CHAPTERS.to_string())).unwrap();

        let err = save_chapter(
            path.clone(),
            meta,
            "<p>zombie</p>".to_string(),
            Some(CHAPTERS.to_string()),
        )
        .unwrap_err();
        assert!(err.contains("not found"));
        assert!(!library_paths(&dir)
            .unwrap()
            .chapter_html(CHAPTERS, &id)
            .exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn read_chapters_bulk_returns_each_chapter() {
        let (_dir, path, id) = temp_library_with_chapter();
        let bulk = read_chapters_bulk(path.clone(), vec![id.clone()], Some(CHAPTERS.to_string())).unwrap();
        assert_eq!(bulk.len(), 1);
        assert_eq!(bulk[0].meta.id, id);
        assert!(bulk[0].html.contains("Original") || bulk[0].html.contains("<p>"));
        let _ = fs::remove_dir_all(&_dir);
    }

    #[test]
    #[serial(active_library)]
    fn duplicate_chapter_copies_comments_sidecar() {
        let (dir, path, id) = temp_library_with_chapter();
        write_chapter_comments(
            &dir,
            &id,
            CHAPTERS,
            &ChapterComments {
                threads: vec![CommentThread {
                    id: "t1".to_string(),
                    mark_id: "m1".to_string(),
                    anchor_text: "anchor".to_string(),
                    resolved: false,
                    replies: vec![CommentReply {
                        id: "r1".to_string(),
                        text: "Keep me".to_string(),
                        author: "Author".to_string(),
                        created_at: Utc::now().to_rfc3339(),
                    }],
                }],
                changes: vec![],
            },
        )
        .unwrap();

        let dup = duplicate_chapter(path.clone(), id, Some(CHAPTERS.to_string())).unwrap();
        let copied = crate::comments::read_chapter_comments(&dir, &dup.meta.id, CHAPTERS).unwrap();
        assert_eq!(copied.threads.len(), 1);
        assert_eq!(copied.threads[0].replies[0].text, "Keep me");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn library_workflow_roundtrip() {
        use crate::compile::strip_review_marks;
        use crate::snapshots::{list_chapter_snapshots, save_chapter_snapshot};

        let (dir, path, id) = temp_library_with_chapter();
        let marked = "<p>Hello <span class=\"dt-insertion\" data-mark-id=\"x\">world</span></p>";
        write_chapter_files(
            &dir,
            CHAPTERS,
            &read_chapter(path.clone(), id.clone(), Some(CHAPTERS.to_string()))
                .unwrap()
                .meta,
            marked,
        )
        .unwrap();

        assert_eq!(strip_review_marks(marked), "<p>Hello world</p>");

        let snap = save_chapter_snapshot(&dir, &id, CHAPTERS).unwrap();
        assert_eq!(snap.word_count, 2);

        let list = list_chapter_snapshots(&dir, &id, CHAPTERS).unwrap();
        assert_eq!(list.len(), 1);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn update_chapter_status_persists_and_syncs_manifest() {
        let (dir, path, id) = temp_library_with_chapter();

        let updated = update_chapter_status(
            path.clone(),
            id.clone(),
            "final".to_string(),
            Some(CHAPTERS.to_string()),
        )
        .unwrap();
        assert_eq!(updated.status, "final");

        let manifest = read_manifest(&dir).unwrap();
        let ch = manifest.chapters.iter().find(|c| c.id == id).unwrap();
        assert_eq!(ch.status, "final");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn update_chapter_title_persists_and_syncs_manifest() {
        let (dir, path, id) = temp_library_with_chapter();

        let updated = update_chapter_title(
            path.clone(),
            id.clone(),
            "Renamed".to_string(),
            Some(CHAPTERS.to_string()),
        )
        .unwrap();
        assert_eq!(updated.title, "Renamed");

        let manifest = read_manifest(&dir).unwrap();
        let ch = manifest.chapters.iter().find(|c| c.id == id).unwrap();
        assert_eq!(ch.title, "Renamed");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn reorder_chapters_on_sidecar_section_reorders_in_place() {
        let dir = std::env::temp_dir().join(format!("darktext-reorder-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.to_string_lossy().to_string();
        create_library(path.clone(), "Test".to_string()).unwrap();

        let a = create_chapter(path.clone(), Some("A".to_string()), Some(RESEARCH.to_string()))
            .unwrap();
        let b = create_chapter(path.clone(), Some("B".to_string()), Some(RESEARCH.to_string()))
            .unwrap();

        reorder_chapters(
            path.clone(),
            vec![b.meta.id.clone(), a.meta.id.clone()],
            Some(RESEARCH.to_string()),
        )
        .unwrap();

        let items = crate::library::load_section_chapters(&dir, RESEARCH).unwrap();
        assert_eq!(items[0].id, b.meta.id);
        assert_eq!(items[1].id, a.meta.id);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn save_chapter_rejects_invalid_status() {
        let (dir, path, id) = temp_library_with_chapter();
        let mut meta = read_chapter_meta(&dir, CHAPTERS, &id).unwrap();
        meta.status = "bogus-status".to_string();

        let err = save_chapter(path, meta, "<p>hi</p>".to_string(), None).unwrap_err();
        assert!(err.contains("Invalid status"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn save_chapter_rejects_oversized_html() {
        let (dir, path, id) = temp_library_with_chapter();
        let meta = read_chapter_meta(&dir, CHAPTERS, &id).unwrap();
        let huge_html = "a".repeat(MAX_CHAPTER_BYTES as usize + 1);

        let err = save_chapter(path, meta, huge_html, None).unwrap_err();
        assert!(err.contains("exceeds"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[serial(active_library)]
    fn read_chapters_bulk_rejects_too_many_ids() {
        let (dir, path, _id) = temp_library_with_chapter();
        let ids: Vec<String> = (0..MAX_BULK_CHAPTERS + 1)
            .map(|i| format!("nonexistent-{i}"))
            .collect();

        let err = read_chapters_bulk(path, ids, Some(CHAPTERS.to_string())).unwrap_err();
        assert!(err.contains("Too many chapters"));

        let _ = fs::remove_dir_all(&dir);
    }
}

#[tauri::command]
pub fn get_compile_preview(library_path: String) -> Result<String, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let settings = read_book_settings(&path)?;
    let finals = load_final_chapters(&path)?;
    let mut preview = String::new();
    if !settings.title.is_empty() {
        preview.push_str(&format!("# {}\n\n", settings.title));
    }
    for meta in finals.iter().take(3) {
        let html = read_chapter_html(&path, &meta.id)?;
        preview.push_str(&format!(
            "## {}\n{}\n\n",
            meta.title,
            html_to_text(&html).chars().take(200).collect::<String>()
        ));
    }
    if finals.len() > 3 {
        preview.push_str(&format!("… and {} more chapters", finals.len() - 3));
    }
    Ok(preview)
}

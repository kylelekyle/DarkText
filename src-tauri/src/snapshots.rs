use crate::compile::stats_from_html;
use crate::library::{
    atomic_write, html_path, meta_path, read_meta_file, section_dir, validate_chapter_id,
    write_chapter_files,
};
use crate::models::{ChapterContent, ChapterSnapshot};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_SNAPSHOTS_PER_CHAPTER: usize = 30;

fn snapshot_root(library_path: &Path, section: &str, chapter_id: &str) -> PathBuf {
    library_path
        .join("snapshots")
        .join(section)
        .join(chapter_id)
}

pub fn save_chapter_snapshot(
    library_path: &Path,
    chapter_id: &str,
    section: &str,
) -> Result<ChapterSnapshot, String> {
    validate_chapter_id(chapter_id)?;
    let html_file = html_path(&section_dir(library_path, section), chapter_id);
    if !html_file.exists() {
        return Err("Chapter not found".into());
    }
    let html = fs::read_to_string(&html_file).map_err(|e| e.to_string())?;
    let meta = read_meta_file(&meta_path(&section_dir(library_path, section), chapter_id))?;
    let (words, chars) = stats_from_html(&html);
    let created_at = Utc::now().to_rfc3339();
    let id = created_at.replace(':', "-");

    let dir = snapshot_root(library_path, section, chapter_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    atomic_write(&dir.join(format!("{id}.html")), html.as_bytes())?;

    let snapshot = ChapterSnapshot {
        id: id.clone(),
        created_at,
        title: meta.title,
        word_count: words,
        char_count: chars,
    };
    let json = serde_json::to_string_pretty(&snapshot).map_err(|e| e.to_string())?;
    atomic_write(&dir.join(format!("{id}.meta.json")), json.as_bytes())?;

    prune_old_snapshots(&dir)?;

    Ok(snapshot)
}

fn prune_old_snapshots(dir: &Path) -> Result<(), String> {
    let mut entries: Vec<(String, std::time::SystemTime)> = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
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
        let modified = entry
            .metadata()
            .map_err(|e| e.to_string())?
            .modified()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        entries.push((id, modified));
    }
    if entries.len() <= MAX_SNAPSHOTS_PER_CHAPTER {
        return Ok(());
    }
    entries.sort_by_key(|(_, t)| *t);
    let remove_count = entries.len() - MAX_SNAPSHOTS_PER_CHAPTER;
    for (id, _) in entries.into_iter().take(remove_count) {
        let _ = fs::remove_file(dir.join(format!("{id}.html")));
        let _ = fs::remove_file(dir.join(format!("{id}.meta.json")));
    }
    Ok(())
}

pub fn list_chapter_snapshots(
    library_path: &Path,
    chapter_id: &str,
    section: &str,
) -> Result<Vec<ChapterSnapshot>, String> {
    validate_chapter_id(chapter_id)?;
    let dir = snapshot_root(library_path, section, chapter_id);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut snaps = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let is_meta = path
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.ends_with(".meta.json"));
        if !is_meta {
            continue;
        }
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let snap: ChapterSnapshot = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        snaps.push(snap);
    }
    snaps.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(snaps)
}

pub fn delete_chapter_snapshots(
    library_path: &Path,
    chapter_id: &str,
    section: &str,
) -> Result<(), String> {
    validate_chapter_id(chapter_id)?;
    let dir = snapshot_root(library_path, section, chapter_id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn restore_chapter_snapshot(
    library_path: &Path,
    chapter_id: &str,
    section: &str,
    snapshot_id: &str,
) -> Result<ChapterContent, String> {
    validate_chapter_id(chapter_id)?;
    if snapshot_id.contains('/') || snapshot_id.contains('\\') || snapshot_id.contains('\0') {
        return Err("Invalid snapshot id".into());
    }
    let dir = snapshot_root(library_path, section, chapter_id);
    let html_file = dir.join(format!("{snapshot_id}.html"));
    if !html_file.exists() {
        return Err("Snapshot not found".into());
    }
    let html = fs::read_to_string(&html_file).map_err(|e| e.to_string())?;
    let meta = read_meta_file(&meta_path(&section_dir(library_path, section), chapter_id))?;
    let updated = write_chapter_files(library_path, section, &meta, &html)?;
    Ok(ChapterContent {
        meta: updated,
        html,
        section: section.to_string(),
    })
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
    fn save_and_list_snapshot() {
        let dir = std::env::temp_dir().join(format!("darktext-snap-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.to_string_lossy().to_string();
        create_library(path.clone(), "Test".to_string()).unwrap();
        let content = crate::chapters::create_chapter(path.clone(), Some("Ch".into()), Some(CHAPTERS.to_string()))
            .unwrap();
        write_chapter_files(&dir, CHAPTERS, &content.meta, "<p>v1</p>").unwrap();

        let snap = save_chapter_snapshot(&dir, &content.meta.id, CHAPTERS).unwrap();
        assert_eq!(snap.word_count, 1);

        let list = list_chapter_snapshots(&dir, &content.meta.id, CHAPTERS).unwrap();
        assert_eq!(list.len(), 1);

        write_chapter_files(&dir, CHAPTERS, &content.meta, "<p>v2</p>").unwrap();
        let restored = restore_chapter_snapshot(&dir, &content.meta.id, CHAPTERS, &snap.id).unwrap();
        assert!(restored.html.contains("v1"));

        let _ = fs::remove_dir_all(&dir);
    }
}
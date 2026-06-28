use crate::comments::read_chapter_comments;
use crate::library::{
    load_section_chapters, read_manifest, require_active_library, CHAPTERS, CHARACTERS, RESEARCH,
};
use crate::models::{ChapterReviewSummary, LibraryReviewSummary};
use std::path::{Path, PathBuf};

fn summarize_section(
    library_path: &Path,
    section: &str,
    items: &[crate::models::ChapterMeta],
) -> Result<Vec<ChapterReviewSummary>, String> {
    let mut out = Vec::new();
    for meta in items {
        let data = read_chapter_comments(library_path, &meta.id, section)?;
        let open_comments = data.threads.iter().filter(|t| !t.resolved).count() as u32;
        let pending_changes = data
            .changes
            .iter()
            .filter(|c| c.status == "pending")
            .count() as u32;
        if open_comments > 0 || pending_changes > 0 {
            out.push(ChapterReviewSummary {
                chapter_id: meta.id.clone(),
                section: section.to_string(),
                title: meta.title.clone(),
                open_comments,
                pending_changes,
            });
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn get_library_review_summary(library_path: String) -> Result<LibraryReviewSummary, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let manifest = read_manifest(&path)?;
    let mut chapters = summarize_section(&path, CHAPTERS, &manifest.chapters)?;
    chapters.extend(summarize_section(
        &path,
        RESEARCH,
        &load_section_chapters(&path, RESEARCH)?,
    )?);
    chapters.extend(summarize_section(
        &path,
        CHARACTERS,
        &load_section_chapters(&path, CHARACTERS)?,
    )?);

    let total_open_comments = chapters.iter().map(|c| c.open_comments).sum();
    let total_pending_changes = chapters.iter().map(|c| c.pending_changes).sum();

    Ok(LibraryReviewSummary {
        total_open_comments,
        total_pending_changes,
        chapters,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::comments::{write_chapter_comments, ChapterComments, CommentReply, CommentThread};
    use crate::library::{create_library, write_chapter_files, CHAPTERS};
    use chrono::Utc;
    use serial_test::serial;
    use std::fs;
    use uuid::Uuid;

    fn temp_library() -> (PathBuf, String) {
        let dir = std::env::temp_dir().join(format!("darktext-review-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.to_string_lossy().to_string();
        create_library(path.clone(), "Test".to_string()).unwrap();
        (dir, path)
    }

    #[test]
    #[serial(active_library)]
    fn summary_counts_open_comments_and_pending_changes() {
        let (dir, path) = temp_library();
        let id = Uuid::new_v4().to_string();
        let meta = crate::models::ChapterMeta {
            id: id.clone(),
            title: "Ch1".to_string(),
            status: "draft".to_string(),
            order: 0,
            updated_at: Utc::now().to_rfc3339(),
            word_count: 1,
            char_count: 1,
        };
        write_chapter_files(&dir, CHAPTERS, &meta, "<p>Hi</p>").unwrap();
        let mut manifest = read_manifest(&dir).unwrap();
        manifest.chapters.push(meta);
        crate::library::write_manifest(&dir, &manifest).unwrap();

        write_chapter_comments(
            &dir,
            &id,
            CHAPTERS,
            &ChapterComments {
                threads: vec![CommentThread {
                    id: "t1".to_string(),
                    mark_id: "m1".to_string(),
                    anchor_text: "Hi".to_string(),
                    resolved: false,
                    replies: vec![CommentReply {
                        id: "r1".to_string(),
                        text: "Note".to_string(),
                        author: "Editor".to_string(),
                        created_at: Utc::now().to_rfc3339(),
                    }],
                }],
                changes: vec![crate::comments::TrackedChange {
                    id: "c1".to_string(),
                    mark_id: "ch1".to_string(),
                    change_type: "insertion".to_string(),
                    text: "x".to_string(),
                    status: "pending".to_string(),
                    created_at: Utc::now().to_rfc3339(),
                }],
            },
        )
        .unwrap();

        let summary = get_library_review_summary(path).unwrap();
        assert_eq!(summary.total_open_comments, 1);
        assert_eq!(summary.total_pending_changes, 1);
        assert_eq!(summary.chapters.len(), 1);

        let _ = fs::remove_dir_all(&dir);
    }
}
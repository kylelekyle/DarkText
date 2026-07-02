use crate::library::{chapter_exists, read_json_or_default, write_json};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommentReply {
    pub id: String,
    pub text: String,
    pub author: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommentThread {
    pub id: String,
    pub mark_id: String,
    pub anchor_text: String,
    pub resolved: bool,
    pub replies: Vec<CommentReply>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrackedChange {
    pub id: String,
    pub mark_id: String,
    #[serde(rename = "type")]
    pub change_type: String,
    pub text: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChapterComments {
    pub threads: Vec<CommentThread>,
    pub changes: Vec<TrackedChange>,
}

fn comments_path(library_path: &Path, section: &str, chapter_id: &str) -> std::path::PathBuf {
    crate::paths::LibraryPaths::detect_or_legacy(library_path).comments_json(section, chapter_id)
}

pub fn read_chapter_comments(
    library_path: &Path,
    chapter_id: &str,
    section: &str,
) -> Result<ChapterComments, String> {
    read_json_or_default(&comments_path(library_path, section, chapter_id))
}

pub fn write_chapter_comments(
    library_path: &Path,
    chapter_id: &str,
    section: &str,
    data: &ChapterComments,
) -> Result<(), String> {
    if !chapter_exists(library_path, section, chapter_id) {
        return Err("Chapter not found".to_string());
    }
    write_json(&comments_path(library_path, section, chapter_id), data)
}

pub fn delete_chapter_comments(
    library_path: &Path,
    chapter_id: &str,
    section: &str,
) -> Result<(), String> {
    let path = comments_path(library_path, section, chapter_id);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChapterMeta {
    pub id: String,
    pub title: String,
    pub status: String,
    pub order: u32,
    pub updated_at: String,
    #[serde(default)]
    pub word_count: u32,
    #[serde(default)]
    pub char_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryManifest {
    pub name: String,
    pub version: u32,
    pub path: String,
    pub chapters: Vec<ChapterMeta>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterContent {
    pub meta: ChapterMeta,
    pub html: String,
    pub section: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChapterSnapshot {
    pub id: String,
    pub created_at: String,
    pub title: String,
    pub word_count: u32,
    pub char_count: u32,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryImage {
    pub relative_path: String,
    pub path: String,
    pub filename: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkChapterComments {
    pub chapter_id: String,
    pub section: String,
    pub comments: crate::comments::ChapterComments,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub path: String,
    pub format: String,
    pub preview: String,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CompileOptions {
    pub format: String,
    pub include_research: Option<bool>,
    pub include_characters: Option<bool>,
    pub filename: Option<String>,
    pub output_dir: Option<String>,
    pub style: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportChaptersOptions {
    pub combined: bool,
    pub output_dir: Option<String>,
    pub filename: Option<String>,
    pub style: Option<String>,
    pub section: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySearchHit {
    pub chapter_id: String,
    pub section: String,
    pub title: String,
    pub excerpt: String,
    pub match_index: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterReviewSummary {
    pub chapter_id: String,
    pub section: String,
    pub title: String,
    pub open_comments: u32,
    pub pending_changes: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryReviewSummary {
    pub total_open_comments: u32,
    pub total_pending_changes: u32,
    pub chapters: Vec<ChapterReviewSummary>,
}
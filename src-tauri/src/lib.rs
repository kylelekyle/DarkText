mod comments;
mod compile;
mod fonts;
mod mindmap;

mod models;
mod library;
mod chapters;
mod export_cmds;
mod search;
mod search_index;
mod review_summary;
mod snapshots;

pub use library::{
    atomic_write, load_section_chapters, read_json, read_json_or_default, read_manifest,
    section_dir, meta_path, write_json, CHAPTERS,
};
pub use models::{ChapterMeta, CompileOptions};
pub use comments::{ChapterComments, CommentReply, CommentThread, TrackedChange};

pub use chapters::*;
pub use export_cmds::*;
pub use search::*;
pub use review_summary::*;
pub use mindmap::{read_mindmap, write_mindmap, MindMapData, MindMapNodePos};
pub use library::{
    close_library, create_library, is_library_path, open_library, trash_library_folder,
    save_library_manifest,
    get_book_settings, save_book_settings, list_research_chapters, list_character_chapters,
    get_compile_chapters,
};

use library::{require_active_library, with_library_lock};
use std::path::PathBuf;

#[tauri::command]
fn list_system_fonts() -> Result<Vec<String>, String> {
    Ok(fonts::list_system_fonts())
}

#[tauri::command]
fn list_library_fonts(library_path: String) -> Result<Vec<fonts::LibraryFont>, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    fonts::list_library_fonts(&path)
}

#[tauri::command]
fn import_library_font(library_path: String, source_path: String) -> Result<fonts::LibraryFont, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    fonts::import_library_font(&path, &PathBuf::from(&source_path))
}

#[tauri::command]
fn get_mindmap(library_path: String) -> Result<mindmap::MindMapData, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    mindmap::read_mindmap(&path)
}

#[tauri::command]
fn save_mindmap(
    library_path: String,
    data: mindmap::MindMapData,
) -> Result<mindmap::MindMapData, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    with_library_lock(|| {
        mindmap::write_mindmap(&path, &data)?;
        Ok(data)
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            create_library,
            is_library_path,
            open_library,
            trash_library_folder,
            close_library,
            create_chapter,
            read_chapter,
            read_chapters_bulk,
            read_comments_bulk,
            save_chapter,
            save_library_manifest,
            update_chapter_status,
            update_chapter_title,
            reorder_chapters,
            list_research_chapters,
            list_character_chapters,
            get_compile_chapters,
            get_book_settings,
            save_book_settings,
            delete_chapter,
            duplicate_chapter,
            export_chapter,
            export_chapters,
            write_export_bytes,
            read_file_bytes,
            strip_review_marks_html,
            sanitize_filename_title,
            list_system_fonts,
            list_library_fonts,
            import_library_font,
            compile_book,
            read_chapter_comments,
            save_chapter_comments,
            get_compile_preview,
            get_mindmap,
            save_mindmap,
            search_library,
            get_library_review_summary,
            export_marked_manuscript,
            export_comments_report,
            import_library_image,
            save_chapter_snapshot,
            list_chapter_snapshots,
            restore_chapter_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
use darktext_lib::{
    ChapterComments, CommentReply, CommentThread, CompileOptions, MindMapData, MindMapNodePos,
    TrackedChange,
};
use serial_test::serial;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// End-to-end smoke coverage of the core authoring workflow: library lifecycle,
/// write/save, review sidecars, search, export, compile, mind-map persist,
/// and chapter delete. DOCX export is TypeScript-only; this exercises Rust paths.
#[test]
#[serial(active_library)]
fn open_save_search_export_workflow() {
    let dir = std::env::temp_dir().join(format!("darktext-workflow-{}", Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap();
    let path = dir.to_string_lossy().to_string();

    darktext_lib::create_library(path.clone(), "Workflow Test".to_string()).unwrap();
    let content =
        darktext_lib::create_chapter(path.clone(), Some("Chapter One".to_string()), None)
            .unwrap();

    let marked_html =
        "<p>The quick <span class=\"dt-insertion\" data-change-id=\"m1\">brown zebra</span> jumps.</p>";
    let saved = darktext_lib::save_chapter(
        path.clone(),
        content.meta.clone(),
        marked_html.to_string(),
        None,
    )
    .unwrap();
    assert_eq!(saved.id, content.meta.id);

    // Review sidecar: comments + tracked changes
    let comments = ChapterComments {
        threads: vec![CommentThread {
            id: "t1".to_string(),
            mark_id: "c1".to_string(),
            anchor_text: "zebra".to_string(),
            resolved: false,
            replies: vec![CommentReply {
                id: "r1".to_string(),
                text: "Check this insertion".to_string(),
                author: "Reviewer".to_string(),
                created_at: "2026-06-27T00:00:00Z".to_string(),
            }],
        }],
        changes: vec![TrackedChange {
            id: "ch1".to_string(),
            mark_id: "m1".to_string(),
            change_type: "insertion".to_string(),
            text: "brown zebra".to_string(),
            status: "pending".to_string(),
            created_at: "2026-06-27T00:00:00Z".to_string(),
        }],
    };
    darktext_lib::save_chapter_comments(
        path.clone(),
        content.meta.id.clone(),
        None,
        comments,
    )
    .unwrap();

    let summary = darktext_lib::get_library_review_summary(path.clone()).unwrap();
    assert_eq!(summary.total_open_comments, 1);
    assert_eq!(summary.total_pending_changes, 1);

    let hits = darktext_lib::search_library(path.clone(), "zebra".to_string(), None).unwrap();
    assert_eq!(hits.len(), 1, "saved chapter should be findable by body text");
    assert_eq!(hits[0].chapter_id, content.meta.id);

    let html_export = darktext_lib::export_chapter(
        path.clone(),
        content.meta.id.clone(),
        "html".to_string(),
        None,
    )
    .unwrap();
    assert!(PathBuf::from(&html_export.path).exists());
    let exported_html = fs::read_to_string(&html_export.path).unwrap();
    assert!(!exported_html.contains("dt-insertion"));
    assert!(exported_html.contains("brown zebra"));

    let md_export = darktext_lib::export_chapter(
        path.clone(),
        content.meta.id.clone(),
        "markdown".to_string(),
        None,
    )
    .unwrap();
    assert!(PathBuf::from(&md_export.path).exists());

    // Compile requires at least one Final chapter
    darktext_lib::update_chapter_status(
        path.clone(),
        content.meta.id.clone(),
        "final".to_string(),
        None,
    )
    .unwrap();
    let compile = darktext_lib::compile_book(
        path.clone(),
        CompileOptions {
            format: "html".to_string(),
            include_research: Some(false),
            include_characters: Some(false),
            filename: None,
            output_dir: None,
            style: None,
        },
    )
    .unwrap();
    assert!(PathBuf::from(&compile.path).exists());

    // Research sidecar create + export
    let research = darktext_lib::create_chapter(
        path.clone(),
        Some("Notes".to_string()),
        Some("research".to_string()),
    )
    .unwrap();
    darktext_lib::save_chapter(
        path.clone(),
        research.meta.clone(),
        "<p>Research detail</p>".to_string(),
        Some("research".to_string()),
    )
    .unwrap();
    let research_export = darktext_lib::export_chapter(
        path.clone(),
        research.meta.id.clone(),
        "text".to_string(),
        Some("research".to_string()),
    )
    .unwrap();
    assert!(PathBuf::from(&research_export.path).exists());

    // Mind-map persist round-trip
    let lib_path = Path::new(&path);
    let mut mindmap = MindMapData::default();
    let node_key = format!("chapters:{}", content.meta.id);
    mindmap.nodes.insert(
        node_key,
        MindMapNodePos {
            x: 120.0,
            y: 80.0,
            pinned: true,
        },
    );
    darktext_lib::write_mindmap(lib_path, &mindmap).unwrap();
    let loaded = darktext_lib::read_mindmap(lib_path).unwrap();
    assert!(loaded.nodes.contains_key(&format!("chapters:{}", content.meta.id)));

    // Delete disposable chapter (create then remove)
    let disposable =
        darktext_lib::create_chapter(path.clone(), Some("To Delete".to_string()), None).unwrap();
    let disposable_id = disposable.meta.id.clone();
    darktext_lib::delete_chapter(path.clone(), disposable_id.clone(), None).unwrap();
    let manifest = darktext_lib::read_manifest(lib_path).unwrap();
    assert!(
        !manifest.chapters.iter().any(|c| c.id == disposable_id),
        "deleted chapter should be gone from manifest"
    );

    let _ = fs::remove_dir_all(&dir);
}
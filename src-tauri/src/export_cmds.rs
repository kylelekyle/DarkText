use crate::comments::read_chapter_comments;
use crate::compile::{
    build_book_html, build_chapters_html, escape_html, html_to_markdown,
    html_to_text, load_final_chapters, marked_review_styles, read_book_settings, read_chapter_html,
    export_filename_stem, read_section_html, sanitize_export_filename, sanitize_filename,
    strip_review_marks, write_export_to, BookSettings, LibraryPreferences,
};
use crate::library::{load_section_chapters, CHAPTERS, CHARACTERS, RESEARCH};
use crate::library::{atomic_write, read_manifest, require_active_library, validate_chapter_id};
use crate::models::{ChapterMeta, CompileOptions, ExportChaptersOptions, ExportResult};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

fn normalize_export_section(section: Option<&str>) -> Result<&'static str, String> {
    match section.unwrap_or(CHAPTERS) {
        CHAPTERS => Ok(CHAPTERS),
        RESEARCH => Ok(RESEARCH),
        CHARACTERS => Ok(CHARACTERS),
        other => Err(format!("Invalid section: {other}")),
    }
}

fn find_chapter_meta(
    library_path: &std::path::Path,
    chapter_id: &str,
    section: &str,
) -> Result<ChapterMeta, String> {
    if section == CHAPTERS {
        let manifest = read_manifest(library_path)?;
        return manifest
            .chapters
            .into_iter()
            .find(|c| c.id == chapter_id)
            .ok_or_else(|| format!("Chapter not found: {chapter_id}"));
    }
    load_section_chapters(library_path, section)?
        .into_iter()
        .find(|c| c.id == chapter_id)
        .ok_or_else(|| format!("Chapter not found: {chapter_id}"))
}

fn style_for_format(_format: &str, preset: Option<&str>) -> &'static str {
    match preset.unwrap_or("") {
        "manuscript" => "manuscript",
        "ebook" => "ebook",
        _ => "default",
    }
}

/// DOCX is generated in TypeScript (`docxExport.ts`). Rust handles html/markdown/text only.
fn ensure_rust_export_format(format: &str) -> Result<&str, String> {
    match format {
        "docx" => Err(
            "DOCX export is handled by the app export store (TypeScript). Use exportStore."
                .into(),
        ),
        "html" | "markdown" | "md" | "text" | "txt" => Ok(format),
        other => Err(format!("Unsupported export format: {other}")),
    }
}

/// Renders a list of (meta, html) chapters into a single markdown document,
/// one `{heading_level} title` section per chapter. Shared by `export_chapters`
/// (combined export) and `compile_book` (chapters + research notes).
fn chapters_to_markdown(
    chapters: &[(ChapterMeta, String)],
    heading_level: &str,
    prefs: Option<&LibraryPreferences>,
) -> String {
    let mut out = String::new();
    for (i, (meta, html)) in chapters.iter().enumerate() {
        let body = html_to_markdown(&strip_review_marks(html));
        let heading = crate::compile::chapter_heading_for_export(meta, i + 1, prefs);
        if let Some(h) = heading {
            out.push_str(&format!("{heading_level} {h}\n\n{body}\n\n"));
        } else {
            out.push_str(&format!("{body}\n\n"));
        }
    }
    out
}

/// Plain-text counterpart to `chapters_to_markdown`.
fn chapters_to_text(
    chapters: &[(ChapterMeta, String)],
    prefs: Option<&LibraryPreferences>,
) -> String {
    let mut out = String::new();
    for (i, (meta, html)) in chapters.iter().enumerate() {
        let body = html_to_text(&strip_review_marks(html));
        let heading = crate::compile::chapter_heading_for_export(meta, i + 1, prefs);
        if let Some(h) = heading {
            out.push_str(&format!("{h}\n\n{body}\n\n"));
        } else {
            out.push_str(&format!("{body}\n\n"));
        }
    }
    out
}

fn default_compile_filename(settings: &BookSettings, format: &str) -> String {
    let base = if settings.title.is_empty() {
        "book".to_string()
    } else {
        sanitize_filename(&settings.title)
    };
    format!("{base}.{format}")
}

fn export_chapter_content(
    title: &str,
    html: &str,
    format: &str,
    filename_base: &str,
    library_path: &std::path::Path,
    output_dir: Option<&str>,
    style: &str,
) -> Result<ExportResult, String> {
    let clean = strip_review_marks(html);
    let safe_title = escape_html(title);
    let css = crate::compile::document_styles(style);
    match format {
        "html" => {
            let doc = format!(
                "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>{safe_title}</title>\
                 <style>{css}</style></head><body>{clean}</body></html>"
            );
            let preview = html_to_text(&clean).chars().take(500).collect();
            let filename = format!("{filename_base}.html");
            let out = write_export_to(library_path, &filename, doc.as_bytes(), output_dir)?;
            Ok(ExportResult {
                path: out,
                format: "html".to_string(),
                preview,
            })
        }
        "markdown" => {
            let md = format!("# {title}\n\n{}", html_to_markdown(&clean));
            let preview = md.chars().take(500).collect();
            let filename = format!("{filename_base}.md");
            let out = write_export_to(library_path, &filename, md.as_bytes(), output_dir)?;
            Ok(ExportResult {
                path: out,
                format: "markdown".to_string(),
                preview,
            })
        }
        "text" => {
            let text = html_to_text(&clean);
            let preview = text.chars().take(500).collect();
            let filename = format!("{filename_base}.txt");
            let out = write_export_to(library_path, &filename, text.as_bytes(), output_dir)?;
            Ok(ExportResult {
                path: out,
                format: "text".to_string(),
                preview,
            })
        }
        _ => Err(format!("Unsupported export format: {format}")),
    }
}

#[tauri::command]
pub fn export_chapter(
    library_path: String,
    chapter_id: String,
    format: String,
    section: Option<String>,
) -> Result<ExportResult, String> {
    validate_chapter_id(&chapter_id)?;
    ensure_rust_export_format(&format)?;
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let section = normalize_export_section(section.as_deref())?;
    let meta = find_chapter_meta(&path, &chapter_id, section)?;
    let html = read_section_html(&path, &chapter_id, section)?;
    let safe_title = sanitize_filename(&meta.title);
    export_chapter_content(&meta.title, &html, &format, &safe_title, &path, None, "default")
}

#[tauri::command]
pub fn export_chapters(
    library_path: String,
    chapter_ids: Vec<String>,
    format: String,
    options: ExportChaptersOptions,
) -> Result<ExportResult, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    if chapter_ids.is_empty() {
        return Err("No chapters selected".to_string());
    }
    ensure_rust_export_format(&format)?;

    let ExportChaptersOptions {
        combined,
        output_dir,
        filename,
        style,
        section,
    } = options;
    let section = normalize_export_section(section.as_deref())?;
    let mut chapters: Vec<(ChapterMeta, String)> = Vec::new();
    for id in &chapter_ids {
        validate_chapter_id(id)?;
        let meta = find_chapter_meta(&path, id, section)?;
        let html = read_section_html(&path, id, section)?;
        chapters.push((meta, html));
    }

    let stamp = Utc::now().format("%Y%m%d-%H%M%S");
    let preview: String = chapters
        .iter()
        .map(|(m, _)| m.title.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    let out_dir = output_dir.as_deref();
    let doc_style = style_for_format(&format, style.as_deref());
    let chapter_prefs = if section == CHAPTERS {
        Some(read_book_settings(&path)?.preferences)
    } else {
        None
    };
    let prefs_ref = chapter_prefs.as_ref();

    if combined || chapter_ids.len() == 1 {
        if chapter_ids.len() == 1 {
            let (meta, html) = &chapters[0];
            let base = filename
                .as_deref()
                .map(export_filename_stem)
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| sanitize_filename(&meta.title));
            return export_chapter_content(
                &meta.title,
                html,
                &format,
                &base,
                &path,
                out_dir,
                doc_style,
            );
        }

        let book_html = build_chapters_html(&chapters, doc_style, prefs_ref);
        let base = filename
            .as_deref()
            .map(export_filename_stem)
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| format!("export-{stamp}"));

        match format.as_str() {
            "html" => {
                let filename = format!("{base}.html");
                let out = write_export_to(&path, &filename, book_html.as_bytes(), out_dir)?;
                Ok(ExportResult {
                    path: out,
                    format: "html".to_string(),
                    preview,
                })
            }
            "markdown" => {
                let md = chapters_to_markdown(&chapters, "##", prefs_ref);
                let filename = format!("{base}.md");
                let out = write_export_to(&path, &filename, md.as_bytes(), out_dir)?;
                Ok(ExportResult {
                    path: out,
                    format: "markdown".to_string(),
                    preview,
                })
            }
            "text" => {
                let text = chapters_to_text(&chapters, prefs_ref);
                let filename = format!("{base}.txt");
                let out = write_export_to(&path, &filename, text.as_bytes(), out_dir)?;
                Ok(ExportResult {
                    path: out,
                    format: "text".to_string(),
                    preview,
                })
            }
            _ => Err(format!("Unsupported export format: {format}")),
        }
    } else {
        let mut last_path = String::new();
        for (meta, html) in &chapters {
            let base = format!("{}-{}", sanitize_filename(&meta.title), stamp);
            let res = export_chapter_content(
                &meta.title,
                html,
                &format,
                &base,
                &path,
                out_dir,
                doc_style,
            )?;
            last_path = res.path;
        }
        Ok(ExportResult {
            path: last_path,
            format,
            preview: format!("{} files exported", chapters.len()),
        })
    }
}

#[tauri::command]
pub fn compile_book(library_path: String, options: CompileOptions) -> Result<ExportResult, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let settings = read_book_settings(&path)?;
    let finals = load_final_chapters(&path)?;

    if finals.is_empty() {
        return Err("No Final chapters to compile. Mark chapters as Final in the sidebar.".to_string());
    }

    let mut chapters = Vec::new();
    for meta in &finals {
        let html = read_chapter_html(&path, &meta.id)?;
        chapters.push((meta.clone(), html));
    }

    let research = if options.include_research.unwrap_or(false) {
        crate::compile::load_research_for_export(&path)?
    } else {
        vec![]
    };

    let characters = if options.include_characters.unwrap_or(false) {
        crate::compile::load_characters_for_export(&path)?
    } else {
        vec![]
    };

    let format = options.format.as_str();
    ensure_rust_export_format(format)?;
    let doc_style = style_for_format(format, options.style.as_deref());
    let book_html = build_book_html(&settings, &chapters, &research, &characters, doc_style);
    let mut preview: String = chapters
        .iter()
        .map(|(m, _)| m.title.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    if !research.is_empty() {
        preview.push_str(&format!(" + {} research", research.len()));
    }
    if !characters.is_empty() {
        preview.push_str(&format!(" + {} characters", characters.len()));
    }

    let out_dir = options.output_dir.as_deref();
    let out_filename = options
        .filename
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| default_compile_filename(&settings, format));
    let out_dir_resolved = crate::compile::resolve_output_dir(&path, out_dir)?;
    let out_path = crate::compile::resolve_export_file_path(&out_dir_resolved, &out_filename)?;

    match format {
        "html" => {
            atomic_write(&out_path, book_html.as_bytes())?;
            Ok(ExportResult {
                path: out_path.to_string_lossy().to_string(),
                format: format.to_string(),
                preview,
            })
        }
        "markdown" => {
            let mut md = String::new();
            if !settings.title.is_empty() {
                md.push_str(&format!("# {}\n\n", settings.title));
            }
            if !settings.author.is_empty() {
                md.push_str(&format!("*{}*\n\n", settings.author));
            }
            md.push_str(&chapters_to_markdown(
                &chapters,
                "##",
                Some(&settings.preferences),
            ));
            if !research.is_empty() {
                md.push_str("## Research Notes\n\n");
                md.push_str(&chapters_to_markdown(&research, "###", None));
            }
            if !characters.is_empty() {
                md.push_str("## Cast of Characters\n\n");
                md.push_str(&chapters_to_markdown(&characters, "###", None));
            }
            atomic_write(&out_path, md.as_bytes())?;
            Ok(ExportResult {
                path: out_path.to_string_lossy().to_string(),
                format: "markdown".to_string(),
                preview,
            })
        }
        "text" => {
            let mut text = String::new();
            if !settings.title.is_empty() {
                text.push_str(&format!("{}\n\n", settings.title));
            }
            text.push_str(&chapters_to_text(
                &chapters,
                Some(&settings.preferences),
            ));
            if !research.is_empty() {
                text.push_str("\n\nResearch Notes\n\n");
                text.push_str(&chapters_to_text(&research, None));
            }
            if !characters.is_empty() {
                text.push_str("\n\nCast of Characters\n\n");
                text.push_str(&chapters_to_text(&characters, None));
            }
            atomic_write(&out_path, text.as_bytes())?;
            Ok(ExportResult {
                path: out_path.to_string_lossy().to_string(),
                format: "text".to_string(),
                preview,
            })
        }
        _ => Err(format!("Unsupported compile format: {format}")),
    }
}

#[tauri::command]
pub fn write_export_bytes(
    library_path: String,
    filename: String,
    bytes: Vec<u8>,
    output_dir: Option<String>,
) -> Result<ExportResult, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let preview = format!("{filename} ({} bytes)", bytes.len());
    let out = write_export_to(&path, &filename, &bytes, output_dir.as_deref())?;
    Ok(ExportResult {
        path: out,
        format: "docx".to_string(),
        preview,
    })
}

#[tauri::command]
pub fn strip_review_marks_html(html: String) -> String {
    strip_review_marks(&html)
}

#[tauri::command]
pub fn sanitize_filename_title(title: String) -> String {
    sanitize_filename(&title)
}

#[tauri::command]
pub fn export_marked_manuscript(
    library_path: String,
    output_dir: Option<String>,
    filename: Option<String>,
) -> Result<ExportResult, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let settings = read_book_settings(&path)?;
    let manifest = read_manifest(&path)?;
    let mut chapters: Vec<(ChapterMeta, String)> = Vec::new();
    for meta in &manifest.chapters {
        let html = read_chapter_html(&path, &meta.id)?;
        chapters.push((meta.clone(), html));
    }
    if chapters.is_empty() {
        return Err("No chapters to export".into());
    }

    let mut body = String::new();
    if !settings.title.is_empty() {
        body.push_str(&format!(
            "<h1>{}</h1><p class=\"author\">{}</p>",
            escape_html(&settings.title),
            escape_html(&settings.author)
        ));
    }
    for (meta, html) in &chapters {
        body.push_str(&format!(
            "<h2>{}</h2>{}",
            escape_html(&meta.title),
            html
        ));
    }

    let css = marked_review_styles();
    let doc = format!(
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>{}</title>\
         <style>{css}</style></head><body>{body}</body></html>",
        escape_html(if settings.title.is_empty() {
            "Marked manuscript"
        } else {
            &settings.title
        })
    );

    let base = filename
        .as_deref()
        .map(export_filename_stem)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            let title = if settings.title.is_empty() {
                "marked-manuscript".to_string()
            } else {
                sanitize_filename(&settings.title)
            };
            format!("{title}-marked")
        });
    let out_name = format!("{base}.html");
    let out = write_export_to(&path, &out_name, doc.as_bytes(), output_dir.as_deref())?;
    Ok(ExportResult {
        path: out,
        format: "html".to_string(),
        preview: format!("{} chapters with review marks visible", chapters.len()),
    })
}

#[tauri::command]
pub fn export_comments_report(
    library_path: String,
    output_dir: Option<String>,
    filename: Option<String>,
) -> Result<ExportResult, String> {
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;
    let settings = read_book_settings(&path)?;
    let manifest = read_manifest(&path)?;
    let mut md = String::new();
    md.push_str("# Comments & Changes Report\n\n");
    if !settings.title.is_empty() {
        md.push_str(&format!("**{}**", settings.title));
        if !settings.author.is_empty() {
            md.push_str(&format!(" by {}", settings.author));
        }
        md.push_str("\n\n");
    }

    let mut total_open = 0u32;
    let mut total_changes = 0u32;

    let mut write_section =
        |section: &str, items: &[ChapterMeta]| -> Result<(), String> {
            for meta in items {
                let data = read_chapter_comments(&path, &meta.id, section)?;
                let open: Vec<_> = data.threads.iter().filter(|t| !t.resolved).collect();
                let pending: Vec<_> = data
                    .changes
                    .iter()
                    .filter(|c| c.status == "pending")
                    .collect();
                if open.is_empty() && pending.is_empty() {
                    continue;
                }
                md.push_str(&format!("## {} ({section})\n\n", meta.title));
                if !open.is_empty() {
                    md.push_str("### Open comments\n\n");
                    for thread in open {
                        total_open += 1;
                        md.push_str(&format!(
                            "- **\"{}\"** — {} reply(ies)\n",
                            thread.anchor_text.replace('\n', " "),
                            thread.replies.len()
                        ));
                        for reply in &thread.replies {
                            md.push_str(&format!(
                                "  - *{}*: {}\n",
                                reply.author,
                                reply.text.replace('\n', " ")
                            ));
                        }
                    }
                    md.push('\n');
                }
                if !pending.is_empty() {
                    md.push_str("### Pending changes\n\n");
                    for change in pending {
                        total_changes += 1;
                        let sign = if change.change_type == "insertion" {
                            "+"
                        } else {
                            "−"
                        };
                        md.push_str(&format!(
                            "- {sign} \"{}\"\n",
                            change.text.replace('\n', " ")
                        ));
                    }
                    md.push('\n');
                }
            }
            Ok(())
        };

    write_section(CHAPTERS, &manifest.chapters)?;
    write_section(RESEARCH, &load_section_chapters(&path, RESEARCH)?)?;
    write_section(CHARACTERS, &load_section_chapters(&path, CHARACTERS)?)?;

    if total_open == 0 && total_changes == 0 {
        md.push_str("_No open comments or pending changes in this library._\n");
    } else {
        let summary = format!(
            "Open comments: **{total_open}** · Pending changes: **{total_changes}**\n\n---\n\n"
        );
        if let Some(pos) = md.find("\n\n") {
            md.insert_str(pos + 2, &summary);
        } else {
            md.push_str(&summary);
        }
    }

    let base = filename
        .as_deref()
        .map(export_filename_stem)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "comments-report".to_string());
    let out_name = format!("{base}.md");
    let out = write_export_to(&path, &out_name, md.as_bytes(), output_dir.as_deref())?;
    Ok(ExportResult {
        path: out,
        format: "markdown".to_string(),
        preview: format!("{total_open} comments, {total_changes} changes"),
    })
}
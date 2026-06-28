use crate::{atomic_write, load_section_chapters, read_manifest, section_dir, ChapterMeta, CHAPTERS};
const RESEARCH: &str = "research";
const CHARACTERS: &str = "characters";
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPreferences {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_save_ms: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_font_family: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_font_size: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_compile_preset: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_compile_format: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub include_research_in_compile: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub include_characters_in_compile: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub compile_show_chapter_numbers: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub compile_show_chapter_titles: Option<bool>,
}

pub fn compile_show_chapter_numbers(prefs: &LibraryPreferences) -> bool {
    prefs.compile_show_chapter_numbers.unwrap_or(true)
}

pub fn compile_show_chapter_titles(prefs: &LibraryPreferences) -> bool {
    prefs.compile_show_chapter_titles.unwrap_or(true)
}

pub fn compile_chapter_heading(
    meta: &ChapterMeta,
    order: usize,
    prefs: &LibraryPreferences,
) -> Option<String> {
    let show_numbers = compile_show_chapter_numbers(prefs);
    let show_titles = compile_show_chapter_titles(prefs);
    let number = if show_numbers {
        Some(format!("Chapter {order}"))
    } else {
        None
    };
    let title = if show_titles && !meta.title.is_empty() {
        Some(meta.title.as_str())
    } else {
        None
    };
    match (number, title) {
        (Some(n), Some(t)) => Some(format!("{n} — {t}")),
        (Some(n), None) => Some(n),
        (None, Some(t)) => Some(t.to_string()),
        (None, None) => None,
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BookSettings {
    pub title: String,
    pub author: String,
    pub include_front_matter: bool,
    pub include_back_matter: bool,
    #[serde(default)]
    pub word_goal: u32,
    #[serde(default)]
    pub preferences: LibraryPreferences,
}

impl Default for BookSettings {
    fn default() -> Self {
        Self {
            title: String::new(),
            author: String::new(),
            include_front_matter: true,
            include_back_matter: false,
            word_goal: 0,
            preferences: LibraryPreferences::default(),
        }
    }
}

pub fn book_settings_path(library_path: &Path) -> PathBuf {
    library_path.join("book.json")
}

pub fn exports_dir(library_path: &Path) -> PathBuf {
    library_path.join("exports")
}

pub fn read_book_settings(library_path: &Path) -> Result<BookSettings, String> {
    let path = book_settings_path(library_path);
    if !path.exists() {
        return Ok(BookSettings::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn write_book_settings(library_path: &Path, settings: &BookSettings) -> Result<(), String> {
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    atomic_write(&book_settings_path(library_path), json.as_bytes())
}

pub fn load_final_chapters(library_path: &Path) -> Result<Vec<ChapterMeta>, String> {
    let manifest = read_manifest(library_path)?;
    let mut finals: Vec<ChapterMeta> = manifest
        .chapters
        .into_iter()
        .filter(|c| c.status == "final")
        .collect();
    finals.sort_by_key(|c| c.order);
    Ok(finals)
}

pub fn read_chapter_html(library_path: &Path, chapter_id: &str) -> Result<String, String> {
    read_section_html(library_path, chapter_id, CHAPTERS)
}

pub fn read_section_html(
    library_path: &Path,
    chapter_id: &str,
    section: &str,
) -> Result<String, String> {
    let path = section_dir(library_path, section).join(format!("{chapter_id}.html"));
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

pub fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub fn strip_review_marks(html: &str) -> String {
    let mut out = html.to_string();
    for marker in ["dt-comment", "dt-insertion", "dt-deletion"] {
        out = strip_span_with_class(&out, marker);
    }
    out
}

fn strip_span_with_class(html: &str, class_name: &str) -> String {
    let mut out = html.to_string();
    let needle = format!("class=\"{class_name}\"");
    while let Some(class_idx) = out.find(&needle) {
        let Some(span_start) = out[..class_idx].rfind("<span") else {
            break;
        };
        let Some(gt_rel) = out[span_start..].find('>') else {
            break;
        };
        let content_start = span_start + gt_rel + 1;
        let Some(close_rel) = out[content_start..].find("</span>") else {
            break;
        };
        let inner = out[content_start..content_start + close_rel].to_string();
        let end = content_start + close_rel + 7;
        out.replace_range(span_start..end, &inner);
    }
    out
}

pub fn marked_review_styles() -> &'static str {
    "body{font-family:Georgia,serif;max-width:680px;margin:2em auto;line-height:1.75;color:#222}\
     h1,h2{font-weight:normal}p{margin:0 0 0.75em}\
     .dt-insertion{background:rgba(72,187,120,0.25);text-decoration:underline}\
     .dt-deletion{background:rgba(245,101,101,0.2);text-decoration:line-through;color:#a33}\
     .dt-comment{background:rgba(255,193,7,0.25);border-bottom:1px dashed #c9a227}"
}

pub fn document_styles(style: &str) -> &'static str {
    match style {
        "manuscript" => "body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:2;max-width:6.5in;margin:1in auto;color:#111}\
                         h1{font-size:18pt;text-align:center;margin:2em 0 1em;font-weight:normal}\
                         h2{font-size:14pt;margin:1.5em 0 0.75em;font-weight:bold;page-break-before:always}\
                         .author{text-align:center;color:#444;margin-bottom:2em}\
                         p{margin:0 0 0.5em;text-indent:0.5in}\
                         .research-section h2{page-break-before:auto;color:#555}",
        "ebook" => "body{font-family:Georgia,'Palatino Linotype',serif;font-size:1.05em;line-height:1.65;max-width:38em;margin:1.5em auto;color:#1a1a1a}\
                     h1{font-size:1.8em;text-align:center;margin:1.5em 0 0.5em;font-weight:normal}\
                     h2{font-size:1.35em;margin:2em 0 0.75em;font-weight:normal;border-bottom:1px solid #ddd;padding-bottom:0.25em}\
                     .author{text-align:center;color:#666;font-style:italic}\
                     p{margin:0 0 0.85em}\
                     .research-section{opacity:0.92}",
        _ => "body{font-family:Georgia,serif;max-width:680px;margin:2em auto;line-height:1.75;color:#222}\
              h1,h2{font-weight:normal}.author{color:#666}p{margin:0 0 0.75em}",
    }
}

pub fn html_to_text(html: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
}

pub fn html_to_markdown(html: &str) -> String {
    let mut md = html.to_string();
    for (tag, replacement) in [
        ("<strong>", "**"),
        ("</strong>", "**"),
        ("<b>", "**"),
        ("</b>", "**"),
        ("<em>", "*"),
        ("</em>", "*"),
        ("<i>", "*"),
        ("</i>", "*"),
        ("<u>", ""),
        ("</u>", ""),
        ("<p>", "\n\n"),
        ("</p>", ""),
        ("<br>", "\n"),
        ("<br/>", "\n"),
        ("<br />", "\n"),
    ] {
        md = md.replace(tag, replacement);
    }
    html_to_text(&md)
}

pub fn build_book_html(
    settings: &BookSettings,
    chapters: &[(ChapterMeta, String)],
    research: &[(ChapterMeta, String)],
    characters: &[(ChapterMeta, String)],
    style: &str,
) -> String {
    let title = if settings.title.is_empty() {
        "Untitled Book"
    } else {
        &settings.title
    };
    let mut body = String::new();

    let safe_title = escape_html(title);

    if settings.include_front_matter {
        body.push_str(&format!(
            "<section class=\"front-matter\"><h1>{safe_title}</h1>",
        ));
        if !settings.author.is_empty() {
            body.push_str(&format!(
                "<p class=\"author\">{}</p>",
                escape_html(&settings.author)
            ));
        }
        body.push_str("</section>");
    }

    let prefs = Some(&settings.preferences);
    for (i, (meta, html)) in chapters.iter().enumerate() {
        let clean = strip_review_marks(html);
        push_chapter_section(&mut body, meta, i + 1, prefs, &clean);
    }

    if !research.is_empty() {
        body.push_str("<section class=\"research-section\"><h2>Research Notes</h2>");
        for (meta, html) in research {
            let clean = strip_review_marks(html);
            body.push_str(&format!(
                "<section class=\"research-item\" data-id=\"{}\"><h3>{}</h3>{}</section>",
                escape_html(&meta.id),
                escape_html(&meta.title),
                clean
            ));
        }
        body.push_str("</section>");
    }

    if !characters.is_empty() {
        body.push_str("<section class=\"characters-section\"><h2>Cast of Characters</h2>");
        for (meta, html) in characters {
            let clean = strip_review_marks(html);
            body.push_str(&format!(
                "<section class=\"character-item\" data-id=\"{}\"><h3>{}</h3>{}</section>",
                escape_html(&meta.id),
                escape_html(&meta.title),
                clean
            ));
        }
        body.push_str("</section>");
    }

    if settings.include_back_matter {
        body.push_str("<section class=\"back-matter\"><p>The End</p></section>");
    }

    let css = document_styles(style);
    format!(
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>{safe_title}</title>\
         <meta name=\"author\" content=\"{author}\"/>\
         <style>{css}</style></head><body>{body}</body></html>",
        author = escape_html(&settings.author)
    )
}

/// Resolves the export output directory, validating any frontend-supplied
/// override. Exports legitimately need to write outside the library (e.g. to
/// the user's Desktop), so this can't enforce library containment like reads
/// do — instead it rejects blank/whitespace-only and non-canonicalizable
/// paths so a malformed `output_dir` can't silently resolve to somewhere
/// unintended (e.g. the process cwd).
pub fn resolve_output_dir(library_path: &Path, output_dir: Option<&str>) -> Result<PathBuf, String> {
    match output_dir.map(str::trim).filter(|s| !s.is_empty()) {
        Some(dir) => {
            if dir.contains('\0') {
                return Err("Invalid export directory".to_string());
            }
            let dir = PathBuf::from(dir);
            fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            fs::canonicalize(&dir).map_err(|e| format!("Invalid export directory: {e}"))
        }
        None => Ok(exports_dir(library_path)),
    }
}

/// If `safe_name` already exists in `dir`, append ` (2)`, ` (3)`, … before the extension.
pub fn unique_export_path(dir: &Path, safe_name: &str) -> PathBuf {
    let initial = dir.join(safe_name);
    if !initial.exists() {
        return initial;
    }

    let path = Path::new(safe_name);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("export");
    let ext = path.extension().and_then(|e| e.to_str());

    for n in 2..=9999 {
        let name = match ext {
            Some(ext) => format!("{stem} ({n}).{ext}"),
            None => format!("{stem} ({n})"),
        };
        let candidate = dir.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }

    dir.join(format!("{stem} (10000)"))
}

pub fn resolve_export_file_path(dir: &Path, filename: &str) -> Result<PathBuf, String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let safe_name = Path::new(filename)
        .file_name()
        .and_then(|n| n.to_str())
        .map(sanitize_export_filename)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Invalid export filename".to_string())?;
    Ok(unique_export_path(dir, &safe_name))
}

pub fn write_export_to(
    library_path: &Path,
    filename: &str,
    content: &[u8],
    output_dir: Option<&str>,
) -> Result<String, String> {
    let dir = resolve_output_dir(library_path, output_dir)?;
    let out = resolve_export_file_path(&dir, filename)?;
    atomic_write(&out, content)?;
    Ok(out.to_string_lossy().to_string())
}

pub fn load_research_for_export(library_path: &Path) -> Result<Vec<(ChapterMeta, String)>, String> {
    load_section_for_export(library_path, RESEARCH)
}

pub fn load_characters_for_export(library_path: &Path) -> Result<Vec<(ChapterMeta, String)>, String> {
    load_section_for_export(library_path, CHARACTERS)
}

fn load_section_for_export(
    library_path: &Path,
    section: &str,
) -> Result<Vec<(ChapterMeta, String)>, String> {
    let items = load_section_chapters(library_path, section)?;
    let mut out = Vec::new();
    for meta in items {
        let html = read_section_html(library_path, &meta.id, section)?;
        out.push((meta, html));
    }
    Ok(out)
}

pub fn chapter_heading_for_export(
    meta: &ChapterMeta,
    order: usize,
    prefs: Option<&LibraryPreferences>,
) -> Option<String> {
    if let Some(p) = prefs {
        compile_chapter_heading(meta, order, p)
    } else if !meta.title.is_empty() {
        Some(meta.title.clone())
    } else {
        None
    }
}

fn push_chapter_section(
    body: &mut String,
    meta: &ChapterMeta,
    order: usize,
    prefs: Option<&LibraryPreferences>,
    clean_html: &str,
) {
    let id = escape_html(&meta.id);
    if let Some(heading) = chapter_heading_for_export(meta, order, prefs) {
        body.push_str(&format!(
            "<section class=\"chapter\" data-id=\"{id}\"><h2>{}</h2>{clean_html}</section>",
            escape_html(&heading)
        ));
    } else {
        body.push_str(&format!(
            "<section class=\"chapter\" data-id=\"{id}\">{clean_html}</section>"
        ));
    }
}

pub fn build_chapters_html(
    chapters: &[(ChapterMeta, String)],
    style: &str,
    prefs: Option<&LibraryPreferences>,
) -> String {
    let mut body = String::new();
    for (i, (meta, html)) in chapters.iter().enumerate() {
        let clean = strip_review_marks(html);
        push_chapter_section(&mut body, meta, i + 1, prefs, &clean);
    }
    let css = document_styles(style);
    format!(
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">\
         <style>{css}</style></head><body>{body}</body></html>"
    )
}

pub fn sanitize_filename(title: &str) -> String {
    let mut out = String::new();
    let mut prev_underscore = false;
    for c in title.chars() {
        let mapped = if c.is_alphanumeric() || c == '-' || c == '_' {
            c
        } else {
            '_'
        };
        if mapped == '_' {
            if !prev_underscore {
                out.push('_');
            }
            prev_underscore = true;
        } else {
            out.push(mapped);
            prev_underscore = false;
        }
    }
    let trimmed = out.trim_matches('_');
    if trimmed.is_empty() {
        "export".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Sanitize a user-supplied name for use as a filename stem, stripping a trailing extension.
pub fn export_filename_stem(filename: &str) -> String {
    let file_name = Path::new(filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(filename);
    if let Some((stem, ext)) = file_name.rsplit_once('.') {
        if !stem.is_empty() && ext.chars().all(|c| c.is_alphanumeric()) {
            return sanitize_filename(stem);
        }
    }
    sanitize_filename(file_name)
}

/// Sanitize a basename while preserving a trailing alphanumeric extension (e.g. `.docx`).
pub fn sanitize_export_filename(filename: &str) -> String {
    let file_name = Path::new(filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(filename);
    if let Some((stem, ext)) = file_name.rsplit_once('.') {
        if !stem.is_empty()
            && !ext.is_empty()
            && ext.chars().all(|c| c.is_alphanumeric())
        {
            let safe_stem = sanitize_filename(stem);
            let safe_stem = if safe_stem.is_empty() {
                "export".to_string()
            } else {
                safe_stem
            };
            return format!("{safe_stem}.{ext}");
        }
    }
    sanitize_filename(file_name)
}

pub fn stats_from_html(html: &str) -> (u32, u32) {
    let plain = html_to_text(html);
    let words = plain
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .count() as u32;
    let chars = plain.len() as u32;
    (words, chars)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn html_to_markdown_bold() {
        let md = html_to_markdown("<p><strong>Hello</strong> world</p>");
        assert!(md.contains("**Hello**"));
    }

    #[test]
    fn compile_chapter_heading_respects_prefs() {
        let meta = ChapterMeta {
            id: "a".to_string(),
            title: "Winter Ridge".to_string(),
            status: "final".to_string(),
            order: 2,
            updated_at: "now".to_string(),
            word_count: 0,
            char_count: 0,
        };
        let mut numbers_only = LibraryPreferences::default();
        numbers_only.compile_show_chapter_titles = Some(false);
        assert_eq!(
            compile_chapter_heading(&meta, 3, &numbers_only),
            Some("Chapter 3".to_string())
        );

        let mut titles_only = LibraryPreferences::default();
        titles_only.compile_show_chapter_numbers = Some(false);
        assert_eq!(
            compile_chapter_heading(&meta, 3, &titles_only),
            Some("Winter Ridge".to_string())
        );

        let mut neither = LibraryPreferences::default();
        neither.compile_show_chapter_numbers = Some(false);
        neither.compile_show_chapter_titles = Some(false);
        assert_eq!(compile_chapter_heading(&meta, 3, &neither), None);
    }

    #[test]
    fn build_book_html_includes_chapters() {
        let settings = BookSettings {
            title: "Test".to_string(),
            author: "Author".to_string(),
            include_front_matter: true,
            include_back_matter: false,
            word_goal: 0,
            preferences: LibraryPreferences::default(),
        };
        let meta = ChapterMeta {
            id: "a".to_string(),
            title: "Chapter One".to_string(),
            status: "final".to_string(),
            order: 0,
            updated_at: "now".to_string(),
            word_count: 0,
            char_count: 0,
        };
        let html = build_book_html(
            &settings,
            &[(meta, "<p>Body</p>".to_string())],
            &[],
            &[],
            "default",
        );
        assert!(html.contains("Chapter 1 — Chapter One"));
        assert!(html.contains("Body"));
    }

    #[test]
    fn sanitize_filename_collapses_underscores() {
        assert_eq!(sanitize_filename("My Chapter!"), "My_Chapter");
        assert_eq!(sanitize_filename("a   b"), "a_b");
        assert_eq!(sanitize_filename("!!!"), "export");
        assert_eq!(sanitize_filename("Book-1_final"), "Book-1_final");
    }

    #[test]
    fn compile_export_filename_uses_basename_only() {
        let traversal = "..\\..\\evil.html";
        let safe = std::path::Path::new(traversal)
            .file_name()
            .and_then(|s| s.to_str())
            .map(sanitize_export_filename)
            .filter(|s| !s.is_empty());
        assert_eq!(safe.as_deref(), Some("evil.html"));
        assert!(!safe.unwrap().contains(".."));
    }

    #[test]
    fn sanitize_export_filename_preserves_extension() {
        assert_eq!(sanitize_export_filename("My Book!.docx"), "My_Book.docx");
        assert_eq!(sanitize_export_filename("export.html"), "export.html");
        assert_eq!(sanitize_export_filename("no-extension"), "no-extension");
    }

    #[test]
    fn strip_review_marks_removes_spans() {
        let html = "<p>Hello <span class=\"dt-insertion\" data-mark-id=\"1\">world</span></p>";
        assert_eq!(strip_review_marks(html), "<p>Hello world</p>");
        let commented =
            "<p><span class=\"dt-comment\" data-mark-id=\"c1\">note</span> gone</p>";
        assert_eq!(strip_review_marks(commented), "<p>note gone</p>");
    }

    #[test]
    fn stats_from_html_counts_words() {
        let (words, chars) = stats_from_html("<p>Hello <strong>world</strong></p>");
        assert_eq!(words, 2);
        assert!(chars >= 11);
    }

    #[test]
    fn unique_export_path_appends_increment() {
        let dir = std::env::temp_dir().join(format!("darktext-uniq-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("book.docx"), b"one").unwrap();
        fs::write(dir.join("book (2).docx"), b"two").unwrap();

        let next = unique_export_path(&dir, "book.docx");
        assert_eq!(next.file_name().and_then(|s| s.to_str()), Some("book (3).docx"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_export_creates_file() {
        let dir = std::env::temp_dir().join("darktext-export-test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let out = write_export_to(&dir, "test.html", b"<p>ok</p>", None).unwrap();
        assert!(Path::new(&out).exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_output_dir_rejects_blank_override() {
        let dir = std::env::temp_dir().join("darktext-output-dir-blank-test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        // Whitespace-only override should fall back to the library's exports dir,
        // not silently resolve into the process cwd.
        let resolved = resolve_output_dir(&dir, Some("   ")).unwrap();
        assert_eq!(resolved, exports_dir(&dir));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_output_dir_creates_and_canonicalizes_custom_dir() {
        let dir = std::env::temp_dir().join("darktext-output-dir-custom-test");
        let custom = dir.join("nested").join("export-target");
        let _ = fs::remove_dir_all(&dir);

        let resolved = resolve_output_dir(&dir, Some(custom.to_str().unwrap())).unwrap();
        assert!(resolved.exists());
        assert!(resolved.ends_with("export-target"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_output_dir_rejects_null_byte() {
        let dir = std::env::temp_dir().join("darktext-output-dir-nul-test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        assert!(resolve_output_dir(&dir, Some("bad\0path")).is_err());
        let _ = fs::remove_dir_all(&dir);
    }
}


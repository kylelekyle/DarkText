use fontdb::Database;
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const SYSTEM_FONT_CACHE_TTL: Duration = Duration::from_secs(120);

struct SystemFontCache {
    families: Vec<String>,
    loaded_at: Instant,
}

static SYSTEM_FONT_CACHE: Mutex<Option<SystemFontCache>> = Mutex::new(None);

const FONT_EXTENSIONS: &[&str] = &["ttf", "otf", "woff", "woff2"];

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryFont {
    pub family: String,
    pub filename: String,
    pub path: String,
}

pub fn fonts_dir(library_path: &Path) -> PathBuf {
    crate::paths::LibraryPaths::detect_or_legacy(library_path).fonts_dir()
}

fn scan_system_fonts() -> Vec<String> {
    let mut db = Database::new();
    db.load_system_fonts();

    let mut families = BTreeSet::new();
    for face in db.faces() {
        if let Some((name, _)) = face.families.first() {
            let trimmed = name.trim();
            if !trimmed.is_empty() {
                families.insert(trimmed.to_string());
            }
        }
    }
    families.into_iter().collect()
}

pub fn list_system_fonts() -> Vec<String> {
    let mut cache = SYSTEM_FONT_CACHE.lock().expect("font cache lock");
    if let Some(entry) = cache.as_ref() {
        if entry.loaded_at.elapsed() < SYSTEM_FONT_CACHE_TTL {
            return entry.families.clone();
        }
    }

    let families = scan_system_fonts();
    *cache = Some(SystemFontCache {
        families: families.clone(),
        loaded_at: Instant::now(),
    });
    families
}

fn family_from_font_file(path: &Path) -> Result<String, String> {
    let mut db = Database::new();
    db.load_font_file(path).map_err(|e| format!("Could not load font: {e}"))?;
    let face = db
        .faces()
        .last()
        .ok_or_else(|| "Font has no faces".to_string())?;
    let (name, _) = face
        .families
        .first()
        .ok_or_else(|| "Font has no family name".to_string())?;
    Ok(name.trim().to_string())
}

pub fn list_library_fonts(library_path: &Path) -> Result<Vec<LibraryFont>, String> {
    let dir = fonts_dir(library_path);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut fonts = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        if !FONT_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }

        let family = family_from_font_file(&path).unwrap_or_else(|_| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Custom Font")
                .to_string()
        });

        fonts.push(LibraryFont {
            family,
            filename: path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("font")
                .to_string(),
            path: path.to_string_lossy().to_string(),
        });
    }

    fonts.sort_by_key(|a| a.family.to_lowercase());
    Ok(fonts)
}

pub fn import_library_font(library_path: &Path, source_path: &Path) -> Result<LibraryFont, String> {
    if !source_path.exists() {
        return Err("Font file not found".into());
    }
    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if !FONT_EXTENSIONS.contains(&ext.as_str()) {
        return Err("Unsupported font format. Use .ttf, .otf, .woff, or .woff2".into());
    }

    let family = family_from_font_file(source_path)?;
    let dir = fonts_dir(library_path);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let filename = source_path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Invalid font filename".to_string())?;

    let dest = dir.join(filename);
    if dest.exists() {
        return Err(format!("A font named \"{filename}\" is already in this Library"));
    }

    fs::copy(source_path, &dest).map_err(|e| format!("Could not copy font: {e}"))?;

    Ok(LibraryFont {
        family,
        filename: filename.to_string(),
        path: dest.to_string_lossy().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_fonts_not_empty() {
        let fonts = list_system_fonts();
        assert!(!fonts.is_empty());
    }
}
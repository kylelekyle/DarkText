use crate::library::require_active_library;
use crate::models::LibrarySearchHit;
use crate::search_index::{self, SearchIndexEntry};
use std::path::PathBuf;

pub fn path_within_library(
    library_path: &std::path::Path,
    requested: &std::path::Path,
) -> Result<std::path::PathBuf, String> {
    use std::fs;
    let lib = fs::canonicalize(library_path)
        .map_err(|e| format!("Invalid library path: {e}"))?;
    let resolved = if requested.is_absolute() {
        fs::canonicalize(requested).map_err(|e| format!("File not found: {e}"))?
    } else {
        fs::canonicalize(library_path.join(requested))
            .map_err(|e| format!("File not found: {e}"))?
    };
    if !resolved.starts_with(&lib) {
        return Err("Access denied: path is outside the open library".into());
    }
    Ok(resolved)
}

pub fn find_text_match(text: &str, query: &str, context: usize) -> Option<(String, u32)> {
    let lower_text = text.to_lowercase();
    let idx = lower_text.find(query)?;
    let excerpt = search_text_excerpt(text, query, context)?;
    Some((excerpt, idx as u32))
}

pub fn search_text_excerpt(text: &str, query: &str, context: usize) -> Option<String> {
    let lower_text = text.to_lowercase();
    let idx = lower_text.find(query)?;
    let start = idx.saturating_sub(context);
    let end = (idx + query.len() + context).min(text.len());
    let mut excerpt = String::new();
    if start > 0 {
        excerpt.push('…');
    }
    excerpt.push_str(text[start..end].trim());
    if end < text.len() {
        excerpt.push('…');
    }
    Some(excerpt)
}

fn hit_from_entry(entry: &SearchIndexEntry, query: &str) -> Option<LibrarySearchHit> {
    let q = query.to_lowercase();
    let (excerpt, match_index) = find_text_match(&entry.text, &q, 40)?;
    Some(LibrarySearchHit {
        chapter_id: entry.chapter_id.clone(),
        section: entry.section.clone(),
        title: entry.title.clone(),
        excerpt,
        match_index,
    })
}

#[tauri::command]
pub fn read_file_bytes(library_path: String, path: String) -> Result<Vec<u8>, String> {
    let lib = PathBuf::from(&library_path);
    require_active_library(&lib)?;
    let requested = PathBuf::from(&path);
    let safe = path_within_library(&lib, &requested)?;
    std::fs::read(&safe).map_err(|e| format!("Could not read file: {e}"))
}

#[tauri::command]
pub fn search_library(
    library_path: String,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<LibrarySearchHit>, String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let max = limit.unwrap_or(50).min(200) as usize;
    let path = PathBuf::from(&library_path);
    require_active_library(&path)?;

    let indexed = search_index::search_indexed(&path, &q, max)?;
    Ok(indexed
        .iter()
        .filter_map(|entry| hit_from_entry(entry, &q))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::{find_text_match, path_within_library, search_text_excerpt};
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    #[test]
    fn search_text_excerpt_finds_match_with_context() {
        let text = "The quick brown fox jumps over the lazy dog";
        let excerpt = search_text_excerpt(text, "brown", 5).unwrap();
        assert!(excerpt.contains("brown"));
    }

    #[test]
    fn search_text_excerpt_is_case_insensitive_via_lower_query() {
        let text = "Hello World";
        assert!(search_text_excerpt(text, "world", 2).is_some());
    }

    #[test]
    fn search_text_excerpt_returns_none_when_no_match() {
        assert!(search_text_excerpt("abc", "xyz", 2).is_none());
    }

    #[test]
    fn find_text_match_returns_excerpt_and_plain_index() {
        let (excerpt, idx) = find_text_match("foo bar baz", "bar", 1).unwrap();
        assert!(excerpt.contains("bar"));
        assert_eq!(idx, 4);
    }

    #[test]
    fn path_within_library_allows_file_inside_library() {
        let dir = std::env::temp_dir().join(format!("darktext-lib-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let inside = dir.join("chapters");
        fs::create_dir_all(&inside).unwrap();
        let file = inside.join("test.txt");
        fs::write(&file, b"ok").unwrap();

        let result = path_within_library(&dir, &PathBuf::from("chapters/test.txt"));
        assert!(result.is_ok());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn path_within_library_rejects_path_outside_library() {
        let dir = std::env::temp_dir().join(format!("darktext-lib-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let outside = std::env::temp_dir().join(format!("darktext-out-{}", Uuid::new_v4()));
        fs::create_dir_all(&outside).unwrap();
        let outside_file = outside.join("secret.txt");
        fs::write(&outside_file, b"x").unwrap();

        let result = path_within_library(&dir, &outside_file);
        assert!(result.is_err());

        let _ = fs::remove_dir_all(&dir);
        let _ = fs::remove_dir_all(&outside);
    }
}
use crate::library::{read_json, read_meta_file, write_json};
use crate::models::{ChapterMeta, LibraryManifest};
use crate::paths::{
    content_folder, LibraryPaths, LayoutVersion, LEGACY_FOLDER_CHAPTERS, LEGACY_FOLDER_CHARACTERS,
    LEGACY_FOLDER_RESEARCH, MANIFEST_VERSION_V2, SECTION_CHAPTERS, SECTION_CHARACTERS,
    SECTION_RESEARCH,
};
use crate::section_index::write_index_file;
use chrono::Utc;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

const SECTIONS: [(&str, &str); 3] = [
    (SECTION_CHAPTERS, LEGACY_FOLDER_CHAPTERS),
    (SECTION_RESEARCH, LEGACY_FOLDER_RESEARCH),
    (SECTION_CHARACTERS, LEGACY_FOLDER_CHARACTERS),
];

pub fn migrate_library_if_needed(library_path: &Path) -> Result<(), String> {
    let paths = LibraryPaths::detect(library_path)?;
    if paths.layout() == LayoutVersion::V2 {
        return Ok(());
    }

    let legacy_manifest: LibraryManifest = read_json(&paths.library_manifest())?;
    let v2 = LibraryPaths::new_v2(library_path.to_path_buf());

    fs::create_dir_all(v2.config_dir()).map_err(|e| e.to_string())?;
    for sub in ["comments", "snapshots", "images", "fonts"] {
        fs::create_dir_all(v2.config_dir().join(sub)).map_err(|e| e.to_string())?;
    }
    for section in [SECTION_CHAPTERS, SECTION_RESEARCH, SECTION_CHARACTERS] {
        fs::create_dir_all(v2.config_dir().join("comments").join(section))
            .map_err(|e| e.to_string())?;
    }

    move_file_if_exists(&paths.book_settings(), &v2.book_settings())?;
    move_file_if_exists(&paths.mindmap(), &v2.mindmap())?;

    let mut manuscript_chapters: HashMap<String, ChapterMeta> = legacy_manifest
        .chapters
        .into_iter()
        .map(|c| (c.id.clone(), c))
        .collect();
    let mut research_items: Vec<ChapterMeta> = Vec::new();
    let mut character_items: Vec<ChapterMeta> = Vec::new();

    for (section, legacy_folder) in SECTIONS {
        let legacy_dir = library_path.join(legacy_folder);
        if !legacy_dir.exists() {
            continue;
        }

        let target_dir = library_path.join(content_folder(section));
        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
        let same_dir = fs::canonicalize(&legacy_dir)
            .ok()
            .and_then(|legacy| {
                fs::canonicalize(&target_dir)
                    .ok()
                    .map(|target| legacy == target)
            })
            .unwrap_or(false);

        let mut metas_by_id: HashMap<String, ChapterMeta> = HashMap::new();

        for entry in fs::read_dir(&legacy_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            if file_name.ends_with(".meta.json") {
                let meta = read_meta_file(&path)?;
                metas_by_id.insert(meta.id.clone(), meta);
            } else if section == SECTION_CHAPTERS
                && path.extension().and_then(|e| e.to_str()) == Some("json")
                && !file_name.ends_with(".meta.json")
                && !file_name.ends_with(".comments.json")
            {
                let meta = read_meta_file(&path)?;
                metas_by_id.insert(meta.id.clone(), meta);
            }
        }

        let mut order = 0u32;
        for entry in fs::read_dir(&legacy_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !file_name.ends_with(".html") {
                continue;
            }
            let id = file_name.trim_end_matches(".html").to_string();
            if !same_dir {
                let dest = target_dir.join(format!("{id}.html"));
                move_file_if_exists(&path, &dest)?;
            }

            if let Some(meta) = metas_by_id.remove(&id) {
                assign_section_meta(
                    section,
                    &mut manuscript_chapters,
                    &mut research_items,
                    &mut character_items,
                    meta,
                );
            } else if section == SECTION_CHAPTERS {
                if !manuscript_chapters.contains_key(&id) {
                    let recovered = ChapterMeta {
                        id: id.clone(),
                        title: "Recovered".to_string(),
                        status: "draft".to_string(),
                        order,
                        updated_at: Utc::now().to_rfc3339(),
                        word_count: 0,
                        char_count: 0,
                    };
                    manuscript_chapters.insert(id.clone(), recovered);
                }
            } else {
                let recovered = ChapterMeta {
                    id: id.clone(),
                    title: "Recovered".to_string(),
                    status: "draft".to_string(),
                    order,
                    updated_at: Utc::now().to_rfc3339(),
                    word_count: 0,
                    char_count: 0,
                };
                assign_section_meta(
                    section,
                    &mut manuscript_chapters,
                    &mut research_items,
                    &mut character_items,
                    recovered,
                );
            }
            order += 1;
        }

        for (_, meta) in metas_by_id {
            assign_section_meta(
                section,
                &mut manuscript_chapters,
                &mut research_items,
                &mut character_items,
                meta,
            );
        }

        for entry in fs::read_dir(&legacy_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !file_name.ends_with(".comments.json") {
                continue;
            }
            let id = file_name
                .trim_end_matches(".comments.json")
                .to_string();
            let dest = v2
                .config_dir()
                .join("comments")
                .join(section)
                .join(format!("{id}.json"));
            move_file_if_exists(&path, &dest)?;
        }

        cleanup_legacy_sidecars(&legacy_dir)?;
        if !same_dir {
            remove_dir_if_empty(&legacy_dir)?;
        }
    }

    let mut chapters: Vec<ChapterMeta> = manuscript_chapters.into_values().collect();
    chapters.sort_by_key(|c| c.order);
    for (i, ch) in chapters.iter_mut().enumerate() {
        ch.order = i as u32;
    }
    research_items.sort_by_key(|c| c.order);
    for (i, ch) in research_items.iter_mut().enumerate() {
        ch.order = i as u32;
    }
    character_items.sort_by_key(|c| c.order);
    for (i, ch) in character_items.iter_mut().enumerate() {
        ch.order = i as u32;
    }

    move_tree_if_exists(&paths.legacy_images_dir(), &v2.images_dir())?;
    move_tree_if_exists(&paths.legacy_fonts_dir(), &v2.fonts_dir())?;
    move_tree_if_exists(&paths.legacy_snapshots_root(), &v2.config_dir().join("snapshots"))?;
    move_tree_if_exists(&paths.legacy_exports_dir(), &v2.exports_dir())?;

    let manifest = LibraryManifest {
        name: legacy_manifest.name,
        version: MANIFEST_VERSION_V2,
        path: legacy_manifest.path,
        chapters,
    };
    write_json(&v2.library_manifest(), &manifest)?;

    if !research_items.is_empty() {
        write_index_file(&v2.research_index(), &research_items)?;
    }
    if !character_items.is_empty() {
        write_index_file(&v2.characters_index(), &character_items)?;
    }

    let legacy_manifest_path = library_path.join("library.json");
    if legacy_manifest_path.exists() {
        let _ = fs::remove_file(legacy_manifest_path);
    }

    Ok(())
}

fn assign_section_meta(
    section: &str,
    manuscript: &mut HashMap<String, ChapterMeta>,
    research: &mut Vec<ChapterMeta>,
    characters: &mut Vec<ChapterMeta>,
    meta: ChapterMeta,
) {
    match section {
        SECTION_CHAPTERS => {
            manuscript.insert(meta.id.clone(), meta);
        }
        SECTION_RESEARCH => research.push(meta),
        SECTION_CHARACTERS => characters.push(meta),
        _ => {}
    }
}

fn move_file_if_exists(from: &Path, to: &Path) -> Result<(), String> {
    if !from.exists() {
        return Ok(());
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if to.exists() {
        fs::remove_file(to).map_err(|e| e.to_string())?;
    }
    fs::rename(from, to).map_err(|e| e.to_string())
}

fn move_tree_if_exists(from: &Path, to: &Path) -> Result<(), String> {
    if !from.exists() {
        return Ok(());
    }
    if to.exists() {
        merge_dir(from, to)?;
        fs::remove_dir_all(from).map_err(|e| e.to_string())?;
    } else {
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::rename(from, to).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn merge_dir(from: &Path, to: &Path) -> Result<(), String> {
    for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src = entry.path();
        let dest = to.join(entry.file_name());
        if src.is_dir() {
            fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
            merge_dir(&src, &dest)?;
            let _ = fs::remove_dir_all(&src);
        } else if dest.exists() {
            fs::remove_file(&dest).map_err(|e| e.to_string())?;
            fs::rename(&src, &dest).map_err(|e| e.to_string())?;
        } else {
            fs::rename(&src, &dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn cleanup_legacy_sidecars(dir: &Path) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if file_name.ends_with(".meta.json")
            || file_name.ends_with(".comments.json")
            || (file_name.ends_with(".json")
                && !file_name.ends_with(".meta.json")
                && !file_name.ends_with(".comments.json"))
        {
            let _ = fs::remove_file(&path);
        }
    }
    Ok(())
}

fn remove_dir_if_empty(dir: &Path) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }
    if fs::read_dir(dir).map_err(|e| e.to_string())?.next().is_none() {
        fs::remove_dir(dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::atomic_write;
    use crate::models::LibraryManifest;
    use crate::paths::{FOLDER_CHAPTERS, CONFIG_DIR};
    use serial_test::serial;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("darktext-migrate-{label}-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_legacy_library(dir: &Path, name: &str) -> (ChapterMeta, String) {
        fs::create_dir_all(dir.join("chapters")).unwrap();
        let manifest = LibraryManifest {
            name: name.to_string(),
            version: 1,
            path: dir.to_string_lossy().to_string(),
            chapters: vec![],
        };
        write_json(&dir.join("library.json"), &manifest).unwrap();

        let id = Uuid::new_v4().to_string();
        let meta = ChapterMeta {
            id: id.clone(),
            title: "Legacy Chapter".to_string(),
            status: "draft".to_string(),
            order: 0,
            updated_at: Utc::now().to_rfc3339(),
            word_count: 1,
            char_count: 4,
        };
        write_json(&dir.join("chapters").join(format!("{id}.meta.json")), &meta).unwrap();
        atomic_write(
            &dir.join("chapters").join(format!("{id}.html")),
            b"<p>legacy</p>",
        )
        .unwrap();
        (meta, id)
    }

    #[test]
    #[serial(active_library)]
    fn migrate_legacy_library_to_v2_layout() {
        let dir = temp_dir("legacy");
        let (meta, id) = write_legacy_library(&dir, "Migrate Me");

        migrate_library_if_needed(&dir).unwrap();

        let paths = LibraryPaths::detect(&dir).unwrap();
        assert_eq!(paths.layout(), LayoutVersion::V2);
        assert!(paths.library_manifest().exists());
        assert!(!dir.join("library.json").exists());
        assert!(dir.join(FOLDER_CHAPTERS).join(format!("{id}.html")).exists());
        assert!(!dir.join("chapters").join(format!("{id}.meta.json")).exists());

        let manifest: LibraryManifest = read_json(&paths.library_manifest()).unwrap();
        assert_eq!(manifest.version, MANIFEST_VERSION_V2);
        assert_eq!(manifest.chapters.len(), 1);
        assert_eq!(manifest.chapters[0].id, meta.id);
        assert_eq!(manifest.chapters[0].title, "Legacy Chapter");
        assert!(dir.join(CONFIG_DIR).is_dir());

        let _ = fs::remove_dir_all(&dir);
    }
}
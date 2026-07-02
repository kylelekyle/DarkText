use std::path::{Path, PathBuf};

pub const CONFIG_DIR: &str = ".darktext";
pub const EXPORTS_DIR: &str = "Exports";
pub const LEGACY_EXPORTS_DIR: &str = "exports";

pub const SECTION_CHAPTERS: &str = "chapters";
pub const SECTION_RESEARCH: &str = "research";
pub const SECTION_CHARACTERS: &str = "characters";

pub const FOLDER_CHAPTERS: &str = "Chapters";
pub const FOLDER_RESEARCH: &str = "Research";
pub const FOLDER_CHARACTERS: &str = "Characters";

pub const LEGACY_FOLDER_CHAPTERS: &str = "chapters";
pub const LEGACY_FOLDER_RESEARCH: &str = "research";
pub const LEGACY_FOLDER_CHARACTERS: &str = "characters";

pub const MANIFEST_VERSION_V2: u32 = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LayoutVersion {
    Legacy,
    V2,
}

pub struct LibraryPaths {
    root: PathBuf,
    layout: LayoutVersion,
}

pub fn content_folder(section: &str) -> &'static str {
    match section {
        SECTION_CHAPTERS => FOLDER_CHAPTERS,
        SECTION_RESEARCH => FOLDER_RESEARCH,
        SECTION_CHARACTERS => FOLDER_CHARACTERS,
        _ => FOLDER_CHAPTERS,
    }
}

pub fn legacy_content_folder(section: &str) -> &'static str {
    match section {
        SECTION_CHAPTERS => LEGACY_FOLDER_CHAPTERS,
        SECTION_RESEARCH => LEGACY_FOLDER_RESEARCH,
        SECTION_CHARACTERS => LEGACY_FOLDER_CHARACTERS,
        _ => LEGACY_FOLDER_CHAPTERS,
    }
}

impl LibraryPaths {
    pub fn detect(root: &Path) -> Result<Self, String> {
        let v2_manifest = root.join(CONFIG_DIR).join("library.json");
        if v2_manifest.is_file() {
            return Ok(Self {
                root: root.to_path_buf(),
                layout: LayoutVersion::V2,
            });
        }
        let legacy_manifest = root.join("library.json");
        if legacy_manifest.is_file() {
            return Ok(Self {
                root: root.to_path_buf(),
                layout: LayoutVersion::Legacy,
            });
        }
        Err("Not a valid Library: library.json not found".to_string())
    }

    pub fn new_v2(root: PathBuf) -> Self {
        Self {
            root,
            layout: LayoutVersion::V2,
        }
    }

    /// Detect the on-disk layout; when detection fails (manifest missing,
    /// e.g. mid-creation), assume the legacy layout so path lookups still
    /// resolve to sensible locations under `root`.
    pub fn detect_or_legacy(root: &Path) -> Self {
        Self::detect(root).unwrap_or_else(|_| Self {
            root: root.to_path_buf(),
            layout: LayoutVersion::Legacy,
        })
    }

    pub fn layout(&self) -> LayoutVersion {
        self.layout
    }

    pub fn is_valid_library(root: &Path) -> bool {
        root.join(CONFIG_DIR).join("library.json").is_file()
            || root.join("library.json").is_file()
    }

    pub fn library_manifest(&self) -> PathBuf {
        match self.layout {
            LayoutVersion::V2 => self.config_dir().join("library.json"),
            LayoutVersion::Legacy => self.root.join("library.json"),
        }
    }

    pub fn config_dir(&self) -> PathBuf {
        self.root.join(CONFIG_DIR)
    }

    pub fn book_settings(&self) -> PathBuf {
        match self.layout {
            LayoutVersion::V2 => self.config_dir().join("book.json"),
            LayoutVersion::Legacy => self.root.join("book.json"),
        }
    }

    pub fn mindmap(&self) -> PathBuf {
        match self.layout {
            LayoutVersion::V2 => self.config_dir().join("mindmap.json"),
            LayoutVersion::Legacy => self.root.join("mindmap.json"),
        }
    }

    pub fn research_index(&self) -> PathBuf {
        self.config_dir().join("research-index.json")
    }

    pub fn characters_index(&self) -> PathBuf {
        self.config_dir().join("characters-index.json")
    }

    pub fn content_dir(&self, section: &str) -> PathBuf {
        match self.layout {
            LayoutVersion::V2 => self.root.join(content_folder(section)),
            LayoutVersion::Legacy => self.root.join(legacy_content_folder(section)),
        }
    }

    pub fn legacy_content_dir(&self, section: &str) -> PathBuf {
        self.root.join(legacy_content_folder(section))
    }

    pub fn chapter_html(&self, section: &str, id: &str) -> PathBuf {
        self.content_dir(section).join(format!("{id}.html"))
    }

    pub fn meta_json(&self, section: &str, id: &str) -> PathBuf {
        self.content_dir(section).join(format!("{id}.meta.json"))
    }

    pub fn legacy_comments_json(&self, section: &str, id: &str) -> PathBuf {
        self.legacy_content_dir(section)
            .join(format!("{id}.comments.json"))
    }

    pub fn comments_json(&self, section: &str, id: &str) -> PathBuf {
        match self.layout {
            LayoutVersion::V2 => self
                .config_dir()
                .join("comments")
                .join(section)
                .join(format!("{id}.json")),
            LayoutVersion::Legacy => self.legacy_comments_json(section, id),
        }
    }

    pub fn snapshot_dir(&self, section: &str, id: &str) -> PathBuf {
        match self.layout {
            LayoutVersion::V2 => self
                .config_dir()
                .join("snapshots")
                .join(section)
                .join(id),
            LayoutVersion::Legacy => self.root.join("snapshots").join(section).join(id),
        }
    }

    pub fn legacy_snapshots_root(&self) -> PathBuf {
        self.root.join("snapshots")
    }

    pub fn images_dir(&self) -> PathBuf {
        match self.layout {
            LayoutVersion::V2 => self.config_dir().join("images"),
            LayoutVersion::Legacy => self.root.join("images"),
        }
    }

    pub fn legacy_images_dir(&self) -> PathBuf {
        self.root.join("images")
    }

    pub fn fonts_dir(&self) -> PathBuf {
        match self.layout {
            LayoutVersion::V2 => self.config_dir().join("fonts"),
            LayoutVersion::Legacy => self.root.join("fonts"),
        }
    }

    pub fn legacy_fonts_dir(&self) -> PathBuf {
        self.root.join("fonts")
    }

    pub fn exports_dir(&self) -> PathBuf {
        match self.layout {
            LayoutVersion::V2 => self.root.join(EXPORTS_DIR),
            LayoutVersion::Legacy => self.root.join(LEGACY_EXPORTS_DIR),
        }
    }

    pub fn legacy_exports_dir(&self) -> PathBuf {
        self.root.join(LEGACY_EXPORTS_DIR)
    }

    pub fn ensure_v2_structure(&self) -> Result<(), String> {
        std::fs::create_dir_all(self.config_dir()).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(self.content_dir(SECTION_CHAPTERS)).map_err(|e| e.to_string())?;
        Ok(())
    }
}
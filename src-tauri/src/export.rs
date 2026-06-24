use std::io::Write;
use std::os::unix::fs::PermissionsExt;

#[derive(serde::Deserialize)]
pub struct ExportFile {
    pub name: String,
    pub content: String,
    pub executable: bool,
}

/// Pure: the export directory under the user's home.
pub fn export_dir(home: &str) -> String {
    format!("{home}/Downloads/catalog-export")
}

/// Write each file into the export dir; chmod +x the executable ones. Returns the dir.
pub fn save(files: &[ExportFile]) -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let dir = export_dir(&home);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    for f in files {
        // Guard against path traversal in the (app-controlled) name.
        if f.name.contains('/') || f.name.contains("..") {
            return Err(format!("invalid file name: {}", f.name));
        }
        let path = format!("{dir}/{}", f.name);
        let mut fh = std::fs::File::create(&path).map_err(|e| e.to_string())?;
        fh.write_all(f.content.as_bytes()).map_err(|e| e.to_string())?;
        if f.executable {
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn export_dir_is_under_downloads() {
        assert_eq!(export_dir("/Users/x"), "/Users/x/Downloads/catalog-export");
    }
}

use std::io::Write;
use std::process::Command;

/// Pure: strip `man`'s overstrike formatting (`X\x08X` bold, `_\x08X` underline) → plain text.
pub fn strip_backspaces(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut out = String::with_capacity(chars.len());
    let mut i = 0;
    while i < chars.len() {
        // If the NEXT char is a backspace, skip this char and the backspace, keep the one after.
        if i + 1 < chars.len() && chars[i + 1] == '\u{8}' {
            i += 2; // drop current char + the backspace; the following char will be kept next loop
            continue;
        }
        if chars[i] != '\u{8}' {
            out.push(chars[i]);
        }
        i += 1;
    }
    out
}

/// Open a URL (or file path) in the user's default handler via macOS `open`.
pub fn open_url(url: &str) -> Result<(), String> {
    let status = Command::new("open")
        .arg(url)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("open exited {status}"))
    }
}

/// Fetch the man page for `name` as plain text. Non-interactive pager; does NOT run the binary.
pub fn get_man(name: &str) -> Result<String, String> {
    let out = Command::new("man")
        .arg(name)
        .env("MANPAGER", "cat")
        .env("PAGER", "cat")
        .env("MANWIDTH", "100")
        .output()
        .map_err(|e| format!("failed to run man: {e}"))?;
    if !out.status.success() {
        return Err(format!("no manual entry for {name}"));
    }
    let text = strip_backspaces(&String::from_utf8_lossy(&out.stdout));
    if text.trim().is_empty() {
        Err(format!("no manual entry for {name}"))
    } else {
        Ok(text)
    }
}

/// Reveal a file/app in Finder.
pub fn reveal_in_finder(path: &str) -> Result<(), String> {
    let st = Command::new("open")
        .arg("-R")
        .arg(path)
        .status()
        .map_err(|e| e.to_string())?;
    if st.success() {
        Ok(())
    } else {
        Err(format!("open -R exited {st}"))
    }
}

/// Copy text to the macOS clipboard via pbcopy.
pub fn copy_text(text: &str) -> Result<(), String> {
    let mut child = Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to run pbcopy: {e}"))?;
    child
        .stdin
        .as_mut()
        .ok_or("no pbcopy stdin")?
        .write_all(text.as_bytes())
        .map_err(|e| e.to_string())?;
    let st = child.wait().map_err(|e| e.to_string())?;
    if st.success() {
        Ok(())
    } else {
        Err("pbcopy failed".into())
    }
}

/// True if a manual page exists for `name` (path lookup only; never renders or runs the binary).
pub fn has_man(name: &str) -> bool {
    Command::new("man")
        .arg("-w")
        .arg(name)
        .output()
        .map(|o| o.status.success() && !o.stdout.trim_ascii().is_empty())
        .unwrap_or(false)
}

/// Absolute Homebrew prefix (`/opt/homebrew` on Apple Silicon, `/usr/local` on
/// Intel). GUI apps inherit a minimal PATH, so brew is addressed absolutely.
pub fn brew_prefix() -> &'static str {
    if std::path::Path::new("/opt/homebrew/bin/brew").exists() {
        "/opt/homebrew"
    } else {
        "/usr/local"
    }
}

/// Absolute path to the `brew` binary.
pub fn brew_bin() -> &'static str {
    match brew_prefix() {
        "/opt/homebrew" => "/opt/homebrew/bin/brew",
        _ => "/usr/local/bin/brew",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn strips_bold_overstrike() {
        // "A\x08A" (bold A) + "b" → "Ab"
        assert_eq!(strip_backspaces("A\u{8}Ab"), "Ab");
    }
    #[test]
    fn strips_underline_overstrike() {
        // "_\x08x" (underlined x) → "x"
        assert_eq!(strip_backspaces("_\u{8}x"), "x");
    }
    #[test]
    fn leaves_plain_text_untouched() {
        assert_eq!(strip_backspaces("hello world"), "hello world");
    }
}

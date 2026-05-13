const MAX_LEN: usize = 100;

pub fn sanitise_filename(title: &str) -> String {
    let sanitised: String = title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '-'
            }
        })
        .collect();

    let sanitised = sanitised.trim().replace(' ', "-");

    // Collapse consecutive dashes
    let mut result = String::new();
    let mut last_dash = false;
    for c in sanitised.chars() {
        if c == '-' {
            if !last_dash {
                result.push(c);
            }
            last_dash = true;
        } else {
            result.push(c);
            last_dash = false;
        }
    }

    let result = result.trim_matches('-').to_string();

    if result.is_empty() {
        return "untitled-course".to_string();
    }

    if result.len() > MAX_LEN {
        result[..MAX_LEN].to_string()
    } else {
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_title() {
        assert_eq!(sanitise_filename("React Basics"), "React-Basics");
    }

    #[test]
    fn special_chars_replaced() {
        // ++ → -- which collapse to -, ! → - which gets trimmed at end
        assert_eq!(sanitise_filename("C++ Programming!"), "C-Programming");
        // leading/trailing special chars become dashes which get trimmed
        let r = sanitise_filename("!bad start!");
        assert!(!r.starts_with('-'));
        assert!(!r.ends_with('-'));
    }

    #[test]
    fn empty_string_returns_untitled() {
        assert_eq!(sanitise_filename(""), "untitled-course");
    }

    #[test]
    fn all_special_chars_returns_untitled() {
        assert_eq!(sanitise_filename("!!!???"), "untitled-course");
    }

    #[test]
    fn very_long_title_truncated() {
        let long = "a".repeat(200);
        let result = sanitise_filename(&long);
        assert_eq!(result.len(), 100);
    }

    #[test]
    fn path_separators_replaced() {
        let r = sanitise_filename("../../etc/passwd");
        assert!(!r.contains('/'));
        assert!(!r.contains('\\'));
    }

    #[test]
    fn unicode_letters_preserved() {
        let r = sanitise_filename("Über Rust");
        assert!(!r.is_empty());
    }
}

use serde_json::Value;

/// Converts persisted summary JSON to canonical markdown.
/// Handles three shapes: markdown passthrough, BlockNote, and legacy sections.
pub(crate) fn summary_to_canonical_markdown(json_str: &str) -> String {
    let parsed: Value = match serde_json::from_str(json_str) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    if parsed.is_null() || !parsed.is_object() {
        return String::new();
    }

    // A. Markdown passthrough
    if let Some(markdown) = parsed.get("markdown").and_then(|v| v.as_str()) {
        let trimmed = markdown.trim();
        if !trimmed.is_empty() {
            return markdown.to_string();
        }
    }

    // B. BlockNote form
    if let Some(arr) = parsed.get("summary_json").and_then(|v| v.as_array()) {
        if !arr.is_empty() {
            return blocknote_to_markdown(arr);
        }
    }

    // C. Legacy section form
    legacy_to_markdown(&parsed)
}

/// Extracts section content from markdown by heading keywords.
/// Returns the body text under the first matching heading, stopping at the next heading.
pub(crate) fn extract_section_by_headings(markdown: &str, headings: &[&str]) -> String {
    let lines: Vec<&str> = markdown.lines().collect();
    let mut found_heading_idx: Option<usize> = None;

    for (i, line) in lines.iter().enumerate() {
        if !line.trim_start().starts_with('#') {
            continue;
        }
        let normalized = normalize_heading(line);
        if headings.iter().any(|h| normalized == *h) {
            found_heading_idx = Some(i);
            break;
        }
    }

    let start = match found_heading_idx {
        Some(idx) => idx + 1,
        None => return String::new(),
    };

    let mut body_lines: Vec<&str> = Vec::new();
    for line in &lines[start..] {
        if line.trim_start().starts_with('#') {
            break;
        }
        body_lines.push(line);
    }

    // Trim leading/trailing empty lines
    while body_lines.first().map_or(false, |l| l.trim().is_empty()) {
        body_lines.remove(0);
    }
    while body_lines.last().map_or(false, |l| l.trim().is_empty()) {
        body_lines.pop();
    }

    body_lines.join("\n")
}

// ── Internal helpers ──

fn normalize_heading(line: &str) -> String {
    line.trim()
        .trim_start_matches('#')
        .trim()
        .to_lowercase()
        .replace('\u{2018}', "")
        .replace('\u{2019}', "")
        .replace('\u{201c}', "")
        .replace('\u{201d}', "")
        .replace('*', "")
        .replace('_', "")
        .replace('`', "")
        .replace('~', "")
}

fn render_inline(content: &Value) -> String {
    if let Some(s) = content.as_str() {
        return s.to_string();
    }
    if let Some(arr) = content.as_array() {
        return arr
            .iter()
            .map(|item| {
                if let Some(s) = item.as_str() {
                    s.to_string()
                } else {
                    item.get("text")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string()
                }
            })
            .collect::<String>()
            .trim()
            .to_string();
    }
    String::new()
}

fn render_block(block: &Value) -> String {
    let inline = render_inline(block.get("content").unwrap_or(&Value::Null));
    let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match block_type {
        "heading" => {
            let level = block
                .get("props")
                .and_then(|p| p.get("level"))
                .and_then(|v| v.as_u64())
                .unwrap_or(2);
            let clamped = level.min(6).max(1);
            let hashes: String = "#".repeat(clamped as usize);
            format!("{} {}", hashes, inline)
        }
        "bulletListItem" => format!("- {}", inline),
        "numberedListItem" => format!("1. {}", inline),
        _ => inline,
    }
}

fn blocknote_to_markdown(blocks: &[Value]) -> String {
    let mut lines: Vec<String> = Vec::new();
    let mut previous_was_heading = false;

    for block in blocks {
        if block.is_null() {
            continue;
        }
        let rendered = render_block(block);
        if !rendered.is_empty() {
            let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if !lines.is_empty() && (previous_was_heading || block_type == "heading") {
                lines.push(String::new());
            }
            lines.push(rendered);
        }
        previous_was_heading = block_type(block) == "heading";

        if let Some(children) = block.get("children").and_then(|v| v.as_array()) {
            if !children.is_empty() {
                let child_md = blocknote_to_markdown(children);
                if !child_md.is_empty() {
                    lines.push(child_md);
                }
            }
        }
    }

    lines.join("\n")
}

fn block_type(block: &Value) -> &str {
    block.get("type").and_then(|v| v.as_str()).unwrap_or("")
}

fn legacy_to_markdown(data: &Value) -> String {
    let skipped: std::collections::HashSet<&str> =
        ["MeetingName", "MeetingDate", "_section_order", "markdown", "summary_json"]
            .iter()
            .copied()
            .collect();

    let order: Vec<String> = data
        .get("_section_order")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_else(|| {
            data.as_object()
                .map(|obj| {
                    obj.keys()
                        .filter(|k| !skipped.contains(k.as_str()))
                        .cloned()
                        .collect()
                })
                .unwrap_or_default()
        });

    let mut parts: Vec<String> = Vec::new();

    for key in &order {
        let section = match data.get(key) {
            Some(s) => s,
            None => continue,
        };
        if !section.is_object() || section.is_array() {
            continue;
        }

        let title = section
            .get("title")
            .and_then(|v| v.as_str())
            .filter(|t| !t.trim().is_empty())
            .unwrap_or(key);

        let blocks = match section.get("blocks").and_then(|v| v.as_array()) {
            Some(b) => b,
            None => continue,
        };

        let contents: Vec<String> = blocks
            .iter()
            .filter_map(|block| {
                block
                    .get("content")
                    .and_then(|v| v.as_str())
                    .filter(|c| !c.trim().is_empty())
                    .map(|c| c.to_string())
            })
            .collect();

        if contents.is_empty() {
            continue;
        }

        let bullets: Vec<String> = contents.iter().map(|c| format!("- {}", c)).collect();
        parts.push(format!("## {}\n\n{}", title, bullets.join("\n")));
    }

    parts.join("\n\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── A. Markdown passthrough ──

    #[test]
    fn summary_markdown_passthrough() {
        let input = json!({"markdown": "## Action Items\n\n- Send proposal\n- Review PR"});
        let result = summary_to_canonical_markdown(&input.to_string());
        assert_eq!(result, "## Action Items\n\n- Send proposal\n- Review PR");
    }

    // ── B. BlockNote heading ──

    #[test]
    fn summary_blocknote_heading() {
        let input = json!({
            "summary_json": [
                {"id": "1", "type": "heading", "props": {"level": 2}, "content": [{"type": "text", "text": "Action Items"}]}
            ]
        });
        let result = summary_to_canonical_markdown(&input.to_string());
        assert_eq!(result, "## Action Items");
    }

    // ── C. BlockNote bullet ──

    #[test]
    fn summary_blocknote_bullet() {
        let input = json!({
            "summary_json": [
                {"id": "1", "type": "bulletListItem", "content": [{"type": "text", "text": "Send proposal"}]}
            ]
        });
        let result = summary_to_canonical_markdown(&input.to_string());
        assert_eq!(result, "- Send proposal");
    }

    // ── D. Legacy sections ──

    #[test]
    fn summary_legacy_sections() {
        let input = json!({
            "MeetingName": "Sprint Planning",
            "Action_Items": {
                "title": "Action Items",
                "blocks": [
                    {"id": "1", "type": "list", "content": "Send proposal", "color": "default"},
                    {"id": "2", "type": "list", "content": "Review PR #42", "color": "default"}
                ]
            },
            "_section_order": ["Action_Items"]
        });
        let result = summary_to_canonical_markdown(&input.to_string());
        assert_eq!(result, "## Action Items\n\n- Send proposal\n- Review PR #42");
    }

    // ── E. Empty / unknown ──

    #[test]
    fn summary_empty_or_unknown() {
        assert_eq!(summary_to_canonical_markdown(""), "");
        assert_eq!(summary_to_canonical_markdown("null"), "");
        assert_eq!(summary_to_canonical_markdown("{}"), "");
    }

    // ── F. extract_section_by_headings ──

    #[test]
    fn extract_action_items_section() {
        let md = "## Decisions\n\n- Use Rust\n\n## Action Items\n\n- Send proposal\n- Review PR\n\n## Notes\n\n- Misc";
        let result = extract_section_by_headings(md, &["action items", "action item", "actions"]);
        assert_eq!(result, "- Send proposal\n- Review PR");
    }

    #[test]
    fn extract_decisions_section() {
        let md = "## Key Decisions\n\n- Use Rust for backend\n- Ship v0.1 first\n\n## Action Items\n\n- Send proposal";
        let result = extract_section_by_headings(md, &["key decisions", "decisions", "decision"]);
        assert_eq!(result, "- Use Rust for backend\n- Ship v0.1 first");
    }

    #[test]
    fn extract_section_stops_at_next_heading() {
        let md = "## Action Items\n\n- Task A\n- Task B\n\n## Decisions\n\n- Decision X";
        let result = extract_section_by_headings(md, &["action items"]);
        assert_eq!(result, "- Task A\n- Task B");
    }

    #[test]
    fn extract_section_not_found() {
        let md = "## Notes\n\n- Something";
        let result = extract_section_by_headings(md, &["action items"]);
        assert_eq!(result, "");
    }
}

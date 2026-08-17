pub(crate) fn classify_query(query: &str) -> &'static str {
    let lower = query.to_lowercase();

    let action_keywords = [
        "action item", "action items", "todo item", "todo items",
        "next steps", "tasks", "who should do", "assign",
    ];
    if action_keywords.iter().any(|kw| lower.contains(kw)) {
        return "action_item";
    }

    let decision_keywords = [
        "decisions were made", "decision", "agreed on", "agree on",
        "conclusion", "what was decided",
    ];
    if decision_keywords.iter().any(|kw| lower.contains(kw)) {
        return "decision";
    }

    let note_keywords = ["notes were taken", "notes", "documented", "what was noted"];
    if note_keywords.iter().any(|kw| lower.contains(kw)) {
        return "note";
    }

    let transcript_keywords = [
        "who said", "what did", "mentioned", "discussed",
        "what was discussed", "who mentioned", "who spoke",
    ];
    if transcript_keywords.iter().any(|kw| lower.contains(kw)) {
        return "transcript";
    }

    let summary_keywords = [
        "summary", "summarize", "summarise", "key points", "tldr",
        "recap", "overview",
    ];
    if summary_keywords.iter().any(|kw| lower.contains(kw)) {
        return "summary";
    }

    "general"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_action_keywords() {
        let q1 = "what are the action items";
        let q2 = "who should do the tasks";
        let q3 = "next steps";
        let q4 = "assign the todo items";
        assert_eq!(classify_query(q1), "action_item");
        assert_eq!(classify_query(q2), "action_item");
        assert_eq!(classify_query(q3), "action_item");
        assert_eq!(classify_query(q4), "action_item");
    }

    #[test]
    fn classify_decision_keywords() {
        let q1 = "what decisions were made";
        let q2 = "what did we agree on";
        let q3 = "the conclusion";
        assert_eq!(classify_query(q1), "decision");
        assert_eq!(classify_query(q2), "decision");
        assert_eq!(classify_query(q3), "decision");
    }

    #[test]
    fn classify_note_keywords() {
        let q1 = "what notes were taken";
        let q2 = "what was documented";
        assert_eq!(classify_query(q1), "note");
        assert_eq!(classify_query(q2), "note");
    }

    #[test]
    fn classify_transcript_keywords() {
        let q1 = "who said the API needs updating";
        let q2 = "what did Sarah mention";
        let q3 = "what was discussed about pricing";
        assert_eq!(classify_query(q1), "transcript");
        assert_eq!(classify_query(q2), "transcript");
        assert_eq!(classify_query(q3), "transcript");
    }

    #[test]
    fn classify_summary_keywords() {
        let q1 = "give me a summary";
        let q2 = "what are the key points";
        let q3 = "tldr of the meeting";
        assert_eq!(classify_query(q1), "summary");
        assert_eq!(classify_query(q2), "summary");
        assert_eq!(classify_query(q3), "summary");
    }

    #[test]
    fn classify_general_fallback() {
        let q1 = "tell me about the project";
        let q2 = "how is everything going";
        assert_eq!(classify_query(q1), "general");
        assert_eq!(classify_query(q2), "general");
    }
}

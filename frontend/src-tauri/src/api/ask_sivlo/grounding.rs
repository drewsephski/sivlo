use once_cell::sync::Lazy;
use regex::Regex;

use super::{AskSivloHistoryMessage, AskSivloScope};

static CITATION_MARKER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[S\d+\]").unwrap()
});

static CITATION_EXTRACT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[S(\d+)\]").unwrap()
});

pub(crate) fn sanitize_history(history: &[AskSivloHistoryMessage]) -> Vec<AskSivloHistoryMessage> {
    history
        .iter()
        .map(|msg| AskSivloHistoryMessage {
            role: msg.role.clone(),
            content: CITATION_MARKER_RE.replace_all(&msg.content, "").to_string(),
        })
        .collect()
}

pub(crate) fn extract_citation_ids(answer: &str) -> Vec<usize> {
    CITATION_EXTRACT_RE
        .captures_iter(answer)
        .filter_map(|cap| cap.get(1)?.as_str().parse::<usize>().ok())
        .collect()
}

pub(crate) fn route_query(query: &str, scope: &Option<AskSivloScope>) -> &'static str {
    // 1. Explicit meeting scope -> meeting
    if let Some(s) = scope {
        if s.kind == "meeting" {
            return "meeting";
        }
    }

    let lower = query.to_lowercase();

    // 2. Meeting evidence / temporal intent -> meeting
    let meeting_evidence = [
        "what did", "who said", "who mentioned", "who spoke",
        "what was discussed", "mentioned", "discussed",
        "decisions were made", "decision", "agreed on", "agree on",
        "conclusion", "what was decided",
    ];
    let temporal = [
        "last week", "yesterday", "today", "this morning",
        "this afternoon", "this week", "last month", "last monday",
        "last tuesday", "last wednesday", "last thursday", "last friday",
    ];
    if meeting_evidence.iter().any(|kw| lower.contains(kw))
        || temporal.iter().any(|kw| lower.contains(kw))
    {
        return "meeting";
    }

    // 3. Product question pattern + product capability keyword -> product
    let question_patterns = ["how do i", "how do we", "can i", "can we", "is it possible", "what is", "what are"];
    let product_keywords = [
        "sivlo", "transcri", "record", "capture", "import", "audio",
        "summar", "note", "meeting", "meeting", "llm", "provider",
        "gpu", "metal", "platform", "macos", "windows", "linux",
        "privacy", "data", "security", "local",
    ];
    let has_question = question_patterns.iter().any(|p| lower.contains(p));
    let has_product = product_keywords.iter().any(|k| lower.contains(k));
    if has_question && has_product {
        return "product";
    }

    // 4. Explicit Sivlo/app reference + product capability keyword -> product
    let sivlo_refs = ["sivlo", "the app", "the application", "the software", "the tool"];
    if sivlo_refs.iter().any(|r| lower.contains(r)) && has_product {
        return "product";
    }

    // 5. Otherwise -> meeting
    "meeting"
}

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

    #[test]
    fn route_meeting_explicit_scope() {
        let scope = Some(AskSivloScope {
            kind: "meeting".to_string(),
            meeting_id: Some("abc-123".to_string()),
        });
        assert_eq!(route_query("anything", &scope), "meeting");
    }

    #[test]
    fn route_product_question_patterns() {
        let q1 = "how do I import audio";
        let q2 = "what is Sivlo's transcription";
        assert_eq!(route_query(q1, &None), "product");
        assert_eq!(route_query(q2, &None), "product");
    }

    #[test]
    fn route_product_sivlo_reference() {
        let q1 = "can Sivlo do transcription";
        let q2 = "does the app support recording";
        assert_eq!(route_query(q1, &None), "product");
        assert_eq!(route_query(q2, &None), "product");
    }

    #[test]
    fn route_meeting_evidence_keywords() {
        let q1 = "what did Sarah say";
        let q2 = "what decisions were made";
        assert_eq!(route_query(q1, &None), "meeting");
        assert_eq!(route_query(q2, &None), "meeting");
    }

    #[test]
    fn route_meeting_temporal_references() {
        let q1 = "what happened last week";
        let q2 = "yesterday's standup";
        assert_eq!(route_query(q1, &None), "meeting");
        assert_eq!(route_query(q2, &None), "meeting");
    }

    #[test]
    fn route_ambiguous_meeting_wins() {
        let q = "What is the pricing decision from yesterday's meeting?";
        assert_eq!(route_query(q, &None), "meeting");
    }

    #[test]
    fn route_meeting_default() {
        let q = "tell me about the project";
        assert_eq!(route_query(q, &None), "meeting");
    }

    #[test]
    fn route_product_only_pattern_no_match() {
        let q = "how do i cook pasta";
        assert_eq!(route_query(q, &None), "meeting");
    }

    #[test]
    fn sanitize_strips_citation_markers() {
        let history = vec![
            AskSivloHistoryMessage {
                role: "assistant".to_string(),
                content: "The answer is [S1] correct and [S23] verified".to_string(),
            },
        ];
        let result = sanitize_history(&history);
        assert_eq!(result[0].content, "The answer is  correct and  verified");
    }

    #[test]
    fn sanitize_preserves_role() {
        let history = vec![
            AskSivloHistoryMessage {
                role: "user".to_string(),
                content: "hello [S1]".to_string(),
            },
        ];
        let result = sanitize_history(&history);
        assert_eq!(result[0].role, "user");
    }

    #[test]
    fn sanitize_empty_history() {
        let result = sanitize_history(&[]);
        assert!(result.is_empty());
    }

    #[test]
    fn extract_citation_ids_valid() {
        let answer = "Hello [S1] world [S2] and [S10]";
        let ids = extract_citation_ids(answer);
        assert_eq!(ids, vec![1, 2, 10]);
    }

    #[test]
    fn extract_citation_ids_none() {
        let answer = "No citations here";
        let ids = extract_citation_ids(answer);
        assert!(ids.is_empty());
    }
}

use std::collections::HashSet;

use super::models::{AskSivloScope, RawEvidence};

/// Minimal stop-word set (approved in plan).
const STOP_WORDS: &[&str] = &[
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "both", "each", "few", "more", "most",
    "other", "some", "such", "no", "nor", "not", "only", "own", "same",
    "so", "than", "too", "very", "just", "about", "what", "which", "who",
    "whom", "this", "that", "these", "those", "i", "me", "my", "we",
    "our", "you", "your", "he", "him", "his", "she", "her", "it", "its",
    "they", "them", "their",
];

/// Normalize a query string into useful search terms.
/// Lowercases, removes stop words, preserves Unicode.
pub(crate) fn normalize_query_terms(query: &str) -> Vec<String> {
    query
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '\'' && c != '-')
        .filter(|term| !term.is_empty() && !STOP_WORDS.contains(term))
        .map(|term| term.to_string())
        .collect()
}

/// Score a single evidence item against the query.
pub(crate) fn score_evidence(
    query: &str,
    query_terms: &[String],
    classification: &str,
    scope: &Option<AskSivloScope>,
    evidence: &RawEvidence,
) -> f64 {
    let mut score: f64 = 0.0;
    let text_lower = evidence.text.to_lowercase();
    let title_lower = evidence.meeting_title.to_lowercase();
    let query_lower = query.to_lowercase();

    // Explicit scope/title match: +2.0
    if let Some(s) = scope {
        if s.kind == "meeting" {
            if title_lower.contains(&query_lower) || query_lower.contains(&title_lower) {
                score += 2.0;
            }
        }
    }

    // Exact phrase match (full query in text): +3.0
    if text_lower.contains(&query_lower) {
        score += 3.0;
    }

    // Token match density: +0.0 to +2.0
    if !query_terms.is_empty() {
        let matched = query_terms
            .iter()
            .filter(|term| text_lower.contains(term.as_str()))
            .count();
        score += 2.0 * (matched as f64 / query_terms.len() as f64);
    }

    // Source-intent boost: +1.0 when classification matches source_type
    if classification == evidence.source_type {
        score += 1.0;
    }

    // Recency: modest tie-break +0.0 to +0.1
    if let Some(ref ts) = evidence.timestamp {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(ts) {
            let now = chrono::Utc::now();
            let age_hours = (now - dt.with_timezone(&chrono::Utc))
                .num_hours()
                .max(0) as f64;
            // Decays from +0.1 at now to ~0 at 30 days
            let recency = (0.1 * (1.0 - age_hours / 720.0)).max(0.0);
            score += recency;
        }
    }

    score
}

/// Rank and deduplicate evidence candidates, returning sorted by relevance.
pub(crate) fn rank_and_dedupe_evidence(
    candidates: Vec<RawEvidence>,
    query: &str,
    classification: &str,
    scope: &Option<AskSivloScope>,
) -> Vec<RawEvidence> {
    let query_terms = normalize_query_terms(query);

    // Deduplicate by (meeting_id, source_type, text)
    let mut seen: HashSet<(String, String, String)> = HashSet::new();
    let mut unique: Vec<RawEvidence> = Vec::new();
    for e in candidates {
        let key = (e.meeting_id.clone(), e.source_type.clone(), e.text.clone());
        if seen.insert(key) {
            unique.push(e);
        }
    }

    // Score and sort descending
    let mut scored: Vec<(f64, RawEvidence)> = unique
        .into_iter()
        .map(|e| {
            let s = score_evidence(query, &query_terms, classification, scope, &e);
            (s, e)
        })
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    scored.into_iter().map(|(_, e)| e).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::ask_sivlo::models::{AskSivloScope, RawEvidence};

    #[test]
    fn normalize_query_terms_basic() {
        let terms = normalize_query_terms("What were the action items?");
        assert_eq!(terms, vec!["action", "items"]);
    }

    #[test]
    fn normalize_query_terms_unicode() {
        let terms = normalize_query_terms("¿Qué pasó en la reunión?");
        // "en" and "la" are not in the English stop-word set; they remain as useful terms
        assert_eq!(terms, vec!["qué", "pasó", "en", "la", "reunión"]);
    }

    #[test]
    fn normalize_stop_words_only() {
        let terms = normalize_query_terms("what is the");
        assert!(terms.is_empty());
    }

    #[test]
    fn score_exact_phrase_match() {
        let evidence_full = RawEvidence {
            meeting_id: "m1".into(),
            meeting_title: "Sprint".into(),
            meeting_date: None,
            source_type: "transcript".into(),
            text: "the pricing decision was final".into(),
            timestamp: None,
            audio_start_time: None,
            audio_end_time: None,
        };
        let evidence_partial = RawEvidence {
            meeting_id: "m1".into(),
            meeting_title: "Sprint".into(),
            meeting_date: None,
            source_type: "transcript".into(),
            text: "pricing was discussed".into(),
            timestamp: None,
            audio_start_time: None,
            audio_end_time: None,
        };

        let terms = normalize_query_terms("pricing decision");
        let score_full = score_evidence("pricing decision", &terms, "general", &None, &evidence_full);
        let score_partial = score_evidence("pricing decision", &terms, "general", &None, &evidence_partial);
        assert!(score_full > score_partial);
    }

    #[test]
    fn score_title_match_boost() {
        let evidence_titled = RawEvidence {
            meeting_id: "m1".into(),
            meeting_title: "Pricing Review".into(),
            meeting_date: None,
            source_type: "transcript".into(),
            text: "we discussed numbers".into(),
            timestamp: None,
            audio_start_time: None,
            audio_end_time: None,
        };
        let evidence_other = RawEvidence {
            meeting_id: "m2".into(),
            meeting_title: "Team Standup".into(),
            meeting_date: None,
            source_type: "transcript".into(),
            text: "pricing was discussed".into(),
            timestamp: None,
            audio_start_time: None,
            audio_end_time: None,
        };

        let terms = normalize_query_terms("pricing review");
        let scope = Some(AskSivloScope {
            kind: "meeting".into(),
            meeting_id: None,
        });
        let score_titled = score_evidence("pricing review", &terms, "general", &scope, &evidence_titled);
        let score_other = score_evidence("pricing review", &terms, "general", &scope, &evidence_other);
        assert!(score_titled > score_other);
    }

    #[test]
    fn score_source_intent_boost() {
        let action_evidence = RawEvidence {
            meeting_id: "m1".into(),
            meeting_title: "Sprint".into(),
            meeting_date: None,
            source_type: "action_item".into(),
            text: "send proposal".into(),
            timestamp: None,
            audio_start_time: None,
            audio_end_time: None,
        };
        let transcript_evidence = RawEvidence {
            meeting_id: "m1".into(),
            meeting_title: "Sprint".into(),
            meeting_date: None,
            source_type: "transcript".into(),
            text: "send proposal".into(),
            timestamp: None,
            audio_start_time: None,
            audio_end_time: None,
        };

        let terms = normalize_query_terms("action items send proposal");
        let score_action = score_evidence("action items send proposal", &terms, "action_item", &None, &action_evidence);
        let score_transcript = score_evidence("action items send proposal", &terms, "action_item", &None, &transcript_evidence);
        assert!(score_action > score_transcript);
    }

    #[test]
    fn rank_relevance_beats_recency() {
        let old_relevant = RawEvidence {
            meeting_id: "m1".into(),
            meeting_title: "Sprint".into(),
            meeting_date: None,
            source_type: "transcript".into(),
            text: "pricing decision was final and confirmed".into(),
            timestamp: Some("2026-01-01T00:00:00Z".into()),
            audio_start_time: None,
            audio_end_time: None,
        };
        let new_less_relevant = RawEvidence {
            meeting_id: "m2".into(),
            meeting_title: "Standup".into(),
            meeting_date: None,
            source_type: "transcript".into(),
            text: "pricing was briefly mentioned".into(),
            timestamp: Some("2026-08-16T00:00:00Z".into()),
            audio_start_time: None,
            audio_end_time: None,
        };

        let query = "pricing decision final";
        let terms = normalize_query_terms(query);
        let ranked = rank_and_dedupe_evidence(
            vec![new_less_relevant, old_relevant],
            query,
            "general",
            &None,
        );
        assert_eq!(ranked.len(), 2);
        assert_eq!(ranked[0].meeting_id, "m1");
    }

    #[test]
    fn rank_deduplication() {
        let e1 = RawEvidence {
            meeting_id: "m1".into(),
            meeting_title: "Sprint".into(),
            meeting_date: None,
            source_type: "transcript".into(),
            text: "pricing decision was final".into(),
            timestamp: None,
            audio_start_time: None,
            audio_end_time: None,
        };
        let e2 = RawEvidence {
            meeting_id: "m1".into(),
            meeting_title: "Sprint".into(),
            meeting_date: None,
            source_type: "transcript".into(),
            text: "pricing decision was final".into(),
            timestamp: None,
            audio_start_time: None,
            audio_end_time: None,
        };
        let e3 = RawEvidence {
            meeting_id: "m1".into(),
            meeting_title: "Sprint".into(),
            meeting_date: None,
            source_type: "summary".into(),
            text: "pricing decision was final".into(),
            timestamp: None,
            audio_start_time: None,
            audio_end_time: None,
        };

        let ranked = rank_and_dedupe_evidence(vec![e1, e2, e3], "pricing", "general", &None);
        assert_eq!(ranked.len(), 2);
    }
}

use std::collections::HashSet;

use sqlx::SqlitePool;

use super::models::{AskSivloScope, RawEvidence};
use super::summary_text::{extract_section_by_headings, summary_to_canonical_markdown};

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

/// Retrieve meeting evidence from the database for a given query.
/// Searches transcripts, summaries, notes, action items, and decisions.
pub(crate) async fn retrieve_meeting_evidence(
    pool: &SqlitePool,
    query: &str,
    classification: &str,
    scope: &Option<AskSivloScope>,
) -> Result<Vec<RawEvidence>, String> {
    let terms = normalize_query_terms(query);
    if terms.is_empty() {
        return Ok(Vec::new());
    }

    let mut candidates: Vec<RawEvidence> = Vec::new();

    // 1. Search transcripts — each useful term independently with bound LIKE
    for term in &terms {
        let pattern = format!("%{}%", term);
        let rows: Vec<(String, String, String, String, String, Option<f64>, Option<f64>)> =
            sqlx::query_as(
                "SELECT m.id, m.title, t.transcript, t.timestamp, m.created_at,
                        t.audio_start_time, t.audio_end_time
                 FROM meetings m
                 JOIN transcripts t ON m.id = t.meeting_id
                 WHERE LOWER(t.transcript) LIKE ?",
            )
            .bind(&pattern)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

        for (meeting_id, title, transcript, timestamp, created_at, audio_start, audio_end) in rows {
            // Apply explicit scope filter
            if let Some(ref s) = scope {
                if s.kind == "meeting" {
                    if let Some(ref mid) = s.meeting_id {
                        if &meeting_id != mid {
                            continue;
                        }
                    }
                }
            }
            candidates.push(RawEvidence {
                meeting_id,
                meeting_title: title,
                meeting_date: Some(created_at),
                source_type: "transcript".into(),
                text: transcript,
                timestamp: Some(timestamp),
                audio_start_time: audio_start,
                audio_end_time: audio_end,
            });
        }
    }

    // 2. Search summaries, action items, decisions
    let meeting_ids = get_eligible_meeting_ids(pool, scope).await?;
    for meeting_id in &meeting_ids {
        if let Ok(Some(sp)) =
            crate::database::repositories::summary::SummaryProcessesRepository::get_summary_data(
                pool,
                meeting_id,
            )
            .await
        {
            if let Some(ref result_json) = sp.result {
                let markdown = summary_to_canonical_markdown(result_json);
                let title = get_meeting_title(pool, meeting_id).await.unwrap_or_default();
                let date = sp.created_at.to_rfc3339();

                // Full summary evidence
                if terms.iter().any(|t| markdown.to_lowercase().contains(t.as_str())) {
                    candidates.push(RawEvidence {
                        meeting_id: meeting_id.clone(),
                        meeting_title: title.clone(),
                        meeting_date: Some(date.clone()),
                        source_type: "summary".into(),
                        text: markdown.clone(),
                        timestamp: Some(date.clone()),
                        audio_start_time: None,
                        audio_end_time: None,
                    });
                }

                // Action items — include when section exists AND either
                // (a) classification matches (intent-based), or (b) body contains query terms (lexical).
                let actions =
                    extract_section_by_headings(&markdown, &["action items", "action item", "actions"]);
                if !actions.is_empty()
                    && (classification == "action_item"
                        || terms.iter().any(|t| actions.to_lowercase().contains(t.as_str())))
                {
                    candidates.push(RawEvidence {
                        meeting_id: meeting_id.clone(),
                        meeting_title: title.clone(),
                        meeting_date: Some(date.clone()),
                        source_type: "action_item".into(),
                        text: actions,
                        timestamp: Some(date.clone()),
                        audio_start_time: None,
                        audio_end_time: None,
                    });
                }

                // Decisions — include when section exists AND either
                // (a) classification matches (intent-based), or (b) body contains query terms (lexical).
                let decisions = extract_section_by_headings(
                    &markdown,
                    &["decisions", "decision", "key decisions"],
                );
                if !decisions.is_empty()
                    && (classification == "decision"
                        || terms.iter().any(|t| decisions.to_lowercase().contains(t.as_str())))
                {
                    candidates.push(RawEvidence {
                        meeting_id: meeting_id.clone(),
                        meeting_title: title.clone(),
                        meeting_date: Some(date),
                        source_type: "decision".into(),
                        text: decisions,
                        timestamp: None,
                        audio_start_time: None,
                        audio_end_time: None,
                    });
                }
            }
        }
    }

    // 3. Search notes
    for meeting_id in &meeting_ids {
        if let Ok(Some(notes)) =
            crate::database::repositories::meeting_notes::MeetingNotesRepository::get_notes(
                pool,
                meeting_id,
            )
            .await
        {
            if let Some(ref md) = notes.notes_markdown {
                if terms.iter().any(|t| md.to_lowercase().contains(t.as_str())) {
                    let title = get_meeting_title(pool, meeting_id).await.unwrap_or_default();
                    candidates.push(RawEvidence {
                        meeting_id: meeting_id.clone(),
                        meeting_title: title,
                        meeting_date: None,
                        source_type: "note".into(),
                        text: md.clone(),
                        timestamp: None,
                        audio_start_time: None,
                        audio_end_time: None,
                    });
                }
            }
        }
    }

    // 4. Rank and dedupe
    Ok(rank_and_dedupe_evidence(candidates, query, classification, scope))
}

/// Get meeting IDs eligible for search, filtered by scope.
async fn get_eligible_meeting_ids(
    pool: &SqlitePool,
    scope: &Option<AskSivloScope>,
) -> Result<Vec<String>, String> {
    if let Some(ref s) = scope {
        if s.kind == "meeting" {
            if let Some(ref mid) = s.meeting_id {
                return Ok(vec![mid.clone()]);
            }
        }
    }
    let rows: Vec<(String,)> = sqlx::query_as("SELECT id FROM meetings")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|(id,)| id).collect())
}

/// Get meeting title by ID.
async fn get_meeting_title(pool: &SqlitePool, meeting_id: &str) -> Option<String> {
    let row: Option<(String,)> = sqlx::query_as("SELECT title FROM meetings WHERE id = ?")
        .bind(meeting_id)
        .fetch_optional(pool)
        .await
        .ok()?;
    row.map(|(t,)| t)
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

    // ── Task 8 DB tests ──

    use chrono::Utc;
    use sqlx::sqlite::SqliteConnectOptions;

    async fn test_db_pool() -> SqlitePool {
        let options = SqliteConnectOptions::new()
            .filename(":memory:")
            .create_if_missing(true);
        let pool = sqlx::pool::PoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .expect("failed to create test database");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("failed to run migrations");
        pool
    }

    async fn seed_meeting(pool: &SqlitePool, id: &str, title: &str) {
        let now = Utc::now();
        sqlx::query("INSERT INTO meetings (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
            .bind(id)
            .bind(title)
            .bind(now)
            .bind(now)
            .execute(pool)
            .await
            .expect("failed to insert meeting");
    }

    async fn seed_transcript(
        pool: &SqlitePool,
        meeting_id: &str,
        text: &str,
        audio_start: Option<f64>,
        audio_end: Option<f64>,
    ) {
        let id = format!("t-{}", meeting_id);
        sqlx::query(
            "INSERT INTO transcripts (id, meeting_id, transcript, timestamp, audio_start_time, audio_end_time) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(meeting_id)
        .bind(text)
        .bind("2026-08-16T10:00:00Z")
        .bind(audio_start)
        .bind(audio_end)
        .execute(pool)
        .await
        .expect("failed to insert transcript");
    }

    async fn seed_summary(pool: &SqlitePool, meeting_id: &str, result_json: &str) {
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO summary_processes (meeting_id, status, created_at, updated_at, result) VALUES (?, 'completed', ?, ?, ?)",
        )
        .bind(meeting_id)
        .bind(now)
        .bind(now)
        .bind(result_json)
        .execute(pool)
        .await
        .expect("failed to insert summary");
    }

    async fn seed_notes(pool: &SqlitePool, meeting_id: &str, markdown: &str) {
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO meeting_notes (meeting_id, notes_markdown, created_at, updated_at) VALUES (?, ?, ?, ?)",
        )
        .bind(meeting_id)
        .bind(markdown)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .expect("failed to insert notes");
    }

    #[tokio::test]
    async fn retrieve_all_scope_transcripts() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Meeting A").await;
        seed_meeting(&pool, "m2", "Meeting B").await;
        seed_transcript(&pool, "m1", "the pricing decision was final", None, None).await;
        seed_transcript(&pool, "m2", "pricing was discussed at length", None, None).await;

        let results = retrieve_meeting_evidence(&pool, "pricing", "general", &None)
            .await
            .unwrap();
        let meeting_ids: Vec<&str> = results.iter().map(|e| e.meeting_id.as_str()).collect();
        assert!(meeting_ids.contains(&"m1"));
        assert!(meeting_ids.contains(&"m2"));
    }

    #[tokio::test]
    async fn retrieve_meeting_scope() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Meeting A").await;
        seed_meeting(&pool, "m2", "Meeting B").await;
        seed_transcript(&pool, "m1", "pricing was final", None, None).await;
        seed_transcript(&pool, "m2", "pricing was discussed", None, None).await;

        let scope = Some(AskSivloScope {
            kind: "meeting".into(),
            meeting_id: Some("m1".into()),
        });
        let results = retrieve_meeting_evidence(&pool, "pricing", "general", &scope)
            .await
            .unwrap();
        assert!(results.iter().all(|e| e.meeting_id == "m1"));
        assert!(!results.iter().any(|e| e.meeting_id == "m2"));
    }

    #[tokio::test]
    async fn retrieve_multi_term_non_contiguous() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        seed_transcript(&pool, "m1", "the pricing decision was final", None, None).await;

        let results = retrieve_meeting_evidence(&pool, "what did we decide about pricing", "general", &None)
            .await
            .unwrap();
        assert!(!results.is_empty());
        assert!(results.iter().any(|e| e.text.contains("pricing")));
    }

    #[tokio::test]
    async fn retrieve_apostrophe_query_parameterized() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        seed_transcript(&pool, "m1", "Sam's pricing proposal was approved", None, None).await;

        let results = retrieve_meeting_evidence(&pool, "Sam's pricing", "general", &None)
            .await
            .unwrap();
        assert!(!results.is_empty());
        assert!(results.iter().any(|e| e.text.contains("Sam's")));
    }

    #[tokio::test]
    async fn retrieve_timestamps_preserved() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        seed_transcript(&pool, "m1", "pricing was discussed", Some(125.3), Some(128.6)).await;

        let results = retrieve_meeting_evidence(&pool, "pricing", "general", &None)
            .await
            .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].audio_start_time, Some(125.3));
        assert_eq!(results[0].audio_end_time, Some(128.6));
    }

    #[tokio::test]
    async fn retrieve_summary_evidence() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        let summary_json = "{\"markdown\": \"## Summary\\n\\nThe pricing was finalized.\"}";
        seed_summary(&pool, "m1", summary_json).await;

        let results = retrieve_meeting_evidence(&pool, "pricing", "general", &None)
            .await
            .unwrap();
        assert!(results.iter().any(|e| e.source_type == "summary"));
    }

    #[tokio::test]
    async fn retrieve_notes_evidence() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        seed_notes(&pool, "m1", "# Notes\n\nPricing discussed at length").await;

        let results = retrieve_meeting_evidence(&pool, "pricing", "general", &None)
            .await
            .unwrap();
        assert!(results.iter().any(|e| e.source_type == "note"));
    }

    #[tokio::test]
    async fn retrieve_action_items_from_summary() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        let summary_json = "{\"markdown\": \"## Action Items\\n\\n- Send proposal\\n\\n- Review pricing\"}";
        seed_summary(&pool, "m1", summary_json).await;

        let results = retrieve_meeting_evidence(&pool, "send", "action_item", &None)
            .await
            .unwrap();
        assert!(results.iter().any(|e| e.source_type == "action_item"));
    }

    #[tokio::test]
    async fn retrieve_decisions_from_summary() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        let summary_json = "{\"markdown\": \"## Decisions\\n\\n- Use Rust for backend\"}";
        seed_summary(&pool, "m1", summary_json).await;

        let results = retrieve_meeting_evidence(&pool, "rust", "decision", &None)
            .await
            .unwrap();
        assert!(results.iter().any(|e| e.source_type == "decision"));
    }

    #[tokio::test]
    async fn extract_action_items_from_summary() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        let summary_json = "{\"markdown\": \"## Summary\\n\\nOverview.\\n\\n## Action Items\\n\\n- Send proposal\\n\\n## Decisions\\n\\n- Use Rust\"}";
        seed_summary(&pool, "m1", summary_json).await;

        let results = retrieve_meeting_evidence(&pool, "send", "action_item", &None)
            .await
            .unwrap();
        let action_texts: Vec<&str> = results
            .iter()
            .filter(|e| e.source_type == "action_item")
            .map(|e| e.text.as_str())
            .collect();
        assert!(action_texts.iter().any(|t| t.contains("Send proposal")));
        assert!(!action_texts.iter().any(|t| t.contains("Use Rust")));
    }

    #[tokio::test]
    async fn extract_decisions_from_summary() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        let summary_json = "{\"markdown\": \"## Action Items\\n\\n- Send proposal\\n\\n## Decisions\\n\\n- Use Rust\\n\\n## Notes\\n\\n- Misc\"}";
        seed_summary(&pool, "m1", summary_json).await;

        let results = retrieve_meeting_evidence(&pool, "rust", "decision", &None)
            .await
            .unwrap();
        let decision_texts: Vec<&str> = results
            .iter()
            .filter(|e| e.source_type == "decision")
            .map(|e| e.text.as_str())
            .collect();
        assert!(decision_texts.iter().any(|t| t.contains("Use Rust")));
        assert!(!decision_texts.iter().any(|t| t.contains("Send proposal")));
    }

    // ── Action-item intent match: body does NOT contain "action"/"items" ──

    #[tokio::test]
    async fn action_item_intent_returns_evidence_without_lexical_match() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        let summary_json = "{\"markdown\": \"## Action Items\\n\\n- Send follow-up email\\n- Prepare proposal\"}";
        seed_summary(&pool, "m1", summary_json).await;

        // classification="action_item", but normalized terms are ["action", "items"]
        // and the body text ("Send follow-up email\n- Prepare proposal") does NOT
        // contain "action" or "items".  This must still return action_item evidence.
        let results = retrieve_meeting_evidence(&pool, "What are my action items?", "action_item", &None)
            .await
            .unwrap();
        let has_action = results.iter().any(|e| e.source_type == "action_item");
        assert!(
            has_action,
            "action_item evidence must be returned when classification is action_item, even if body text lacks the literal terms"
        );
    }

    #[tokio::test]
    async fn decision_intent_returns_evidence_without_lexical_match() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        let summary_json = "{\"markdown\": \"## Decisions\\n\\n- Use PostgreSQL for the database\"}";
        seed_summary(&pool, "m1", summary_json).await;

        // classification="decision", terms=["decisions", "made"], body="Use PostgreSQL..."
        // does not contain "decisions" or "made"
        let results = retrieve_meeting_evidence(&pool, "What decisions were made?", "decision", &None)
            .await
            .unwrap();
        let has_decision = results.iter().any(|e| e.source_type == "decision");
        assert!(
            has_decision,
            "decision evidence must be returned when classification is decision, even if body text lacks the literal terms"
        );
    }

    #[tokio::test]
    async fn unrelated_classification_does_not_include_action_items() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        let summary_json = "{\"markdown\": \"## Action Items\\n\\n- Send proposal\\n\\n## Decisions\\n\\n- Use Rust\"}";
        seed_summary(&pool, "m1", summary_json).await;

        // classification="general" — should NOT auto-include action_item sections
        let results = retrieve_meeting_evidence(&pool, "tell me about the project", "general", &None)
            .await
            .unwrap();
        let has_action = results.iter().any(|e| e.source_type == "action_item");
        let has_decision = results.iter().any(|e| e.source_type == "decision");
        assert!(!has_action, "general classification must not include action_item evidence");
        assert!(!has_decision, "general classification must not include decision evidence");
    }

    #[tokio::test]
    async fn explicit_meeting_scope_isolated() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Meeting A").await;
        seed_meeting(&pool, "m2", "Meeting B").await;
        let summary_a = "{\"markdown\": \"## Action Items\\n\\n- Task A\"}";
        let summary_b = "{\"markdown\": \"## Action Items\\n\\n- Task B\"}";
        seed_summary(&pool, "m1", summary_a).await;
        seed_summary(&pool, "m2", summary_b).await;

        let scope = Some(AskSivloScope {
            kind: "meeting".into(),
            meeting_id: Some("m1".into()),
        });
        let results = retrieve_meeting_evidence(&pool, "action items", "action_item", &scope)
            .await
            .unwrap();
        assert!(results.iter().all(|e| e.meeting_id == "m1"));
        assert!(!results.iter().any(|e| e.meeting_id == "m2"));
    }

    #[tokio::test]
    async fn retrieve_empty_normalized_terms_skips_like() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "m1", "Sprint").await;
        seed_transcript(&pool, "m1", "the pricing decision was final", None, None).await;

        let results = retrieve_meeting_evidence(&pool, "what is the", "general", &None)
            .await
            .unwrap();
        assert!(results.is_empty());
    }
}

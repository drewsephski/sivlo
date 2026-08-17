pub mod grounding;
pub mod models;
pub mod product_knowledge;
pub mod provider;
pub mod retrieval;
pub mod summary_text;
pub use models::*;

use grounding::{build_bounded_history, sanitize_history};
use models::{
    AskSivloHistoryMessage, AskSivloResponse, MAX_HISTORY_CHARS, MAX_HISTORY_MESSAGES,
    MAX_USER_PROMPT_CHARS, SYSTEM_PROMPT_PRODUCT,
};
use product_knowledge::{find_matching_product_facts, ProductFact};

use std::collections::HashMap;

/// Detect whether a query has strong product-level intent.
/// Returns true only for explicit product capability questions.
/// Common words like "data", "find", "local", "meeting" alone cannot qualify.
/// Used ONLY for post-retrieval fallback — does not alter route_query or find_matching_product_facts.
pub(crate) fn has_strong_product_intent(query: &str) -> bool {
    let lower = query.to_lowercase();

    let question_patterns = [
        "how do i", "how do we", "can i", "can we", "is it possible",
        "does sivlo", "does the app", "does the software",
        "what is sivlo", "what are the", "does it support",
    ];
    let has_question = question_patterns.iter().any(|p| lower.contains(p));
    if !has_question {
        return false;
    }

    let product_refs = [
        "sivlo", "the app", "the application", "the software", "the tool",
    ];
    let has_product_ref = product_refs.iter().any(|r| lower.contains(r));
    if !has_product_ref {
        return false;
    }

    let capability_keywords = [
        "transcrib", "record", "capture", "import", "audio", "summar",
        "note", "llm", "provider", "gpu", "metal", "platform",
        "macos", "windows", "linux", "privacy", "security",
        "export", "share", "invite", "integrate", "plugin",
        "offline", "keyboard", "shortcut", "settings", "config",
        "update", "install", "download",
    ];
    capability_keywords.iter().any(|kw| lower.contains(kw))
}

/// Resolve citation IDs from an LLM answer against the current evidence map.
/// - Only keeps IDs present in evidence_map (unknown IDs discarded)
/// - Deduplicates repeated IDs preserving first-reference order
/// - Returns citations in the order they first appear in the answer
pub(crate) fn resolve_citations(
    answer: &str,
    evidence_map: &HashMap<String, models::AskSivloCitation>,
) -> Vec<models::AskSivloCitation> {
    let ids = grounding::extract_citation_ids(answer);
    let mut seen = std::collections::HashSet::new();
    let mut resolved = Vec::new();
    for id in ids {
        let key = format!("S{}", id);
        if evidence_map.contains_key(&key) && seen.insert(key.clone()) {
            resolved.push(evidence_map[&key].clone());
        }
    }
    resolved
}

/// Validate an Ask Sivlo query string.
/// Rejects queries shorter than MIN_QUERY_CHARS or longer than MAX_QUERY_CHARS.
/// Uses Unicode-safe character counting.
pub(crate) fn validate_ask_sivlo_query(query: &str) -> Result<(), String> {
    let trimmed = query.trim();
    let char_count = trimmed.chars().count();
    if char_count < MIN_QUERY_CHARS {
        return Err("Query must be at least 3 characters".to_string());
    }
    if char_count > MAX_QUERY_CHARS {
        return Err("Query must be at most 4000 characters".to_string());
    }
    Ok(())
}

/// Validate that an explicit meeting scope has a meetingId.
/// Returns Ok(()) if scope is None, "all", or has a meetingId.
/// Returns Err if scope is "meeting" but meetingId is missing.
pub(crate) fn validate_meeting_scope(scope: &Option<models::AskSivloScope>) -> Result<(), String> {
    if let Some(ref s) = scope {
        if s.kind == "meeting" && s.meeting_id.is_none() {
            return Err("Meeting scope requires a meetingId".to_string());
        }
    }
    Ok(())
}

/// Validate that an explicit meeting scope references an existing meeting.
/// Requires a DB pool for the existence check.
pub(crate) async fn validate_meeting_scope_with_db(
    scope: &Option<models::AskSivloScope>,
    pool: &sqlx::SqlitePool,
) -> Result<(), String> {
    validate_meeting_scope(scope)?;

    if let Some(ref s) = scope {
        if s.kind == "meeting" {
            if let Some(ref mid) = s.meeting_id {
                let exists: Option<(String,)> =
                    sqlx::query_as("SELECT id FROM meetings WHERE id = ?")
                        .bind(mid)
                        .fetch_optional(pool)
                        .await
                        .map_err(|e| e.to_string())?;
                if exists.is_none() {
                    return Err("Meeting not found".to_string());
                }
            }
        }
    }
    Ok(())
}

/// Build the user prompt for the product route.
/// Product knowledge is trusted, source-controlled Sivlo knowledge.
/// History is conversational context only.
pub(crate) fn build_product_prompt(
    query: &str,
    history: &[AskSivloHistoryMessage],
    facts: &[&ProductFact],
) -> String {
    let sanitized = sanitize_history(history);
    let bounded_history =
        build_bounded_history(&sanitized, MAX_HISTORY_MESSAGES, MAX_HISTORY_CHARS);

    let mut parts: Vec<String> = Vec::new();

    if !bounded_history.is_empty() {
        parts.push("Conversation History:".to_string());
        for msg in &bounded_history {
            parts.push(format!("{}: {}", msg.role, msg.content));
        }
        parts.push(String::new());
    }

    parts.push("<product_knowledge>".to_string());
    for fact in facts {
        parts.push(fact.answer.to_string());
    }
    parts.push("</product_knowledge>".to_string());
    parts.push(String::new());
    parts.push("Current Question:".to_string());
    parts.push(query.to_string());

    let full_prompt = parts.join("\n");

    // Enforce MAX_USER_PROMPT_CHARS budget (Unicode-safe)
    if full_prompt.chars().count() > MAX_USER_PROMPT_CHARS {
        // Keep query and product facts; trim history from the oldest
        let mut trimmed_parts: Vec<String> = Vec::new();

        trimmed_parts.push("Current Question:".to_string());
        trimmed_parts.push(query.to_string());

        trimmed_parts.push(String::new());
        trimmed_parts.push("<product_knowledge>".to_string());
        for fact in facts {
            trimmed_parts.push(fact.answer.to_string());
        }
        trimmed_parts.push("</product_knowledge>".to_string());

        let fixed_parts: String = trimmed_parts.join("\n");
        let fixed_chars = fixed_parts.chars().count();

        if fixed_chars >= MAX_USER_PROMPT_CHARS {
            return fixed_parts;
        }

        let budget = MAX_USER_PROMPT_CHARS - fixed_chars;

        // Add as much history as fits, newest first
        let mut history_lines: Vec<String> = Vec::new();
        let mut total_chars: usize = 0;

        for msg in bounded_history.iter().rev() {
            let line = format!("{}: {}", msg.role, msg.content);
            let line_chars = line.chars().count() + 1; // +1 for newline
            if total_chars + line_chars > budget {
                break;
            }
            total_chars += line_chars;
            history_lines.push(line);
        }
        history_lines.reverse();

        if !history_lines.is_empty() {
            let mut result = "Conversation History:\n".to_string();
            result.push_str(&history_lines.join("\n"));
            result.push('\n');
            result.push_str(&fixed_parts);
            return result;
        }

        return fixed_parts;
    }

    full_prompt
}

/// Handle a product-route query end-to-end.
/// 1. Match product facts; fallback if none
/// 2. Sanitize and bound history
/// 3. Resolve provider
/// 4. Build product prompt and call LLM
/// 5. Return response with no meeting citations
pub(crate) async fn handle_product_route(
    query: &str,
    history: &[AskSivloHistoryMessage],
    pool: &sqlx::SqlitePool,
    app: &tauri::AppHandle<impl tauri::Runtime>,
) -> Result<AskSivloResponse, String> {
    let facts = find_matching_product_facts(query);

    if facts.is_empty() {
        return Ok(AskSivloResponse {
            answer: models::FALLBACK_ANSWER_NO_PRODUCT.to_string(),
            route: "product".to_string(),
            citations: Vec::new(),
        });
    }

    let config = provider::resolve_provider_config(pool, app).await?;
    let client = reqwest::Client::new();
    let user_prompt = build_product_prompt(query, history, &facts);

    let answer = crate::summary::llm_client::generate_summary(
        &client,
        &config.provider,
        &config.model_name,
        &config.api_key,
        SYSTEM_PROMPT_PRODUCT,
        &user_prompt,
        config.ollama_endpoint.as_deref(),
        config.custom_openai_endpoint.as_deref(),
        config.max_tokens,
        config.temperature,
        config.top_p,
        config.app_data_dir.as_ref(),
        None,
    )
    .await?;

    Ok(AskSivloResponse {
        answer,
        route: "product".to_string(),
        citations: Vec::new(),
    })
}

/// Ask Sivlo — Tauri command endpoint.
/// Routes a user query to either product knowledge or meeting retrieval,
/// generates a grounded LLM response, and resolves cited sources.
#[tauri::command]
pub async fn api_ask_sivlo<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: tauri::State<'_, crate::state::AppState>,
    query: String,
    history: Vec<AskSivloHistoryMessage>,
    scope: Option<AskSivloScope>,
) -> Result<AskSivloResponse, String> {
    // A. Query validation
    validate_ask_sivlo_query(&query)?;

    let pool = state.db_manager.pool();

    // B. Explicit meeting scope validation
    validate_meeting_scope_with_db(&scope, pool).await?;

    // C. Initial deterministic route
    let route = grounding::route_query(&query, &scope);

    if route == "product" {
        return handle_product_route(&query, &history, pool, &app).await;
    }

    // D. Meeting retrieval
    let classification = grounding::classify_query(&query);
    let evidence =
        retrieval::retrieve_meeting_evidence(pool, &query, classification, &scope).await?;

    // E. Zero-evidence behavior
    if evidence.is_empty() {
        let is_explicit_meeting = scope.as_ref().map_or(false, |s| s.kind == "meeting");

        if is_explicit_meeting {
            return Ok(AskSivloResponse {
                answer: FALLBACK_ANSWER_NO_EVIDENCE.to_string(),
                route: "meeting".to_string(),
                citations: vec![],
            });
        }

        if has_strong_product_intent(&query) && !product_knowledge::find_matching_product_facts(&query).is_empty() {
            return handle_product_route(&query, &history, pool, &app).await;
        }

        return Ok(AskSivloResponse {
            answer: FALLBACK_ANSWER_NO_EVIDENCE.to_string(),
            route: "meeting".to_string(),
            citations: vec![],
        });
    }

    // F. Build meeting grounding context
    let sanitized_history = grounding::sanitize_history(&history);
    let mut evidence_map: HashMap<String, models::AskSivloCitation> = HashMap::new();
    let (system_prompt, user_prompt) = grounding::build_meeting_context(
        &query,
        &sanitized_history,
        &evidence,
        &mut evidence_map,
    );

    // G. Resolve provider
    let config = provider::resolve_provider_config(pool, &app).await?;

    // H. Generate meeting response
    let client = reqwest::Client::new();
    let answer = crate::summary::llm_client::generate_summary(
        &client,
        &config.provider,
        &config.model_name,
        &config.api_key,
        &system_prompt,
        &user_prompt,
        config.ollama_endpoint.as_deref(),
        config.custom_openai_endpoint.as_deref(),
        config.max_tokens,
        config.temperature,
        config.top_p,
        config.app_data_dir.as_ref(),
        None,
    )
    .await?;

    // I. Resolve citations
    let citations = resolve_citations(&answer, &evidence_map);

    if citations.is_empty() {
        return Ok(AskSivloResponse {
            answer: FALLBACK_ANSWER_NO_EVIDENCE.to_string(),
            route: "meeting".to_string(),
            citations: vec![],
        });
    }

    Ok(AskSivloResponse {
        answer,
        route: "meeting".to_string(),
        citations,
    })
}

#[cfg(test)]
mod tests {
    use super::product_knowledge::find_matching_product_facts;
    use super::{build_product_prompt, MAX_USER_PROMPT_CHARS};
    use super::models::AskSivloHistoryMessage;
    use chrono::Utc;

    async fn test_db_pool() -> sqlx::SqlitePool {
        use sqlx::sqlite::SqliteConnectOptions;
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

    async fn seed_meeting(pool: &sqlx::SqlitePool, id: &str, title: &str) {
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

    // ── Task 12 — Query validation ──

    #[test]
    fn validate_query_too_short() {
        let result = super::validate_ask_sivlo_query("ab");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Query must be at least 3 characters");
    }

    #[test]
    fn validate_query_too_long() {
        let query = "x".repeat(4001);
        let result = super::validate_ask_sivlo_query(&query);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Query must be at most 4000 characters");
    }

    // ── Task 12 — Meeting scope validation ──

    #[test]
    fn validate_explicit_meeting_scope_missing_id() {
        let result = super::validate_meeting_scope(
            &Some(super::models::AskSivloScope {
                kind: "meeting".into(),
                meeting_id: None,
            }),
        );
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Meeting scope requires a meetingId");
    }

    #[tokio::test]
    async fn validate_explicit_meeting_scope_nonexistent() {
        let pool = test_db_pool().await;
        let result = super::validate_meeting_scope_with_db(
            &Some(super::models::AskSivloScope {
                kind: "meeting".into(),
                meeting_id: Some("nonexistent-id".into()),
            }),
            &pool,
        )
        .await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Meeting not found");
    }

    // ── Task 12 — Strong product intent ──

    #[test]
    fn post_retrieval_common_word_match_does_not_route_product() {
        let query = "Can you find the local meeting data about Sarah?";
        assert!(!super::has_strong_product_intent(query));
    }

    #[test]
    fn strong_product_intent_accepts_explicit_product_question() {
        let query = "How do I import audio into Sivlo?";
        assert!(super::has_strong_product_intent(query));
    }

    // ── Task 12 — Citation resolution ──

    #[test]
    fn answer_citations_keep_only_known_source_ids() {
        let mut evidence_map = std::collections::HashMap::new();
        evidence_map.insert(
            "S1".into(),
            super::models::AskSivloCitation {
                source_id: "S1".into(),
                meeting_id: "m1".into(),
                meeting_title: "Sprint".into(),
                meeting_date: None,
                source_type: "transcript".into(),
                excerpt: "test".into(),
                timestamp_start: None,
                timestamp_end: None,
            },
        );
        evidence_map.insert(
            "S2".into(),
            super::models::AskSivloCitation {
                source_id: "S2".into(),
                meeting_id: "m1".into(),
                meeting_title: "Sprint".into(),
                meeting_date: None,
                source_type: "summary".into(),
                excerpt: "test".into(),
                timestamp_start: None,
                timestamp_end: None,
            },
        );

        let answer = "Approved [S1]. Ignore [S999].";
        let resolved = super::resolve_citations(answer, &evidence_map);
        let ids: Vec<&str> = resolved.iter().map(|c| c.source_id.as_str()).collect();
        assert_eq!(ids, vec!["S1"]);
        assert!(!ids.contains(&"S999"));
    }

    #[test]
    fn answer_citations_deduplicate_repeated_source_ids() {
        let mut evidence_map = std::collections::HashMap::new();
        evidence_map.insert(
            "S1".into(),
            super::models::AskSivloCitation {
                source_id: "S1".into(),
                meeting_id: "m1".into(),
                meeting_title: "Sprint".into(),
                meeting_date: None,
                source_type: "transcript".into(),
                excerpt: "test".into(),
                timestamp_start: None,
                timestamp_end: None,
            },
        );
        evidence_map.insert(
            "S2".into(),
            super::models::AskSivloCitation {
                source_id: "S2".into(),
                meeting_id: "m1".into(),
                meeting_title: "Sprint".into(),
                meeting_date: None,
                source_type: "summary".into(),
                excerpt: "test".into(),
                timestamp_start: None,
                timestamp_end: None,
            },
        );

        let answer = "[S1] first mention and [S1] repeated then [S2]";
        let resolved = super::resolve_citations(answer, &evidence_map);
        let ids: Vec<&str> = resolved.iter().map(|c| c.source_id.as_str()).collect();
        assert_eq!(ids, vec!["S1", "S2"]);
    }

    #[test]
    fn answer_citations_zero_valid_ids_fail_closed() {
        let evidence_map: std::collections::HashMap<String, super::models::AskSivloCitation> =
            std::collections::HashMap::new();

        let answer = "No valid citations here [S42] [S99]";
        let resolved = super::resolve_citations(answer, &evidence_map);
        assert!(resolved.is_empty());
    }

    // ── Product prompt tests ──

    #[test]
    fn product_prompt_contains_facts() {
        let facts = find_matching_product_facts("how do I import audio");
        assert!(!facts.is_empty(), "Expected at least one matching product fact");

        let prompt = build_product_prompt("how do I import audio", &[], &facts);

        for fact in &facts {
            assert!(
                prompt.contains(fact.answer),
                "Product prompt must contain the fact answer: {}",
                fact.answer
            );
        }

        assert!(
            prompt.contains("<product_knowledge>"),
            "Product prompt must wrap facts in <product_knowledge> tags"
        );
        assert!(
            prompt.contains("</product_knowledge>"),
            "Product prompt must close <product_knowledge> tags"
        );
        assert!(
            prompt.contains("Current Question:"),
            "Product prompt must include the current question"
        );
        assert!(
            prompt.contains("how do I import audio"),
            "Product prompt must contain the original query"
        );
    }

    #[test]
    fn product_prompt_bounded() {
        let long_query = "x".repeat(16_500);
        let history: Vec<AskSivloHistoryMessage> = (0..10)
            .map(|_i| AskSivloHistoryMessage {
                role: "user".into(),
                content: "y".repeat(500),
            })
            .collect();
        let facts = find_matching_product_facts("sivlo transcription");
        assert!(!facts.is_empty(), "Expected at least one matching product fact for bounding test");

        let prompt = build_product_prompt(&long_query, &history, &facts);
        let chars = prompt.chars().count();
        assert!(
            chars <= MAX_USER_PROMPT_CHARS,
            "Product prompt chars {} exceeds MAX_USER_PROMPT_CHARS {}",
            chars,
            MAX_USER_PROMPT_CHARS
        );
    }
}

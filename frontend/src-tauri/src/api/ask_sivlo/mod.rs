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

#[cfg(test)]
mod tests {
    use super::product_knowledge::find_matching_product_facts;
    use super::{build_product_prompt, MAX_USER_PROMPT_CHARS};
    use super::models::AskSivloHistoryMessage;

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

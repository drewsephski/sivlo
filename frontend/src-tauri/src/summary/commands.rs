use crate::database::repositories::{
    meeting::MeetingsRepository,
    setting::SettingsRepository,
    summary::SummaryProcessesRepository, transcript_chunk::TranscriptChunksRepository,
};
use crate::summary::llm_client::{generate_summary, LLMProvider};
use crate::state::AppState;
use crate::summary::metadata::{
    read_detected_summary_language_from_metadata, read_summary_language_from_metadata,
    write_detected_summary_language_to_metadata, write_summary_language_to_metadata,
};
use crate::summary::language_detection::{
    detect_summary_language, SummaryLanguageDetection,
};
use crate::summary::service::SummaryService;
use log::{error as log_error, info as log_info, warn as log_warn};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Serialize, Deserialize)]
pub struct SummaryResponse {
    pub status: String,
    #[serde(rename = "meetingName")]
    pub meeting_name: Option<String>,
    pub meeting_id: String,
    pub start: Option<String>,
    pub end: Option<String>,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessTranscriptResponse {
    pub message: String,
    pub process_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SummaryLanguageStorage {
    Metadata,
    LocalFallback,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MeetingSummaryLanguagePreference {
    pub language: Option<String>,
    pub storage: SummaryLanguageStorage,
}

impl MeetingSummaryLanguagePreference {
    fn metadata(language: Option<String>) -> Self {
        Self {
            language,
            storage: SummaryLanguageStorage::Metadata,
        }
    }

    fn local_fallback() -> Self {
        Self {
            language: None,
            storage: SummaryLanguageStorage::LocalFallback,
        }
    }
}

enum MeetingFolderResolution {
    Folder(PathBuf),
    NoFolder,
}

/// Saves a meeting summary (Native SQLx implementation)
///
/// Expected format: { "markdown": "...", "summary_json": [...BlockNote blocks...] }
#[tauri::command]
pub async fn api_save_meeting_summary<R: Runtime>(
    _app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    meeting_id: String,
    summary: serde_json::Value,
    _auth_token: Option<String>,
) -> Result<serde_json::Value, String> {
    log_info!(
        "api_save_meeting_summary (native) called for meeting_id: {}",
        meeting_id
    );
    let pool = state.db_manager.pool();

    match SummaryProcessesRepository::update_meeting_summary(pool, &meeting_id, &summary).await {
        Ok(true) => {
            log_info!("Summary saved successfully for meeting_id: {}", meeting_id);
            Ok(serde_json::json!({
                "message": "Meeting summary saved successfully"
            }))
        }
        Ok(false) => {
            log_warn!(
                "Meeting not found or invalid JSON for meeting_id: {}",
                meeting_id
            );
            Err("Meeting not found or can't convert the json".into())
        }
        Err(e) => {
            log_error!("Failed to save meeting summary for {}: {}", meeting_id, e);
            Err(e.to_string())
        }
    }
}

/// Gets the per-meeting summary language override from metadata.json.
#[tauri::command]
pub async fn api_get_meeting_summary_language<R: Runtime>(
    _app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    meeting_id: String,
) -> Result<MeetingSummaryLanguagePreference, String> {
    log_info!(
        "api_get_meeting_summary_language called for meeting_id: {}",
        meeting_id
    );

    match resolve_meeting_folder(state.db_manager.pool(), &meeting_id).await? {
        MeetingFolderResolution::Folder(folder) => read_summary_language_from_metadata(&folder)
            .map(MeetingSummaryLanguagePreference::metadata)
            .map_err(|e| e.to_string()),
        MeetingFolderResolution::NoFolder => Ok(MeetingSummaryLanguagePreference::local_fallback()),
    }
}

/// Saves or clears the per-meeting summary language override in metadata.json.
#[tauri::command]
pub async fn api_save_meeting_summary_language<R: Runtime>(
    _app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    meeting_id: String,
    summary_language: Option<String>,
) -> Result<MeetingSummaryLanguagePreference, String> {
    log_info!(
        "api_save_meeting_summary_language called for meeting_id: {}, language: {:?}",
        meeting_id,
        summary_language
    );

    match resolve_meeting_folder(state.db_manager.pool(), &meeting_id).await? {
        MeetingFolderResolution::Folder(folder) => {
            write_summary_language_to_metadata(&folder, summary_language.as_deref())
                .map_err(|e| e.to_string())?;
            read_summary_language_from_metadata(&folder)
                .map(MeetingSummaryLanguagePreference::metadata)
                .map_err(|e| e.to_string())
        }
        MeetingFolderResolution::NoFolder => Ok(MeetingSummaryLanguagePreference::local_fallback()),
    }
}

/// Gets the cached Auto-detected summary language from metadata.json.
#[tauri::command]
pub async fn api_get_meeting_detected_summary_language<R: Runtime>(
    _app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    meeting_id: String,
) -> Result<MeetingSummaryLanguagePreference, String> {
    log_info!(
        "api_get_meeting_detected_summary_language called for meeting_id: {}",
        meeting_id
    );

    match resolve_meeting_folder(state.db_manager.pool(), &meeting_id).await? {
        MeetingFolderResolution::Folder(folder) => read_detected_summary_language_from_metadata(&folder)
            .map(MeetingSummaryLanguagePreference::metadata)
            .map_err(|e| e.to_string()),
        MeetingFolderResolution::NoFolder => Ok(MeetingSummaryLanguagePreference::local_fallback()),
    }
}

/// Saves or clears the cached Auto-detected summary language in metadata.json.
#[tauri::command]
pub async fn api_save_meeting_detected_summary_language<R: Runtime>(
    _app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    meeting_id: String,
    detected_summary_language: Option<String>,
) -> Result<MeetingSummaryLanguagePreference, String> {
    log_info!(
        "api_save_meeting_detected_summary_language called for meeting_id: {}, language: {:?}",
        meeting_id,
        detected_summary_language
    );

    match resolve_meeting_folder(state.db_manager.pool(), &meeting_id).await? {
        MeetingFolderResolution::Folder(folder) => {
            write_detected_summary_language_to_metadata(&folder, detected_summary_language.as_deref())
                .map_err(|e| e.to_string())?;
            read_detected_summary_language_from_metadata(&folder)
                .map(MeetingSummaryLanguagePreference::metadata)
                .map_err(|e| e.to_string())
        }
        MeetingFolderResolution::NoFolder => Ok(MeetingSummaryLanguagePreference::local_fallback()),
    }
}

/// Detects the dominant supported summary language from transcript segments.
#[tauri::command]
pub async fn api_detect_transcript_summary_language(
    transcript_texts: Vec<String>,
) -> Result<SummaryLanguageDetection, String> {
    Ok(detect_summary_language(&transcript_texts))
}

async fn resolve_meeting_folder(
    pool: &sqlx::SqlitePool,
    meeting_id: &str,
) -> Result<MeetingFolderResolution, String> {
    let meeting = MeetingsRepository::get_meeting_metadata(pool, meeting_id)
        .await
        .map_err(|e| format!("Failed to load meeting metadata: {}", e))?
        .ok_or_else(|| format!("Meeting not found: {}", meeting_id))?;

    let Some(folder_path) = meeting.folder_path.filter(|p| !p.trim().is_empty()) else {
        return Ok(MeetingFolderResolution::NoFolder);
    };

    Ok(MeetingFolderResolution::Folder(PathBuf::from(folder_path)))
}

/// Gets summary status and data (Native SQLx implementation)
///
/// Returns summary status (pending/processing/completed/failed) and parsed result data
#[tauri::command]
pub async fn api_get_summary<R: Runtime>(
    _app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    meeting_id: String,
    _auth_token: Option<String>,
) -> Result<SummaryResponse, String> {
    log_info!(
        "api_get_summary (native) called for meeting_id: {}",
        meeting_id
    );
    let pool = state.db_manager.pool();

    match SummaryProcessesRepository::get_summary_data_for_meeting(pool, &meeting_id).await {
        Ok(Some(process)) => {
            let status = process.status.to_lowercase();
            let error = process.error;

            // Parse result data if it exists (regardless of status)
            // This allows displaying restored summaries after cancellation or failure
            let data = if let Some(result_str) = process.result {
                match serde_json::from_str::<serde_json::Value>(&result_str) {
                    Ok(parsed) => Some(parsed),
                    Err(e) => {
                        log_error!("Failed to parse summary result JSON: {}", e);
                        None
                    }
                }
            } else {
                None
            };

            // Fetch meeting title from database
            let meeting_name = match MeetingsRepository::get_meeting(pool, &meeting_id).await {
                Ok(Some(meeting_details)) => {
                    log_info!("Fetched meeting title: {}", &meeting_details.title);
                    Some(meeting_details.title)
                }
                Ok(None) => {
                    log_warn!("Meeting not found for meeting_id: {}", meeting_id);
                    None
                }
                Err(e) => {
                    log_error!("Failed to fetch meeting title: {}", e);
                    None
                }
            };

            let response = SummaryResponse {
                status: status.clone(),
                meeting_name,
                meeting_id: meeting_id.clone(),
                start: process.start_time.map(|t| t.to_rfc3339()),
                end: process.end_time.map(|t| t.to_rfc3339()),
                data,
                error,
            };

            log_info!(
                "Summary status for {}: {}, has_data: {}, meeting_name: {:?}",
                meeting_id,
                status,
                response.data.is_some(),
                response.meeting_name
            );
            Ok(response)
        }
        Ok(None) => {
            log_info!("No summary process found for meeting_id: {}", meeting_id);

            // Still fetch meeting title for idle state
            let meeting_name = match MeetingsRepository::get_meeting(pool, &meeting_id).await {
                Ok(Some(meeting_details)) => Some(meeting_details.title),
                _ => None,
            };

            Ok(SummaryResponse {
                status: "idle".to_string(),
                meeting_name,
                meeting_id,
                start: None,
                end: None,
                data: None,
                error: None,
            })
        }
        Err(e) => {
            log_error!("Error retrieving summary for {}: {}", meeting_id, e);
            Err(format!("Failed to retrieve summary: {}", e))
        }
    }
}

/// Processes transcript and generates summary (Native SQLx implementation)
///
/// Spawns a background task and returns immediately with process_id
#[tauri::command]
pub async fn api_process_transcript<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    text: String,
    model: String,
    model_name: String,
    meeting_id: Option<String>,
    _chunk_size: Option<i32>,
    _overlap: Option<i32>,
    custom_prompt: Option<String>,
    template_id: Option<String>,
    summary_language: Option<String>,
    _auth_token: Option<String>,
) -> Result<ProcessTranscriptResponse, String> {
    use uuid::Uuid;

    let m_id = meeting_id.unwrap_or_else(|| format!("meeting-{}", Uuid::new_v4()));
    log_info!(
        "api_process_transcript (native) called for meeting_id: {}, model: {}",
        &m_id,
        &model
    );

    let pool = state.db_manager.pool().clone();
    let final_prompt = custom_prompt.unwrap_or_else(|| "".to_string());
    let final_template_id = template_id.unwrap_or_else(|| "daily_standup".to_string());

    // Normalise empty / whitespace-only to None so "" and null behave identically
    let summary_language = summary_language.and_then(|s| {
        let t = s.trim();
        if t.is_empty() { None } else { Some(t.to_string()) }
    });

    // Create or reset the process entry in the database
    SummaryProcessesRepository::create_or_reset_process(&pool, &m_id)
        .await
        .map_err(|e| format!("Failed to initialize process: {}", e))?;

    log_info!("✓ Summary process initialized for meeting_id: {}", &m_id);

    // Save transcript chunks data (matching Python backend behavior)
    let chunk_size = _chunk_size.unwrap_or(40000);
    let overlap = _overlap.unwrap_or(1000);

    TranscriptChunksRepository::save_transcript_data(
        &pool,
        &m_id,
        &text,
        &model,
        &model_name,
        chunk_size,
        overlap,
    )
    .await
    .map_err(|e| format!("Failed to save transcript data: {}", e))?;

    log_info!("✓ Transcript chunks saved for meeting_id: {}", &m_id);

    // Spawn background task for actual processing
    let meeting_id_clone = m_id.clone();
    tauri::async_runtime::spawn(async move {
        SummaryService::process_transcript_background(
            app,
            pool,
            meeting_id_clone.clone(),
            text,
            model,
            model_name,
            final_prompt,
            final_template_id,
            summary_language,
        )
        .await;
    });

    log_info!("🚀 Background task spawned for meeting_id: {}", &m_id);

    Ok(ProcessTranscriptResponse {
        message: "Summary generation started".to_string(),
        process_id: m_id,
    })
}

/// Cancels an ongoing summary generation process
///
/// This command triggers the cancellation token for the specified meeting,
/// stopping the summary generation gracefully.
#[tauri::command]
pub async fn api_cancel_summary<R: Runtime>(
    _app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    meeting_id: String,
) -> Result<serde_json::Value, String> {
    log_info!("api_cancel_summary called for meeting_id: {}", meeting_id);

    // Trigger cancellation via the service
    let cancelled = SummaryService::cancel_summary(&meeting_id);

    if cancelled {
        // Update database status to cancelled
        let pool = state.db_manager.pool();
        if let Err(e) = SummaryProcessesRepository::update_process_cancelled(pool, &meeting_id).await {
            log_error!("Failed to update DB status to cancelled for {}: {}", meeting_id, e);
            return Err(format!("Failed to update cancellation status: {}", e));
        }

        log_info!("Successfully cancelled summary generation for meeting_id: {}", meeting_id);
        Ok(serde_json::json!({
            "message": "Summary generation cancelled successfully",
            "meeting_id": meeting_id,
        }))
    } else {
        log_warn!("No active summary generation found for meeting_id: {}", meeting_id);
        Ok(serde_json::json!({
            "message": "No active summary generation to cancel",
            "meeting_id": meeting_id,
        }))
    }
}

const MIN_TRANSCRIPT_CHARS: usize = 40;
const MAX_TRANSCRIPT_CHARS: usize = 8000;
const MAX_TITLE_WORDS: usize = 8;
const MAX_TITLE_CHARS: usize = 80;

/// Result of an AI meeting-title generation attempt.
///
/// `retitled` is true only when the stored title was actually updated.
/// `reason` explains why generation was skipped (never a user-facing error —
/// callers keep the default title and stay silent).
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateMeetingTitleResponse {
    pub retitled: bool,
    pub title: Option<String>,
    pub reason: String,
}

/// Generates a short, professional meeting title from the transcript via the
/// configured summary LLM provider.
///
/// Race-safe: only retitles when the stored title still equals `expected_title`,
/// so user-renamed or user-entered titles are never overwritten. Best-effort by
/// design — every skip/failure returns `Ok(retitled: false)` so the caller keeps
/// the default title without blocking the save/navigation flow.
#[tauri::command]
pub async fn api_generate_meeting_title<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    meeting_id: String,
    expected_title: String,
) -> Result<GenerateMeetingTitleResponse, String> {
    log_info!(
        "api_generate_meeting_title called for meeting_id: {}, expected_title: {:?}",
        meeting_id,
        expected_title
    );

    let pool = state.db_manager.pool();

    // Confirm the meeting exists and its stored title is still the expected default.
    let meeting = match MeetingsRepository::get_meeting_metadata(pool, &meeting_id).await {
        Ok(Some(meeting)) => meeting,
        Ok(None) => {
            log_warn!("Meeting not found for AI title: {}", meeting_id);
            return Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "meeting_not_found".to_string(),
            });
        }
        Err(e) => {
            log_error!("Failed to load meeting metadata for AI title ({}): {}", meeting_id, e);
            return Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "metadata_load_failed".to_string(),
            });
        }
    };

    if !title_still_expected(&meeting.title, &expected_title) {
        log_warn!(
            "Meeting title changed since save, skipping AI title for {} (expected {:?}, got {:?})",
            meeting_id,
            expected_title,
            meeting.title
        );
        return Ok(GenerateMeetingTitleResponse {
            retitled: false,
            title: None,
            reason: "title_changed".to_string(),
        });
    }

    // Build the transcript text for the prompt.
    let transcript_text = match MeetingsRepository::get_meeting(pool, &meeting_id).await {
        Ok(Some(details)) => details
            .transcripts
            .iter()
            .map(|t| t.text.trim())
            .filter(|t| !t.is_empty())
            .collect::<Vec<_>>()
            .join(" "),
        Ok(None) => {
            log_warn!("Meeting transcripts not found for AI title: {}", meeting_id);
            return Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "meeting_not_found".to_string(),
            });
        }
        Err(e) => {
            log_error!("Failed to load transcripts for AI title ({}): {}", meeting_id, e);
            return Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "transcript_load_failed".to_string(),
            });
        }
    };

    if transcript_text.trim().chars().count() < MIN_TRANSCRIPT_CHARS {
        log_warn!(
            "Transcript too short for AI title ({} chars), skipping for {}",
            transcript_text.trim().chars().count(),
            meeting_id
        );
        return Ok(GenerateMeetingTitleResponse {
            retitled: false,
            title: None,
            reason: "transcript_too_short".to_string(),
        });
    }

    // Resolve the configured summary LLM provider (mirrors summary service).
    let config = match SettingsRepository::get_model_config(pool).await {
        Ok(Some(config)) => config,
        Ok(None) => {
            log_warn!("No summary model configured, skipping AI title for {}", meeting_id);
            return Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "no_model_configured".to_string(),
            });
        }
        Err(e) => {
            log_error!("Failed to load model config for AI title: {}", e);
            return Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "model_config_load_failed".to_string(),
            });
        }
    };

    let provider = match LLMProvider::from_str(&config.provider) {
        Ok(provider) => provider,
        Err(e) => {
            log_warn!("Invalid summary provider {:?}: {}", config.provider, e);
            return Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "invalid_provider".to_string(),
            });
        }
    };

    let mut model_name = config.model.clone();

    let api_key = if provider == LLMProvider::Ollama
        || provider == LLMProvider::BuiltInAI
        || provider == LLMProvider::CustomOpenAI
    {
        String::new()
    } else {
        match SettingsRepository::get_api_key(pool, &config.provider).await {
            Ok(Some(key)) if !key.is_empty() => key,
            _ => {
                log_warn!("No API key for provider {}, skipping AI title", config.provider);
                return Ok(GenerateMeetingTitleResponse {
                    retitled: false,
                    title: None,
                    reason: "no_api_key".to_string(),
                });
            }
        }
    };

    let ollama_endpoint = if provider == LLMProvider::Ollama {
        config.ollama_endpoint.clone()
    } else {
        None
    };

    let (custom_openai_endpoint, custom_openai_api_key, custom_openai_max_tokens, custom_openai_temperature, custom_openai_top_p) =
        if provider == LLMProvider::CustomOpenAI {
            match SettingsRepository::get_custom_openai_config(pool).await {
                Ok(Some(cfg)) => {
                    model_name = cfg.model.clone();
                    (
                        Some(cfg.endpoint),
                        cfg.api_key,
                        cfg.max_tokens.map(|t| t as u32),
                        cfg.temperature,
                        cfg.top_p,
                    )
                }
                _ => {
                    log_warn!("Custom OpenAI provider selected but no config found, skipping AI title");
                    return Ok(GenerateMeetingTitleResponse {
                        retitled: false,
                        title: None,
                        reason: "no_custom_openai_config".to_string(),
                    });
                }
            }
        } else {
            (None, None, None, None, None)
        };

    let final_api_key = if provider == LLMProvider::CustomOpenAI {
        custom_openai_api_key.unwrap_or_default()
    } else {
        api_key
    };

    // Cap the transcript sent to the LLM to bound cost/latency.
    let prompt_transcript: String = transcript_text
        .chars()
        .take(MAX_TRANSCRIPT_CHARS)
        .collect();

    let system_prompt = "You write short, professional meeting titles. \
        Respond with ONLY the title: 3-7 words, plain text, no quotes, no markdown, \
        no leading article like 'Meeting about' or 'Weekly', no dates, no timestamps, \
        no trailing punctuation.";

    let user_prompt = format!(
        "Suggest a short professional meeting title (3-7 words) for the following transcript:\n\n{}",
        prompt_transcript
    );

    let app_data_dir = app.path().app_data_dir().ok();
    let client = reqwest::Client::new();

    let raw_title = match generate_summary(
        &client,
        &provider,
        &model_name,
        &final_api_key,
        system_prompt,
        &user_prompt,
        ollama_endpoint.as_deref(),
        custom_openai_endpoint.as_deref(),
        custom_openai_max_tokens,
        custom_openai_temperature,
        custom_openai_top_p,
        app_data_dir.as_ref(),
        None,
    )
    .await
    {
        Ok(title) => title,
        Err(e) => {
            log_warn!("LLM request failed for AI title ({}): {}", meeting_id, e);
            return Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "llm_failed".to_string(),
            });
        }
    };

    let clean_title = sanitize_generated_title(&raw_title);
    if clean_title.is_empty() {
        log_warn!("LLM returned empty title, skipping for {}", meeting_id);
        return Ok(GenerateMeetingTitleResponse {
            retitled: false,
            title: None,
            reason: "empty_title".to_string(),
        });
    }

    // Re-check the title still matches before applying (user may have renamed meanwhile).
    let current = match MeetingsRepository::get_meeting_metadata(pool, &meeting_id).await {
        Ok(Some(meeting)) => meeting,
        _ => {
            log_warn!("Meeting vanished while generating AI title: {}", meeting_id);
            return Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "meeting_not_found".to_string(),
            });
        }
    };

    if !title_still_expected(&current.title, &expected_title) {
        log_warn!(
            "Meeting title changed while generating AI title, skipping for {}",
            meeting_id
        );
        return Ok(GenerateMeetingTitleResponse {
            retitled: false,
            title: None,
            reason: "title_changed".to_string(),
        });
    }

    match MeetingsRepository::update_meeting_title(pool, &meeting_id, &clean_title).await {
        Ok(true) => {
            log_info!(
                "AI-generated meeting title set for {}: '{}'",
                meeting_id,
                clean_title
            );
            Ok(GenerateMeetingTitleResponse {
                retitled: true,
                title: Some(clean_title),
                reason: "ok".to_string(),
            })
        }
        Ok(false) => {
            log_warn!("Failed to persist AI meeting title for {}", meeting_id);
            Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "update_failed".to_string(),
            })
        }
        Err(e) => {
            log_error!("Failed to persist AI meeting title for {}: {}", meeting_id, e);
            Ok(GenerateMeetingTitleResponse {
                retitled: false,
                title: None,
                reason: "update_failed".to_string(),
            })
        }
    }
}

/// Cleans an LLM title response: first non-empty line, leading markdown
/// heading markers stripped, surrounding quotes removed, whitespace collapsed,
/// capped at `MAX_TITLE_WORDS` words and `MAX_TITLE_CHARS` characters (never
/// splitting a word), and a single trailing period removed.
fn sanitize_generated_title(raw: &str) -> String {
    let first_line = raw
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");

    let trimmed = first_line
        .trim_start_matches('#')
        .trim_start()
        .trim_matches(|c| c == '"' || c == '\'' || c == '\u{201c}' || c == '\u{201d}');

    let mut collapsed = String::new();
    let mut prev_whitespace = false;
    for ch in trimmed.chars() {
        if ch.is_whitespace() {
            if !prev_whitespace && !collapsed.is_empty() {
                collapsed.push(' ');
            }
            prev_whitespace = true;
        } else {
            collapsed.push(ch);
            prev_whitespace = false;
        }
    }

    let words: Vec<&str> = collapsed.split(' ').filter(|w| !w.is_empty()).collect();
    let mut words = words;
    words.truncate(MAX_TITLE_WORDS);

    let mut title = String::new();
    for word in words {
        if title.is_empty() {
            // Always accept the first word so output is never empty and words
            // are never split mid-word by the character cap.
            title = word.to_string();
            continue;
        }
        let candidate = format!("{} {}", title, word);
        if candidate.chars().count() > MAX_TITLE_CHARS {
            break;
        }
        title = candidate;
    }

    if title.ends_with('.') {
        title.pop();
    }

    title
}

/// True when the stored title still equals the title the meeting was saved
/// with (whitespace-insensitive). Guards the race-safe AI retitle path so
/// user-renamed or user-entered titles are never overwritten.
fn title_still_expected(current_title: &str, expected_title: &str) -> bool {
    current_title.trim() == expected_title.trim()
}

#[cfg(test)]
mod tests {
    use super::{sanitize_generated_title, title_still_expected, MAX_TITLE_CHARS};

    #[test]
    fn sanitize_returns_first_non_empty_line() {
        assert_eq!(sanitize_generated_title("Q3 Planning\n\nBody"), "Q3 Planning");
        assert_eq!(sanitize_generated_title("  \nDesign Review  "), "Design Review");
    }

    #[test]
    fn sanitize_strips_quotes_and_collapses_whitespace() {
        assert_eq!(sanitize_generated_title("\"Roadmap Prioritization\""), "Roadmap Prioritization");
        assert_eq!(
            sanitize_generated_title("  Launch   Readiness   Check  "),
            "Launch Readiness Check"
        );
    }

    #[test]
    fn sanitize_trims_to_max_words_and_trailing_period() {
        assert_eq!(
            sanitize_generated_title("One Two Three Four Five Six Seven Eight Nine Ten"),
            "One Two Three Four Five Six Seven Eight"
        );
        assert_eq!(sanitize_generated_title("Sprint Planning."), "Sprint Planning");
    }

    #[test]
    fn sanitize_strips_markdown_heading_markers() {
        assert_eq!(sanitize_generated_title("# Sivlo UI Redesign"), "Sivlo UI Redesign");
        assert_eq!(sanitize_generated_title("## Q3 Planning"), "Q3 Planning");
        assert_eq!(
            sanitize_generated_title("###  Launch   Readiness   Check  "),
            "Launch Readiness Check"
        );
    }

    #[test]
    fn sanitize_caps_title_length_without_splitting_words() {
        let long = "This is an extremely long generated meeting title that definitely exceeds the maximum character budget";
        let out = sanitize_generated_title(long);
        assert!(out.chars().count() <= MAX_TITLE_CHARS);
        assert!(!out.is_empty());
        assert!(!out.contains("  "));
    }

    #[test]
    fn sanitize_empty_input_returns_empty() {
        assert_eq!(sanitize_generated_title(""), "");
        assert_eq!(sanitize_generated_title("   \n\t "), "");
        assert_eq!(sanitize_generated_title("\"\"\""), "");
        assert_eq!(sanitize_generated_title("#"), "");
    }

    #[test]
    fn title_still_expected_compares_trimmed_titles() {
        assert!(title_still_expected("New Meeting", "New Meeting"));
        assert!(title_still_expected("  Q3 Sync  ", "Q3 Sync"));
        assert!(!title_still_expected("User Title", "Meeting 15_08_26_10_37_29"));
        assert!(!title_still_expected("", "Meeting 15_08_26_10_37_29"));
    }
}


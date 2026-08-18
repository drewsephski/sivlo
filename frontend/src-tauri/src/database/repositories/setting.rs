use crate::database::models::{Setting, TranscriptSetting};
use crate::secrets::{self, account_for_provider, account_for_transcript_provider};
use crate::summary::CustomOpenAIConfig;
use sqlx::SqlitePool;

#[derive(serde::Deserialize, Debug)]
pub struct SaveModelConfigRequest {
    pub provider: String,
    pub model: String,
    #[serde(rename = "whisperModel")]
    pub whisper_model: String,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "ollamaEndpoint")]
    pub ollama_endpoint: Option<String>,
}

#[derive(serde::Deserialize, Debug)]
pub struct SaveTranscriptConfigRequest {
    pub provider: String,
    pub model: String,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
}

pub struct SettingsRepository;

// Transcript providers: localWhisper, deepgram, elevenLabs, groq, openai
// Summary providers: openai, claude, ollama, groq, added openrouter
// NOTE: Handle data exclusion in the higher layer as this is database abstraction layer(using SELECT *)

impl SettingsRepository {
    pub async fn get_model_config(
        pool: &SqlitePool,
    ) -> std::result::Result<Option<Setting>, sqlx::Error> {
        let setting = sqlx::query_as::<_, Setting>("SELECT * FROM settings LIMIT 1")
            .fetch_optional(pool)
            .await?;
        Ok(setting)
    }

    pub async fn save_model_config(
        pool: &SqlitePool,
        provider: &str,
        model: &str,
        whisper_model: &str,
        ollama_endpoint: Option<&str>,
    ) -> std::result::Result<(), sqlx::Error> {
        // Using id '1' for backward compatibility
        sqlx::query(
            r#"
            INSERT INTO settings (id, provider, model, whisperModel, ollamaEndpoint)
            VALUES ('1', $1, $2, $3, $4)
            ON CONFLICT(id) DO UPDATE SET
                provider = excluded.provider,
                model = excluded.model,
                whisperModel = excluded.whisperModel,
                ollamaEndpoint = excluded.ollamaEndpoint
            "#,
        )
        .bind(provider)
        .bind(model)
        .bind(whisper_model)
        .bind(ollama_endpoint)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn save_api_key(
        pool: &SqlitePool,
        provider: &str,
        api_key: &str,
    ) -> std::result::Result<(), sqlx::Error> {
        // Custom OpenAI uses JSON config (customOpenAIConfig) instead of a separate API key column
        if provider == "custom-openai" {
            return Err(sqlx::Error::Protocol(
                "custom-openai provider should use save_custom_openai_config() instead of save_api_key()".into(),
            ));
        }

        match provider {
            "openai" | "claude" | "ollama" | "groq" | "openrouter" => {}
            "builtin-ai" => return Ok(()), // No API key needed
            _ => {
                return Err(sqlx::Error::Protocol(
                    format!("Invalid provider: {}", provider).into(),
                ))
            }
        };

        if let Some(account) = account_for_provider(provider) {
            secrets::store_api_key(account, api_key).map_err(|e| {
                sqlx::Error::Protocol(format!("Failed to store API key securely: {}", e).into())
            })?;
        }

        // Clear any legacy plaintext key from SQLite
        Self::clear_legacy_api_key_column(pool, provider).await?;

        Ok(())
    }

    async fn clear_legacy_api_key_column(
        pool: &SqlitePool,
        provider: &str,
    ) -> std::result::Result<(), sqlx::Error> {
        let api_key_column = match provider {
            "openai" => "openaiApiKey",
            "claude" => "anthropicApiKey",
            "ollama" => "ollamaApiKey",
            "groq" => "groqApiKey",
            "openrouter" => "openRouterApiKey",
            "localWhisper" => "whisperApiKey",
            "deepgram" => "deepgramApiKey",
            "elevenLabs" => "elevenLabsApiKey",
            _ => return Ok(()),
        };

        let query = format!(
            "UPDATE settings SET {} = NULL WHERE id = '1'",
            api_key_column
        );
        // transcript_settings uses different table for transcript providers
        let query = if matches!(provider, "localWhisper" | "deepgram" | "elevenLabs") {
            format!(
                "UPDATE transcript_settings SET {} = NULL WHERE id = '1'",
                api_key_column
            )
        } else {
            query
        };

        sqlx::query(&query).execute(pool).await?;
        Ok(())
    }

    async fn read_legacy_api_key(
        pool: &SqlitePool,
        provider: &str,
    ) -> std::result::Result<Option<String>, sqlx::Error> {
        let (table, api_key_column) = match provider {
            "openai" => ("settings", "openaiApiKey"),
            "ollama" => ("settings", "ollamaApiKey"),
            "groq" => ("settings", "groqApiKey"),
            "claude" => ("settings", "anthropicApiKey"),
            "openrouter" => ("settings", "openRouterApiKey"),
            "localWhisper" => ("transcript_settings", "whisperApiKey"),
            "deepgram" => ("transcript_settings", "deepgramApiKey"),
            "elevenLabs" => ("transcript_settings", "elevenLabsApiKey"),
            _ => return Ok(None),
        };

        let query = format!(
            "SELECT {} FROM {} WHERE id = '1' LIMIT 1",
            api_key_column, table
        );
        let api_key: Option<String> = sqlx::query_scalar(&query).fetch_optional(pool).await?;
        Ok(api_key.filter(|k| !k.is_empty()))
    }

    pub async fn get_api_key(
        pool: &SqlitePool,
        provider: &str,
    ) -> std::result::Result<Option<String>, sqlx::Error> {
        if provider == "custom-openai" {
            return Self::get_custom_openai_api_key(pool).await;
        }

        match provider {
            "openai" | "ollama" | "groq" | "claude" | "openrouter" => {}
            "builtin-ai" => return Ok(None),
            _ => {
                return Err(sqlx::Error::Protocol(
                    format!("Invalid provider: {}", provider).into(),
                ))
            }
        };

        if let Some(account) = account_for_provider(provider) {
            if let Ok(Some(key)) = secrets::get_api_key(account) {
                return Ok(Some(key));
            }
        }

        if let Some(legacy_key) = Self::read_legacy_api_key(pool, provider).await? {
            if secrets::migrate_key_to_store(provider, &legacy_key).is_ok() {
                Self::clear_legacy_api_key_column(pool, provider).await?;
            }
            return Ok(Some(legacy_key));
        }

        Ok(None)
    }

    async fn get_custom_openai_api_key(
        pool: &SqlitePool,
    ) -> std::result::Result<Option<String>, sqlx::Error> {
        if let Ok(Some(key)) = secrets::get_api_key("custom-openai") {
            return Ok(Some(key));
        }

        let mut config = Self::get_custom_openai_config(pool).await?;
        if let Some(ref mut cfg) = config {
            if let Some(key) = cfg.api_key.clone() {
                if secrets::migrate_key_to_store("custom-openai", &key).is_ok() {
                    cfg.api_key = None;
                    Self::save_custom_openai_config_without_key(pool, cfg).await?;
                }
                return Ok(Some(key));
            }
        }

        Ok(None)
    }

    async fn save_custom_openai_config_without_key(
        pool: &SqlitePool,
        config: &CustomOpenAIConfig,
    ) -> std::result::Result<(), sqlx::Error> {
        let mut stored = config.clone();
        stored.api_key = None;
        let config_json = serde_json::to_string(&stored).map_err(|e| {
            sqlx::Error::Protocol(format!("Failed to serialize config to JSON: {}", e).into())
        })?;

        sqlx::query(
            r#"
            INSERT INTO settings (id, provider, model, whisperModel, customOpenAIConfig)
            VALUES ('1', 'custom-openai', $1, 'large-v3', $2)
            ON CONFLICT(id) DO UPDATE SET
                customOpenAIConfig = excluded.customOpenAIConfig
            "#,
        )
        .bind(&stored.model)
        .bind(config_json)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn get_transcript_config(
        pool: &SqlitePool,
    ) -> std::result::Result<Option<TranscriptSetting>, sqlx::Error> {
        let setting =
            sqlx::query_as::<_, TranscriptSetting>("SELECT * FROM transcript_settings LIMIT 1")
                .fetch_optional(pool)
                .await?;
        Ok(setting)

    }

    pub async fn save_transcript_config(
        pool: &SqlitePool,
        provider: &str,
        model: &str,
    ) -> std::result::Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO transcript_settings (id, provider, model)
            VALUES ('1', $1, $2)
            ON CONFLICT(id) DO UPDATE SET
                provider = excluded.provider,
                model = excluded.model
            "#,
        )
        .bind(provider)
        .bind(model)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn save_transcript_api_key(
        pool: &SqlitePool,
        provider: &str,
        api_key: &str,
    ) -> std::result::Result<(), sqlx::Error> {
        match provider {
            "localWhisper" | "deepgram" | "elevenLabs" | "groq" | "openai" => {}
            "parakeet" => return Ok(()),
            _ => {
                return Err(sqlx::Error::Protocol(
                    format!("Invalid provider: {}", provider).into(),
                ))
            }
        };

        if let Some(account) = account_for_transcript_provider(provider) {
            secrets::store_api_key(account, api_key).map_err(|e| {
                sqlx::Error::Protocol(format!("Failed to store API key securely: {}", e).into())
            })?;
        }

        Self::clear_legacy_api_key_column(pool, provider).await?;
        Ok(())
    }

    pub async fn get_transcript_api_key(
        pool: &SqlitePool,
        provider: &str,
    ) -> std::result::Result<Option<String>, sqlx::Error> {
        match provider {
            "localWhisper" | "deepgram" | "elevenLabs" | "groq" | "openai" => {}
            "parakeet" => return Ok(None),
            _ => {
                return Err(sqlx::Error::Protocol(
                    format!("Invalid provider: {}", provider).into(),
                ))
            }
        };

        if let Some(account) = account_for_transcript_provider(provider) {
            if let Ok(Some(key)) = secrets::get_api_key(account) {
                return Ok(Some(key));
            }
        }

        if let Some(legacy_key) = Self::read_legacy_api_key(pool, provider).await? {
            let account = account_for_transcript_provider(provider).unwrap_or(provider);
            if secrets::migrate_key_to_store(account, &legacy_key).is_ok() {
                Self::clear_legacy_api_key_column(pool, provider).await?;
            }
            return Ok(Some(legacy_key));
        }

        Ok(None)
    }

    pub async fn delete_api_key(
        pool: &SqlitePool,
        provider: &str,
    ) -> std::result::Result<(), sqlx::Error> {
        if provider == "custom-openai" {
            secrets::delete_api_key("custom-openai").ok();
            sqlx::query("UPDATE settings SET customOpenAIConfig = NULL WHERE id = '1'")
                .execute(pool)
                .await?;
            return Ok(());
        }

        match provider {
            "openai" | "ollama" | "groq" | "claude" | "openrouter" | "builtin-ai" => {}
            _ => {
                return Err(sqlx::Error::Protocol(
                    format!("Invalid provider: {}", provider).into(),
                ))
            }
        };

        if let Some(account) = account_for_provider(provider) {
            secrets::delete_api_key(account).ok();
        }

        Self::clear_legacy_api_key_column(pool, provider).await
    }

    // ===== CUSTOM OPENAI CONFIG METHODS =====

    /// Gets the custom OpenAI configuration from JSON
    ///
    /// # Returns
    /// * `Ok(Some(CustomOpenAIConfig))` - Config exists and is valid JSON
    /// * `Ok(None)` - No config stored
    /// * `Err(sqlx::Error)` - Database error
    pub async fn get_custom_openai_config(
        pool: &SqlitePool,
    ) -> std::result::Result<Option<CustomOpenAIConfig>, sqlx::Error> {
        use sqlx::Row;

        let row = sqlx::query(
            r#"
            SELECT customOpenAIConfig
            FROM settings
            WHERE id = '1'
            LIMIT 1
            "#
        )
        .fetch_optional(pool)
        .await?;

        let mut config = match row {
            Some(record) => {
                let config_json: Option<String> = record.get("customOpenAIConfig");

                if let Some(json) = config_json {
                    let config: CustomOpenAIConfig = serde_json::from_str(&json).map_err(|e| {
                        sqlx::Error::Protocol(
                            format!("Invalid JSON in customOpenAIConfig: {}", e).into(),
                        )
                    })?;
                    Some(config)
                } else {
                    None
                }
            }
            None => None,
        };

        if let Some(ref mut cfg) = config {
            if cfg.api_key.is_none() {
                if let Ok(Some(key)) = secrets::get_api_key("custom-openai") {
                    cfg.api_key = Some(key);
                }
            }
        }

        Ok(config)
    }

    pub async fn save_custom_openai_config(
        pool: &SqlitePool,
        config: &CustomOpenAIConfig,
    ) -> std::result::Result<(), sqlx::Error> {
        if let Some(ref api_key) = config.api_key {
            secrets::store_api_key("custom-openai", api_key).map_err(|e| {
                sqlx::Error::Protocol(format!("Failed to store API key securely: {}", e).into())
            })?;
        } else {
            secrets::delete_api_key("custom-openai").ok();
        }

        Self::save_custom_openai_config_without_key(pool, config).await
    }
}

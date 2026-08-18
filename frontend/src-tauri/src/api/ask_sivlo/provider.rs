use sqlx::SqlitePool;
use tauri::Manager;

use crate::database::repositories::setting::SettingsRepository;
use crate::summary::llm_client::LLMProvider;

use super::models::ProviderConfig;

/// Pure DB helper — resolves provider configuration from stored settings.
/// No AppHandle, no network, no LLM calls.
pub(crate) async fn resolve_stored_provider_config(
    pool: &SqlitePool,
) -> Result<ProviderConfig, String> {
    let setting = SettingsRepository::get_model_config(pool)
        .await
        .map_err(|e| format!("Failed to retrieve model config: {}", e))?
        .ok_or_else(|| {
            "No AI model configured. Please configure a model in Settings.".to_string()
        })?;

    let provider = LLMProvider::from_str(&setting.provider)?;

    let api_key =
        if provider == LLMProvider::Ollama || provider == LLMProvider::BuiltInAI || provider == LLMProvider::CustomOpenAI {
            String::new()
        } else {
            match SettingsRepository::get_api_key(pool, &setting.provider).await {
                Ok(Some(key)) if !key.is_empty() => key,
                Ok(None) | Ok(Some(_)) => {
                    return Err(format!("API key not found for {}", &setting.provider));
                }
                Err(e) => {
                    return Err(format!(
                        "Failed to retrieve API key for {}: {}",
                        &setting.provider, e
                    ));
                }
            }
        };

    let ollama_endpoint = if provider == LLMProvider::Ollama {
        setting.ollama_endpoint.clone()
    } else {
        None
    };

    let (custom_openai_endpoint, custom_openai_api_key, custom_openai_max_tokens, custom_openai_temperature, custom_openai_top_p) =
        if provider == LLMProvider::CustomOpenAI {
            match SettingsRepository::get_custom_openai_config(pool).await {
                Ok(Some(config)) => (
                    Some(config.endpoint),
                    config.api_key,
                    config.max_tokens.map(|t| t as u32),
                    config.temperature,
                    config.top_p,
                ),
                Ok(None) => {
                    return Err(
                        "Custom OpenAI provider selected but no configuration found".to_string(),
                    );
                }
                Err(e) => {
                    return Err(format!("Failed to retrieve custom OpenAI config: {}", e));
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

    Ok(ProviderConfig {
        provider,
        model_name: setting.model,
        api_key: final_api_key,
        ollama_endpoint,
        custom_openai_endpoint,
        app_data_dir: None,
        max_tokens: custom_openai_max_tokens,
        temperature: custom_openai_temperature,
        top_p: custom_openai_top_p,
    })
}

/// Thin wrapper — resolves stored config then adds AppHandle-derived values.
pub(crate) async fn resolve_provider_config(
    pool: &SqlitePool,
    app: &tauri::AppHandle<impl tauri::Runtime>,
) -> Result<ProviderConfig, String> {
    let mut config = resolve_stored_provider_config(pool).await?;
    config.app_data_dir = app.path().app_data_dir().ok();
    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;

    async fn test_db_pool() -> SqlitePool {
        crate::secrets::init_test_keyring();
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

    #[tokio::test]
    async fn missing_model_configuration_returns_configure_model_error() {
        let pool = test_db_pool().await;
        let err = match resolve_stored_provider_config(&pool).await {
            Ok(_) => panic!("expected missing model configuration to fail"),
            Err(err) => err,
        };
        assert_eq!(
            err,
            "No AI model configured. Please configure a model in Settings."
        );
    }

    #[tokio::test]
    async fn configured_ollama_resolves_without_cloud_api_key() {
        let pool = test_db_pool().await;
        SettingsRepository::save_model_config(&pool, "ollama", "llama3.2:latest", "large-v3", Some("http://localhost:11434"))
            .await
            .expect("failed to save model config");

        let config = resolve_stored_provider_config(&pool).await.expect("should resolve");

        assert_eq!(config.provider, LLMProvider::Ollama);
        assert_eq!(config.model_name, "llama3.2:latest");
        assert_eq!(config.api_key, "");
        assert_eq!(config.ollama_endpoint.as_deref(), Some("http://localhost:11434"));
        assert!(config.custom_openai_endpoint.is_none());
    }

    #[tokio::test]
    async fn configured_cloud_provider_resolves_expected_model() {
        let pool = test_db_pool().await;
        SettingsRepository::save_model_config(&pool, "openai", "gpt-4o", "large-v3", None)
            .await
            .expect("failed to save model config");
        SettingsRepository::save_api_key(&pool, "openai", "sk-test-key-123")
            .await
            .expect("failed to save api key");

        let config = resolve_stored_provider_config(&pool).await.expect("should resolve");

        assert_eq!(config.provider, LLMProvider::OpenAI);
        assert_eq!(config.model_name, "gpt-4o");
        assert_eq!(config.api_key, "sk-test-key-123");
        assert!(config.ollama_endpoint.is_none());
        assert!(config.custom_openai_endpoint.is_none());
    }

    #[tokio::test]
    async fn configured_custom_openai_preserves_endpoint() {
        use crate::summary::CustomOpenAIConfig;

        let pool = test_db_pool().await;
        let custom_config = CustomOpenAIConfig {
            endpoint: "http://localhost:8000/v1".to_string(),
            api_key: Some("custom-key".to_string()),
            model: "llama-3-70b".to_string(),
            max_tokens: Some(4096),
            temperature: Some(0.7),
            top_p: Some(0.9),
        };
        SettingsRepository::save_model_config(&pool, "custom-openai", "llama-3-70b", "large-v3", None)
            .await
            .expect("failed to save model config");
        SettingsRepository::save_custom_openai_config(&pool, &custom_config)
            .await
            .expect("failed to save custom openai config");

        let config = resolve_stored_provider_config(&pool).await.expect("should resolve");

        assert_eq!(config.provider, LLMProvider::CustomOpenAI);
        assert_eq!(config.model_name, "llama-3-70b");
        assert_eq!(config.api_key, "custom-key");
        assert_eq!(config.custom_openai_endpoint.as_deref(), Some("http://localhost:8000/v1"));
        assert_eq!(config.max_tokens, Some(4096));
        assert_eq!(config.temperature, Some(0.7));
        assert_eq!(config.top_p, Some(0.9));
        assert!(config.ollama_endpoint.is_none());
    }
}

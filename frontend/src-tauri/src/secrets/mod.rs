//! Secure storage for API keys using the OS credential store (Keychain on macOS,
//! Credential Manager on Windows, Secret Service on Linux).
//!
//! In unit tests, an in-memory store is used instead of the OS keychain.

use anyhow::{Context, Result};
use keyring::Entry;
use log::info;
use std::collections::HashMap;
use std::sync::Mutex;

const SERVICE_NAME: &str = "com.drewsepeczi.sivlo";

#[cfg(test)]
static TEST_STORE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

#[cfg(test)]
fn test_store() -> std::sync::MutexGuard<'static, Option<HashMap<String, String>>> {
    let mut guard = TEST_STORE.lock().expect("test store lock");
    if guard.is_none() {
        *guard = Some(HashMap::new());
    }
    guard
}

#[cfg(test)]
pub fn init_test_keyring() {
    drop(test_store());
}

fn entry_for(account: &str) -> Result<Entry> {
    Entry::new(SERVICE_NAME, account).context("failed to create keyring entry")
}

/// Store an API key in the OS credential store.
pub fn store_api_key(account: &str, api_key: &str) -> Result<()> {
    #[cfg(test)]
    {
        test_store()
            .as_mut()
            .expect("call init_test_keyring() before storing keys in tests")
            .insert(account.to_string(), api_key.to_string());
        return Ok(());
    }

    #[cfg(not(test))]
    {
        let entry = entry_for(account)?;
        entry
            .set_password(api_key)
            .context("failed to store API key in credential store")
    }
}

/// Retrieve an API key from the OS credential store.
pub fn get_api_key(account: &str) -> Result<Option<String>> {
    #[cfg(test)]
    {
        return Ok(
            test_store()
                .as_ref()
                .expect("call init_test_keyring() before reading keys in tests")
                .get(account)
                .cloned(),
        );
    }

    #[cfg(not(test))]
    {
        let entry = entry_for(account)?;
        match entry.get_password() {
            Ok(password) => Ok(Some(password)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e).context("failed to read API key from credential store"),
        }
    }
}

/// Delete an API key from the OS credential store.
pub fn delete_api_key(account: &str) -> Result<()> {
    #[cfg(test)]
    {
        test_store()
            .as_mut()
            .expect("call init_test_keyring() before deleting keys in tests")
            .remove(account);
        return Ok(());
    }

    #[cfg(not(test))]
    {
        let entry = entry_for(account)?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e).context("failed to delete API key from credential store"),
        }
    }
}

/// Map a provider name to its keyring account identifier.
pub fn account_for_provider(provider: &str) -> Option<&'static str> {
    match provider {
        "openai" => Some("openai"),
        "claude" => Some("claude"),
        "ollama" => Some("ollama"),
        "groq" => Some("groq"),
        "openrouter" => Some("openrouter"),
        "custom-openai" => Some("custom-openai"),
        "localWhisper" => Some("transcript-whisper"),
        "deepgram" => Some("transcript-deepgram"),
        "elevenLabs" => Some("transcript-elevenlabs"),
        "transcript-openai" => Some("transcript-openai"),
        "transcript-groq" => Some("transcript-groq"),
        _ => None,
    }
}

/// Keyring account for a transcript provider (distinct from summary providers).
pub fn account_for_transcript_provider(provider: &str) -> Option<&'static str> {
    match provider {
        "openai" => Some("transcript-openai"),
        "groq" => Some("transcript-groq"),
        other => account_for_provider(other),
    }
}

/// Migrate a plaintext key from SQLite into the credential store.
pub fn migrate_key_to_store(provider: &str, plaintext: &str) -> Result<()> {
    if plaintext.is_empty() {
        return Ok(());
    }

    if let Some(account) = account_for_provider(provider) {
        store_api_key(account, plaintext)?;
        info!("Migrated API key for {} from database to credential store", provider);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_for_provider_maps_known_providers() {
        init_test_keyring();
        assert_eq!(account_for_provider("openai"), Some("openai"));
        assert_eq!(account_for_provider("claude"), Some("claude"));
        assert_eq!(account_for_provider("deepgram"), Some("transcript-deepgram"));
        assert_eq!(account_for_provider("unknown"), None);
    }

    #[test]
    fn in_memory_store_round_trips() {
        init_test_keyring();
        store_api_key("openai", "sk-test").unwrap();
        assert_eq!(get_api_key("openai").unwrap(), Some("sk-test".to_string()));
        delete_api_key("openai").unwrap();
        assert_eq!(get_api_key("openai").unwrap(), None);
    }
}

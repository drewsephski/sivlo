/// Application configuration constants
///
/// Centralized definitions for default models and settings.
/// Used across database initialization, import, and retranscription.

/// Production application bundle identifier.
/// Drives the Tauri app data directory (e.g. `~/Library/Application Support/com.drewsepeczi.sivlo/`)
/// and the macOS bundle identity.
pub const APP_IDENTIFIER: &str = "com.drewsepeczi.sivlo";

/// Production main binary name (bundle binary inside the .app).
pub const APP_MAIN_BINARY_NAME: &str = "sivlo";

/// Default recordings folder name, joined to the platform media directory
/// (macOS `~/Movies/Sivlo-recordings`, Windows `~/Music/Sivlo-recordings`, Linux `~/Documents/Sivlo-recordings`).
pub const RECORDINGS_DIR_NAME: &str = "Sivlo-recordings";

/// Application-owned data directory name used by direct `dirs`-based storage
/// that bypasses Tauri's identifier-derived paths (e.g. templates, model fallbacks).
pub const STORAGE_DIR_NAME: &str = "Sivlo";

/// Notification settings config directory name.
pub const NOTIFICATION_SETTINGS_DIR_NAME: &str = "sivlo";

/// Default Whisper model for transcription when no preference is configured.
/// This is the recommended balance of accuracy and speed.
pub const DEFAULT_WHISPER_MODEL: &str = "large-v3-turbo";

/// Default Parakeet model for transcription when no preference is configured.
/// This is the quantized version optimized for speed.
pub const DEFAULT_PARAKEET_MODEL: &str = "parakeet-tdt-0.6b-v3-int8";

/// Whisper model catalog with metadata for all supported models.
/// Used by both WhisperEngine::discover_models() and discover_models_standalone().
///
/// Format: (name, filename, size_mb, accuracy, speed, description)
pub const WHISPER_MODEL_CATALOG: &[(&str, &str, u32, &str, &str, &str)] = &[
    // Standard f16 models (full precision)
    ("tiny", "ggml-tiny.bin", 74, "Decent", "Very Fast", "Fastest processing, good for real-time use"),
    ("base", "ggml-base.bin", 142, "Good", "Fast", "Good balance of speed and accuracy"),
    ("small", "ggml-small.bin", 466, "Good", "Medium", "Better accuracy, moderate speed"),
    ("medium", "ggml-medium.bin", 1463, "High", "Slow", "High accuracy for professional use"),
    ("large-v3-turbo", "ggml-large-v3-turbo.bin", 1549, "High", "Medium", "Best accuracy with improved speed"),
    ("large-v3", "ggml-large-v3.bin", 2951, "High", "Slow", "Most Accurate, latest large model"),

    // Q5_1 quantized models (balanced speed/accuracy, slightly better quality than Q5_0)
    ("tiny-q5_1", "ggml-tiny-q5_1.bin", 31, "Decent", "Very Fast", "Quantized tiny model, ~50% faster processing"),
    ("base-q5_1", "ggml-base-q5_1.bin", 57, "Good", "Fast", "Quantized base model, good speed/accuracy balance"),
    ("small-q5_1", "ggml-small-q5_1.bin", 181, "Good", "Fast", "Quantized small model, faster than f16 version"),

    // Q5_0 quantized models (balanced speed/accuracy)
    ("medium-q5_0", "ggml-medium-q5_0.bin", 514, "High", "Medium", "Quantized medium model, professional quality"),
    ("large-v3-turbo-q5_0", "ggml-large-v3-turbo-q5_0.bin", 547, "High", "Medium", "Quantized large model, best balance"),
    ("large-v3-q5_0", "ggml-large-v3-q5_0.bin", 1031, "High", "Slow", "Quantized large model, high accuracy"),
];

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    /// Assert the identity/storage constants carry the Sivlo production values.
    #[test]
    fn test_production_identity_constants() {
        assert_eq!(APP_IDENTIFIER, "com.drewsepeczi.sivlo");
        assert_eq!(APP_MAIN_BINARY_NAME, "sivlo");
        assert_eq!(RECORDINGS_DIR_NAME, "Sivlo-recordings");
        assert_eq!(STORAGE_DIR_NAME, "Sivlo");
        assert_eq!(NOTIFICATION_SETTINGS_DIR_NAME, "sivlo");
    }

    /// Read the actual `tauri.conf.json` (resolved relative to the crate root so the
    /// test is cwd-independent) and assert its production identity matches the constants.
    /// This proves the JSON parses and keeps config and code in agreement.
    #[test]
    fn test_tauri_config_matches_production_identity() {
        let config_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json");
        let raw = std::fs::read_to_string(&config_path).unwrap_or_else(|e| {
            panic!("Failed to read tauri config at {}: {}", config_path.display(), e)
        });
        let config: serde_json::Value =
            serde_json::from_str(&raw).expect("tauri.conf.json must parse as valid JSON");

        assert_eq!(
            config.get("identifier").and_then(|v| v.as_str()),
            Some(APP_IDENTIFIER),
            "tauri.conf.json `identifier` must be {}",
            APP_IDENTIFIER
        );
        assert_eq!(
            config.get("productName").and_then(|v| v.as_str()),
            Some("Sivlo"),
            "tauri.conf.json `productName` must be Sivlo"
        );
        assert_eq!(
            config.get("mainBinaryName").and_then(|v| v.as_str()),
            Some(APP_MAIN_BINARY_NAME),
            "tauri.conf.json `mainBinaryName` must be {}",
            APP_MAIN_BINARY_NAME
        );
        assert_eq!(
            config
                .get("bundle")
                .and_then(|b| b.get("macOS"))
                .and_then(|m| m.get("minimumSystemVersion"))
                .and_then(|v| v.as_str()),
            Some("13.0"),
            "tauri.conf.json `bundle.macOS.minimumSystemVersion` must be 13.0"
        );
    }
}

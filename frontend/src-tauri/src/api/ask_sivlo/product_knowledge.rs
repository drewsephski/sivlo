pub(crate) struct ProductFact {
    pub keywords: &'static [&'static str],
    pub answer: &'static str,
}

pub(crate) const PRODUCT_FACTS: &[ProductFact] = &[
    ProductFact {
        keywords: &["record", "recording", "capture", "audio", "system audio", "microphone"],
        answer: "Sivlo captures meeting audio using the microphone and system audio. On macOS, system audio capture uses Core Audio tap. Microphone capture uses CPAL. Audio is processed locally.",
    },
    ProductFact {
        keywords: &["transcrib", "transcription", "whisper", "parakeet", "speech to text", "stt"],
        answer: "Sivlo transcribes meetings locally using Whisper or Parakeet engines. Cloud transcription providers (OpenAI, Groq, etc.) are also available via configured provider settings.",
    },
    ProductFact {
        keywords: &["import", "audio file", "wav", "mp3", "m4a"],
        answer: "Sivlo supports importing supported audio files. Imported audio is decoded locally and transcribed using your configured transcription provider, which may be local or cloud-based.",
    },
    ProductFact {
        keywords: &["summar", "summary", "summarize", "key points", "tldr"],
        answer: "Sivlo generates meeting summaries using your configured LLM provider. Summaries include action items, decisions, and key discussion points.",
    },
    ProductFact {
        keywords: &["note", "notes", "editor", "blocknote", "rich text"],
        answer: "Sivlo includes a rich text notes editor powered by BlockNote. Notes are stored locally and used for retrieval.",
    },
    ProductFact {
        keywords: &["priv", "private", "privacy", "data", "security", "local", "leave", "device"],
        answer: "Local retrieval and storage stays on your device. Cloud transcription may send audio to the configured transcription provider. Cloud LLM use may send bounded text, history, and evidence to the configured AI provider. Your meeting data in SQLite remains local.",
    },
    ProductFact {
        keywords: &["platform", "macos", "windows", "linux", "system requirements"],
        answer: "Sivlo is currently in public beta on macOS 13+. System audio capture uses Core Audio tap. GPU acceleration (Metal) is available for faster transcription.",
    },
    ProductFact {
        keywords: &["gpu", "metal", "cuda", "vulkan", "acceleration", "speed"],
        answer: "Sivlo supports GPU acceleration for transcription. On macOS, Metal is used. GPU acceleration significantly speeds up local transcription.",
    },
    ProductFact {
        keywords: &["llm", "ai model", "provider", "ollama", "claude", "openai", "groq"],
        answer: "Sivlo supports multiple LLM providers for summarization: Ollama (local), Claude, OpenAI, Groq, and OpenRouter. Configure your preferred provider in settings.",
    },
    ProductFact {
        keywords: &["meeting", "meetings", "search", "retrieval", "find"],
        answer: "Sivlo stores all your meetings locally. You can search across all meetings or scope to a specific meeting. Retrieval uses transcript, summary, notes, action items, and decisions.",
    },
];

pub(crate) fn find_matching_product_facts(query: &str) -> Vec<&'static ProductFact> {
    let lower = query.to_lowercase();
    PRODUCT_FACTS
        .iter()
        .filter(|fact| fact.keywords.iter().any(|kw| lower.contains(kw)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn product_facts_match_import_query() {
        let results = find_matching_product_facts("how do I import audio");
        assert!(!results.is_empty());
        assert!(
            results.iter().any(|f| f.answer.to_lowercase().contains("import")),
            "Expected at least one fact with 'import' in the answer"
        );
    }

    #[test]
    fn product_facts_match_privacy_query() {
        let results = find_matching_product_facts("does my data leave my device");
        assert!(!results.is_empty());
        assert!(
            results.iter().any(|f| {
                let a = f.answer.to_lowercase();
                a.contains("privacy") || a.contains("locally") || a.contains("on your device")
            }),
            "Expected at least one fact about privacy"
        );
    }

    #[test]
    fn product_facts_no_match() {
        let results = find_matching_product_facts("what is the meaning of life");
        assert!(results.is_empty());
    }
}

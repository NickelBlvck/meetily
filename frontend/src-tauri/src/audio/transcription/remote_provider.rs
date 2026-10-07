// audio/transcription/remote_provider.rs
//
// Remote transcription provider for OpenAI-compatible speech-to-text APIs
// (e.g. https://plusvibeapi.ru/v1, OpenAI, Groq, or any self-hosted proxy).
//
// Protocol: POST {endpoint}/audio/transcriptions (multipart/form-data) with
// fields `file` (16-bit mono WAV), `model`, optional `language`. The endpoint
// is the API base URL including the version segment (e.g. "https://host/v1");
// if it already ends with "/audio/transcriptions" it is used as-is.

use super::provider::{TranscriptResult, TranscriptionError, TranscriptionProvider};
use async_trait::async_trait;
use log::{info, warn};

pub struct RemoteTranscriptionProvider {
    endpoint: String,
    api_key: Option<String>,
    model: String,
}

impl RemoteTranscriptionProvider {
    pub fn new(endpoint: String, api_key: Option<String>, model: Option<String>) -> Self {
        Self {
            endpoint: endpoint.trim().trim_end_matches('/').to_string(),
            api_key: api_key.filter(|k| !k.trim().is_empty()),
            model: match model {
                Some(m) if !m.trim().is_empty() => m.trim().to_string(),
                _ => "whisper-large-v3".to_string(),
            },
        }
    }

    fn transcriptions_url(&self) -> String {
        if self.endpoint.ends_with("/audio/transcriptions") {
            self.endpoint.clone()
        } else {
            format!("{}/audio/transcriptions", self.endpoint)
        }
    }

    /// Encode f32 mono samples as a 16-bit PCM WAV file in memory.
    fn encode_wav_16khz(audio: &[f32]) -> Vec<u8> {
        const SAMPLE_RATE: u32 = 16_000;
        let samples: Vec<i16> = audio
            .iter()
            .map(|&s| {
                let clamped = s.clamp(-1.0, 1.0);
                (clamped * i16::MAX as f32) as i16
            })
            .collect();

        let bytes_per_sample = 2u32;
        let data_len = (samples.len() as u32) * bytes_per_sample;
        let mut wav = Vec::with_capacity(44 + data_len as usize);

        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + data_len).to_le_bytes());
        wav.extend_from_slice(b"WAVE");
        // fmt chunk
        wav.extend_from_slice(b"fmt ");
        wav.extend_from_slice(&16u32.to_le_bytes()); // chunk size
        wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
        wav.extend_from_slice(&1u16.to_le_bytes()); // mono
        wav.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
        wav.extend_from_slice(&(SAMPLE_RATE * bytes_per_sample).to_le_bytes()); // byte rate
        wav.extend_from_slice(&(bytes_per_sample as u16).to_le_bytes()); // block align
        wav.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
        // data chunk
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_len.to_le_bytes());
        for s in &samples {
            wav.extend_from_slice(&s.to_le_bytes());
        }
        wav
    }
}

#[async_trait]
impl TranscriptionProvider for RemoteTranscriptionProvider {
    async fn transcribe(
        &self,
        audio: Vec<f32>,
        language: Option<String>,
    ) -> std::result::Result<TranscriptResult, TranscriptionError> {
        if audio.is_empty() {
            return Err(TranscriptionError::AudioTooShort { samples: 0, minimum: 1 });
        }

        let wav_bytes = Self::encode_wav_16khz(&audio);
        let part = reqwest::multipart::Part::bytes(wav_bytes)
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| TranscriptionError::EngineFailed(format!("multipart error: {}", e)))?;

        let mut form = reqwest::multipart::Form::new()
            .text("model", self.model.clone())
            .part("file", part);
        if let Some(lang) = language.as_deref() {
            if !lang.is_empty() && lang != "auto" {
                form = form.text("language", lang.to_string());
            }
        }

        let mut request = reqwest::Client::new()
            .post(self.transcriptions_url())
            .multipart(form)
            .timeout(std::time::Duration::from_secs(120));
        if let Some(key) = &self.api_key {
            request = request.bearer_auth(key);
        }

        info!(
            "🌐 Sending {} samples to remote transcription endpoint ({}, model: {})",
            audio.len(),
            self.endpoint,
            self.model
        );

        let response = request
            .send()
            .await
            .map_err(|e| TranscriptionError::EngineFailed(format!("request failed: {}", e)))?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            let snippet: String = body.chars().take(300).collect();
            warn!("Remote transcription failed with status {}: {}", status, snippet);
            return Err(TranscriptionError::EngineFailed(format!(
                "remote endpoint returned status {}",
                status
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| TranscriptionError::EngineFailed(format!("invalid JSON response: {}", e)))?;

        let text = json
            .get("text")
            .and_then(|t| t.as_str())
            .unwrap_or_default()
            .to_string();

        // OpenAI-compatible usage object: input_tokens/output_tokens/total_tokens
        // (also accept prompt_tokens/completion_tokens variants)
        let usage = json.get("usage");
        let input_tokens = usage
            .and_then(|u| {
                u.get("input_tokens")
                    .or_else(|| u.get("prompt_tokens"))
            })
            .and_then(|v| v.as_u64());
        let output_tokens = usage
            .and_then(|u| {
                u.get("output_tokens")
                    .or_else(|| u.get("completion_tokens"))
            })
            .and_then(|v| v.as_u64());
        let total_tokens = usage
            .and_then(|u| u.get("total_tokens"))
            .and_then(|v| v.as_u64())
            .or_else(|| match (input_tokens, output_tokens) {
                (Some(i), Some(o)) => Some(i + o),
                _ => None,
            });

        info!(
            "🌐 Remote transcription usage: input {:?}, output {:?}, total {:?} tokens",
            input_tokens, output_tokens, total_tokens
        );

        Ok(TranscriptResult {
            text,
            confidence: None,
            is_partial: false,
            input_tokens,
            output_tokens,
            total_tokens,
        })
    }

    async fn is_model_loaded(&self) -> bool {
        // Remote endpoint is always "loaded" — readiness is validated up front.
        true
    }

    async fn get_current_model(&self) -> Option<String> {
        Some(self.model.clone())
    }

    fn provider_name(&self) -> &'static str {
        "Remote (OpenAI-compatible)"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transcriptions_url_appends_path() {
        let p = RemoteTranscriptionProvider::new(
            "https://plusvibeapi.ru/v1".to_string(),
            None,
            None,
        );
        assert_eq!(p.transcriptions_url(), "https://plusvibeapi.ru/v1/audio/transcriptions");
    }

    #[test]
    fn transcriptions_url_respects_full_url() {
        let p = RemoteTranscriptionProvider::new(
            "https://host/v1/audio/transcriptions".to_string(),
            None,
            None,
        );
        assert_eq!(p.transcriptions_url(), "https://host/v1/audio/transcriptions");
    }

    #[test]
    fn default_model_is_whisper_large_v3() {
        let p = RemoteTranscriptionProvider::new("https://x/v1".to_string(), None, None);
        assert_eq!(p.model, "whisper-large-v3");
    }

    #[test]
    fn wav_header_is_valid() {
        let audio = vec![0.0f32; 160]; // 10ms at 16kHz
        let wav = RemoteTranscriptionProvider::encode_wav_16khz(&audio);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(&wav[36..40], b"data");
        let data_len = u32::from_le_bytes([wav[40], wav[41], wav[42], wav[43]]);
        assert_eq!(data_len, 320); // 160 samples * 2 bytes
        assert_eq!(wav.len() as u32, 44 + data_len);
    }
}

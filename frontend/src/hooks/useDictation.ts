'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { writeFile, remove, BaseDirectory } from '@tauri-apps/plugin-fs';
import { join, tempDir } from '@tauri-apps/api/path';
import { toast } from 'sonner';
import { useConfig } from '@/contexts/ConfigContext';

export type DictationState = 'idle' | 'recording' | 'processing';

interface UseDictationOptions {
  /** Called with the recognized text once transcription succeeds. */
  onInsert: (text: string) => void;
  /** Disable dictation (e.g. while a meeting recording is active). */
  disabled?: boolean;
}

/**
 * Push-to-talk style dictation for short text input.
 *
 * Records the microphone with MediaRecorder, decodes the clip with the
 * WebView's own decoder, re-encodes it to a WAV temp file and hands the file
 * to the `api_transcribe_clip` Tauri command, which runs the same
 * transcription engine used for meetings.
 */
export function useDictation({ onInsert, disabled = false }: UseDictationOptions) {
  const [state, setState] = useState<DictationState>('idle');
  const { t } = useConfig();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stateRef = useRef<DictationState>('idle');

  const setDictationState = useCallback((next: DictationState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const cleanupMedia = useCallback(() => {
    recorderRef.current = null;
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (stateRef.current === 'recording' && recorderRef.current?.state !== 'inactive') {
      recorderRef.current?.stop();
    } else if (stateRef.current === 'idle') {
      cleanupMedia();
    }
  }, [cleanupMedia]);

  const start = useCallback(async () => {
    if (stateRef.current !== 'idle' || disabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const tempFile = `meetily-dictation-${Date.now()}.wav`;
        let audioContext: AudioContext | null = null;
        try {
          setDictationState('processing');

          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          cleanupMedia();

          // Decode with the WebView's built-in decoder (handles webm/opus),
          // then re-encode to PCM WAV so the Rust side needs no ffmpeg.
          audioContext = new AudioContext();
          const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
          await audioContext.close();
          audioContext = null;

          const wav = encodeWav(decoded);
          await writeFile(tempFile, wav, { baseDir: BaseDirectory.Temp });

          const fullPath = await join(await tempDir(), tempFile);
          const text = await invoke<string>('api_transcribe_clip', { path: fullPath });

          if (text) onInsert(text);
        } catch (error) {
          console.error('Dictation failed:', error);
          toast.error(t('dictation.failed'), {
            description: error instanceof Error ? error.message : String(error),
          });
        } finally {
          if (audioContext) await audioContext.close().catch(() => {});
          remove(tempFile, { baseDir: BaseDirectory.Temp }).catch(() => {});
          setDictationState('idle');
        }
      };

      recorder.start();
      setDictationState('recording');
    } catch (error) {
      console.error('Failed to start dictation:', error);
      cleanupMedia();
      toast.error(t('dictation.failed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [disabled, onInsert, t, cleanupMedia, setDictationState]);

  // Cancel on Escape while recording
  useEffect(() => {
    if (state !== 'recording') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        stop();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [state, stop]);

  const toggle = useCallback(() => {
    if (state === 'recording') {
      stop();
    } else if (state === 'idle') {
      void start();
    }
  }, [state, start, stop]);

  return { state, toggle, stop };
}

/** Mix an AudioBuffer down to mono and encode it as a 16-bit PCM WAV file. */
function encodeWav(buffer: AudioBuffer): Uint8Array {
  const channelCount = buffer.numberOfChannels;
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channelCount; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / channelCount;
    }
  }

  const bytesPerSample = 2;
  const dataSize = mono.length * bytesPerSample;
  const view = new DataView(new ArrayBuffer(44 + dataSize));

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < mono.length; i++) {
    const sample = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Uint8Array(view.buffer);
}

#!/usr/bin/env python3
"""
Read to Me - Native Messaging Host

Converts webpage article text to speech using Piper TTS.
Supports streaming playback and file download.
"""

import json
import struct
import sys
import subprocess
import os
import traceback
import base64
import io
import wave
from datetime import datetime
from pathlib import Path

# Configuration
SCRIPT_DIR = Path(__file__).parent
VENV_PYTHON = SCRIPT_DIR / ".venv" / "bin" / "python"
PIPER_MODEL = Path.home() / ".local/share/piper/en_US-lessac-medium.onnx"
OUTPUT_DIR = Path.home() / "Downloads/audio-briefings"
ERROR_LOG = OUTPUT_DIR / "error.log"

# Piper audio format (lessac model)
SAMPLE_RATE = 22050
SAMPLE_WIDTH = 2  # 16-bit
CHANNELS = 1


def log_error(message: str):
    """Write error to log file for debugging."""
    try:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(ERROR_LOG, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


def send_message(message: dict):
    """Send a message to the extension."""
    encoded = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def read_message():
    """Read a message from the extension."""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack('I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)


def generate_silence(duration_secs: float) -> bytes:
    """Generate silent audio bytes for the given duration."""
    num_samples = int(SAMPLE_RATE * duration_secs)
    # 16-bit silence = zero bytes
    return b'\x00\x00' * num_samples


def split_into_paragraphs(text: str) -> list[str]:
    """Split text into paragraphs, filtering out empty ones.
    
    Handles various paragraph separators:
    - Double newlines (\n\n)
    - Single newlines (common from Readability.js)
    - Multiple newlines
    
    Combines short lines (< 50 chars) with the next paragraph
    to avoid treating headers/bylines as separate paragraphs.
    """
    # First try splitting on double newlines
    if '\n\n' in text:
        paragraphs = text.split('\n\n')
    else:
        # Fall back to single newlines
        paragraphs = text.split('\n')
    
    # Filter empty and combine short fragments
    result = []
    buffer = ""
    
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        
        # If it's a short line and we have a buffer, combine them
        if len(p) < 50 and buffer:
            buffer += " " + p
        elif len(p) < 50 and not buffer:
            # Start buffering short lines
            buffer = p
        else:
            # It's a real paragraph
            if buffer:
                # Prepend buffered content
                p = buffer + " " + p
                buffer = ""
            result.append(p)
    
    # Don't forget any remaining buffer
    if buffer:
        if result:
            result[-1] += " " + buffer
        else:
            result.append(buffer)
    
    return result if result else [text]


def stream_audio(text: str, title: str, config: dict):
    """Stream audio chunks to the extension for real-time playback."""
    
    length_scale = config.get('lengthScale', 0.83)
    sentence_silence = config.get('sentenceSilence', 0.3)
    paragraph_silence = config.get('paragraphSilence', 0.8)  # Longer pause between paragraphs
    chunk_size = config.get('chunkSize', 22050 * 2)  # ~1 second of audio
    
    if not VENV_PYTHON.exists():
        raise Exception(f"Python venv not found. Run install.sh again.")
    if not PIPER_MODEL.exists():
        raise Exception(f"Piper model not found. Run install.sh again.")
    
    # Send audio format info
    send_message({
        "status": "audioFormat",
        "sampleRate": SAMPLE_RATE,
        "sampleWidth": SAMPLE_WIDTH,
        "channels": CHANNELS
    })
    
    # Split into paragraphs for natural pauses
    paragraphs = split_into_paragraphs(text)
    
    chunk_index = 0
    total_bytes = 0
    silence_chunk = generate_silence(paragraph_silence)
    
    for para_idx, paragraph in enumerate(paragraphs):
        # Start Piper for this paragraph
        process = subprocess.Popen(
            [
                str(VENV_PYTHON), "-m", "piper",
                "--model", str(PIPER_MODEL),
                "--length_scale", str(length_scale),
                "--sentence_silence", str(sentence_silence),
                "--output-raw"
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Send paragraph text to Piper
        process.stdin.write(paragraph.encode('utf-8'))
        process.stdin.close()
        
        # Stream audio chunks for this paragraph
        while True:
            chunk = process.stdout.read(chunk_size)
            if not chunk:
                break
            
            total_bytes += len(chunk)
            chunk_index += 1
            
            send_message({
                "status": "audioChunk",
                "chunk": base64.b64encode(chunk).decode('ascii'),
                "chunkIndex": chunk_index
            })
        
        process.wait()
        
        if process.returncode != 0:
            stderr = process.stderr.read().decode('utf-8')
            log_error(f"Piper stderr: {stderr}")
            raise Exception(f"Piper failed: {stderr}")
        
        # Insert silence between paragraphs (not after the last one)
        if para_idx < len(paragraphs) - 1:
            total_bytes += len(silence_chunk)
            chunk_index += 1
            send_message({
                "status": "audioChunk",
                "chunk": base64.b64encode(silence_chunk).decode('ascii'),
                "chunkIndex": chunk_index
            })
    
    # Calculate duration
    total_samples = total_bytes // SAMPLE_WIDTH
    duration_secs = total_samples / SAMPLE_RATE
    
    if duration_secs < 60:
        duration_str = f"{int(duration_secs)}s"
    else:
        mins = int(duration_secs // 60)
        secs = int(duration_secs % 60)
        duration_str = f"{mins}:{secs:02d}"
    
    # Signal completion
    send_message({
        "status": "streamComplete",
        "duration": duration_str,
        "totalChunks": chunk_index,
        "totalBytes": total_bytes
    })


def download_audio(text: str, title: str, config: dict) -> tuple[str, str, int]:
    """Generate and save audio file (original behavior)."""
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Generate filename
    safe_title = "".join(c for c in title[:30] if c.isalnum() or c in " -_").strip()
    safe_title = safe_title.replace(" ", "_") or "article"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = OUTPUT_DIR / f"{safe_title}_{timestamp}.wav"
    
    length_scale = config.get('lengthScale', 0.83)
    sentence_silence = config.get('sentenceSilence', 0.3)
    paragraph_silence = config.get('paragraphSilence', 0.8)
    
    if not VENV_PYTHON.exists():
        raise Exception(f"Python venv not found. Run install.sh again.")
    if not PIPER_MODEL.exists():
        raise Exception(f"Piper model not found. Run install.sh again.")
    
    # Split into paragraphs and process each
    paragraphs = split_into_paragraphs(text)
    silence_chunk = generate_silence(paragraph_silence)
    all_audio = b''
    
    for para_idx, paragraph in enumerate(paragraphs):
        result = subprocess.run(
            [
                str(VENV_PYTHON), "-m", "piper",
                "--model", str(PIPER_MODEL),
                "--length_scale", str(length_scale),
                "--sentence_silence", str(sentence_silence),
                "--output-raw"
            ],
            input=paragraph,
            capture_output=True,
            text=False,  # Binary output
            timeout=300
        )
        
        if result.returncode != 0:
            log_error(f"Piper stderr: {result.stderr.decode('utf-8')}")
            raise Exception(f"Piper failed: {result.stderr.decode('utf-8')}")
        
        all_audio += result.stdout
        
        # Add silence between paragraphs (not after the last one)
        if para_idx < len(paragraphs) - 1:
            all_audio += silence_chunk
    
    # Write combined audio to WAV file
    with wave.open(str(output_path), 'wb') as wav_file:
        wav_file.setnchannels(CHANNELS)
        wav_file.setsampwidth(SAMPLE_WIDTH)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(all_audio)
    
    # Calculate duration from actual audio length
    word_count = len(text.split())
    total_samples = len(all_audio) // SAMPLE_WIDTH
    duration_secs = total_samples / SAMPLE_RATE
    
    if duration_secs < 60:
        duration_str = f"{int(duration_secs)}s"
    else:
        mins = int(duration_secs // 60)
        secs = int(duration_secs % 60)
        duration_str = f"{mins}:{secs:02d}"
    
    return str(output_path), duration_str, word_count


def main():
    """Main loop - process messages from the extension."""
    try:
        while True:
            message = read_message()
            if message is None:
                break
            
            try:
                action = message.get('action')
                article = message.get('article', {})
                config = message.get('config', {})
                
                text = article.get('content', '')
                title = article.get('title', 'Article')
                
                if not text or len(text.strip()) < 50:
                    raise Exception("Not enough text content to read")
                
                word_count = len(text.split())
                
                if action == 'stream':
                    # Stream audio for real-time playback
                    send_message({
                        "status": "progress",
                        "message": f"Streaming audio for {word_count:,} words..."
                    })
                    stream_audio(text, title, config)
                    
                elif action == 'download':
                    # Save to file
                    send_message({
                        "status": "progress",
                        "message": f"Generating audio for {word_count:,} words..."
                    })
                    audio_path, duration, words = download_audio(text, title, config)
                    send_message({
                        "status": "downloadComplete",
                        "audioPath": audio_path,
                        "duration": duration,
                        "wordCount": words
                    })
                    
                else:
                    send_message({
                        "status": "error",
                        "message": f"Unknown action: {action}"
                    })
                    
            except Exception as e:
                log_error(f"Request error: {str(e)}\n{traceback.format_exc()}")
                send_message({
                    "status": "error",
                    "message": str(e)
                })
                
    except Exception as e:
        log_error(f"Fatal error: {str(e)}\n{traceback.format_exc()}")
        raise


if __name__ == "__main__":
    main()

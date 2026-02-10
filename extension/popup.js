// Read to Me - Popup Script
// Streaming audio playback with Web Audio API

let currentArticle = null;
let audioContext = null;
let audioQueue = [];
let isPlaying = false;
let isPaused = false;
let currentSource = null;
let nextPlayTime = 0;
let audioFormat = null;
let totalChunks = 0;
let playedChunks = 0;
let backgroundPort = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Connect to background for streaming messages
  backgroundPort = chrome.runtime.connect({ name: 'popup' });
  backgroundPort.onMessage.addListener(handleBackgroundMessage);
  
  // Set up button handlers
  document.getElementById('playBtn').addEventListener('click', startPlayback);
  document.getElementById('pauseBtn').addEventListener('click', togglePause);
  document.getElementById('stopBtn').addEventListener('click', stopPlayback);
  document.getElementById('downloadBtn').addEventListener('click', downloadAudio);
  
  // Get current tab and extract article
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractArticle' });
    if (response && response.article) {
      currentArticle = response.article;
      displayArticleInfo(currentArticle);
    } else {
      showStatus('error', 'Could not extract article from this page');
      disableAllButtons();
    }
  } catch (error) {
    showStatus('error', 'Content script not loaded. Try refreshing the page.');
    disableAllButtons();
  }
});

function displayArticleInfo(article) {
  document.getElementById('articleTitle').textContent = article.title || 'Untitled Page';
  
  const wordCount = article.textContent ? article.textContent.split(/\s+/).length : 0;
  const readTime = Math.ceil(wordCount / 200); // ~200 wpm at 0.7 speed
  
  document.getElementById('articleMeta').textContent = 
    `~${wordCount.toLocaleString()} words • ~${readTime} min`;
}

function handleBackgroundMessage(message) {
  switch (message.status) {
    case 'progress':
      showStatus('loading', message.message);
      break;
      
    case 'audioFormat':
      audioFormat = {
        sampleRate: message.sampleRate,
        sampleWidth: message.sampleWidth,
        channels: message.channels
      };
      break;
      
    case 'audioChunk':
      handleAudioChunk(message.chunk, message.chunkIndex);
      break;
      
    case 'streamComplete':
      totalChunks = message.totalChunks;
      showStatus('success', `✓ ${message.duration} of audio`);
      document.getElementById('playBtn').disabled = true;
      break;
      
    case 'error':
      showStatus('error', message.message);
      resetPlaybackState();
      break;
  }
}

function handleAudioChunk(base64Chunk, chunkIndex) {
  // Decode base64 to ArrayBuffer
  const binaryString = atob(base64Chunk);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Convert 16-bit PCM to Float32
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  
  // Create AudioBuffer
  const audioBuffer = audioContext.createBuffer(
    audioFormat.channels,
    float32Array.length,
    audioFormat.sampleRate
  );
  audioBuffer.getChannelData(0).set(float32Array);
  
  // Queue for playback
  audioQueue.push(audioBuffer);
  
  // Start playback if this is the first chunk
  if (audioQueue.length === 1 && isPlaying && !isPaused) {
    scheduleNextBuffer();
  }
  
  // Update progress
  updateProgress(chunkIndex);
}

function scheduleNextBuffer() {
  if (audioQueue.length === 0 || isPaused || !isPlaying) return;
  
  const buffer = audioQueue.shift();
  playedChunks++;
  
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  
  // Schedule playback
  const startTime = Math.max(audioContext.currentTime, nextPlayTime);
  source.start(startTime);
  nextPlayTime = startTime + buffer.duration;
  
  currentSource = source;
  
  // Schedule next buffer
  source.onended = () => {
    if (isPlaying && !isPaused) {
      scheduleNextBuffer();
    }
    
    // Check if playback complete
    if (audioQueue.length === 0 && totalChunks > 0 && playedChunks >= totalChunks) {
      playbackComplete();
    }
  };
}

function startPlayback() {
  if (!currentArticle) return;
  
  // Initialize audio context (must be after user gesture)
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 22050 });
  }
  
  // Reset state
  audioQueue = [];
  isPlaying = true;
  isPaused = false;
  totalChunks = 0;
  playedChunks = 0;
  nextPlayTime = 0;
  
  // Update UI
  document.getElementById('playBtn').disabled = true;
  document.getElementById('pauseBtn').disabled = false;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('downloadBtn').disabled = true;
  showStatus('loading', 'Starting playback...');
  showProgress();
  
  // Request streaming from background
  chrome.runtime.sendMessage({
    action: 'stream',
    article: {
      title: currentArticle.title,
      content: currentArticle.textContent,
      url: currentArticle.url
    }
  });
}

function togglePause() {
  if (!isPlaying) return;
  
  const pauseBtn = document.getElementById('pauseBtn');
  
  if (isPaused) {
    // Resume
    isPaused = false;
    pauseBtn.textContent = '⏸️ Pause';
    audioContext.resume();
    scheduleNextBuffer();
  } else {
    // Pause
    isPaused = true;
    pauseBtn.textContent = '▶️ Resume';
    audioContext.suspend();
  }
}

function stopPlayback() {
  isPlaying = false;
  isPaused = false;
  audioQueue = [];
  
  if (currentSource) {
    try { currentSource.stop(); } catch (e) {}
    currentSource = null;
  }
  
  // Tell background to stop
  chrome.runtime.sendMessage({ action: 'stop' });
  
  // Reset UI
  resetPlaybackState();
  showStatus('', '');
  hideProgress();
}

function playbackComplete() {
  isPlaying = false;
  document.getElementById('playBtn').disabled = false;
  document.getElementById('playBtn').textContent = '🔄 Replay';
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('downloadBtn').disabled = false;
}

function resetPlaybackState() {
  isPlaying = false;
  isPaused = false;
  
  document.getElementById('playBtn').disabled = false;
  document.getElementById('playBtn').textContent = '▶️ Play';
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('pauseBtn').textContent = '⏸️ Pause';
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('downloadBtn').disabled = false;
}

async function downloadAudio() {
  if (!currentArticle) return;
  
  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.disabled = true;
  downloadBtn.textContent = '⏳ Saving...';
  showStatus('loading', 'Generating audio file...');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'download',
      article: {
        title: currentArticle.title,
        content: currentArticle.textContent,
        url: currentArticle.url
      }
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    showStatus('success', `✓ Saved to Downloads`);
    document.getElementById('filePath').textContent = response.audioPath;
    document.getElementById('fileInfo').classList.add('visible');
    
  } catch (error) {
    showStatus('error', `Error: ${error.message}`);
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = '💾 Download';
  }
}

function showStatus(type, message) {
  const statusEl = document.getElementById('status');
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
  statusEl.style.display = message ? 'block' : 'none';
}

function showProgress() {
  document.getElementById('progressContainer').style.display = 'block';
}

function hideProgress() {
  document.getElementById('progressContainer').style.display = 'none';
}

function updateProgress(chunkIndex) {
  // Estimate progress (we don't know total until complete)
  const bar = document.getElementById('progressBar');
  // Use logarithmic scale since we don't know the end
  const progress = Math.min(95, (chunkIndex / (chunkIndex + 5)) * 100);
  bar.style.width = `${progress}%`;
}

function disableAllButtons() {
  document.getElementById('playBtn').disabled = true;
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('downloadBtn').disabled = true;
}

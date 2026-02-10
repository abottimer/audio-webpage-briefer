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
let streamingComplete = false;
let backgroundPort = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Connect to background for streaming messages
  backgroundPort = chrome.runtime.connect({ name: 'popup' });
  backgroundPort.onMessage.addListener(handleBackgroundMessage);
  
  // Set up button handlers
  document.getElementById('playBtn').addEventListener('click', handlePlayClick);
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
      showStatus('error', 'Could not extract article');
      disableAllButtons();
    }
  } catch (error) {
    showStatus('error', 'Refresh page and try again');
    disableAllButtons();
  }
});

function displayArticleInfo(article) {
  document.getElementById('articleTitle').textContent = article.title || 'Untitled';
  
  const wordCount = article.textContent ? article.textContent.split(/\s+/).length : 0;
  const readTime = Math.ceil(wordCount / 200);
  
  document.getElementById('articleMeta').textContent = 
    `${wordCount.toLocaleString()} words · ~${readTime} min`;
}

function handleBackgroundMessage(message) {
  switch (message.status) {
    case 'progress':
      showStatus('', message.message);
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
      streamingComplete = true;
      showStatus('', `${message.duration}`);
      // Don't update buttons here — wait for actual playback to finish
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
  
  updateProgress();
}

function scheduleNextBuffer() {
  if (audioQueue.length === 0 || isPaused || !isPlaying) {
    // Check if we're done
    if (audioQueue.length === 0 && streamingComplete && isPlaying) {
      // No more buffers and streaming is done — playback complete
      playbackComplete();
    }
    return;
  }
  
  const buffer = audioQueue.shift();
  
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  
  // Schedule playback
  const startTime = Math.max(audioContext.currentTime, nextPlayTime);
  source.start(startTime);
  nextPlayTime = startTime + buffer.duration;
  
  currentSource = source;
  
  // When this buffer finishes, schedule the next one
  source.onended = () => {
    if (isPlaying && !isPaused) {
      scheduleNextBuffer();
    }
  };
}

function handlePlayClick() {
  const playBtn = document.getElementById('playBtn');
  
  if (playBtn.textContent === '↻') {
    // Replay - reset and start again
    startPlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  if (!currentArticle) return;
  
  // Initialize audio context (must be after user gesture)
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 22050 });
  } else if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  // Reset state
  audioQueue = [];
  isPlaying = true;
  isPaused = false;
  streamingComplete = false;
  nextPlayTime = 0;
  
  // Update UI
  const playBtn = document.getElementById('playBtn');
  playBtn.disabled = true;
  playBtn.textContent = '•••';
  document.getElementById('pauseBtn').disabled = false;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('downloadBtn').disabled = true;
  
  showStatus('', 'Starting...');
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
    pauseBtn.textContent = '⏸';
    audioContext.resume();
    scheduleNextBuffer();
  } else {
    // Pause
    isPaused = true;
    pauseBtn.textContent = '▶';
    audioContext.suspend();
  }
}

function stopPlayback() {
  isPlaying = false;
  isPaused = false;
  streamingComplete = false;
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
  
  const playBtn = document.getElementById('playBtn');
  playBtn.disabled = false;
  playBtn.textContent = '↻';
  playBtn.title = 'Replay';
  
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('pauseBtn').textContent = '⏸';
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('downloadBtn').disabled = false;
  
  showStatus('success', 'Done');
}

function resetPlaybackState() {
  isPlaying = false;
  isPaused = false;
  streamingComplete = false;
  
  const playBtn = document.getElementById('playBtn');
  playBtn.disabled = false;
  playBtn.textContent = '▶';
  playBtn.title = 'Play';
  
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('pauseBtn').textContent = '⏸';
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('downloadBtn').disabled = false;
}

async function downloadAudio() {
  if (!currentArticle) return;
  
  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.disabled = true;
  showStatus('', 'Saving...');
  
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
    
    showStatus('success', 'Saved to Downloads');
    document.getElementById('filePath').textContent = response.audioPath;
    document.getElementById('fileInfo').classList.add('visible');
    
  } catch (error) {
    showStatus('error', error.message);
  } finally {
    downloadBtn.disabled = false;
  }
}

function showStatus(type, message) {
  const statusEl = document.getElementById('status');
  statusEl.className = `status ${type ? type : ''} ${message ? 'visible' : ''}`;
  statusEl.textContent = message;
}

function showProgress() {
  document.getElementById('progressContainer').style.display = 'block';
  document.getElementById('progressBar').style.width = '0%';
}

function hideProgress() {
  document.getElementById('progressContainer').style.display = 'none';
}

function updateProgress() {
  const bar = document.getElementById('progressBar');
  if (streamingComplete) {
    bar.style.width = '100%';
  } else {
    // Pulse animation effect during streaming
    const current = parseFloat(bar.style.width) || 0;
    bar.style.width = `${Math.min(95, current + 2)}%`;
  }
}

function disableAllButtons() {
  document.getElementById('playBtn').disabled = true;
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('downloadBtn').disabled = true;
}

// Audio Webpage Briefer - Popup Script

let selectedMode = 'quick';
let currentArticle = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Set up mode toggle
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMode = btn.dataset.mode;
    });
  });

  // Set up generate button
  document.getElementById('generateBtn').addEventListener('click', generateBriefing);

  // Get current tab and extract article
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Request article content from content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractArticle' });
    if (response && response.article) {
      currentArticle = response.article;
      displayArticleInfo(currentArticle);
    } else {
      showStatus('error', 'Could not extract article from this page');
      document.getElementById('generateBtn').disabled = true;
    }
  } catch (error) {
    showStatus('error', 'Content script not loaded. Try refreshing the page.');
    document.getElementById('generateBtn').disabled = true;
  }
});

function displayArticleInfo(article) {
  const titleEl = document.getElementById('articleTitle');
  const metaEl = document.getElementById('articleMeta');

  titleEl.textContent = article.title || 'Untitled Page';

  const wordCount = article.textContent ? article.textContent.split(/\s+/).length : 0;
  const readTime = Math.ceil(wordCount / 200); // ~200 wpm average reading speed

  metaEl.textContent = `~${wordCount.toLocaleString()} words • ${readTime} min read`;
}

async function generateBriefing() {
  if (!currentArticle) {
    showStatus('error', 'No article content available');
    return;
  }

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Summarizing...';
  showStatus('loading', 'Sending to Claude for summarization...');

  try {
    // Send to native messaging host
    const response = await chrome.runtime.sendMessage({
      action: 'generateBriefing',
      article: {
        title: currentArticle.title,
        content: currentArticle.textContent,
        url: currentArticle.url
      },
      mode: selectedMode
    });

    if (response.error) {
      throw new Error(response.error);
    }

    btn.textContent = '🔊 Generating audio...';
    showStatus('loading', 'Converting summary to speech with Piper...');

    // Wait for audio generation (response should include audio path or data)
    if (response.audioUrl) {
      const audioEl = document.getElementById('audio');
      audioEl.src = response.audioUrl;
      document.getElementById('audioPlayer').classList.add('visible');
      showStatus('success', `✓ Briefing ready! (${response.duration})`);
      audioEl.play();
    } else if (response.audioPath) {
      showStatus('success', `✓ Audio saved to: ${response.audioPath}`);
    }

  } catch (error) {
    showStatus('error', `Error: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '🎙️ Generate Briefing';
  }
}

function showStatus(type, message) {
  const statusEl = document.getElementById('status');
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

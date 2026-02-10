// Audio Webpage Briefer - Popup Script
// V1: Read full article text aloud

let currentArticle = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Set up generate button
  document.getElementById('generateBtn').addEventListener('click', generateAudio);

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
  const readTime = Math.ceil(wordCount / 150); // ~150 wpm at 0.7 speed

  metaEl.textContent = `~${wordCount.toLocaleString()} words • ~${readTime} min audio`;
}

async function generateAudio() {
  if (!currentArticle) {
    showStatus('error', 'No article content available');
    return;
  }

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';
  showStatus('loading', 'Converting text to speech...');

  try {
    // Send to native messaging host
    const response = await chrome.runtime.sendMessage({
      action: 'generateBriefing',
      article: {
        title: currentArticle.title,
        content: currentArticle.textContent,
        url: currentArticle.url
      }
    });

    if (response.error) {
      throw new Error(response.error);
    }

    // Show success
    showStatus('success', '✓ Audio generated!');
    
    const resultEl = document.getElementById('result');
    const durationEl = document.getElementById('resultDuration');
    const pathEl = document.getElementById('resultPath');
    
    durationEl.textContent = `Duration: ${response.duration} • ${response.wordCount?.toLocaleString() || '?'} words`;
    pathEl.textContent = response.audioPath;
    resultEl.classList.add('visible');

  } catch (error) {
    showStatus('error', `Error: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔊 Generate Audio';
  }
}

function showStatus(type, message) {
  const statusEl = document.getElementById('status');
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

// Audio Webpage Briefer - Background Service Worker
// Handles native messaging communication

const NATIVE_HOST = 'com.claudebot.audio_briefer';

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateBriefing') {
    generateAudio(request.article)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function generateAudio(article) {
  return new Promise((resolve, reject) => {
    // Connect to native messaging host
    const port = chrome.runtime.connectNative(NATIVE_HOST);

    port.onMessage.addListener((message) => {
      if (message.status === 'progress') {
        console.log('Progress:', message.message);
      } else if (message.status === 'success') {
        resolve({
          audioPath: message.audioPath,
          duration: message.duration,
          wordCount: message.wordCount
        });
      } else if (message.status === 'error') {
        reject(new Error(message.message));
      }
    });

    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(
          chrome.runtime.lastError.message ||
          'Native host disconnected. Make sure the native messaging host is installed.'
        ));
      }
    });

    // Send article to native host
    port.postMessage({
      action: 'generate',
      article: article,
      config: {
        lengthScale: 0.7  // 30% faster speech
      }
    });
  });
}

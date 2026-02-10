// Audio Webpage Briefer - Background Service Worker
// Handles native messaging communication

const NATIVE_HOST = 'com.claudebot.audio_briefer';

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateBriefing') {
    generateBriefing(request.article, request.mode)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function generateBriefing(article, mode) {
  return new Promise((resolve, reject) => {
    // Connect to native messaging host
    const port = chrome.runtime.connectNative(NATIVE_HOST);

    let responseData = '';

    port.onMessage.addListener((message) => {
      if (message.status === 'progress') {
        // Could emit progress events here
        console.log('Progress:', message.message);
      } else if (message.status === 'success') {
        resolve({
          audioPath: message.audioPath,
          duration: message.duration,
          summary: message.summary
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
      mode: mode, // 'quick' or 'deep'
      config: {
        lengthScale: 0.7, // 30% faster speech
        voice: 'en_US-lessac-medium' // Default voice
      }
    });
  });
}

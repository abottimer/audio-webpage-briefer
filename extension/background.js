// Read to Me - Background Service Worker
// Handles native messaging and audio streaming

const NATIVE_HOST = 'com.claudebot.audio_briefer';

let activePort = null;
let popupPort = null;

// Listen for popup connection
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    popupPort = port;
    port.onDisconnect.addListener(() => {
      popupPort = null;
      // Stop any active generation if popup closes
      if (activePort) {
        activePort.disconnect();
        activePort = null;
      }
    });
  }
});

// Forward messages to popup
function sendToPopup(message) {
  if (popupPort) {
    try {
      popupPort.postMessage(message);
    } catch (e) {
      console.error('Failed to send to popup:', e);
    }
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'stream') {
    streamAudio(request.article);
    sendResponse({ started: true });
    return false;
  }
  
  if (request.action === 'download') {
    downloadAudio(request.article)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (request.action === 'stop') {
    if (activePort) {
      activePort.disconnect();
      activePort = null;
    }
    sendResponse({ stopped: true });
    return false;
  }
});

function streamAudio(article) {
  // Disconnect any existing connection
  if (activePort) {
    activePort.disconnect();
  }
  
  activePort = chrome.runtime.connectNative(NATIVE_HOST);
  
  activePort.onMessage.addListener((message) => {
    // Forward all messages to popup
    sendToPopup(message);
    
    if (message.status === 'streamComplete' || message.status === 'error') {
      activePort = null;
    }
  });
  
  activePort.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      sendToPopup({
        status: 'error',
        message: chrome.runtime.lastError.message || 'Native host disconnected'
      });
    }
    activePort = null;
  });
  
  // Request streaming
  activePort.postMessage({
    action: 'stream',
    article: article,
    config: {
      lengthScale: 0.7
    }
  });
}

async function downloadAudio(article) {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connectNative(NATIVE_HOST);
    
    port.onMessage.addListener((message) => {
      if (message.status === 'progress') {
        sendToPopup(message);
      } else if (message.status === 'downloadComplete') {
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
          'Native host disconnected'
        ));
      }
    });
    
    port.postMessage({
      action: 'download',
      article: article,
      config: {
        lengthScale: 0.7
      }
    });
  });
}

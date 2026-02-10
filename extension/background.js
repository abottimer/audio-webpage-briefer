// Read to Me - Background Service Worker
// Handles native messaging and audio streaming

const NATIVE_HOST = 'com.claudebot.audio_briefer';

let activePort = null;
let popupPort = null;
let streamResponseCallback = null;

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
      // Clean up pending response
      if (streamResponseCallback) {
        streamResponseCallback = null;
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
// Using sendMessage + return true keeps the service worker alive
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'stream') {
    streamAudio(request.article);
    // return true keeps SW alive until sendResponse is called
    streamResponseCallback = sendResponse;
    return true;
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
    // Resolve the pending stream response
    if (streamResponseCallback) {
      streamResponseCallback({ stopped: true });
      streamResponseCallback = null;
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
    // Forward all messages to popup via port
    sendToPopup(message);

    if (message.status === 'streamComplete') {
      activePort = null;
      // Resolve the pending sendResponse to clean up
      if (streamResponseCallback) {
        streamResponseCallback({ status: 'streamComplete' });
        streamResponseCallback = null;
      }
    }

    if (message.status === 'error') {
      activePort = null;
      if (streamResponseCallback) {
        streamResponseCallback({ status: 'error', message: message.message });
        streamResponseCallback = null;
      }
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
    // Resolve pending response so SW can clean up
    if (streamResponseCallback) {
      streamResponseCallback({ status: 'error', message: 'Native host has exited.' });
      streamResponseCallback = null;
    }
  });

  // Request streaming
  activePort.postMessage({
    action: 'stream',
    article: article,
    config: {
      lengthScale: 0.83,
      sentenceSilence: 0.3
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
        lengthScale: 0.83,
        sentenceSilence: 0.3
      }
    });
  });
}

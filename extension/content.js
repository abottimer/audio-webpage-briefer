// Audio Webpage Briefer - Content Script
// Extracts article content using Readability.js

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractArticle') {
    const article = extractArticle();
    sendResponse({ article });
  }
  return true; // Keep message channel open for async response
});

function extractArticle() {
  try {
    // Clone the document to avoid modifying the original
    const documentClone = document.cloneNode(true);

    // Use Readability to extract article content
    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (article) {
      return {
        title: article.title,
        byline: article.byline,
        content: article.content, // HTML content
        textContent: article.textContent, // Plain text
        excerpt: article.excerpt,
        siteName: article.siteName,
        url: window.location.href
      };
    }

    // Fallback: try to get basic content
    return {
      title: document.title,
      textContent: getMainContent(),
      url: window.location.href
    };
  } catch (error) {
    console.error('Article extraction failed:', error);
    return null;
  }
}

// Fallback content extraction
function getMainContent() {
  // Try common article selectors
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim().length > 500) {
      return el.textContent.trim();
    }
  }

  // Last resort: body text
  return document.body.textContent.trim();
}

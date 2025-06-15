// Chatbot Embed Script
(function() {
  'use strict';

  // Get script attributes
  const script = document.currentScript || document.querySelector('script[data-chatbot-id]');
  const chatbotId = script?.getAttribute('data-chatbot-id');
  const token = script?.getAttribute('data-token');
  const domain = script?.getAttribute('data-domain');

  if (!chatbotId) {
    console.error('Chatbot ID is required');
    return;
  }

  // Create iframe container
  const container = document.createElement('div');
  container.id = 'chatbot-widget-container';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 400px;
    height: 600px;
    z-index: 999999;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    background: white;
    border: 1px solid #e2e8f0;
  `;

  // Create iframe
  const iframe = document.createElement('iframe');
  const baseUrl = script.src.replace('/embed/chatbot.js', '');
  
  // Build URL with parameters
  let iframeUrl = `${baseUrl}/chatbot/${chatbotId}?embedded=true`;
  if (token) iframeUrl += `&token=${encodeURIComponent(token)}`;
  if (domain) iframeUrl += `&domain=${encodeURIComponent(domain)}`;

  iframe.src = iframeUrl;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 12px;
  `;
  iframe.allow = 'microphone';

  // Add iframe to container
  container.appendChild(iframe);

  // Add container to page
  document.body.appendChild(container);

  // Handle responsive design
  function updateSize() {
    if (window.innerWidth <= 768) {
      container.style.cssText = `
        position: fixed;
        bottom: 0;
        right: 0;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        z-index: 999999;
        border-radius: 0;
        box-shadow: none;
        overflow: hidden;
        background: white;
        border: none;
      `;
    } else {
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 400px;
        height: 600px;
        z-index: 999999;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        background: white;
        border: 1px solid #e2e8f0;
      `;
    }
  }

  // Initial size update
  updateSize();

  // Listen for window resize
  window.addEventListener('resize', updateSize);

  console.log('Chatbot widget loaded successfully');
})();
document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const chatMessages = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');

  if (!chatForm || !chatMessages || !userInput) {
    console.error('Chat elements not found in DOM');
    return;
  }

  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const message = userInput.value.trim();
    if (!message) return;

    appendMessage('You', message);
    userInput.value = '';

    const loadingId = appendMessage('AI', 'Thinking...', true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      removeMessage(loadingId);

      if (!response.ok) {
        appendMessage('Error', data.error || 'AI request failed.');
        return;
      }

      appendMessage('AI', data.reply || 'No response received.');
    } catch (error) {
      removeMessage(loadingId);
      appendMessage('Error', 'Failed to connect to server.');
      console.error(error);
    }
  });

  function appendMessage(sender, text, isLoading = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender.toLowerCase()}`;

    if (isLoading) {
      messageDiv.id = 'loading-' + Date.now() + '-' +
        Math.random().toString(36).slice(2);
    }

    const strong = document.createElement('strong');
    strong.textContent = sender + ': ';
    messageDiv.appendChild(strong);

    const span = document.createElement('span');
    span.textContent = String(text);
    messageDiv.appendChild(span);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageDiv.id;
  }

  function removeMessage(id) {
    if (!id) return;
    const element = document.getElementById(id);
    if (element) element.remove();
  }
});

"use strict";

const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const chatMessages = document.getElementById("chatMessages");
const errorMessage = document.getElementById("errorMessage");
const sendButton = document.getElementById("sendButton");
const connectionStatus = document.getElementById("connectionStatus");

function addMessage(text, role) {
  const message = document.createElement("div");
  message.className = `message ${role}`;

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "AI Agent";

  const content = document.createElement("div");
  content.textContent = text;

  message.append(label, content);
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = button.dataset.prompt || "";
    messageInput.focus();
  });
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  errorMessage.hidden = true;
  errorMessage.textContent = "";
  addMessage(message, "user");

  messageInput.value = "";
  sendButton.disabled = true;
  connectionStatus.textContent = "Connecting…";

  const loading = document.createElement("div");
  loading.className = "message assistant";
  loading.textContent = "AI Agent is thinking…";
  chatMessages.appendChild(loading);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI request failed.");
    }

    if (typeof data.reply !== "string") {
      throw new Error("AI reply was not received correctly.");
    }

    loading.remove();
    addMessage(data.reply, "assistant");
    connectionStatus.textContent = "Ready";
  } catch (error) {
    loading.remove();
    errorMessage.textContent =
      error.message || "Connection failed. Please try again.";
    errorMessage.hidden = false;
    connectionStatus.textContent = "Connection issue";
  } finally {
    sendButton.disabled = false;
    messageInput.focus();
  }
});￼Enter

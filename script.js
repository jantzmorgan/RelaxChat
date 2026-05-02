document.addEventListener("DOMContentLoaded", function() {
const CHAT_PASSWORD = "relaxguy";
const SERVER_URL = "https://relaxchat.duckdns.org";
const socket = typeof io !== "undefined" ? io(SERVER_URL) : null;

const lockScreen = document.getElementById("lockScreen");
const app = document.getElementById("app");
const passwordInput = document.getElementById("passwordInput");
const unlockBtn = document.getElementById("unlockBtn");
const lockError = document.getElementById("lockError");

const clearBtn = document.getElementById("clearBtn");
const sendBtn = document.getElementById("sendBtn");
const chatNameInput = document.getElementById("chatNameInput");
const chatStatus = document.getElementById("chatStatus");
const messagesBox = document.getElementById("messages");
const displayNameInput = document.getElementById("displayNameInput");
const messageInput = document.getElementById("messageInput");

let messages = [];

function unlockChat() {
	const typedPassword = passwordInput.value.trim();

	if (typedPassword === CHAT_PASSWORD) {
		lockScreen.style.display = "none";
		app.style.display = "grid";
		localStorage.setItem("relaxChatUnlocked", "true");
		messageInput.focus();
	} else {
		lockError.textContent = "Wrong password, buddy.";
		passwordInput.value = "";
		passwordInput.focus();
	}
}

unlockBtn.addEventListener("click", unlockChat);

passwordInput.addEventListener("keydown", function(event) {
	if (event.key === "Enter") {
		unlockChat();
	}
});

function saveSettings() {
	localStorage.setItem("relaxChatName", displayNameInput.value);
	localStorage.setItem("relaxChatTitle", chatNameInput.value);
}

function loadSettings() {
	displayNameInput.value = localStorage.getItem("relaxChatName") || "";
	chatNameInput.value = localStorage.getItem("relaxChatTitle") || "RelaxChat";
}

function renderMessages() {
	messagesBox.innerHTML = "";

	if (messages.length === 0) {
		messagesBox.innerHTML = `
      <div class="welcomeMessage">
        <h2>${chatNameInput.value || "RelaxChat"}</h2>
        <p>No messages yet. Start the chat.</p>
      </div>
    `;
		return;
	}

	messages.forEach(function(message) {
		const messageDiv = document.createElement("div");
		messageDiv.classList.add("message");

		messageDiv.innerHTML = `
      <div class="messageTop">
        <span class="name">${message.name}</span>
        <span class="time">${message.time}</span>
      </div>
      <div class="text">${message.text}</div>
    `;

		messagesBox.appendChild(messageDiv);
	});

	messagesBox.scrollTop = messagesBox.scrollHeight;
}

function sendMessage() {
	const name = displayNameInput.value.trim() || "Anonymous";
	const text = messageInput.value.trim();

	if (text === "") return;

	if (!socket) {
		alert("RelaxChat is not connected to the server.");
		return;
	}

	socket.emit("sendMessage", {
		name: name,
		text: text,
		channel: "general"
	});

	messageInput.value = "";
	saveSettings();
}

function clearMessages() {
	if (!socket) return;

	const answer = confirm("Clear all messages?");
	if (!answer) return;

	socket.emit("clearChannel", "general");
}

if (socket) {
	socket.on("connect", function() {
		chatStatus.textContent = "Connected";
		console.log("Connected to RelaxChat server");
	});

	socket.on("loadMessages", function(serverMessages) {
		messages = serverMessages.general || [];
		renderMessages();
	});

	socket.on("newMessage", function(message) {
		if (message.channel !== "general") return;

		messages.push(message);
		renderMessages();
	});

	socket.on("channelCleared", function(channel) {
		if (channel !== "general") return;

		messages = [];
		renderMessages();
	});

	socket.on("connect_error", function(error) {
		console.log("Connection error:", error);
		chatStatus.textContent = "Could not connect";
	});
} else {
	chatStatus.textContent = "Socket.IO did not load";
}

sendBtn.addEventListener("click", sendMessage);
clearBtn.addEventListener("click", clearMessages);

messageInput.addEventListener("keydown", function(event) {
	if (event.key === "Enter") {
		sendMessage();
	}
});

displayNameInput.addEventListener("input", saveSettings);

chatNameInput.addEventListener("input", function() {
	saveSettings();
	renderMessages();
});

loadSettings();
renderMessages();

if (localStorage.getItem("relaxChatUnlocked") === "true") {
	lockScreen.style.display = "none";
	app.style.display = "grid";
}
});
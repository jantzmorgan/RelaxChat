const SERVER_URL = "http://18.218.108.184:3000";
const socket = io(SERVER_URL);

const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const messageInput = document.getElementById("messageInput");
const displayNameInput = document.getElementById("displayNameInput");
const serverNameInput = document.getElementById("serverNameInput");
const messagesBox = document.getElementById("messages");
const chatTitle = document.getElementById("chatTitle");
const chatSubtitle = document.getElementById("chatSubtitle");

const channelButtons = document.querySelectorAll(".channel");
const serverButtons = document.querySelectorAll(".serverButton");

const defaultMessages = {
	general: [],
	gaming: [],
	clips: [],
	random: []
};

let currentChannel = localStorage.getItem("relaxChatCurrentChannel") || "general";
let allMessages = defaultMessages;

function saveSettings() {
	localStorage.setItem("relaxChatName", displayNameInput.value);
	localStorage.setItem("relaxChatServerName", serverNameInput.value);
	localStorage.setItem("relaxChatCurrentChannel", currentChannel);
}

function loadSettings() {
	displayNameInput.value = localStorage.getItem("relaxChatName") || "";
	serverNameInput.value = localStorage.getItem("relaxChatServerName") || "RelaxChat Server";
}

function updateActiveButtons() {
	channelButtons.forEach(function(button) {
		button.classList.toggle("active", button.dataset.channel === currentChannel);
	});

	serverButtons.forEach(function(button) {
		button.classList.toggle("active", button.dataset.channel === currentChannel);
	});
}

function getChannelSubtitle() {
	if (currentChannel === "general") return "Main hangout for everybody.";
	if (currentChannel === "gaming") return "Games, party chat, clips, and trash talk.";
	if (currentChannel === "clips") return "Drop videos, links, screenshots, and funny stuff.";
	if (currentChannel === "random") return "Anything goes. Relax guy.";
	return "Welcome to RelaxChat.";
}

function renderMessages() {
	messagesBox.innerHTML = "";

	chatTitle.textContent = "# " + currentChannel;
	chatSubtitle.textContent = getChannelSubtitle();
	messageInput.placeholder = "Message #" + currentChannel;

	const channelMessages = allMessages[currentChannel] || [];

	if (channelMessages.length === 0) {
		messagesBox.innerHTML = `
      <div class="welcomeMessage">
        <h2>Welcome to #${currentChannel}</h2>
        <p>${getChannelSubtitle()}</p>
      </div>
    `;
		return;
	}

	channelMessages.forEach(function(message) {
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

	if (text === "") {
		messageInput.focus();
		return;
	}

	socket.emit("sendMessage", {
		name: name,
		text: text,
		channel: currentChannel
	});

	messageInput.value = "";
	saveSettings();
	messageInput.focus();
}

function changeChannel(channelName) {
	currentChannel = channelName;
	saveSettings();
	updateActiveButtons();
	renderMessages();
}

function clearCurrentChannel() {
	const answer = confirm("Clear all messages in #" + currentChannel + "?");

	if (answer === false) return;

	socket.emit("clearChannel", currentChannel);
}

socket.on("loadMessages", function(serverMessages) {
	allMessages = serverMessages;
	renderMessages();
});

socket.on("newMessage", function(message) {
	if (!allMessages[message.channel]) {
		allMessages[message.channel] = [];
	}

	allMessages[message.channel].push(message);
	renderMessages();
});

socket.on("channelCleared", function(channel) {
	allMessages[channel] = [];
	renderMessages();
});

socket.on("connect", function() {
	console.log("Connected to RelaxChat server");
});

socket.on("connect_error", function(error) {
	console.log("Connection error:", error);
});

channelButtons.forEach(function(button) {
	button.addEventListener("click", function() {
		changeChannel(button.dataset.channel);
	});
});

serverButtons.forEach(function(button) {
	button.addEventListener("click", function() {
		changeChannel(button.dataset.channel);
	});
});

sendBtn.addEventListener("click", sendMessage);
clearBtn.addEventListener("click", clearCurrentChannel);

messageInput.addEventListener("keydown", function(event) {
	if (event.key === "Enter") {
		sendMessage();
	}
});

displayNameInput.addEventListener("input", saveSettings);
serverNameInput.addEventListener("input", saveSettings);

loadSettings();
updateActiveButtons();
renderMessages();
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

	const voiceBtn = document.getElementById("voiceBtn");
	const muteBtn = document.getElementById("muteBtn");
	const voiceStatus = document.getElementById("voiceStatus");
	const voiceUsersBox = document.getElementById("voiceUsers");
	const remoteAudioBox = document.getElementById("remoteAudioBox");

	let messages = [];
	let localStream = null;
	let inVoice = false;
	let isMuted = false;
	let peerConnections = {};

	const rtcConfig = {
		iceServers: [
			{ urls: "stun:stun.l.google.com:19302" },
			{ urls: "stun:stun1.l.google.com:19302" }
		]
	};

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

	function renderVoiceUsers(users) {
		voiceUsersBox.innerHTML = "";

		if (!users || users.length === 0) {
			voiceUsersBox.innerHTML = `<span class="voiceUser">Nobody in voice</span>`;
			return;
		}

		users.forEach(function(user) {
			const pill = document.createElement("span");
			pill.classList.add("voiceUser");
			pill.textContent = "🎧 " + user.name;
			voiceUsersBox.appendChild(pill);
		});
	}

	async function joinVoice() {
		if (!socket) {
			alert("RelaxChat is not connected to the server.");
			return;
		}

		try {
			localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

			inVoice = true;
			isMuted = false;

			voiceStatus.textContent = "In voice";
			voiceBtn.classList.add("active");
			muteBtn.classList.remove("hidden");
			muteBtn.classList.remove("muted");

			const name = displayNameInput.value.trim() || "Anonymous";
			socket.emit("joinVoice", name);
		} catch (error) {
			console.log("Mic error:", error);
			alert("Microphone permission was blocked or failed.");
		}
	}

	function leaveVoice() {
		if (!socket) return;

		Object.keys(peerConnections).forEach(function(id) {
			peerConnections[id].close();
		});

		peerConnections = {};

		if (localStream) {
			localStream.getTracks().forEach(function(track) {
				track.stop();
			});
		}

		localStream = null;
		inVoice = false;
		isMuted = false;

		voiceStatus.textContent = "Not in voice";
		voiceBtn.classList.remove("active");
		muteBtn.classList.add("hidden");
		muteBtn.classList.remove("muted");
		remoteAudioBox.innerHTML = "";

		socket.emit("leaveVoice");
	}

	function toggleMute() {
		if (!localStream) return;

		isMuted = !isMuted;

		localStream.getAudioTracks().forEach(function(track) {
			track.enabled = !isMuted;
		});

		if (isMuted) {
			muteBtn.classList.add("muted");
			voiceStatus.textContent = "Muted";
		} else {
			muteBtn.classList.remove("muted");
			voiceStatus.textContent = "In voice";
		}
	}

	function createPeerConnection(peerId) {
		const peer = new RTCPeerConnection(rtcConfig);

		peerConnections[peerId] = peer;

		if (localStream) {
			localStream.getTracks().forEach(function(track) {
				peer.addTrack(track, localStream);
			});
		}

		peer.onicecandidate = function(event) {
			if (event.candidate) {
				socket.emit("iceCandidate", {
					to: peerId,
					candidate: event.candidate
				});
			}
		};

		peer.ontrack = function(event) {
			let audio = document.getElementById("audio-" + peerId);

			if (!audio) {
				audio = document.createElement("audio");
				audio.id = "audio-" + peerId;
				audio.autoplay = true;
				audio.playsInline = true;
				remoteAudioBox.appendChild(audio);
			}

			audio.srcObject = event.streams[0];
		};

		peer.onconnectionstatechange = function() {
			if (
				peer.connectionState === "disconnected" ||
				peer.connectionState === "failed" ||
				peer.connectionState === "closed"
			) {
				removePeer(peerId);
			}
		};

		return peer;
	}

	function removePeer(peerId) {
		if (peerConnections[peerId]) {
			peerConnections[peerId].close();
			delete peerConnections[peerId];
		}

		const audio = document.getElementById("audio-" + peerId);
		if (audio) {
			audio.remove();
		}
	}

	async function callPeer(peerId) {
		if (!inVoice || !localStream) return;
		if (peerConnections[peerId]) return;

		const peer = createPeerConnection(peerId);
		const offer = await peer.createOffer();

		await peer.setLocalDescription(offer);

		socket.emit("voiceOffer", {
			to: peerId,
			offer: offer
		});
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

		socket.on("voiceUsers", function(users) {
			renderVoiceUsers(users);

			if (!inVoice) return;

			users.forEach(function(user) {
				if (user.id !== socket.id) {
					callPeer(user.id);
				}
			});
		});

		socket.on("voiceUserJoined", function(user) {
			if (!inVoice) return;
			if (user.id === socket.id) return;

			callPeer(user.id);
		});

		socket.on("voiceUserLeft", function(peerId) {
			removePeer(peerId);
		});

		socket.on("voiceOffer", async function(data) {
			if (!inVoice) return;

			const peer = createPeerConnection(data.from);

			await peer.setRemoteDescription(new RTCSessionDescription(data.offer));

			const answer = await peer.createAnswer();
			await peer.setLocalDescription(answer);

			socket.emit("voiceAnswer", {
				to: data.from,
				answer: answer
			});
		});

		socket.on("voiceAnswer", async function(data) {
			const peer = peerConnections[data.from];
			if (!peer) return;

			await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
		});

		socket.on("iceCandidate", async function(data) {
			const peer = peerConnections[data.from];
			if (!peer) return;

			try {
				await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
			} catch (error) {
				console.log("ICE error:", error);
			}
		});
	} else {
		chatStatus.textContent = "Socket.IO did not load";
	}

	sendBtn.addEventListener("click", sendMessage);
	clearBtn.addEventListener("click", clearMessages);
	voiceBtn.addEventListener("click", function() {
		if (inVoice) {
			leaveVoice();
		} else {
			joinVoice();
		}
	});

	muteBtn.addEventListener("click", toggleMute);

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
document.addEventListener("DOMContentLoaded", function() {
	const CHAT_PASSWORD = "relaxguy";
	const SERVER_URL = "https://relaxchat.duckdns.org";

	const TURN_SECRET = "relaxchatsecret";
	const TURN_URLS = [
		"stun:stun.l.google.com:19302",
		"stun:stun1.l.google.com:19302",
		"turn:relaxchat.duckdns.org:3478?transport=udp",
		"turn:relaxchat.duckdns.org:3478?transport=tcp"
	];

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
	const audioUnlockBtn = document.getElementById("audioUnlockBtn");

	let messages = [];
	let localStream = null;
	let inVoice = false;
	let isMuted = false;
	let peerConnections = {};
	let audioContext = null;
	let analyser = null;
	let speakingLoop = null;

	async function makeTurnCredential() {
		const unixTime = Math.floor(Date.now() / 1000) + 3600;
		const username = String(unixTime);

		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(TURN_SECRET), { name: "HMAC", hash: "SHA-1" },
			false,
			["sign"]
		);

		const signature = await crypto.subtle.sign(
			"HMAC",
			key,
			encoder.encode(username)
		);

		const bytes = new Uint8Array(signature);
		let binary = "";

		bytes.forEach(function(byte) {
			binary += String.fromCharCode(byte);
		});

		return {
			username: username,
			credential: btoa(binary)
		};
	}

	async function getRtcConfig() {
		const turn = await makeTurnCredential();

		return {
			iceServers: [
				{ urls: TURN_URLS[0] },
				{ urls: TURN_URLS[1] },
				{
					urls: [TURN_URLS[2], TURN_URLS[3]],
					username: turn.username,
					credential: turn.credential
				}
			],
			iceTransportPolicy: "relay"
		};
	}

	function unlockChat() {
		if (passwordInput.value.trim() === CHAT_PASSWORD) {
			lockScreen.style.display = "none";
			app.style.display = "grid";
			localStorage.setItem("relaxChatUnlocked", "true");
		} else {
			lockError.textContent = "Wrong password, buddy.";
			passwordInput.value = "";
			passwordInput.focus();
		}
	}

	unlockBtn.addEventListener("click", unlockChat);

	passwordInput.addEventListener("keydown", function(event) {
		if (event.key === "Enter") unlockChat();
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
		if (!socket) return alert("RelaxChat is not connected.");

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
		if (!confirm("Clear all messages?")) return;
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

	function startSpeakingDetection(stream) {
		if (audioContext) audioContext.close();

		audioContext = new AudioContext();
		analyser = audioContext.createAnalyser();

		const source = audioContext.createMediaStreamSource(stream);
		source.connect(analyser);

		analyser.fftSize = 512;

		const dataArray = new Uint8Array(analyser.frequencyBinCount);

		function checkVolume() {
			analyser.getByteFrequencyData(dataArray);

			let total = 0;

			dataArray.forEach(function(value) {
				total += value;
			});

			const average = total / dataArray.length;

			if (average > 18 && !isMuted) {
				voiceBtn.classList.add("speaking");
			} else {
				voiceBtn.classList.remove("speaking");
			}

			speakingLoop = requestAnimationFrame(checkVolume);
		}

		checkVolume();
	}

	async function unlockRemoteAudio() {
		const audioElements = remoteAudioBox.querySelectorAll("audio");

		for (const audio of audioElements) {
			audio.muted = false;
			audio.volume = 1;

			try {
				await audio.play();
			} catch (error) {
				console.log("Audio unlock failed:", error);
			}
		}

		voiceStatus.textContent = "Audio ready";
	}

	async function joinVoice() {
		if (!socket) return alert("RelaxChat is not connected.");

		try {
			await unlockRemoteAudio();

			localStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});

			startSpeakingDetection(localStream);

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
		Object.keys(peerConnections).forEach(removePeer);
		peerConnections = {};

		if (speakingLoop) {
			cancelAnimationFrame(speakingLoop);
			speakingLoop = null;
		}

		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}

		voiceBtn.classList.remove("speaking");

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

		if (socket) socket.emit("leaveVoice");
	}

	function toggleMute() {
		if (!localStream) return;

		isMuted = !isMuted;

		localStream.getAudioTracks().forEach(function(track) {
			track.enabled = !isMuted;
		});

		muteBtn.classList.toggle("muted", isMuted);
		voiceStatus.textContent = isMuted ? "Muted" : "In voice";
	}

	async function createPeerConnection(peerId) {
		const rtcConfig = await getRtcConfig();
		const peer = new RTCPeerConnection(rtcConfig);

		peerConnections[peerId] = peer;

		localStream.getTracks().forEach(function(track) {
			peer.addTrack(track, localStream);
		});

		peer.onicecandidate = function(event) {
			if (event.candidate) {
				socket.emit("iceCandidate", {
					to: peerId,
					candidate: event.candidate
				});
			}
		};

		peer.ontrack = function(event) {
			console.log("Remote audio track received from", peerId);

			let audio = document.getElementById("audio-" + peerId);

			if (!audio) {
				audio = document.createElement("audio");
				audio.id = "audio-" + peerId;
				audio.autoplay = true;
				audio.playsInline = true;
				audio.controls = true;
				audio.muted = false;
				audio.volume = 1;
				remoteAudioBox.appendChild(audio);
			}

			audio.srcObject = event.streams[0];

			audio.play().then(function() {
				voiceStatus.textContent = "Voice audio playing";
			}).catch(function(error) {
				console.log("Audio play blocked:", error);
				voiceStatus.textContent = "Press play on audio box";
			});
		};

		peer.onconnectionstatechange = function() {
			console.log("Voice state with", peerId, peer.connectionState);

			if (peer.connectionState === "connected") {
				voiceStatus.textContent = "Voice connected";
			}

			if (peer.connectionState === "failed") {
				voiceStatus.textContent = "Voice failed";
			}
		};

		peer.oniceconnectionstatechange = function() {
			console.log("ICE state with", peerId, peer.iceConnectionState);

			if (
				peer.iceConnectionState === "connected" ||
				peer.iceConnectionState === "completed"
			) {
				voiceStatus.textContent = "Voice connected";
			}

			if (peer.iceConnectionState === "failed") {
				voiceStatus.textContent = "TURN failed";
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
		if (audio) audio.remove();
	}

	async function callPeer(peerId) {
		if (!inVoice || !localStream) return;
		if (peerConnections[peerId]) return;

		const peer = await createPeerConnection(peerId);
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

			if (!inVoice || !localStream) return;

			users.forEach(function(user) {
				if (user.id === socket.id) return;
				if (peerConnections[user.id]) return;

				if (socket.id > user.id) {
					callPeer(user.id);
				}
			});
		});

		socket.on("voiceUserJoined", function(user) {
			if (!inVoice || !localStream) return;
			if (user.id === socket.id) return;
			if (peerConnections[user.id]) return;

			if (socket.id > user.id) {
				callPeer(user.id);
			}
		});

		socket.on("voiceUserLeft", function(peerId) {
			removePeer(peerId);
		});

		socket.on("voiceOffer", async function(data) {
			if (!inVoice || !localStream) return;

			if (peerConnections[data.from]) {
				removePeer(data.from);
			}

			const peer = await createPeerConnection(data.from);

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
	audioUnlockBtn.addEventListener("click", unlockRemoteAudio);

	messageInput.addEventListener("keydown", function(event) {
		if (event.key === "Enter") sendMessage();
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
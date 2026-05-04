document.addEventListener("DOMContentLoaded", function() {
	const SERVER_URL = "https://relaxchat.duckdns.org";

	const TURN_SECRET = "relaxchatsecret";
	const TURN_URLS = [
		"stun:stun.l.google.com:19302",
		"stun:stun1.l.google.com:19302",
		"turn:relaxchat.duckdns.org:3478?transport=udp",
		"turn:relaxchat.duckdns.org:3478?transport=tcp"
	];

	const socket = typeof io !== "undefined" ? io(SERVER_URL) : null;

	const authScreen = document.getElementById("authScreen");
	const startScreen = document.getElementById("startScreen");
	const app = document.getElementById("app");

	const authUsernameInput = document.getElementById("authUsernameInput");
	const authPasswordInput = document.getElementById("authPasswordInput");
	const loginBtn = document.getElementById("loginBtn");
	const signupBtn = document.getElementById("signupBtn");
	const authError = document.getElementById("authError");

	const welcomeUserText = document.getElementById("welcomeUserText");
	const startSessionBtn = document.getElementById("startSessionBtn");
	const logoutBtn = document.getElementById("logoutBtn");
	const startError = document.getElementById("startError");

	const clearBtn = document.getElementById("clearBtn");
	const sendBtn = document.getElementById("sendBtn");
	const chatNameInput = document.getElementById("chatNameInput");
	const chatStatus = document.getElementById("chatStatus");
	const messagesBox = document.getElementById("messages");
	const displayNameInput = document.getElementById("displayNameInput");
	const messageInput = document.getElementById("messageInput");
	const typingIndicator = document.getElementById("typingIndicator");
	const reactionPopup = document.getElementById("reactionPopup");

	const voiceBtn = document.getElementById("voiceBtn");
	const muteBtn = document.getElementById("muteBtn");
	const audioUnlockBtn = document.getElementById("audioUnlockBtn");
	const voiceStatus = document.getElementById("voiceStatus");
	const voiceUsersBox = document.getElementById("voiceUsers");
	const remoteAudioBox = document.getElementById("remoteAudioBox");

	const soundUploadInput = document.getElementById("soundUploadInput");
	const soundList = document.getElementById("soundList");
	const soundVolumeSlider = document.getElementById("soundVolumeSlider");
	const soundVolumeText = document.getElementById("soundVolumeText");
	const soundboardToggleBtn = document.getElementById("soundboardToggleBtn");
	const soundboardDrawer = document.getElementById("soundboardDrawer");
	const closeSoundboardBtn = document.getElementById("closeSoundboardBtn");
	const enableSoundboardBtn = document.getElementById("enableSoundboardBtn");

	const settingsBtn = document.getElementById("settingsBtn");
	const settingsDrawer = document.getElementById("settingsDrawer");
	const closeSettingsBtn = document.getElementById("closeSettingsBtn");

	const roomsBtn = document.getElementById("roomsBtn");
	const roomsDrawer = document.getElementById("roomsDrawer");
	const closeRoomsBtn = document.getElementById("closeRoomsBtn");
	const roomsList = document.getElementById("roomsList");
	const newRoomName = document.getElementById("newRoomName");
	const newRoomPassword = document.getElementById("newRoomPassword");
	const createRoomBtn = document.getElementById("createRoomBtn");
	const joinRoomId = document.getElementById("joinRoomId");
	const joinRoomPassword = document.getElementById("joinRoomPassword");
	const joinRoomBtn = document.getElementById("joinRoomBtn");

	const logoutBtnMain = document.getElementById("logoutBtnMain");
	const setBgBtn = document.getElementById("setBgBtn");
	const bgUpload = document.getElementById("bgUpload");

	let authToken = localStorage.getItem("relaxChatToken") || "";
	let currentUser = null;

	let currentRoom = "general";
	let messages = [];
	let allMessages = {};
	let sounds = [];
	let allSounds = [];

	let activeReactionMessageId = null;
	let typingTimer = null;
	let typingHideTimer = null;
	let isTyping = false;

	let longPressTimer = null;
	let pressedMessageDiv = null;
	let pressStartX = 0;
	let pressStartY = 0;

	let localStream = null;
	let inVoice = false;
	let isMuted = false;
	let peerConnections = {};
	let audioContext = null;
	let analyser = null;
	let speakingLoop = null;

	let soundVolume = 0.8;
	let soundAudioContext = null;
	let soundBufferCache = {};

	async function apiPost(path, data) {
		const response = await fetch(SERVER_URL + path, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(data)
		});

		return await response.json();
	}

	async function verifySavedLogin() {
		if (!authToken) {
			showAuthScreen();
			return;
		}

		try {
			const result = await apiPost("/verify", {
				token: authToken
			});

			if (result.success) {
				currentUser = result.user;
				showStartScreen();
			} else {
				localStorage.removeItem("relaxChatToken");
				authToken = "";
				showAuthScreen();
			}
		} catch (error) {
			console.log("Verify error:", error);
			showAuthScreen();
		}
	}

	async function login() {
		authError.textContent = "";

		const username = authUsernameInput.value.trim();
		const password = authPasswordInput.value;

		if (!username || !password) {
			authError.textContent = "Enter username and password.";
			return;
		}

		const result = await apiPost("/login", {
			username: username,
			password: password
		});

		if (!result.success) {
			authError.textContent = result.message || "Login failed.";
			return;
		}

		authToken = result.token;
		currentUser = result.user;
		localStorage.setItem("relaxChatToken", authToken);

		showStartScreen();
	}

	async function signup() {
		authError.textContent = "";

		const username = authUsernameInput.value.trim();
		const password = authPasswordInput.value;

		if (!username || !password) {
			authError.textContent = "Enter username and password.";
			return;
		}

		const result = await apiPost("/signup", {
			username: username,
			password: password
		});

		if (!result.success) {
			authError.textContent = result.message || "Signup failed.";
			return;
		}

		authToken = result.token;
		currentUser = result.user;
		localStorage.setItem("relaxChatToken", authToken);

		showStartScreen();
	}

	function logout() {
		localStorage.removeItem("relaxChatToken");
		authToken = "";
		currentUser = null;

		if (inVoice) {
			leaveVoice();
		}

		app.style.display = "none";
		startScreen.style.display = "none";
		authScreen.style.display = "flex";
	}

	function showAuthScreen() {
		authScreen.style.display = "flex";
		startScreen.style.display = "none";
		app.style.display = "none";
	}

	function showStartScreen() {
		authScreen.style.display = "none";
		startScreen.style.display = "flex";
		app.style.display = "none";

		welcomeUserText.textContent = "Ready to enter, " + currentUser.username + "?";
	}

	async function startSession() {
		startError.textContent = "";

		authScreen.style.display = "none";
		startScreen.style.display = "none";
		app.style.display = "grid";

		displayNameInput.value = currentUser.username;
		displayNameInput.disabled = true;

		await unlockRemoteAudio();
		await enableSoundboardAudio();
		await loadRooms();
	}

	function getMyName() {
		if (currentUser) return currentUser.username;
		return displayNameInput.value.trim() || "Anonymous";
	}

	function getMyUserId() {
		if (currentUser) return currentUser.id;
		return null;
	}

	function saveSettings() {
		localStorage.setItem("relaxChatTitle", chatNameInput.value);
		localStorage.setItem("relaxChatSoundVolume", String(soundVolumeSlider.value));
	}

	function loadSettings() {
		currentRoom = localStorage.getItem("relaxChatCurrentRoom") || "general";
		chatNameInput.value = localStorage.getItem("relaxChatCurrentRoomName") || "RelaxChat";

		const savedVolume = localStorage.getItem("relaxChatSoundVolume") || "80";
		soundVolumeSlider.value = savedVolume;
		soundVolume = Number(savedVolume) / 100;
		soundVolumeText.textContent = savedVolume + "%";
	}

	function getBackgroundKey() {
		return "relaxChatBackground_" + currentRoom;
	}

	function applySavedBackground() {
		const savedBackground = localStorage.getItem(getBackgroundKey());

		if (savedBackground) {
			messagesBox.style.backgroundImage = "url(" + savedBackground + ")";
		} else {
			messagesBox.style.backgroundImage = "";
		}
	}

	function chooseBackgroundImage() {
		bgUpload.click();
	}

	function setBackgroundImage() {
		const file = bgUpload.files[0];

		if (!file) return;

		const reader = new FileReader();

		reader.onload = function(event) {
			const imageData = event.target.result;

			localStorage.setItem(getBackgroundKey(), imageData);
			messagesBox.style.backgroundImage = "url(" + imageData + ")";
		};

		reader.readAsDataURL(file);
	}

	async function loadRooms() {
		const result = await apiPost("/rooms", {
			token: authToken
		});

		if (!result.success) return;

		roomsList.innerHTML = "";

		result.rooms.forEach(function(room) {
			const roomWrap = document.createElement("div");
			roomWrap.classList.add("soundItem");

			const roomBtn = document.createElement("button");
			roomBtn.classList.add("soundBtn");

			if (room.id === currentRoom) {
				roomBtn.classList.add("active");
			}

			roomBtn.textContent = room.name;

			roomBtn.addEventListener("click", function() {
				switchRoom(room.id, room.name);
			});

			roomWrap.appendChild(roomBtn);

			const isCreator = currentUser && room.ownerId === currentUser.id;
			const isNotGeneral = room.id !== "general";

			if (isCreator && isNotGeneral) {
				const deleteBtn = document.createElement("button");
				deleteBtn.classList.add("soundBtn", "deleteSoundBtn");
				deleteBtn.textContent = "✕";

				deleteBtn.addEventListener("click", function(event) {
					event.stopPropagation();
					deleteRoom(room.id, room.name);
				});

				roomWrap.appendChild(deleteBtn);
			}

			roomsList.appendChild(roomWrap);
		});
	}

	async function createRoom() {
		const name = newRoomName.value.trim();
		const password = newRoomPassword.value.trim();

		if (!name || !password) {
			alert("Room name and password required.");
			return;
		}

		const result = await apiPost("/createRoom", {
			token: authToken,
			name: name,
			password: password
		});

		if (!result.success) {
			alert(result.message || "Could not create room.");
			return;
		}

		newRoomName.value = "";
		newRoomPassword.value = "";

		await loadRooms();
		switchRoom(result.room.id, result.room.name);
	}

	async function deleteRoom(roomId, roomName) {
		if (!confirm("Are you sure you want to delete this room? This will delete all messages and sounds inside it.")) {
			return;
		}

		const result = await apiPost("/deleteRoom", {
			token: authToken,
			roomId: roomId
		});

		if (!result.success) {
			alert(result.message || "Could not delete room.");
			return;
		}

		if (currentRoom === roomId) {
			switchRoom("general", "RelaxChat");
		}

		await loadRooms();
	}

	async function joinRoom() {
		const roomId = joinRoomId.value.trim();
		const password = joinRoomPassword.value.trim();

		if (!roomId || !password) {
			alert("Room ID and password required.");
			return;
		}

		const result = await apiPost("/joinRoom", {
			token: authToken,
			name: roomId,
			password: password
		});

		if (!result.success) {
			alert(result.message || "Could not join room.");
			return;
		}

		joinRoomId.value = "";
		joinRoomPassword.value = "";

		await loadRooms();
		switchRoom(result.room.id, result.room.name);
	}

	function switchRoom(roomId, roomName) {
		if (inVoice) {
			leaveVoice();
		}

		currentRoom = roomId;

		localStorage.setItem("relaxChatCurrentRoom", roomId);
		localStorage.setItem("relaxChatCurrentRoomName", roomName);

		chatNameInput.value = roomName;
		applySavedBackground();

		messages = allMessages[currentRoom] || [];
		sounds = allSounds.filter(function(sound) {
			return sound.roomId === currentRoom;
		});

		if (socket) {
			socket.emit("setRoom", currentRoom);
		}

		renderMessages();
		renderSounds();
		renderVoiceUsers([]);

		roomsDrawer.classList.add("hidden");
	}

	async function makeTurnCredential() {
		const unixTime = Math.floor(Date.now() / 1000) + 3600;
		const username = String(unixTime);
		const encoder = new TextEncoder();

		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(TURN_SECRET), {
				name: "HMAC",
				hash: "SHA-1"
			},
			false,
			["sign"]
		);

		const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(username));
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
			iceServers: [{
					urls: TURN_URLS[0]
				},
				{
					urls: TURN_URLS[1]
				},
				{
					urls: [TURN_URLS[2], TURN_URLS[3]],
					username: turn.username,
					credential: turn.credential
				}
			],
			iceTransportPolicy: "relay"
		};
	}

	function escapeHtml(value) {
		return String(value || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function renderReactionPills(messageDiv, reactions) {
		const oldReactionBox = messageDiv.querySelector(".message-reactions");

		if (oldReactionBox) {
			oldReactionBox.remove();
		}

		const reactionKeys = Object.keys(reactions || {}).filter(function(emoji) {
			return Number(reactions[emoji]) > 0;
		});

		if (reactionKeys.length === 0) return;

		const reactionBox = document.createElement("div");
		reactionBox.classList.add("message-reactions");

		reactionKeys.forEach(function(emoji) {
			const pill = document.createElement("span");
			pill.classList.add("message-reaction-pill");

			pill.innerHTML =
				escapeHtml(emoji) +
				`<span class="message-reaction-count">${Number(reactions[emoji])}</span>`;

			reactionBox.appendChild(pill);
		});

		messageDiv.appendChild(reactionBox);
	}

	function openReactionPopup(messageDiv) {
		if (!reactionPopup || !messageDiv) return;

		activeReactionMessageId = messageDiv.dataset.messageId;

		const rect = messageDiv.getBoundingClientRect();

		reactionPopup.classList.remove("hidden");
		reactionPopup.setAttribute("aria-hidden", "false");

		const popupWidth = reactionPopup.offsetWidth || 240;
		const popupHeight = reactionPopup.offsetHeight || 54;

		const left = Math.max(10, Math.min(rect.left, window.innerWidth - popupWidth - 10));

		let top = rect.top - popupHeight - 8;

		if (top < 10) {
			top = rect.bottom + 8;
		}

		reactionPopup.style.left = left + "px";
		reactionPopup.style.top = top + "px";
	}

	function closeReactionPopup() {
		if (!reactionPopup) return;

		reactionPopup.classList.add("hidden");
		reactionPopup.setAttribute("aria-hidden", "true");
		activeReactionMessageId = null;
	}

	function stopTypingNow() {
		if (!socket) return;

		isTyping = false;
		clearTimeout(typingTimer);

		socket.emit("stopTyping", {
			channel: currentRoom
		});
	}

	function renderMessages() {
		messagesBox.innerHTML = "";

		if (messages.length === 0) {
			messagesBox.innerHTML = `
				<div class="welcomeMessage">
					<h2>${escapeHtml(chatNameInput.value || "RelaxChat")}</h2>
					<p>No messages yet. Start the chat.</p>
				</div>
			`;
			return;
		}

		messages.forEach(function(message) {
			const messageDiv = document.createElement("div");
			messageDiv.classList.add("message");

			messageDiv.dataset.messageId = message.id;
			messageDiv.dataset.channel = message.channel || currentRoom;

			messageDiv.innerHTML = `
				<div class="messageTop">
					<span class="name">${escapeHtml(message.name)}</span>
					<span class="time">${escapeHtml(message.time)}</span>
				</div>
				<div class="text">${escapeHtml(message.text)}</div>
			`;

			renderReactionPills(messageDiv, message.reactions || {});

			messagesBox.appendChild(messageDiv);
		});

		messagesBox.scrollTop = messagesBox.scrollHeight;
	}

	function sendMessage() {
		const text = messageInput.value.trim();

		if (text === "") return;
		if (!socket) return alert("RelaxChat is not connected.");

		socket.emit("sendMessage", {
			name: getMyName(),
			userId: getMyUserId(),
			text: text,
			channel: currentRoom
		});

		messageInput.value = "";
		stopTypingNow();
		saveSettings();
	}

	function clearMessages() {
		if (!socket) return;
		if (!confirm("Clear this room's messages?")) return;

		if (settingsDrawer) {
			settingsDrawer.classList.add("hidden");
		}

		socket.emit("clearChannel", currentRoom);
	}

	function getSoundUrl(sound) {
		if (sound.url.startsWith("http")) return sound.url;
		return SERVER_URL + sound.url;
	}

	function renderSounds() {
		soundList.innerHTML = "";

		if (!sounds || sounds.length === 0) {
			soundList.innerHTML = `<span class="emptySounds">No sounds yet.</span>`;
			return;
		}

		sounds.forEach(function(sound) {
			const wrapper = document.createElement("div");
			wrapper.classList.add("soundItem");

			const playBtn = document.createElement("button");
			playBtn.classList.add("soundBtn");
			playBtn.textContent = "🔊 " + sound.name;

			playBtn.addEventListener("click", function() {
				if (!socket) return;

				socket.emit("playSound", {
					...sound,
					roomId: currentRoom
				});
			});

			wrapper.appendChild(playBtn);

			const ownsByAccount = sound.ownerId && currentUser && sound.ownerId === currentUser.id;
			const ownsOldSound = !sound.ownerId && sound.owner === getMyName();
			const isAdmin = currentUser && (currentUser.role === "owner" || currentUser.role === "admin");

			if (ownsByAccount || ownsOldSound || isAdmin) {
				const deleteBtn = document.createElement("button");
				deleteBtn.classList.add("soundBtn", "deleteSoundBtn");
				deleteBtn.textContent = "✕";

				deleteBtn.addEventListener("click", async function() {
					if (!confirm("Delete this sound?")) return;

					try {
						await fetch(SERVER_URL + "/deleteSound", {
							method: "POST",
							headers: {
								"Content-Type": "application/json"
							},
							body: JSON.stringify({
								url: sound.url,
								owner: getMyName(),
								token: authToken
							})
						});
					} catch (error) {
						console.log("Delete sound error:", error);
						alert("Could not delete sound.");
					}
				});

				wrapper.appendChild(deleteBtn);
			}

			soundList.appendChild(wrapper);
		});
	}

	async function enableSoundboardAudio() {
		try {
			if (!soundAudioContext) {
				soundAudioContext = new AudioContext();
			}

			if (soundAudioContext.state === "suspended") {
				await soundAudioContext.resume();
			}

			const silentBuffer = soundAudioContext.createBuffer(1, 1, 22050);
			const source = soundAudioContext.createBufferSource();

			source.buffer = silentBuffer;
			source.connect(soundAudioContext.destination);
			source.start(0);

			enableSoundboardBtn.textContent = "Soundboard Enabled";
			enableSoundboardBtn.classList.add("active");
		} catch (error) {
			console.log("Soundboard enable failed:", error);
		}
	}

	async function uploadSound() {
		const file = soundUploadInput.files[0];
		if (!file) return;

		const formData = new FormData();
		formData.append("sound", file);
		formData.append("owner", getMyName());
		formData.append("token", authToken);
		formData.append("roomId", currentRoom);

		try {
			const response = await fetch(SERVER_URL + "/upload", {
				method: "POST",
				body: formData
			});

			const result = await response.json();

			if (!result.success) {
				alert("Upload failed.");
			}

			soundUploadInput.value = "";
		} catch (error) {
			console.log("Upload error:", error);
			alert("Sound upload failed.");
		}
	}

	async function playSoundLocally(sound) {
		try {
			if (sound.roomId && sound.roomId !== currentRoom) return;

			if (!soundAudioContext || soundAudioContext.state === "suspended") {
				await enableSoundboardAudio();
			}

			const url = getSoundUrl(sound);

			if (!soundBufferCache[url]) {
				const response = await fetch(url);
				const arrayBuffer = await response.arrayBuffer();
				soundBufferCache[url] = await soundAudioContext.decodeAudioData(arrayBuffer);
			}

			const source = soundAudioContext.createBufferSource();
			const gainNode = soundAudioContext.createGain();

			gainNode.gain.value = soundVolume;
			source.buffer = soundBufferCache[url];

			source.connect(gainNode);
			gainNode.connect(soundAudioContext.destination);
			source.start(0);
		} catch (error) {
			console.log("Sound play failed:", error);
		}
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
			muteBtn.textContent = "Mute";

			socket.emit("joinVoice", {
				name: getMyName(),
				roomId: currentRoom
			});
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
		muteBtn.textContent = "Mute";
		remoteAudioBox.innerHTML = "";

		if (socket) {
			socket.emit("leaveVoice");
		}
	}

	function toggleMute() {
		if (!localStream) return;

		isMuted = !isMuted;

		localStream.getAudioTracks().forEach(function(track) {
			track.enabled = !isMuted;
		});

		muteBtn.classList.toggle("muted", isMuted);
		muteBtn.textContent = isMuted ? "Unmute" : "Mute";
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
			}).catch(function() {
				voiceStatus.textContent = "Press play on audio box";
			});
		};

		peer.onconnectionstatechange = function() {
			if (peer.connectionState === "connected") {
				voiceStatus.textContent = "Voice connected";
			}

			if (peer.connectionState === "failed") {
				voiceStatus.textContent = "Voice failed";
			}
		};

		peer.oniceconnectionstatechange = function() {
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

		if (audio) {
			audio.remove();
		}
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
			allMessages = serverMessages || {};
			messages = allMessages[currentRoom] || [];
			renderMessages();
		});

		socket.on("newMessage", function(message) {
			if (!allMessages[message.channel]) {
				allMessages[message.channel] = [];
			}

			allMessages[message.channel].push(message);

			if (message.channel !== currentRoom) return;

			messages = allMessages[currentRoom] || [];
			renderMessages();
		});

		socket.on("channelCleared", function(channel) {
			allMessages[channel] = [];

			if (channel !== currentRoom) return;

			messages = [];
			renderMessages();
		});

		socket.on("userTyping", function(data) {
			if (!typingIndicator) return;
			if (data.channel !== currentRoom) return;
			if (data.name === getMyName()) return;

			typingIndicator.textContent = data.name + " is typing...";

			clearTimeout(typingHideTimer);

			typingHideTimer = setTimeout(function() {
				typingIndicator.textContent = "";
			}, 1600);
		});

		socket.on("userStoppedTyping", function(data) {
			if (!typingIndicator) return;
			if (data.channel !== currentRoom) return;

			typingIndicator.textContent = "";
		});

		socket.on("reactionUpdated", function(data) {
			if (!data.channel || data.channel !== currentRoom) return;

			if (allMessages[data.channel]) {
				const savedMessage = allMessages[data.channel].find(function(message) {
					return message.id === data.messageId;
				});

				if (savedMessage) {
					savedMessage.reactions = data.reactions || {};
				}
			}

			const messageDiv = messagesBox.querySelector(
				`[data-message-id="${data.messageId}"]`
			);

			if (!messageDiv) return;

			renderReactionPills(messageDiv, data.reactions || {});
		});

		socket.on("soundList", function(serverSounds) {
			allSounds = serverSounds || [];

			sounds = allSounds.filter(function(sound) {
				return sound.roomId === currentRoom;
			});

			renderSounds();
		});

		socket.off("playSound");

		socket.on("playSound", function(sound) {
			playSoundLocally(sound);
		});

		socket.on("connect_error", function() {
			chatStatus.textContent = "Could not connect";
		});

		socket.on("voiceUsers", function(users) {
			const roomVoiceUsers = users.filter(function(user) {
				return user.roomId === currentRoom;
			});

			renderVoiceUsers(roomVoiceUsers);

			if (!inVoice || !localStream) return;

			roomVoiceUsers.forEach(function(user) {
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
			if (user.roomId !== currentRoom) return;
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

		socket.on("roomsUpdated", function() {
			loadRooms();
		});

		socket.on("roomDeleted", function(roomId) {
			if (currentRoom === roomId) {
				switchRoom("general", "RelaxChat");
			}

			loadRooms();
		});
	}

	loginBtn.addEventListener("click", login);
	signupBtn.addEventListener("click", signup);
	logoutBtn.addEventListener("click", logout);
	startSessionBtn.addEventListener("click", startSession);

	authPasswordInput.addEventListener("keydown", function(event) {
		if (event.key === "Enter") login();
	});

	sendBtn.addEventListener("click", sendMessage);
	clearBtn.addEventListener("click", clearMessages);

	voiceBtn.addEventListener("click", function() {
		if (inVoice) {
			leaveVoice();
		} else {
			joinVoice();
		}
	});

	audioUnlockBtn.addEventListener("click", unlockRemoteAudio);
	muteBtn.addEventListener("click", toggleMute);

	soundboardToggleBtn.addEventListener("click", function() {
		soundboardDrawer.classList.remove("hidden");
	});

	closeSoundboardBtn.addEventListener("click", function() {
		soundboardDrawer.classList.add("hidden");
	});

	soundboardDrawer.addEventListener("click", function(event) {
		if (event.target === soundboardDrawer) {
			soundboardDrawer.classList.add("hidden");
		}
	});

	enableSoundboardBtn.addEventListener("click", enableSoundboardAudio);
	soundUploadInput.addEventListener("change", uploadSound);

	soundVolumeSlider.addEventListener("input", function() {
		soundVolume = Number(soundVolumeSlider.value) / 100;
		soundVolumeText.textContent = soundVolumeSlider.value + "%";
		saveSettings();
	});

	messageInput.addEventListener("keydown", function(event) {
		if (event.key === "Enter") sendMessage();
	});

	messageInput.addEventListener("input", function() {
		if (!socket) return;

		const text = messageInput.value.trim();

		if (text === "") {
			stopTypingNow();
			return;
		}

		if (!isTyping) {
			isTyping = true;

			socket.emit("typing", {
				channel: currentRoom,
				name: getMyName()
			});
		}

		clearTimeout(typingTimer);

		typingTimer = setTimeout(function() {
			stopTypingNow();
		}, 1000);
	});

	messagesBox.addEventListener("pointerdown", function(event) {
		const messageDiv = event.target.closest(".message");

		if (!messageDiv) return;

		pressedMessageDiv = messageDiv;
		pressStartX = event.clientX;
		pressStartY = event.clientY;

		clearTimeout(longPressTimer);

		longPressTimer = setTimeout(function() {
			if (!pressedMessageDiv) return;

			openReactionPopup(pressedMessageDiv);
		}, 550);
	});

	messagesBox.addEventListener("pointermove", function(event) {
		if (!pressedMessageDiv) return;

		const moveX = Math.abs(event.clientX - pressStartX);
		const moveY = Math.abs(event.clientY - pressStartY);

		if (moveX > 10 || moveY > 10) {
			clearTimeout(longPressTimer);
			pressedMessageDiv = null;
		}
	});

	messagesBox.addEventListener("pointerup", function() {
		clearTimeout(longPressTimer);
		pressedMessageDiv = null;
	});

	messagesBox.addEventListener("pointercancel", function() {
		clearTimeout(longPressTimer);
		pressedMessageDiv = null;
	});

	messagesBox.addEventListener("contextmenu", function(event) {
		const messageDiv = event.target.closest(".message");

		if (!messageDiv) return;

		event.preventDefault();
		openReactionPopup(messageDiv);
	});

	if (reactionPopup) {
		reactionPopup.addEventListener("click", function(event) {
			event.stopPropagation();

			const button = event.target.closest(".popup-reaction-btn");

			if (!button) return;
			if (!activeReactionMessageId) return;
			if (!socket) return;

			socket.emit("addReaction", {
				channel: currentRoom,
				messageId: activeReactionMessageId,
				emoji: button.dataset.emoji
			});

			closeReactionPopup();
		});
	}

	document.addEventListener("click", function() {
		closeReactionPopup();
	});

	window.addEventListener("scroll", function() {
		closeReactionPopup();
	});

	chatNameInput.addEventListener("input", function() {
		saveSettings();
		renderMessages();
	});

	settingsBtn.addEventListener("click", function() {
		settingsDrawer.classList.remove("hidden");
	});

	closeSettingsBtn.addEventListener("click", function() {
		settingsDrawer.classList.add("hidden");
	});

	settingsDrawer.addEventListener("click", function(event) {
		if (event.target === settingsDrawer) {
			settingsDrawer.classList.add("hidden");
		}
	});

	roomsBtn.addEventListener("click", function() {
		roomsDrawer.classList.remove("hidden");
		loadRooms();
	});

	closeRoomsBtn.addEventListener("click", function() {
		roomsDrawer.classList.add("hidden");
	});

	roomsDrawer.addEventListener("click", function(event) {
		if (event.target === roomsDrawer) {
			roomsDrawer.classList.add("hidden");
		}
	});

	createRoomBtn.addEventListener("click", createRoom);
	joinRoomBtn.addEventListener("click", joinRoom);

	if (logoutBtnMain) {
		logoutBtnMain.addEventListener("click", function() {
			settingsDrawer.classList.add("hidden");
			logout();
		});
	}

	setBgBtn.addEventListener("click", function() {
		settingsDrawer.classList.add("hidden");
		chooseBackgroundImage();
	});

	bgUpload.addEventListener("change", setBackgroundImage);

	loadSettings();
	applySavedBackground();
	renderMessages();
	renderSounds();
	verifySavedLogin();
});
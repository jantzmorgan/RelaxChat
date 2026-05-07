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

	const streamPanelBtn = document.getElementById("streamPanelBtn");
	const streamsDrawer = document.getElementById("streamsDrawer");
	const closeStreamsBtn = document.getElementById("closeStreamsBtn");
	const startStreamBtn = document.getElementById("startStreamBtn");
	const flipCameraBtn = document.getElementById("flipCameraBtn");
	const stopStreamBtn = document.getElementById("stopStreamBtn");
	const stopWatchingBtn = document.getElementById("stopWatchingBtn");
	const screenViewer = document.getElementById("screenViewer");
	const noStreamSelected = document.getElementById("noStreamSelected");
	const streamFocusStatus = document.getElementById("streamFocusStatus");
	const streamVolumeSlider = document.getElementById("streamVolumeSlider");
	const streamVolumeText = document.getElementById("streamVolumeText");
	const liveStreamsList = document.getElementById("liveStreamsList");
	const streamSupportNote = document.getElementById("streamSupportNote");

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
	let currentRoomName = "RelaxChat";
	let messages = [];
	let allMessages = {};
	let sounds = [];
	let allSounds = [];

	let activeReactionMessageId = null;
	let reactionHoverTimer = null;
	let reactionHoverMessageDiv = null;
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

	let streamVolume = 0.8;
	let isScreenStreaming = false;
	let localScreenStream = null;
	let localScreenStreamIsSelfie = false;
	let currentScreenStreamId = null;
	let currentStreamType = null;
	let cameraFacingMode = "user";
	let screenBroadcastPeers = {};
	let screenViewerPeer = null;
	let selectedScreenStreamId = null;
	let latestLiveScreenStreams = [];

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

		try {
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
		} catch (error) {
			console.log("Login error:", error);
			authError.textContent = "Could not reach RelaxChat server.";
		}
	}

	async function signup() {
		authError.textContent = "";

		const username = authUsernameInput.value.trim();
		const password = authPasswordInput.value;

		if (!username || !password) {
			authError.textContent = "Enter username and password.";
			return;
		}

		try {
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
		} catch (error) {
			console.log("Signup error:", error);
			authError.textContent = "Could not reach RelaxChat server.";
		}
	}

	function logout() {
		localStorage.removeItem("relaxChatToken");
		authToken = "";
		currentUser = null;

		if (inVoice) {
			leaveVoice();
		}

		if (isScreenStreaming) {
			stopScreenStream("logout");
		} else {
			stopWatchingScreenStream();
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

		updateStreamSupport();
		renderStreamPlaceholder();
	}

	function getMyName() {
		if (currentUser) return currentUser.username;
		return displayNameInput.value.trim() || "Anonymous";
	}

	function getMyUserId() {
		if (currentUser) return currentUser.id;
		return null;
	}

	function lockChatNameInput() {
		if (!chatNameInput) return;

		chatNameInput.readOnly = true;
		chatNameInput.tabIndex = -1;
		chatNameInput.setAttribute("aria-readonly", "true");
		chatNameInput.value = currentRoomName || "RelaxChat";
		chatNameInput.blur();
	}

	function isMobileDevice() {
		return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
	}

	function setScreenViewerMirror(shouldMirror) {
		if (!screenViewer) return;

		screenViewer.classList.toggle("selfieMirror", Boolean(shouldMirror));
	}

	async function getRelaxStreamMedia() {
		const shouldUseSelfieCamera =
			isMobileDevice() || !navigator.mediaDevices.getDisplayMedia;

		if (shouldUseSelfieCamera) {
			localScreenStreamIsSelfie = true;

			return await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: "user",
					width: {
						ideal: 720
					},
					height: {
						ideal: 1280
					},
					frameRate: {
						ideal: 30,
						max: 30
					}
				},
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});
		}

		localScreenStreamIsSelfie = false;

		return await navigator.mediaDevices.getDisplayMedia({
			video: {
				width: {
					ideal: 1280
				},
				height: {
					ideal: 720
				},
				frameRate: {
					ideal: 30,
					max: 30
				}
			},
			audio: true
		});
	}

	function saveSettings() {
		localStorage.setItem("relaxChatTitle", chatNameInput.value);
		localStorage.setItem("relaxChatSoundVolume", String(soundVolumeSlider.value));

		if (streamVolumeSlider) {
			localStorage.setItem("relaxChatStreamVolume", String(streamVolumeSlider.value));
		}
	}

	function loadSettings() {
		currentRoom = localStorage.getItem("relaxChatCurrentRoom") || "general";
		currentRoomName = localStorage.getItem("relaxChatCurrentRoomName") || "RelaxChat";

		if (currentRoom === "general") {
			currentRoomName = "RelaxChat";
		}

		chatNameInput.value = currentRoomName;
		lockChatNameInput();

		const savedVolume = localStorage.getItem("relaxChatSoundVolume") || "80";
		soundVolumeSlider.value = savedVolume;
		soundVolume = Number(savedVolume) / 100;
		soundVolumeText.textContent = savedVolume + "%";

		const savedStreamVolume = localStorage.getItem("relaxChatStreamVolume") || "80";

		if (streamVolumeSlider && streamVolumeText) {
			streamVolumeSlider.value = savedStreamVolume;
			streamVolume = Number(savedStreamVolume) / 100;
			streamVolumeText.textContent = savedStreamVolume + "%";
		}

		if (screenViewer) {
			screenViewer.volume = streamVolume;
		}
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

		if (isScreenStreaming) {
			stopScreenStream("room-change");
		} else {
			stopWatchingScreenStream();
		}

		currentRoom = roomId;

		currentRoom = roomId;
		currentRoomName = roomId === "general" ? "RelaxChat" : roomName;

		localStorage.setItem("relaxChatCurrentRoom", roomId);
		localStorage.setItem("relaxChatCurrentRoomName", currentRoomName);

		chatNameInput.value = currentRoomName;
		lockChatNameInput();
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
		renderStreamPlaceholder();

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

	async function getScreenRtcConfig() {
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
			iceTransportPolicy: "all"
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

	function normalizeReactionEntry(entry) {
		if (!entry) {
			return {
				count: 0,
				users: []
			};
		}

		if (typeof entry === "number") {
			return {
				count: entry,
				users: []
			};
		}

		if (Array.isArray(entry)) {
			return {
				count: entry.length,
				users: entry
			};
		}

		return {
			count: Number(entry.count || 0),
			users: Array.isArray(entry.users) ? entry.users : []
		};
	}

	function getReactionDetailsHtml(reactions) {
		const reactionKeys = Object.keys(reactions || {});
		const detailLines = [];

		reactionKeys.forEach(function(emoji) {
			const reaction = normalizeReactionEntry(reactions[emoji]);

			if (reaction.users.length > 0) {
				reaction.users.forEach(function(user) {
					detailLines.push(
						`<div class="reaction-detail-line">
							<span>${escapeHtml(user.name || "Someone")}</span>
							<strong>${escapeHtml(emoji)}</strong>
						</div>`
					);
				});
			} else if (reaction.count > 0) {
				detailLines.push(
					`<div class="reaction-detail-line">
						<span>${reaction.count} reaction${reaction.count === 1 ? "" : "s"}</span>
						<strong>${escapeHtml(emoji)}</strong>
					</div>`
				);
			}
		});

		if (detailLines.length === 0) {
			return "";
		}

		return `
			<div class="message-reaction-details">
				${detailLines.join("")}
			</div>
		`;
	}

	function removeReactionDetails(messageDiv) {
		const oldDetails = messageDiv.querySelector(".message-reaction-details");

		if (oldDetails) {
			oldDetails.remove();
		}
	}

	function showReactionDetailsAfterDelay(messageDiv, reactions) {
		clearTimeout(reactionHoverTimer);

		reactionHoverMessageDiv = messageDiv;

		reactionHoverTimer = setTimeout(function() {
			if (!reactionHoverMessageDiv) return;

			removeReactionDetails(reactionHoverMessageDiv);

			const detailsHtml = getReactionDetailsHtml(reactions);

			if (!detailsHtml) return;

			reactionHoverMessageDiv.insertAdjacentHTML("beforeend", detailsHtml);
		}, 3000);
	}

	function hideReactionDetails(messageDiv) {
		clearTimeout(reactionHoverTimer);
		reactionHoverMessageDiv = null;

		if (messageDiv) {
			removeReactionDetails(messageDiv);
		}
	}

	function renderReactionPills(messageDiv, reactions) {
		const oldReactionBox = messageDiv.querySelector(".message-reactions");

		if (oldReactionBox) {
			oldReactionBox.remove();
		}

		removeReactionDetails(messageDiv);

		const reactionKeys = Object.keys(reactions || {}).filter(function(emoji) {
			const reaction = normalizeReactionEntry(reactions[emoji]);
			return reaction.count > 0;
		});

		if (reactionKeys.length === 0) return;

		const reactionBox = document.createElement("div");
		reactionBox.classList.add("message-reactions");

		reactionKeys.forEach(function(emoji) {
			const reaction = normalizeReactionEntry(reactions[emoji]);

			const pill = document.createElement("span");
			pill.classList.add("message-reaction-pill");
			pill.dataset.emoji = emoji;

			pill.innerHTML =
				escapeHtml(emoji) +
				`<span class="message-reaction-count">${reaction.count}</span>`;

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

		const popupWidth = reactionPopup.offsetWidth || 320;
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

	function getActiveMessageText() {
		if (!activeReactionMessageId) return "";

		const messageDiv = messagesBox.querySelector(
			`[data-message-id="${activeReactionMessageId}"]`
		);

		if (!messageDiv) return "";

		const textDiv = messageDiv.querySelector(".text");

		if (!textDiv) return "";

		return textDiv.textContent.trim();
	}

	async function copyTextToClipboard(text) {
		if (!text) return;

		try {
			await navigator.clipboard.writeText(text);
		} catch (error) {
			const textarea = document.createElement("textarea");

			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.left = "-9999px";
			textarea.style.top = "0";

			document.body.appendChild(textarea);
			textarea.focus();
			textarea.select();

			document.execCommand("copy");

			textarea.remove();
		}
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
					<h2>${escapeHtml(currentRoomName || "RelaxChat")}</h2>
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

			messageDiv.addEventListener("mouseenter", function() {
				showReactionDetailsAfterDelay(messageDiv, message.reactions || {});
			});

			messageDiv.addEventListener("mouseleave", function() {
				hideReactionDetails(messageDiv);
			});

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
			channel: currentRoom,
			token: authToken
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

		socket.emit("clearChannel", {
			channel: currentRoom,
			token: authToken
		});
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
						const response = await fetch(SERVER_URL + "/deleteSound", {
							method: "POST",
							headers: {
								"Content-Type": "application/json"
							},
							body: JSON.stringify({
								url: sound.url,
								id: sound.id,
								owner: getMyName(),
								token: authToken
							})
						});

						const result = await response.json();

						if (!result.success) {
							alert(result.message || "Could not delete sound.");
						}
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

	function isProbablyMobileDevice() {
		return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
	}

	function canStartCameraStream() {
		return !!(
			navigator.mediaDevices &&
			navigator.mediaDevices.getUserMedia
		);
	}

	function canStartScreenShare() {
		return !!(
			navigator.mediaDevices &&
			navigator.mediaDevices.getDisplayMedia
		);
	}

	function shouldUseCameraStream() {
		if (isProbablyMobileDevice()) return true;
		if (!canStartScreenShare() && canStartCameraStream()) return true;
		return false;
	}

	function updateStreamSupport() {
		if (!startStreamBtn) return;

		if (shouldUseCameraStream() && canStartCameraStream()) {
			startStreamBtn.classList.remove("hidden");
			startStreamBtn.textContent = "Start Camera Stream";

			if (streamSupportNote) {
				streamSupportNote.textContent = "This device will stream your camera like FaceTime. Use Flip Camera while live to switch front/back camera.";
			}

			return;
		}

		if (canStartScreenShare()) {
			startStreamBtn.classList.remove("hidden");
			startStreamBtn.textContent = "Start Screen Stream";

			if (streamSupportNote) {
				streamSupportNote.textContent = "This browser supports screen sharing. Mobile devices may still use camera streaming instead.";
			}

			return;
		}

		startStreamBtn.classList.add("hidden");

		if (streamSupportNote) {
			streamSupportNote.textContent = "This device can watch streams, but this browser cannot start a stream.";
		}
	}

	function setStreamFocusStatus(text) {
		if (streamFocusStatus) {
			streamFocusStatus.textContent = text;
		}
	}

	function showStopWatchingButton(shouldShow) {
		if (!stopWatchingBtn) return;

		if (shouldShow) {
			stopWatchingBtn.classList.remove("hidden");
		} else {
			stopWatchingBtn.classList.add("hidden");
		}
	}

	function updateFlipCameraButton() {
		if (!flipCameraBtn) return;

		if (isScreenStreaming && currentStreamType === "camera") {
			flipCameraBtn.classList.remove("hidden");
		} else {
			flipCameraBtn.classList.add("hidden");
		}
	}

	function updateLocalPreviewMirror() {
		if (!screenViewer) return;

		if (
			selectedScreenStreamId === currentScreenStreamId &&
			currentStreamType === "camera" &&
			cameraFacingMode === "user"
		) {
			screenViewer.style.transform = "scaleX(-1)";
		} else {
			screenViewer.style.transform = "";
		}
	}

	function showOwnStreamPreview() {
		if (!localScreenStream || !screenViewer) return;

		screenViewer.pause();

		screenViewer.setAttribute("playsinline", "");
		screenViewer.setAttribute("webkit-playsinline", "");
		screenViewer.setAttribute("autoplay", "");

		screenViewer.muted = true;
		screenViewer.defaultMuted = true;
		screenViewer.volume = 0;
		screenViewer.srcObject = localScreenStream;
		setScreenViewerMirror(localScreenStreamIsSelfie);

		if (noStreamSelected) {
			noStreamSelected.classList.add("hidden");
		}

		selectedScreenStreamId = currentScreenStreamId;
		showStopWatchingButton(false);

		if (currentStreamType === "camera") {
			setStreamFocusStatus("Previewing your camera stream. Others can watch you.");
		} else {
			setStreamFocusStatus("Previewing your screen stream. Others can watch you.");
		}

		updateLocalPreviewMirror();

		function tryPlayPreview() {
			screenViewer.play().catch(function() {
				setStreamFocusStatus("Camera is live. Tap the preview if it does not appear.");
			});
		}

		if (screenViewer.readyState >= 2) {
			tryPlayPreview();
		} else {
			screenViewer.onloadedmetadata = tryPlayPreview;
		}
	}

	function renderStreamPlaceholder() {
		if (screenViewer) {
			screenViewer.pause();
			screenViewer.onloadedmetadata = null;
			screenViewer.srcObject = null;
			screenViewer.volume = streamVolume;
			screenViewer.muted = false;
			screenViewer.defaultMuted = false;
			screenViewer.style.transform = "";
		}

		if (noStreamSelected) {
			noStreamSelected.classList.remove("hidden");
		}

		showStopWatchingButton(false);
		updateFlipCameraButton();
		setStreamFocusStatus("Not watching a stream.");

		if (liveStreamsList) {
			liveStreamsList.innerHTML = `<span class="emptySounds">No one is streaming yet.</span>`;
		}
	}

	function renderLiveStreams(streams) {
		if (!liveStreamsList) return;

		latestLiveScreenStreams = streams || [];

		const roomStreams = latestLiveScreenStreams.filter(function(stream) {
			return stream.roomId === currentRoom;
		});

		liveStreamsList.innerHTML = "";

		if (roomStreams.length === 0) {
			liveStreamsList.innerHTML = `<span class="emptySounds">No one is streaming yet.</span>`;
			return;
		}

		roomStreams.forEach(function(stream) {
			const item = document.createElement("div");
			item.classList.add("liveStreamItem");

			const name = document.createElement("div");
			name.classList.add("liveStreamName");

			const isMe = socket && stream.socketId === socket.id;
			const isSelected = selectedScreenStreamId === stream.id;

			if (isMe) {
				if (currentStreamType === "camera") {
					name.textContent = isSelected ? "🟢 Your camera · previewing" : "🟢 Your camera";
				} else {
					name.textContent = isSelected ? "🟢 You are live · previewing" : "🟢 You are live";
				}
			} else {
				name.textContent = isSelected ? "👀 Watching " + stream.name : "🟢 " + stream.name;
			}

			const watchBtn = document.createElement("button");
			watchBtn.classList.add("watchStreamBtn");

			if (isMe) {
				watchBtn.textContent = "Preview";

				watchBtn.addEventListener("click", function() {
					showOwnStreamPreview();
					renderLiveStreams(latestLiveScreenStreams);
				});
			} else {
				watchBtn.textContent = isSelected ? "Watching" : "Watch";

				watchBtn.addEventListener("click", function() {
					watchScreenStream(stream.id);
				});
			}

			item.appendChild(name);
			item.appendChild(watchBtn);
			liveStreamsList.appendChild(item);
		});
	}

	async function createScreenPeerConnection(peerSocketId, isBroadcaster, streamId) {
		const rtcConfig = await getScreenRtcConfig();
		const peer = new RTCPeerConnection(rtcConfig);

		peer.onicecandidate = function(event) {
			if (!event.candidate) return;

			socket.emit("screenIceCandidate", {
				to: peerSocketId,
				streamId: streamId,
				roomId: currentRoom,
				channel: currentRoom,
				candidate: event.candidate,
				token: authToken
			});
		};

		peer.ontrack = function(event) {
			if (isBroadcaster) return;

			screenViewer.srcObject = event.streams[0];
			screenViewer.volume = streamVolume;
			screenViewer.muted = false;

			const watchedStream = latestLiveScreenStreams.find(function(stream) {
				return stream.id === streamId;
			});

			setScreenViewerMirror(watchedStream && watchedStream.isSelfieCamera);
			screenViewer.style.transform = "";

			if (noStreamSelected) {
				noStreamSelected.classList.add("hidden");
			}

			showStopWatchingButton(true);
			setStreamFocusStatus("Watching stream. Voice chat stays active.");

			screenViewer.play().catch(function(error) {
				console.log("Screen viewer play failed:", error);
			});
		};

		peer.onconnectionstatechange = function() {
			console.log("Screen peer state:", peer.connectionState);

			if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
				if (!isBroadcaster && selectedScreenStreamId === streamId) {
					stopWatchingScreenStream();
				}
			}
		};

		return peer;
	}

	function getCameraConstraints(includeAudio) {
		return {
			video: {
				facingMode: {
					ideal: cameraFacingMode
				},
				width: {
					ideal: 1280
				},
				height: {
					ideal: 720
				},
				frameRate: {
					ideal: 24,
					max: 30
				}
			},
			audio: includeAudio
		};
	}

	async function getCameraStream() {
		const shouldIncludeAudio = !inVoice;

		try {
			return await navigator.mediaDevices.getUserMedia(getCameraConstraints(shouldIncludeAudio));
		} catch (firstError) {
			console.log("Camera preferred constraints failed, trying simpler camera:", firstError);

			try {
				return await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: cameraFacingMode
					},
					audio: shouldIncludeAudio
				});
			} catch (secondError) {
				console.log("Camera with audio failed, trying video only:", secondError);

				return await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: cameraFacingMode
					},
					audio: false
				});
			}
		}
	}

	function announceStartedStream(streamName) {
		socket.emit("startScreenStream", {
			roomId: currentRoom,
			channel: currentRoom,
			streamId: currentScreenStreamId,
			id: currentScreenStreamId,
			name: streamName,
			userId: getMyUserId(),
			token: authToken,
			isSelfieCamera: localScreenStreamIsSelfie
		});
	}

	async function startCameraStream() {
		if (isScreenStreaming) return;
		if (!socket) return alert("RelaxChat is not connected.");

		if (!canStartCameraStream()) {
			alert("This browser cannot start a camera stream.");
			updateStreamSupport();
			return;
		}

		try {
			localScreenStream = await getCameraStream();

			isScreenStreaming = true;
			currentStreamType = "camera";
			currentScreenStreamId = "screen_" + socket.id;

			if (!selectedScreenStreamId) {
				showOwnStreamPreview();
			} else {
				setStreamFocusStatus("Your camera is live while watching another stream.");
			}

			startStreamBtn.classList.add("hidden");
			stopStreamBtn.classList.remove("hidden");
			streamPanelBtn.classList.add("active");
			updateFlipCameraButton();

			announceStartedStream(getMyName() + "'s camera");

			setStreamFocusStatus("Camera is live. Others can watch you.");

			console.log("Camera stream started and announced.");
		} catch (error) {
			console.log("Camera stream failed:", error);
			alert("Camera stream failed or was blocked.");
		}
	}

	async function startScreenShareStream() {
		if (isScreenStreaming) return;
		if (!socket) return alert("RelaxChat is not connected.");

		if (!canStartScreenShare()) {
			startCameraStream();
			return;
		}

		try {
			localScreenStream = await getRelaxStreamMedia();

			isScreenStreaming = true;
			currentStreamType = "screen";
			currentScreenStreamId = "screen_" + socket.id;

			if (!selectedScreenStreamId) {
				showOwnStreamPreview();
			} else {
				setStreamFocusStatus("You are live while watching another stream.");
			}

			startStreamBtn.classList.add("hidden");
			stopStreamBtn.classList.remove("hidden");
			streamPanelBtn.classList.add("active");
			updateFlipCameraButton();

			const videoTracks = localScreenStream.getVideoTracks();

			announceStartedStream(getMyName());

			if (videoTracks[0]) {
				videoTracks[0].addEventListener("ended", function() {
					stopScreenStream("screen-track-ended");
				});
			}
		} catch (error) {
			console.log("Screen stream failed:", error);

			if (canStartCameraStream()) {
				const wantsCamera = confirm("Screen sharing failed or was cancelled. Start camera stream instead?");

				if (wantsCamera) {
					startCameraStream();
				}

				return;
			}

			alert("Screen stream failed or was cancelled.");
		}
	}

	function startScreenStream() {
		if (shouldUseCameraStream()) {
			startCameraStream();
		} else {
			startScreenShareStream();
		}
	}

	async function flipCamera() {
		if (!isScreenStreaming || currentStreamType !== "camera") return;
		if (!canStartCameraStream()) return;

		cameraFacingMode = cameraFacingMode === "user" ? "environment" : "user";

		try {
			const newStream = await getCameraStream();

			const oldStream = localScreenStream;
			localScreenStream = newStream;

			if (screenViewer && selectedScreenStreamId === currentScreenStreamId) {
				screenViewer.srcObject = localScreenStream;
				screenViewer.muted = true;
				screenViewer.volume = streamVolume;
				updateLocalPreviewMirror();

				screenViewer.play().catch(function(error) {
					console.log("Camera preview play failed after flip:", error);
				});
			}

			const newVideoTrack = newStream.getVideoTracks()[0];
			const newAudioTrack = newStream.getAudioTracks()[0];

			Object.keys(screenBroadcastPeers).forEach(function(peerSocketId) {
				const peer = screenBroadcastPeers[peerSocketId];

				peer.getSenders().forEach(function(sender) {
					if (sender.track && sender.track.kind === "video" && newVideoTrack) {
						sender.replaceTrack(newVideoTrack).catch(function(error) {
							console.log("Could not replace video track:", error);
						});
					}

					if (sender.track && sender.track.kind === "audio" && newAudioTrack) {
						sender.replaceTrack(newAudioTrack).catch(function(error) {
							console.log("Could not replace audio track:", error);
						});
					}
				});
			});

			if (oldStream) {
				oldStream.getTracks().forEach(function(track) {
					track.stop();
				});
			}

			setStreamFocusStatus(
				cameraFacingMode === "user" ?
				"Using front camera." :
				"Using back camera."
			);
		} catch (error) {
			console.log("Flip camera failed:", error);
			alert("Could not flip camera on this device.");
		}
	}

	function stopScreenStream(reason = "unknown") {
		console.log("stopScreenStream called because:", reason);

		if (
			currentStreamType === "camera" &&
			reason !== "manual" &&
			reason !== "logout" &&
			reason !== "room-change"
		) {
			console.log("Ignored accidental camera stop.");
			setStreamFocusStatus("Camera is still live. Ignored accidental stop.");
			return;
		}

		if (!socket) return;

		if (localScreenStream) {
			localScreenStream.getTracks().forEach(function(track) {
				track.stop();
			});
		}

		Object.keys(screenBroadcastPeers).forEach(function(peerSocketId) {
			screenBroadcastPeers[peerSocketId].close();
		});

		screenBroadcastPeers = {};

		socket.emit("stopScreenStream", {
			roomId: currentRoom,
			channel: currentRoom,
			streamId: currentScreenStreamId,
			token: authToken
		});

		const wasPreviewingOwnStream = selectedScreenStreamId === currentScreenStreamId;

		localScreenStream = null;
		isScreenStreaming = false;
		currentScreenStreamId = null;
		currentStreamType = null;

		updateStreamSupport();
		stopStreamBtn.classList.add("hidden");
		streamPanelBtn.classList.remove("active");
		updateFlipCameraButton();

		if (wasPreviewingOwnStream) {
			selectedScreenStreamId = null;

			if (screenViewer) {
				screenViewer.pause();
				screenViewer.onloadedmetadata = null;
				screenViewer.srcObject = null;
				screenViewer.muted = false;
				screenViewer.defaultMuted = false;
				screenViewer.style.transform = "";
			}

			if (noStreamSelected) {
				noStreamSelected.classList.remove("hidden");
			}

			showStopWatchingButton(false);
			setStreamFocusStatus("Not watching a stream.");
		} else if (selectedScreenStreamId) {
			setStreamFocusStatus("Stopped your stream. Still watching selected stream.");
		}

		renderLiveStreams(latestLiveScreenStreams);

		console.log("Stream stopped for real. Reason:", reason);
	}

	function stopWatchingScreenStream() {
		const wasWatchingRemote = selectedScreenStreamId && selectedScreenStreamId !== currentScreenStreamId;

		if (screenViewerPeer) {
			screenViewerPeer.close();
			screenViewerPeer = null;
		}

		if (wasWatchingRemote && socket) {
			const selectedStream = latestLiveScreenStreams.find(function(stream) {
				return stream.id === selectedScreenStreamId;
			});

			if (selectedStream) {
				socket.emit("screenViewerLeft", {
					to: selectedStream.socketId,
					streamId: selectedScreenStreamId,
					roomId: currentRoom,
					channel: currentRoom,
					token: authToken
				});
			}
		}

		selectedScreenStreamId = null;

		if (localScreenStream && isScreenStreaming) {
			showOwnStreamPreview();
		} else {
			if (screenViewer) {
				screenViewer.pause();
				screenViewer.srcObject = null;
				screenViewer.muted = false;
				screenViewer.style.transform = "";
			}

			if (noStreamSelected) {
				noStreamSelected.classList.remove("hidden");
			}

			showStopWatchingButton(false);
			setStreamFocusStatus("Not watching a stream.");
		}

		renderLiveStreams(latestLiveScreenStreams);
	}

	function watchScreenStream(streamId) {
		if (!socket) return;
		if (!streamId) return;

		const stream = latestLiveScreenStreams.find(function(savedStream) {
			return savedStream.id === streamId;
		});

		if (!stream) {
			alert("That stream is no longer available.");
			return;
		}

		if (stream.socketId === socket.id) {
			showOwnStreamPreview();
			renderLiveStreams(latestLiveScreenStreams);
			return;
		}

		stopWatchingScreenStream();

		selectedScreenStreamId = streamId;

		showStopWatchingButton(true);
		setStreamFocusStatus("Connecting to " + stream.name + "'s stream...");

		socket.emit("watchScreenStream", {
			roomId: currentRoom,
			channel: currentRoom,
			streamId: streamId,
			name: getMyName(),
			userId: getMyUserId(),
			token: authToken
		});

		renderLiveStreams(latestLiveScreenStreams);
	}

	if (socket) {
		socket.on("connect", function() {
			chatStatus.textContent = "Connected";

			socket.emit("setRoom", currentRoom);
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

		socket.on("screenStreamsUpdated", function(data) {
			if (!data || data.roomId !== currentRoom) return;

			renderLiveStreams(data.streams || []);
		});

		socket.on("screenViewerRequest", async function(data) {
			if (!isScreenStreaming || !localScreenStream) return;
			if (data.roomId !== currentRoom) return;

			const viewerSocketId = data.viewerSocketId;
			const streamId = data.streamId;

			if (screenBroadcastPeers[viewerSocketId]) {
				screenBroadcastPeers[viewerSocketId].close();
				delete screenBroadcastPeers[viewerSocketId];
			}

			const peer = await createScreenPeerConnection(viewerSocketId, true, streamId);
			screenBroadcastPeers[viewerSocketId] = peer;

			localScreenStream.getTracks().forEach(function(track) {
				const sender = peer.addTrack(track, localScreenStream);

				if (track.kind === "video") {
					const parameters = sender.getParameters();

					if (!parameters.encodings) {
						parameters.encodings = [{}];
					}

					parameters.encodings[0].maxBitrate = 1800000;
					parameters.encodings[0].maxFramerate = 24;

					sender.setParameters(parameters).catch(function(error) {
						console.log("Could not set stream bitrate:", error);
					});
				}
			});

			const offer = await peer.createOffer();
			await peer.setLocalDescription(offer);

			socket.emit("screenOffer", {
				to: viewerSocketId,
				streamId: streamId,
				roomId: currentRoom,
				channel: currentRoom,
				offer: offer,
				token: authToken
			});
		});

		socket.on("screenOffer", async function(data) {
			if (data.roomId !== currentRoom) return;

			if (screenViewerPeer) {
				screenViewerPeer.close();
				screenViewerPeer = null;
			}

			screenViewerPeer = await createScreenPeerConnection(data.from, false, data.streamId);

			await screenViewerPeer.setRemoteDescription(new RTCSessionDescription(data.offer));

			const answer = await screenViewerPeer.createAnswer();
			await screenViewerPeer.setLocalDescription(answer);

			socket.emit("screenAnswer", {
				to: data.from,
				streamId: data.streamId,
				roomId: currentRoom,
				channel: currentRoom,
				answer: answer,
				token: authToken
			});
		});

		socket.on("screenAnswer", async function(data) {
			const peer = screenBroadcastPeers[data.from];

			if (!peer) return;

			await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
		});

		socket.on("screenIceCandidate", async function(data) {
			let peer = null;

			if (screenBroadcastPeers[data.from]) {
				peer = screenBroadcastPeers[data.from];
			} else if (screenViewerPeer) {
				peer = screenViewerPeer;
			}

			if (!peer) return;

			try {
				await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
			} catch (error) {
				console.log("Screen ICE error:", error);
			}
		});

		socket.on("screenStreamUnavailable", function(data) {
			console.log("screenStreamUnavailable:", data);

			if (isScreenStreaming && currentStreamType === "camera") {
				console.log("Ignored unavailable warning while camera is live.");
				setStreamFocusStatus("Camera is live. Ignored old unavailable stream warning.");
				return;
			}

			alert("That stream is no longer available.");
			stopWatchingScreenStream();
		});

		socket.on("screenViewerLeft", function(data) {
			if (screenBroadcastPeers[data.from]) {
				screenBroadcastPeers[data.from].close();
				delete screenBroadcastPeers[data.from];
			}
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

	if (streamPanelBtn && streamsDrawer) {
		streamPanelBtn.addEventListener("click", function() {
			streamsDrawer.classList.remove("hidden");
			updateStreamSupport();
			renderLiveStreams(latestLiveScreenStreams);
		});
	}

	if (closeStreamsBtn && streamsDrawer) {
		closeStreamsBtn.addEventListener("click", function() {
			streamsDrawer.classList.add("hidden");
		});
	}

	if (streamsDrawer) {
		streamsDrawer.addEventListener("click", function(event) {
			if (event.target === streamsDrawer) {
				streamsDrawer.classList.add("hidden");
			}
		});
	}

	if (startStreamBtn) {
		startStreamBtn.addEventListener("click", startScreenStream);
	}

	if (flipCameraBtn) {
		flipCameraBtn.addEventListener("click", flipCamera);
	}

	if (stopStreamBtn) {
		stopStreamBtn.addEventListener("click", function() {
			stopScreenStream("manual");
		});
	}

	if (stopWatchingBtn) {
		stopWatchingBtn.addEventListener("click", stopWatchingScreenStream);
	}

	if (streamVolumeSlider) {
		streamVolumeSlider.addEventListener("input", function() {
			streamVolume = Number(streamVolumeSlider.value) / 100;
			streamVolumeText.textContent = streamVolumeSlider.value + "%";

			if (screenViewer) {
				screenViewer.volume = streamVolume;
			}

			saveSettings();
		});
	}

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
		reactionPopup.addEventListener("click", async function(event) {
			event.stopPropagation();

			const reactionButton = event.target.closest(".popup-reaction-btn");
			const copyButton = event.target.closest(".popup-copy-btn");

			if (copyButton) {
				const textToCopy = getActiveMessageText();

				await copyTextToClipboard(textToCopy);

				copyButton.textContent = "Copied!";
				copyButton.classList.add("copied");

				setTimeout(function() {
					copyButton.textContent = "Copy";
					copyButton.classList.remove("copied");
					closeReactionPopup();
				}, 450);

				return;
			}

			if (!reactionButton) return;
			if (!activeReactionMessageId) return;
			if (!socket) return;

			socket.emit("addReaction", {
				channel: currentRoom,
				messageId: activeReactionMessageId,
				emoji: reactionButton.dataset.emoji,
				name: getMyName(),
				userId: getMyUserId(),
				token: authToken
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

	chatNameInput.addEventListener("focus", lockChatNameInput);
	chatNameInput.addEventListener("click", lockChatNameInput);

	chatNameInput.addEventListener("input", function() {
		chatNameInput.value = currentRoomName || "RelaxChat";
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

	window.addEventListener("beforeunload", function() {
		if (isScreenStreaming && socket) {
			socket.emit("stopScreenStream", {
				roomId: currentRoom,
				streamId: currentScreenStreamId
			});
		}
	});

	let lastTouchEnd = 0;

	document.addEventListener("touchend", function(event) {
		const now = Date.now();

		if (now - lastTouchEnd <= 350) {
			event.preventDefault();
		}

		lastTouchEnd = now;
	}, {
		passive: false
	});

	document.addEventListener("gesturestart", function(event) {
		event.preventDefault();
	});

	document.addEventListener("contextmenu", function(event) {
		if (event.target.closest("input, textarea, .popup-copy-btn")) return;

		event.preventDefault();
	});

	lockChatNameInput();

	loadSettings();
	applySavedBackground();
	updateStreamSupport();
	renderMessages();
	renderSounds();
	renderStreamPlaceholder();
	verifySavedLogin();
});
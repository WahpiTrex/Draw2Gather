// ===== App.js - Main Application Logic =====

// Socket connection
const socket = io();

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const drawingScreen = document.getElementById('drawing-screen');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const createRandomBtn = document.getElementById('create-random-btn');
const roomsList = document.getElementById('rooms-list');
const backBtn = document.getElementById('back-btn');
const currentRoomName = document.getElementById('current-room-name');
const userCount = document.getElementById('user-count');
const usersList = document.getElementById('users-list');
const toggleUsersBtn = document.getElementById('toggle-users');
const usersPanel = document.getElementById('users-panel');

// App State
let currentRoom = null;
let currentUser = null;
let users = new Map();

// ===== Room Management =====

// Generate random room name
function generateRandomRoomName() {
    const adjectives = ['Renkli', 'Harika', 'Eglenceli', 'Yaratici', 'Parlak', 'Super', 'Muhtesem', 'Tatli'];
    const nouns = ['Cizimler', 'Sanat', 'Atölye', 'Stüdyo', 'Galeri', 'Tuval', 'Defter', 'Karalamalar'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 999);
    return `${adj}-${noun}-${num}`;
}

// Join room
function joinRoom(roomId, userName) {
    if (!roomId.trim()) {
        roomInput.classList.add('shake');
        setTimeout(() => roomInput.classList.remove('shake'), 500);
        return;
    }

    currentRoom = roomId;
    currentUser = userName || usernameInput.value.trim() || 'Gizemli Çizer';

    socket.emit('join-room', roomId, currentUser);

    // Switch screens
    lobbyScreen.classList.remove('active');
    drawingScreen.classList.add('active');

    currentRoomName.textContent = roomId;

    // Initialize canvas
    initCanvas();
}

// Leave room
function leaveRoom() {
    socket.emit('leave-room');

    currentRoom = null;
    users.clear();

    // Clear canvas
    clearLocalCanvas();

    // Switch screens
    drawingScreen.classList.remove('active');
    lobbyScreen.classList.add('active');

    // Request updated room list
    socket.emit('get-rooms');
}

// Update rooms list in lobby
function updateRoomsList(rooms) {
    roomsList.innerHTML = '';

    if (rooms.length === 0) {
        roomsList.innerHTML = '<div class="no-rooms">Henüz aktif oda yok... İlk sen oluştur! 🎉</div>';
        return;
    }

    rooms.forEach(room => {
        const roomItem = document.createElement('div');
        roomItem.className = 'room-item';
        roomItem.innerHTML = `
            <span class="room-name">🎨 ${room.id}</span>
            <span class="user-count">👥 ${room.userCount}</span>
        `;
        roomItem.addEventListener('click', () => {
            roomInput.value = room.id;
            joinRoom(room.id, usernameInput.value);
        });
        roomsList.appendChild(roomItem);
    });
}

// Update users list in panel
function updateUsersList(userList) {
    users.clear();
    usersList.innerHTML = '';

    userList.forEach(user => {
        users.set(user.id, user);

        const userItem = document.createElement('div');
        userItem.className = `user-item ${user.id === socket.id ? 'you' : ''}`;
        userItem.innerHTML = `
            <div class="user-avatar" style="background: ${user.color}">${user.name.charAt(0)}</div>
            <span class="user-name">${user.name}</span>
        `;
        usersList.appendChild(userItem);
    });

    userCount.textContent = userList.length;
}

// ===== Event Listeners =====

// Join button
joinBtn.addEventListener('click', () => {
    joinRoom(roomInput.value.trim(), usernameInput.value);
});

// Create random room button
createRandomBtn.addEventListener('click', () => {
    const randomRoom = generateRandomRoomName();
    roomInput.value = randomRoom;
    joinRoom(randomRoom, usernameInput.value);
});

// Back button
backBtn.addEventListener('click', leaveRoom);

// Toggle users panel
toggleUsersBtn.addEventListener('click', () => {
    const list = usersPanel.querySelector('.users-list');
    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'block' : 'none';
    toggleUsersBtn.textContent = isHidden ? '−' : '+';
});

// Enter key to join
roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoom(roomInput.value.trim(), usernameInput.value);
    }
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        roomInput.focus();
    }
});

// ===== Socket Events =====

// Room list
socket.on('room-list', (rooms) => {
    updateRoomsList(rooms);
});

// User list
socket.on('user-list', (userList) => {
    updateUsersList(userList);
});

// User joined
socket.on('user-joined', (user) => {
    users.set(user.id, user);
    // Show a little notification (optional enhancement)
    console.log(`${user.name} odaya katıldı! 🎉`);
});

// User left
socket.on('user-left', (userId) => {
    const user = users.get(userId);
    if (user) {
        console.log(`${user.name} ayrıldı 👋`);
    }
    users.delete(userId);
    removeCursor(userId);
});

// Load existing drawings when joining
socket.on('load-drawings', (drawings) => {
    loadDrawings(drawings);
});

// Receive drawing from others
socket.on('draw', (drawData) => {
    drawFromData(drawData);
});

// Receive cursor updates
socket.on('cursor-update', (data) => {
    updateOtherCursor(data);
});

// Canvas cleared
socket.on('canvas-cleared', () => {
    clearLocalCanvas();
});

// ===== Initial Setup =====

// Request room list on load
socket.emit('get-rooms');

// Add shake animation style
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-5px); }
        40%, 80% { transform: translateX(5px); }
    }
    .shake {
        animation: shake 0.5s ease;
        border-color: var(--accent-coral) !important;
    }
`;
document.head.appendChild(shakeStyle);

console.log('🎨 Draw2Gather loaded! Ready to create art together!');

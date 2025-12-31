// ===== Draw2Gather - Main Application =====

// ============================================
// SOCKET CONNECTION
// ============================================
const socket = io();

// ============================================
// GLOBAL STATE
// ============================================

// Canvas state
const canvasState = {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    worldWidth: 10000,
    worldHeight: 10000,
    width: 0,
    height: 0,
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
    drawings: []
};

// Drawing state
const drawingState = {
    isDrawing: false,
    currentTool: 'pencil',
    currentColor: '#FF6B6B',
    brushSize: 5,
    currentStroke: null
};

// App state
let currentRoom = null;
let currentUser = null;
const users = new Map();
const cursorElements = new Map();

// ============================================
// DOM ELEMENTS
// ============================================

// Screens
const lobbyScreen = document.getElementById('lobby-screen');
const drawingScreen = document.getElementById('drawing-screen');

// Lobby elements
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const createRandomBtn = document.getElementById('create-random-btn');
const roomsList = document.getElementById('rooms-list');

// Drawing screen elements
const backBtn = document.getElementById('back-btn');
const currentRoomName = document.getElementById('current-room-name');
const userCount = document.getElementById('user-count');
const usersList = document.getElementById('users-list');
const toggleUsersBtn = document.getElementById('toggle-users');
const usersPanel = document.getElementById('users-panel');

// Canvas elements
const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const cursorsLayer = document.getElementById('cursors-layer');

// Mini map
const miniMapCanvas = document.getElementById('mini-map-canvas');
const miniMapCtx = miniMapCanvas.getContext('2d');
const viewportIndicator = document.getElementById('viewport-indicator');

// Tools
const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
const colorPicker = document.getElementById('color-picker');
const colorPreview = document.getElementById('color-preview');
const colorButtons = document.querySelectorAll('.color-btn');
const brushSizeSlider = document.getElementById('brush-size');
const sizeValue = document.getElementById('size-value');
const clearBtn = document.getElementById('clear-btn');
const centerBtn = document.getElementById('center-btn');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomLevelDisplay = document.getElementById('zoom-level');

// ============================================
// COORDINATE TRANSFORMATIONS
// ============================================

function screenToWorld(screenX, screenY) {
    return {
        x: (screenX - canvasState.offsetX) / canvasState.scale,
        y: (screenY - canvasState.offsetY) / canvasState.scale
    };
}

function worldToScreen(worldX, worldY) {
    return {
        x: worldX * canvasState.scale + canvasState.offsetX,
        y: worldY * canvasState.scale + canvasState.offsetY
    };
}

// ============================================
// CANVAS FUNCTIONS
// ============================================

function initCanvas() {
    resizeCanvas();
    centerCanvas();
    render();
    updateMiniMap();

    console.log('🎨 Canvas initialized!');
}

function resizeCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    canvasState.width = rect.width;
    canvasState.height = rect.height;

    canvas.width = rect.width;
    canvas.height = rect.height;

    miniMapCanvas.width = 150;
    miniMapCanvas.height = 100;
}

function centerCanvas() {
    canvasState.offsetX = (canvasState.width / 2) - (canvasState.worldWidth / 2) * canvasState.scale;
    canvasState.offsetY = (canvasState.height / 2) - (canvasState.worldHeight / 2) * canvasState.scale;
    canvasState.scale = 1;
    updateZoomDisplay();
}

function render() {
    // Clear canvas with white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid();

    // Draw all strokes and fills
    canvasState.drawings.forEach(item => {
        if (item.tool === 'bucket') {
            applyBucketFill(item);
        } else {
            renderStroke(item);
        }
    });
}

function drawGrid() {
    const gridSize = 50;

    ctx.strokeStyle = '#F0E6DC';
    ctx.lineWidth = 1;

    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(canvasState.width, canvasState.height);

    const startX = Math.floor(topLeft.x / gridSize) * gridSize;
    const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
        const screenPos = worldToScreen(x, 0);
        ctx.beginPath();
        ctx.moveTo(screenPos.x, 0);
        ctx.lineTo(screenPos.x, canvasState.height);
        ctx.stroke();
    }

    const startY = Math.floor(topLeft.y / gridSize) * gridSize;
    const endY = Math.ceil(bottomRight.y / gridSize) * gridSize;

    for (let y = startY; y <= endY; y += gridSize) {
        const screenPos = worldToScreen(0, y);
        ctx.beginPath();
        ctx.moveTo(0, screenPos.y);
        ctx.lineTo(canvasState.width, screenPos.y);
        ctx.stroke();
    }
}

function renderStroke(stroke) {
    if (!stroke.points || stroke.points.length < 2) return;

    ctx.save();

    if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
    }

    ctx.lineWidth = stroke.size * canvasState.scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    const firstPoint = worldToScreen(stroke.points[0].x, stroke.points[0].y);
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < stroke.points.length; i++) {
        const point = worldToScreen(stroke.points[i].x, stroke.points[i].y);
        ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
    ctx.restore();
}

function updateMiniMap() {
    const mapWidth = miniMapCanvas.width;
    const mapHeight = miniMapCanvas.height;

    miniMapCtx.fillStyle = '#F8F4EF';
    miniMapCtx.fillRect(0, 0, mapWidth, mapHeight);

    const mapScale = Math.min(mapWidth / canvasState.worldWidth, mapHeight / canvasState.worldHeight);

    miniMapCtx.lineWidth = 1;
    canvasState.drawings.forEach(stroke => {
        if (!stroke.points || stroke.points.length < 2) return;

        miniMapCtx.beginPath();
        miniMapCtx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;

        miniMapCtx.moveTo(stroke.points[0].x * mapScale, stroke.points[0].y * mapScale);

        for (let i = 1; i < stroke.points.length; i++) {
            miniMapCtx.lineTo(stroke.points[i].x * mapScale, stroke.points[i].y * mapScale);
        }

        miniMapCtx.stroke();
    });

    const viewLeft = -canvasState.offsetX / canvasState.scale * mapScale;
    const viewTop = -canvasState.offsetY / canvasState.scale * mapScale;
    const viewWidth = canvasState.width / canvasState.scale * mapScale;
    const viewHeight = canvasState.height / canvasState.scale * mapScale;

    viewportIndicator.style.left = `${viewLeft}px`;
    viewportIndicator.style.top = `${viewTop}px`;
    viewportIndicator.style.width = `${viewWidth}px`;
    viewportIndicator.style.height = `${viewHeight}px`;
}

function updateZoomDisplay() {
    zoomLevelDisplay.textContent = `${Math.round(canvasState.scale * 100)}%`;
}

function zoom(factor) {
    const centerX = canvasState.width / 2;
    const centerY = canvasState.height / 2;
    zoomAt(factor, centerX, centerY);
}

function zoomAt(factor, screenX, screenY) {
    const worldPos = screenToWorld(screenX, screenY);
    const newScale = Math.max(0.1, Math.min(5, canvasState.scale * factor));

    if (newScale !== canvasState.scale) {
        canvasState.scale = newScale;
        canvasState.offsetX = screenX - worldPos.x * canvasState.scale;
        canvasState.offsetY = screenY - worldPos.y * canvasState.scale;

        render();
        updateZoomDisplay();
        updateMiniMap();
    }
}

// ============================================
// DRAWING FUNCTIONS
// ============================================

function startDrawing(worldX, worldY) {
    drawingState.isDrawing = true;

    drawingState.currentStroke = {
        tool: drawingState.currentTool,
        color: drawingState.currentColor,
        size: drawingState.brushSize,
        points: [{ x: worldX, y: worldY }]
    };

    console.log('Started drawing at', worldX, worldY);
}

function continueDrawing(worldX, worldY) {
    if (!drawingState.isDrawing || !drawingState.currentStroke) return;

    drawingState.currentStroke.points.push({ x: worldX, y: worldY });

    const points = drawingState.currentStroke.points;

    if (points.length >= 2) {
        const prevPoint = points[points.length - 2];
        const currPoint = points[points.length - 1];

        const prevScreen = worldToScreen(prevPoint.x, prevPoint.y);
        const currScreen = worldToScreen(currPoint.x, currPoint.y);

        ctx.save();

        if (drawingState.currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = drawingState.currentColor;
        }

        ctx.lineWidth = drawingState.brushSize * canvasState.scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(prevScreen.x, prevScreen.y);
        ctx.lineTo(currScreen.x, currScreen.y);
        ctx.stroke();
        ctx.restore();
    }
}

function endDrawing() {
    if (!drawingState.isDrawing || !drawingState.currentStroke) return;

    drawingState.isDrawing = false;

    if (drawingState.currentStroke.points.length >= 2) {
        canvasState.drawings.push(drawingState.currentStroke);
        socket.emit('draw', drawingState.currentStroke);
        updateMiniMap();
        console.log('Stroke sent to server', drawingState.currentStroke.points.length, 'points');
    }

    drawingState.currentStroke = null;
}

function setTool(tool) {
    drawingState.currentTool = tool;

    toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    if (tool === 'eraser') {
        canvasContainer.style.cursor = 'cell';
    } else if (tool === 'bucket') {
        canvasContainer.style.cursor = 'cell';
    } else {
        canvasContainer.style.cursor = 'crosshair';
    }
}

function setColor(color) {
    drawingState.currentColor = color;
    colorPicker.value = color;
    colorPreview.style.background = color;
}

function setBrushSize(size) {
    drawingState.brushSize = parseInt(size);
    sizeValue.textContent = size;
}

// ============================================
// BUCKET FILL FUNCTIONS
// ============================================

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function colorsMatch(r1, g1, b1, r2, g2, b2, tolerance = 32) {
    return Math.abs(r1 - r2) <= tolerance &&
        Math.abs(g1 - g2) <= tolerance &&
        Math.abs(b1 - b2) <= tolerance;
}

function floodFill(startX, startY, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    startX = Math.floor(startX);
    startY = Math.floor(startY);

    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return null;

    const startPos = (startY * width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];

    const fillRgb = hexToRgb(fillColor);

    // Don't fill if clicking on the same color
    if (colorsMatch(startR, startG, startB, fillRgb.r, fillRgb.g, fillRgb.b, 10)) {
        return null;
    }

    const pixelsToCheck = [[startX, startY]];
    const visited = new Set();
    const filledPixels = [];
    const maxPixels = 500000; // Limit to prevent browser freeze
    let pixelCount = 0;

    while (pixelsToCheck.length > 0 && pixelCount < maxPixels) {
        const [x, y] = pixelsToCheck.pop();
        const key = `${x},${y}`;

        if (visited.has(key)) continue;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const pos = (y * width + x) * 4;
        const r = pixels[pos];
        const g = pixels[pos + 1];
        const b = pixels[pos + 2];

        if (!colorsMatch(r, g, b, startR, startG, startB)) continue;

        visited.add(key);
        pixelCount++;

        // Fill pixel
        pixels[pos] = fillRgb.r;
        pixels[pos + 1] = fillRgb.g;
        pixels[pos + 2] = fillRgb.b;
        pixels[pos + 3] = 255;

        filledPixels.push({ x, y });

        // Add neighbors
        pixelsToCheck.push([x + 1, y]);
        pixelsToCheck.push([x - 1, y]);
        pixelsToCheck.push([x, y + 1]);
        pixelsToCheck.push([x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);

    // Return fill data for syncing
    return {
        tool: 'bucket',
        color: fillColor,
        screenX: startX,
        screenY: startY,
        canvasWidth: width,
        canvasHeight: height,
        offsetX: canvasState.offsetX,
        offsetY: canvasState.offsetY,
        scale: canvasState.scale
    };
}

function applyBucketFill(fillData) {
    // Recalculate the screen position based on current view
    // This is a simplified approach - bucket fills are view-dependent
    const worldX = (fillData.screenX - fillData.offsetX) / fillData.scale;
    const worldY = (fillData.screenY - fillData.offsetY) / fillData.scale;
    const screenPos = worldToScreen(worldX, worldY);

    floodFill(screenPos.x, screenPos.y, fillData.color);
}

function clearLocalCanvas() {
    canvasState.drawings = [];
    render();
    updateMiniMap();
}

// ============================================
// CURSOR FUNCTIONS
// ============================================

function updateOtherCursor(data) {
    const { id, name, color, cursor } = data;

    if (id === socket.id) return;

    let cursorEl = cursorElements.get(id);

    if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.className = 'other-cursor';
        cursorEl.innerHTML = `
            <div class="cursor-pointer" style="background: ${color}"></div>
            <span class="cursor-name" style="border-color: ${color}; color: ${color}">${name}</span>
        `;
        cursorElements.set(id, cursorEl);
        cursorsLayer.appendChild(cursorEl);
    }

    const screenPos = worldToScreen(cursor.x, cursor.y);
    cursorEl.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px)`;
    cursorEl.style.opacity = '1';

    clearTimeout(cursorEl.hideTimeout);
    cursorEl.hideTimeout = setTimeout(() => {
        cursorEl.style.opacity = '0.3';
    }, 3000);
}

function removeCursor(userId) {
    const cursorEl = cursorElements.get(userId);
    if (cursorEl) {
        cursorEl.style.opacity = '0';
        setTimeout(() => {
            cursorEl.remove();
            cursorElements.delete(userId);
        }, 300);
    }
}

// ============================================
// ROOM FUNCTIONS
// ============================================

function generateRandomRoomName() {
    const adjectives = ['Renkli', 'Harika', 'Eglenceli', 'Yaratici', 'Parlak', 'Super', 'Muhtesem', 'Tatli'];
    const nouns = ['Cizimler', 'Sanat', 'Atolye', 'Studyo', 'Galeri', 'Tuval', 'Defter', 'Karalamalar'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 999);
    return `${adj}-${noun}-${num}`;
}

function joinRoom(roomId, userName) {
    if (!roomId.trim()) {
        roomInput.classList.add('shake');
        setTimeout(() => roomInput.classList.remove('shake'), 500);
        return;
    }

    currentRoom = roomId;
    currentUser = userName || usernameInput.value.trim() || 'Gizemli Çizer';

    socket.emit('join-room', roomId, currentUser);

    lobbyScreen.classList.remove('active');
    drawingScreen.classList.add('active');

    currentRoomName.textContent = roomId;

    // Initialize canvas after screen switch
    setTimeout(() => {
        initCanvas();
        setupCanvasEvents();
    }, 100);
}

function leaveRoom() {
    socket.emit('leave-room');

    currentRoom = null;
    users.clear();
    clearLocalCanvas();

    drawingScreen.classList.remove('active');
    lobbyScreen.classList.add('active');

    socket.emit('get-rooms');
}

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

// ============================================
// CANVAS EVENT HANDLERS
// ============================================

function setupCanvasEvents() {
    // Mouse events
    canvasContainer.addEventListener('mousedown', handleMouseDown);
    canvasContainer.addEventListener('mousemove', handleMouseMove);
    canvasContainer.addEventListener('mouseup', handleMouseUp);
    canvasContainer.addEventListener('mouseleave', handleMouseUp);
    canvasContainer.addEventListener('wheel', handleWheel, { passive: false });

    // Touch events
    canvasContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvasContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvasContainer.addEventListener('touchend', handleTouchEnd);

    // Window resize
    window.addEventListener('resize', () => {
        resizeCanvas();
        render();
        updateMiniMap();
    });

    console.log('🎯 Canvas events set up!');
}

function handleMouseDown(e) {
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Middle mouse button or Ctrl/Alt + left click for panning
    if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.altKey))) {
        canvasState.isPanning = true;
        canvasState.lastPanX = e.clientX;
        canvasState.lastPanY = e.clientY;
        canvasContainer.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }

    // Left click
    if (e.button === 0) {
        // Bucket tool - single click to fill
        if (drawingState.currentTool === 'bucket') {
            const fillData = floodFill(mouseX, mouseY, drawingState.currentColor);
            if (fillData) {
                canvasState.drawings.push(fillData);
                socket.emit('draw', fillData);
                updateMiniMap();
                console.log('Bucket fill applied');
            }
            return;
        }

        // Other tools - start drawing
        const worldPos = screenToWorld(mouseX, mouseY);
        startDrawing(worldPos.x, worldPos.y);
    }
}

function handleMouseMove(e) {
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = screenToWorld(mouseX, mouseY);

    // Send cursor position
    socket.emit('cursor-move', worldPos);

    // Panning
    if (canvasState.isPanning) {
        const dx = e.clientX - canvasState.lastPanX;
        const dy = e.clientY - canvasState.lastPanY;

        canvasState.offsetX += dx;
        canvasState.offsetY += dy;

        canvasState.lastPanX = e.clientX;
        canvasState.lastPanY = e.clientY;

        render();
        updateMiniMap();
        return;
    }

    // Drawing
    if (drawingState.isDrawing) {
        continueDrawing(worldPos.x, worldPos.y);
    }
}

function handleMouseUp(e) {
    if (canvasState.isPanning) {
        canvasState.isPanning = false;
        canvasContainer.style.cursor = drawingState.currentTool === 'eraser' ? 'cell' : 'crosshair';
    }

    if (drawingState.isDrawing) {
        endDrawing();
    }
}

function handleWheel(e) {
    e.preventDefault();

    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomAt(scaleFactor, mouseX, mouseY);
}

let lastTouchDistance = 0;

function handleTouchStart(e) {
    if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTouchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        e.preventDefault();
    } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvasContainer.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        const worldPos = screenToWorld(touchX, touchY);

        startDrawing(worldPos.x, worldPos.y);
        e.preventDefault();
    }
}

function handleTouchMove(e) {
    if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const distance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;

        if (lastTouchDistance > 0) {
            const scaleFactor = distance / lastTouchDistance;
            zoomAt(scaleFactor, centerX, centerY);
        }

        lastTouchDistance = distance;
        e.preventDefault();
    } else if (e.touches.length === 1 && drawingState.isDrawing) {
        const touch = e.touches[0];
        const rect = canvasContainer.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        const worldPos = screenToWorld(touchX, touchY);

        continueDrawing(worldPos.x, worldPos.y);
        e.preventDefault();
    }
}

function handleTouchEnd(e) {
    lastTouchDistance = 0;
    endDrawing();
}

// ============================================
// UI EVENT LISTENERS
// ============================================

// Lobby events
joinBtn.addEventListener('click', () => {
    joinRoom(roomInput.value.trim(), usernameInput.value);
});

createRandomBtn.addEventListener('click', () => {
    const randomRoom = generateRandomRoomName();
    roomInput.value = randomRoom;
    joinRoom(randomRoom, usernameInput.value);
});

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

// Drawing screen events
backBtn.addEventListener('click', leaveRoom);

toggleUsersBtn.addEventListener('click', () => {
    const list = usersPanel.querySelector('.users-list');
    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'block' : 'none';
    toggleUsersBtn.textContent = isHidden ? '−' : '+';
});

// Tool events
toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tool) {
            setTool(btn.dataset.tool);
        }
    });
});

colorPicker.addEventListener('input', (e) => {
    setColor(e.target.value);
});

colorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        setColor(btn.dataset.color);
    });
});

brushSizeSlider.addEventListener('input', (e) => {
    setBrushSize(e.target.value);
});

clearBtn.addEventListener('click', () => {
    if (confirm('Tüm çizimler silinecek. Emin misin? 🗑️')) {
        socket.emit('clear-canvas');
    }
});

centerBtn.addEventListener('click', () => {
    centerCanvas();
    render();
    updateMiniMap();
});

zoomInBtn.addEventListener('click', () => zoom(1.2));
zoomOutBtn.addEventListener('click', () => zoom(0.8));

// ============================================
// SOCKET EVENTS
// ============================================

socket.on('room-list', (rooms) => {
    updateRoomsList(rooms);
});

socket.on('user-list', (userList) => {
    updateUsersList(userList);
});

socket.on('user-joined', (user) => {
    users.set(user.id, user);
    console.log(`${user.name} odaya katıldı! 🎉`);
});

socket.on('user-left', (userId) => {
    const user = users.get(userId);
    if (user) {
        console.log(`${user.name} ayrıldı 👋`);
    }
    users.delete(userId);
    removeCursor(userId);
});

socket.on('load-drawings', (drawings) => {
    canvasState.drawings = drawings;
    render();
    updateMiniMap();
    console.log(`Loaded ${drawings.length} drawings from server`);
});

socket.on('draw', (drawData) => {
    canvasState.drawings.push(drawData);
    renderStroke(drawData);
    updateMiniMap();
});

socket.on('cursor-update', (data) => {
    updateOtherCursor(data);
});

socket.on('canvas-cleared', () => {
    clearLocalCanvas();
});

// ============================================
// INITIALIZATION
// ============================================

// Set initial color preview
colorPreview.style.background = drawingState.currentColor;

// Request room list
socket.emit('get-rooms');

// Add shake animation
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-5px); }
        40%, 80% { transform: translateX(5px); }
    }
    .shake {
        animation: shake 0.5s ease;
        border-color: #FC5C65 !important;
    }
`;
document.head.appendChild(shakeStyle);

// ============================================
// DARK MODE
// ============================================

const darkModeBtn = document.getElementById('dark-mode-btn');
const darkModeIcon = document.getElementById('dark-mode-icon');
let isDarkMode = localStorage.getItem('darkMode') === 'true';

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    darkModeIcon.textContent = isDarkMode ? '☀️' : '🌙';
    localStorage.setItem('darkMode', isDarkMode);
}

// Initialize dark mode from localStorage
if (isDarkMode) {
    document.body.classList.add('dark-mode');
    darkModeIcon.textContent = '☀️';
}

darkModeBtn.addEventListener('click', toggleDarkMode);

// ============================================
// OWN CURSOR TRACKING
// ============================================

const myCursor = document.getElementById('my-cursor');

function updateMyCursor(e) {
    if (!myCursor || !drawingScreen.classList.contains('active')) return;

    const rect = canvasContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Show cursor only when inside canvas
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        myCursor.style.display = 'block';
        myCursor.style.left = `${x}px`;
        myCursor.style.top = `${y}px`;
    } else {
        myCursor.style.display = 'none';
    }
}

// Track cursor movement globally
document.addEventListener('mousemove', updateMyCursor);

// Hide default cursor on canvas container
canvasContainer.style.cursor = 'none';

console.log('🎨 Draw2Gather loaded! Ready to create art together!');


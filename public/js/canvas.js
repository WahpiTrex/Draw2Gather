// ===== Canvas.js - Infinite Canvas with Pan/Zoom =====

// Canvas elements
const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');

// Mini map elements
const miniMapCanvas = document.getElementById('mini-map-canvas');
const miniMapCtx = miniMapCanvas.getContext('2d');
const viewportIndicator = document.getElementById('viewport-indicator');

// Zoom controls
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomLevelDisplay = document.getElementById('zoom-level');
const centerBtn = document.getElementById('center-btn');

// Canvas state
let canvasState = {
    // View transform
    offsetX: 0,
    offsetY: 0,
    scale: 1,

    // Canvas size (virtual infinite canvas bounds for drawing)
    worldWidth: 10000,
    worldHeight: 10000,

    // Actual canvas element size
    width: 0,
    height: 0,

    // Panning state
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,

    // Drawing history (local cache)
    drawings: []
};

// ===== Canvas Initialization =====

function initCanvas() {
    resizeCanvas();
    centerCanvas();

    // Set up event listeners
    window.addEventListener('resize', resizeCanvas);

    // Mouse events for panning
    canvasContainer.addEventListener('mousedown', handleMouseDown);
    canvasContainer.addEventListener('mousemove', handleMouseMove);
    canvasContainer.addEventListener('mouseup', handleMouseUp);
    canvasContainer.addEventListener('mouseleave', handleMouseUp);

    // Touch events for mobile
    canvasContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvasContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvasContainer.addEventListener('touchend', handleTouchEnd);

    // Zoom with mouse wheel
    canvasContainer.addEventListener('wheel', handleWheel, { passive: false });

    // Zoom buttons
    zoomInBtn.addEventListener('click', () => zoom(1.2));
    zoomOutBtn.addEventListener('click', () => zoom(0.8));
    centerBtn.addEventListener('click', centerCanvas);

    // Initial render
    render();
    updateMiniMap();
}

function resizeCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    canvasState.width = rect.width;
    canvasState.height = rect.height;

    canvas.width = rect.width;
    canvas.height = rect.height;

    // Mini map size
    miniMapCanvas.width = 150;
    miniMapCanvas.height = 100;

    render();
    updateMiniMap();
}

function centerCanvas() {
    // Center the view on the middle of the world
    canvasState.offsetX = (canvasState.width / 2) - (canvasState.worldWidth / 2) * canvasState.scale;
    canvasState.offsetY = (canvasState.height / 2) - (canvasState.worldHeight / 2) * canvasState.scale;
    canvasState.scale = 1;

    render();
    updateZoomDisplay();
    updateMiniMap();
}

// ===== Coordinate Transformations =====

// Screen coordinates to world coordinates
function screenToWorld(screenX, screenY) {
    return {
        x: (screenX - canvasState.offsetX) / canvasState.scale,
        y: (screenY - canvasState.offsetY) / canvasState.scale
    };
}

// World coordinates to screen coordinates
function worldToScreen(worldX, worldY) {
    return {
        x: worldX * canvasState.scale + canvasState.offsetX,
        y: worldY * canvasState.scale + canvasState.offsetY
    };
}

// ===== Pan & Zoom Handlers =====

function handleMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.ctrlKey) || (e.button === 0 && e.altKey)) {
        // Middle mouse button or Ctrl+Left click for panning
        canvasState.isPanning = true;
        canvasState.lastPanX = e.clientX;
        canvasState.lastPanY = e.clientY;
        canvasContainer.style.cursor = 'grabbing';
        e.preventDefault();
    }
}

function handleMouseMove(e) {
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Send cursor position to server
    const worldPos = screenToWorld(mouseX, mouseY);
    socket.emit('cursor-move', worldPos);

    if (canvasState.isPanning) {
        const dx = e.clientX - canvasState.lastPanX;
        const dy = e.clientY - canvasState.lastPanY;

        canvasState.offsetX += dx;
        canvasState.offsetY += dy;

        canvasState.lastPanX = e.clientX;
        canvasState.lastPanY = e.clientY;

        render();
        updateMiniMap();
    }
}

function handleMouseUp(e) {
    if (canvasState.isPanning) {
        canvasState.isPanning = false;
        canvasContainer.style.cursor = 'crosshair';
    }
}

// Touch handling for mobile
let lastTouchDistance = 0;

function handleTouchStart(e) {
    if (e.touches.length === 2) {
        // Two finger touch - prepare for pinch zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTouchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        e.preventDefault();
    } else if (e.touches.length === 1) {
        // Check if there's a modifier for panning (won't work on touch, so skip)
    }
}

function handleTouchMove(e) {
    if (e.touches.length === 2) {
        // Pinch zoom
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
    }
}

function handleTouchEnd(e) {
    lastTouchDistance = 0;
}

function handleWheel(e) {
    e.preventDefault();

    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom in/out based on scroll direction
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomAt(scaleFactor, mouseX, mouseY);
}

function zoom(factor) {
    // Zoom centered on canvas
    const centerX = canvasState.width / 2;
    const centerY = canvasState.height / 2;
    zoomAt(factor, centerX, centerY);
}

function zoomAt(factor, screenX, screenY) {
    const worldPos = screenToWorld(screenX, screenY);

    // Apply scale with limits
    const newScale = Math.max(0.1, Math.min(5, canvasState.scale * factor));

    if (newScale !== canvasState.scale) {
        canvasState.scale = newScale;

        // Adjust offset to keep the point under cursor in place
        canvasState.offsetX = screenX - worldPos.x * canvasState.scale;
        canvasState.offsetY = screenY - worldPos.y * canvasState.scale;

        render();
        updateZoomDisplay();
        updateMiniMap();
    }
}

function updateZoomDisplay() {
    zoomLevelDisplay.textContent = `${Math.round(canvasState.scale * 100)}%`;
}

// ===== Rendering =====

function render() {
    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid (optional, for spatial reference)
    drawGrid();

    // Draw all strokes
    canvasState.drawings.forEach(drawing => {
        renderStroke(drawing);
    });
}

function drawGrid() {
    const gridSize = 50;

    ctx.strokeStyle = '#F0E6DC';
    ctx.lineWidth = 1;

    // Calculate visible range in world coordinates
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(canvasState.width, canvasState.height);

    // Vertical lines
    const startX = Math.floor(topLeft.x / gridSize) * gridSize;
    const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
        const screenPos = worldToScreen(x, 0);
        ctx.beginPath();
        ctx.moveTo(screenPos.x, 0);
        ctx.lineTo(screenPos.x, canvasState.height);
        ctx.stroke();
    }

    // Horizontal lines
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

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size * canvasState.scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Handle eraser
    if (stroke.tool === 'eraser') {
        ctx.strokeStyle = '#FFFFFF';
    }

    const firstPoint = worldToScreen(stroke.points[0].x, stroke.points[0].y);
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < stroke.points.length; i++) {
        const point = worldToScreen(stroke.points[i].x, stroke.points[i].y);
        ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
}

// ===== Drawing Data Management =====

function loadDrawings(drawings) {
    canvasState.drawings = drawings;
    render();
    updateMiniMap();
}

function addDrawing(drawing) {
    canvasState.drawings.push(drawing);
    renderStroke(drawing);
    updateMiniMap();
}

function drawFromData(drawData) {
    addDrawing(drawData);
}

function clearLocalCanvas() {
    canvasState.drawings = [];
    render();
    updateMiniMap();
}

// ===== Mini Map =====

function updateMiniMap() {
    const mapWidth = miniMapCanvas.width;
    const mapHeight = miniMapCanvas.height;

    // Clear
    miniMapCtx.fillStyle = '#F8F4EF';
    miniMapCtx.fillRect(0, 0, mapWidth, mapHeight);

    // Calculate scale for mini map
    const mapScale = Math.min(
        mapWidth / canvasState.worldWidth,
        mapHeight / canvasState.worldHeight
    );

    // Draw simplified strokes
    miniMapCtx.lineWidth = 1;
    canvasState.drawings.forEach(stroke => {
        if (!stroke.points || stroke.points.length < 2) return;

        miniMapCtx.beginPath();
        miniMapCtx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;

        miniMapCtx.moveTo(
            stroke.points[0].x * mapScale,
            stroke.points[0].y * mapScale
        );

        for (let i = 1; i < stroke.points.length; i++) {
            miniMapCtx.lineTo(
                stroke.points[i].x * mapScale,
                stroke.points[i].y * mapScale
            );
        }

        miniMapCtx.stroke();
    });

    // Update viewport indicator
    const viewLeft = -canvasState.offsetX / canvasState.scale * mapScale;
    const viewTop = -canvasState.offsetY / canvasState.scale * mapScale;
    const viewWidth = canvasState.width / canvasState.scale * mapScale;
    const viewHeight = canvasState.height / canvasState.scale * mapScale;

    viewportIndicator.style.left = `${viewLeft}px`;
    viewportIndicator.style.top = `${viewTop}px`;
    viewportIndicator.style.width = `${viewWidth}px`;
    viewportIndicator.style.height = `${viewHeight}px`;
}

// Export for other modules
window.canvasState = canvasState;
window.screenToWorld = screenToWorld;
window.worldToScreen = worldToScreen;
window.render = render;
window.loadDrawings = loadDrawings;
window.drawFromData = drawFromData;
window.clearLocalCanvas = clearLocalCanvas;
window.initCanvas = initCanvas;

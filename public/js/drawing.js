// ===== Drawing.js - Drawing Tools =====

// Tool buttons
const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
const colorPicker = document.getElementById('color-picker');
const colorPreview = document.getElementById('color-preview');
const colorButtons = document.querySelectorAll('.color-btn');
const brushSizeSlider = document.getElementById('brush-size');
const sizeValue = document.getElementById('size-value');
const clearBtn = document.getElementById('clear-btn');

// Drawing state
let drawingState = {
    isDrawing: false,
    currentTool: 'pencil',
    currentColor: '#FF6B6B',
    brushSize: 5,
    currentStroke: null
};

// ===== Tool Selection =====

function setTool(tool) {
    drawingState.currentTool = tool;

    toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Change cursor based on tool
    const container = document.getElementById('canvas-container');
    if (tool === 'eraser') {
        container.style.cursor = 'cell';
    } else {
        container.style.cursor = 'crosshair';
    }
}

// ===== Color Selection =====

function setColor(color) {
    drawingState.currentColor = color;
    colorPicker.value = color;
    colorPreview.style.background = color;
}

// ===== Brush Size =====

function setBrushSize(size) {
    drawingState.brushSize = parseInt(size);
    sizeValue.textContent = size;
}

// ===== Drawing Logic =====

function startDrawing(worldX, worldY) {
    drawingState.isDrawing = true;

    drawingState.currentStroke = {
        tool: drawingState.currentTool,
        color: drawingState.currentColor,
        size: drawingState.brushSize,
        points: [{ x: worldX, y: worldY }]
    };
}

function continueDrawing(worldX, worldY) {
    if (!drawingState.isDrawing || !drawingState.currentStroke) return;

    // Add point to current stroke
    drawingState.currentStroke.points.push({ x: worldX, y: worldY });

    // Draw the line segment locally for immediate feedback
    const ctx = document.getElementById('drawing-canvas').getContext('2d');
    const points = drawingState.currentStroke.points;

    if (points.length >= 2) {
        const prevPoint = points[points.length - 2];
        const currPoint = points[points.length - 1];

        const prevScreen = worldToScreen(prevPoint.x, prevPoint.y);
        const currScreen = worldToScreen(currPoint.x, currPoint.y);

        ctx.beginPath();
        ctx.strokeStyle = drawingState.currentTool === 'eraser' ? '#FFFFFF' : drawingState.currentColor;
        ctx.lineWidth = drawingState.brushSize * canvasState.scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(prevScreen.x, prevScreen.y);
        ctx.lineTo(currScreen.x, currScreen.y);
        ctx.stroke();
    }
}

function endDrawing() {
    if (!drawingState.isDrawing || !drawingState.currentStroke) return;

    drawingState.isDrawing = false;

    // Only send if we have at least 2 points
    if (drawingState.currentStroke.points.length >= 2) {
        // Add to local drawings
        canvasState.drawings.push(drawingState.currentStroke);

        // Send to server
        socket.emit('draw', drawingState.currentStroke);

        // Update mini map
        if (typeof updateMiniMap === 'function') {
            updateMiniMap();
        }
    }

    drawingState.currentStroke = null;
}

// ===== Event Listeners =====

// Tool buttons
toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tool) {
            setTool(btn.dataset.tool);
        }
    });
});

// Color picker
colorPicker.addEventListener('input', (e) => {
    setColor(e.target.value);
});

// Quick color buttons
colorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        setColor(btn.dataset.color);
    });
});

// Brush size
brushSizeSlider.addEventListener('input', (e) => {
    setBrushSize(e.target.value);
});

// Clear canvas button
clearBtn.addEventListener('click', () => {
    if (confirm('Tüm çizimler silinecek. Emin misin? 🗑️')) {
        socket.emit('clear-canvas');
    }
});

// ===== Canvas Drawing Events =====

const canvasContainer = document.getElementById('canvas-container');

// Mouse events
canvasContainer.addEventListener('mousedown', (e) => {
    // Only draw with left mouse button and no modifiers
    if (e.button === 0 && !e.ctrlKey && !e.altKey) {
        const rect = canvasContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = screenToWorld(mouseX, mouseY);

        startDrawing(worldPos.x, worldPos.y);
    }
});

canvasContainer.addEventListener('mousemove', (e) => {
    if (drawingState.isDrawing) {
        const rect = canvasContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = screenToWorld(mouseX, mouseY);

        continueDrawing(worldPos.x, worldPos.y);
    }
});

canvasContainer.addEventListener('mouseup', endDrawing);
canvasContainer.addEventListener('mouseleave', endDrawing);

// Touch events for drawing
canvasContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvasContainer.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        const worldPos = screenToWorld(touchX, touchY);

        startDrawing(worldPos.x, worldPos.y);
        e.preventDefault();
    }
}, { passive: false });

canvasContainer.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && drawingState.isDrawing) {
        const touch = e.touches[0];
        const rect = canvasContainer.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        const worldPos = screenToWorld(touchX, touchY);

        continueDrawing(worldPos.x, worldPos.y);
        e.preventDefault();
    }
}, { passive: false });

canvasContainer.addEventListener('touchend', (e) => {
    endDrawing();
});

// ===== Initialize =====

// Set initial color preview
colorPreview.style.background = drawingState.currentColor;

// Export for other modules
window.drawingState = drawingState;

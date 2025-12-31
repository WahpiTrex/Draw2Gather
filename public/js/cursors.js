// ===== Cursors.js - Other Users' Cursor Display =====

const cursorsLayer = document.getElementById('cursors-layer');

// Store cursor elements
const cursorElements = new Map();

// ===== Cursor Management =====

function updateOtherCursor(data) {
    const { id, name, color, cursor } = data;

    // Don't show our own cursor
    if (id === socket.id) return;

    let cursorEl = cursorElements.get(id);

    if (!cursorEl) {
        // Create new cursor element
        cursorEl = createCursorElement(id, name, color);
        cursorElements.set(id, cursorEl);
        cursorsLayer.appendChild(cursorEl);
    }

    // Update position
    const screenPos = worldToScreen(cursor.x, cursor.y);

    cursorEl.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px)`;
    cursorEl.style.opacity = '1';

    // Hide cursor after 3 seconds of inactivity
    clearTimeout(cursorEl.hideTimeout);
    cursorEl.hideTimeout = setTimeout(() => {
        cursorEl.style.opacity = '0.3';
    }, 3000);
}

function createCursorElement(id, name, color) {
    const cursor = document.createElement('div');
    cursor.className = 'other-cursor';
    cursor.id = `cursor-${id}`;

    cursor.innerHTML = `
        <div class="cursor-pointer" style="background: ${color}"></div>
        <span class="cursor-name" style="border-color: ${color}; color: ${color}">${name}</span>
    `;

    // Add entrance animation
    cursor.style.animation = 'cursorAppear 0.3s ease-out';

    return cursor;
}

function removeCursor(userId) {
    const cursorEl = cursorElements.get(userId);
    if (cursorEl) {
        // Fade out animation
        cursorEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        cursorEl.style.opacity = '0';
        cursorEl.style.transform += ' scale(0.5)';

        setTimeout(() => {
            cursorEl.remove();
            cursorElements.delete(userId);
        }, 300);
    }
}

// ===== Update all cursors when view changes =====

function updateAllCursors() {
    // This would be called when panning/zooming to update cursor positions
    // For now, cursors will naturally update with the next cursor-move event
}

// ===== Add cursor animation styles =====

const cursorStyles = document.createElement('style');
cursorStyles.textContent = `
    @keyframes cursorAppear {
        from {
            opacity: 0;
            transform: scale(0.5);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    
    .other-cursor {
        opacity: 1;
        transition: transform 0.1s linear, opacity 0.5s ease;
    }
`;
document.head.appendChild(cursorStyles);

// ===== Export =====

window.updateOtherCursor = updateOtherCursor;
window.removeCursor = removeCursor;

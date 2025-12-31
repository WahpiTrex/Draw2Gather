const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Room data storage
const rooms = new Map();

// Generate random color for user cursor
function generateUserColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        '#BB8FCE', '#85C1E9', '#F8B500', '#FF8C00'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Generate random cute name
function generateUserName() {
    const adjectives = ['Mutlu', 'Neşeli', 'Hızlı', 'Yaratıcı', 'Renkli', 'Sevimli', 'Parlak', 'Eğlenceli'];
    const nouns = ['Fırça', 'Kalem', 'Boya', 'Çizgi', 'Nokta', 'Yıldız', 'Bulut', 'Gökkuşağı'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    let currentRoom = null;
    let userData = {
        id: socket.id,
        name: generateUserName(),
        color: generateUserColor(),
        cursor: { x: 0, y: 0 }
    };

    // Get list of rooms
    socket.on('get-rooms', () => {
        const roomList = [];
        rooms.forEach((data, roomId) => {
            roomList.push({
                id: roomId,
                userCount: data.users.size
            });
        });
        socket.emit('room-list', roomList);
    });

    // Create or join a room
    socket.on('join-room', (roomId, userName) => {
        if (currentRoom) {
            leaveRoom();
        }

        currentRoom = roomId;
        if (userName) {
            userData.name = userName;
        }

        // Create room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                users: new Map(),
                drawings: [],
                createdAt: Date.now()
            });
        }

        const room = rooms.get(roomId);
        room.users.set(socket.id, userData);

        socket.join(roomId);

        // Send existing drawings to the new user
        socket.emit('load-drawings', room.drawings);

        // Send user list to everyone in the room
        const userList = Array.from(room.users.values());
        io.to(roomId).emit('user-list', userList);

        // Notify others about new user
        socket.to(roomId).emit('user-joined', userData);

        console.log(`${userData.name} joined room: ${roomId}`);
    });

    // Handle drawing
    socket.on('draw', (drawData) => {
        if (!currentRoom || !rooms.has(currentRoom)) return;

        const room = rooms.get(currentRoom);

        // Add to drawings history
        room.drawings.push(drawData);

        // Limit drawings to prevent memory issues (keep last 10000)
        if (room.drawings.length > 10000) {
            room.drawings = room.drawings.slice(-8000);
        }

        // Broadcast to others in the room
        socket.to(currentRoom).emit('draw', drawData);
    });

    // Handle cursor movement
    socket.on('cursor-move', (position) => {
        if (!currentRoom || !rooms.has(currentRoom)) return;

        userData.cursor = position;

        const room = rooms.get(currentRoom);
        room.users.set(socket.id, userData);

        // Broadcast cursor position to others
        socket.to(currentRoom).emit('cursor-update', {
            id: socket.id,
            name: userData.name,
            color: userData.color,
            cursor: position
        });
    });

    // Handle clear canvas
    socket.on('clear-canvas', () => {
        if (!currentRoom || !rooms.has(currentRoom)) return;

        const room = rooms.get(currentRoom);
        room.drawings = [];

        io.to(currentRoom).emit('canvas-cleared');
    });

    // Leave room function
    function leaveRoom() {
        if (currentRoom && rooms.has(currentRoom)) {
            const room = rooms.get(currentRoom);
            room.users.delete(socket.id);

            socket.to(currentRoom).emit('user-left', socket.id);

            // Send updated user list
            const userList = Array.from(room.users.values());
            io.to(currentRoom).emit('user-list', userList);

            // Delete room if empty
            if (room.users.size === 0) {
                rooms.delete(currentRoom);
                console.log(`Room deleted: ${currentRoom}`);
            }

            socket.leave(currentRoom);
            console.log(`${userData.name} left room: ${currentRoom}`);
        }
        currentRoom = null;
    }

    // Handle leave room
    socket.on('leave-room', () => {
        leaveRoom();
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        leaveRoom();
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3131;
server.listen(PORT, () => {
    console.log(`🎨 Draw2Gather server running on http://localhost:${PORT}`);
});

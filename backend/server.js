const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Frontend dosyalarını servis et
app.use(express.static(path.join(__dirname, '../frontend')));

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Veritabanı (geçici)
let users = {};
let rooms = {};
let messages = {};

// Rastgele oda kodu üret
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Aynı kod varsa yeniden üret
  if (rooms[result]) {
    return generateRoomCode();
  }
  return result;
}

io.on('connection', (socket) => {
  console.log('✅ Yeni kullanıcı bağlandı:', socket.id);

  // Kullanıcı girişi
  socket.on('user_login', (data) => {
    users[socket.id] = data.username;
    socket.username = data.username;
    console.log('👤 Kullanıcı girişi:', data.username);
    
    // Kullanıcının odalarını gönder
    const userRooms = Object.values(rooms).filter(room => 
      room.members.includes(data.username)
    );
    socket.emit('user_rooms', userRooms);
  });

  // Oda oluştur
  socket.on('create_room', (data) => {
    const roomCode = generateRoomCode();
    const room = {
      id: roomCode,
      code: roomCode,
      name: data.name,
      description: data.description,
      creator: socket.username,
      members: [socket.username],
      createdAt: new Date().toISOString()
    };

    rooms[roomCode] = room;
    messages[roomCode] = [];

    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('room_created', { room, roomCode });
    console.log('🎯 Oda oluşturuldu:', roomCode, 'Oda sahibi:', socket.username);
  });

  // Odaya katıl
  socket.on('join_room', (data) => {
    const roomCode = data.roomCode.toUpperCase();
    const room = rooms[roomCode];

    if (!room) {
      socket.emit('room_not_found', { message: '❌ Oda bulunamadı! Geçersiz oda kodu.' });
      return;
    }

    // Kullanıcıyı odaya ekle
    if (!room.members.includes(socket.username)) {
      room.members.push(socket.username);
    }

    socket.join(roomCode);
    socket.roomCode = roomCode;

    // Kullanıcıya oda bilgilerini gönder
    socket.emit('room_joined', { 
      room, 
      messages: messages[roomCode] || [] 
    });
    
    // Odadaki herkese güncel üye listesini gönder
    io.to(roomCode).emit('room_updated', room);
    io.to(roomCode).emit('user_joined', { 
      username: socket.username, 
      members: room.members 
    });

    console.log('✅ Kullanıcı odaya katıldı:', socket.username, 'Oda:', roomCode);
  });

  // Mesaj gönder
  socket.on('send_message', (data) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const message = {
      id: Date.now().toString(),
      text: data.text,
      sender: socket.username,
      timestamp: new Date().toISOString(),
      roomId: roomCode
    };

    // Mesajı kaydet
    if (!messages[roomCode]) {
      messages[roomCode] = [];
    }
    messages[roomCode].push(message);

    // Odadaki herkese mesajı gönder
    io.to(roomCode).emit('new_message', message);
    console.log('💬 Mesaj gönderildi:', socket.username, 'Oda:', roomCode);
  });

  // Sohbeti temizle
  socket.on('clear_chat', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    
    // Sadece oda sahibi temizleyebilir
    if (room.creator !== socket.username) {
      socket.emit('clear_chat_error', { message: '❌ Sadece oda sahibi sohbeti temizleyebilir!' });
      return;
    }

    messages[roomCode] = [];
    io.to(roomCode).emit('chat_cleared');
    console.log('🧹 Sohbet temizlendi. Oda:', roomCode);
  });

  // Odadan ayrıl
  socket.on('leave_room', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    
    // Kullanıcıyı üye listesinden çıkar
    room.members = room.members.filter(member => member !== socket.username);
    
    socket.leave

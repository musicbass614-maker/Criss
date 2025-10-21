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

// API test endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Zahir Chat Server Çalışıyor',
    timestamp: new Date().toISOString(),
    activeRooms: Object.keys(rooms).length,
    activeUsers: Object.keys(users).length
  });
});

// Veritabanı (geçici - memory)
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

// Socket.io bağlantı yönetimi
io.on('connection', (socket) => {
  console.log('✅ Yeni kullanıcı bağlandı:', socket.id);

  // Kullanıcı girişi
  socket.on('user_login', (data) => {
    try {
      if (!data.username) {
        socket.emit('login_error', { message: 'Kullanıcı adı gerekli!' });
        return;
      }

      users[socket.id] = data.username;
      socket.username = data.username;
      
      console.log('👤 Kullanıcı girişi:', data.username);
      
      // Kullanıcının odalarını bul ve gönder
      const userRooms = Object.values(rooms).filter(room => 
        room.members.includes(data.username)
      );
      
      socket.emit('login_success', { 
        username: data.username,
        rooms: userRooms 
      });
      
    } catch (error) {
      console.error('Login hatası:', error);
      socket.emit('login_error', { message: 'Giriş sırasında hata oluştu!' });
    }
  });

  // Oda oluştur
  socket.on('create_room', (data) => {
    try {
      if (!socket.username) {
        socket.emit('room_error', { message: 'Önce giriş yapmalısınız!' });
        return;
      }

      if (!data.name) {
        socket.emit('room_error', { message: 'Oda ismi gerekli!' });
        return;
      }

      const roomCode = generateRoomCode();
      const room = {
        id: roomCode,
        code: roomCode,
        name: data.name,
        description: data.description || 'Açıklama yok',
        creator: socket.username,
        members: [socket.username],
        createdAt: new Date().toISOString()
      };

      // Odayı kaydet
      rooms[roomCode] = room;
      messages[roomCode] = [];

      // Kullanıcıyı odaya ekle
      socket.join(roomCode);
      socket.roomCode = roomCode;

      console.log('🎯 Oda oluşturuldu:', roomCode, 'Oda sahibi:', socket.username);

      // Başarılı yanıt
      socket.emit('room_created', { 
        room: room, 
        roomCode: roomCode 
      });

    } catch (error) {
      console.error('Oda oluşturma hatası:', error);
      socket.emit('room_error', { message: 'Oda oluşturulurken hata oluştu!' });
    }
  });

  // Odaya katıl
  socket.on('join_room', (data) => {
    try {
      if (!socket.username) {
        socket.emit('room_error', { message: 'Önce giriş yapmalısınız!' });
        return;
      }

      const roomCode = data.roomCode.toUpperCase();
      const room = rooms[roomCode];

      if (!room) {
        socket.emit('room_not_found', { message: '❌ Oda bulunamadı! Geçersiz oda kodu.' });
        return;
      }

      // Kullanıcıyı odaya ekle (eğer zaten yoksa)
      if (!room.members.includes(socket.username)) {
        room.members.push(socket.username);
      }

      // Socket'i odaya ekle
      socket.join(roomCode);
      socket.roomCode = roomCode;

      console.log('✅ Kullanıcı odaya katıldı:', socket.username, 'Oda:', roomCode);

      // Katılan kullanıcıya oda bilgilerini gönder
      socket.emit('room_joined', { 
        room: room, 
        messages: messages[roomCode] || [] 
      });
      
      // Odadaki diğer kullanıcılara güncel durumu bildir
      io.to(roomCode).emit('room_updated', room);
      io.to(roomCode).emit('user_joined', { 
        username: socket.username, 
        members: room.members,
        message: `${socket.username} odaya katıldı`
      });

    } catch (error) {
      console.error('Odaya katılma hatası:', error);
      socket.emit('room_error', { message: 'Odaya katılırken hata oluştu!' });
    }
  });

  // Mesaj gönder
  socket.on('send_message', (data) => {
    try {
      const roomCode = socket.roomCode;
      
      if (!roomCode || !rooms[roomCode]) {
        socket.emit('message_error', { message: 'Önce bir odaya katılmalısınız!' });
        return;
      }

      if (!data.text || data.text.trim() === '') {
        return;
      }

      const message = {
        id: Date.now().toString(),
        text: data.text.trim(),
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

    } catch (error) {
      console.error('Mesaj gönderme hatası:', error);
      socket.emit('message_error', { message: 'Mesaj gönderilirken hata oluştu!' });
    }
  });

  // Sohbeti temizle
  socket.on('clear_chat', () => {
    try {
      const roomCode = socket.roomCode;
      if (!roomCode || !rooms[roomCode]) {
        socket.emit('clear_chat_error', { message: 'Geçerli bir odada değilsiniz!' });
        return;
      }

      const room = rooms[roomCode];
      
      // Sadece oda sahibi temizleyebilir
      if (room.creator !== socket.username) {
        socket.emit('clear_chat_error', { message: '❌ Sadece oda sahibi sohbeti temizleyebilir!' });
        return;
      }

      // Mesajları temizle
      messages[roomCode] = [];
      
      // Odadaki herkese bildir
      io.to(roomCode).emit('chat_cleared');
      
      console.log('🧹 Sohbet temizlendi. Oda:', roomCode, 'Temizleyen:', socket.username);

    } catch (error) {
      console.error('Sohbet temizleme hatası:', error);
      socket.emit('clear_chat_error', { message: 'Sohbet temizlenirken hata oluştu!' });
    }
  });

  // Odadan ayrıl
  socket.on('leave_room', () => {
    try {
      const roomCode = socket.roomCode;
      if (!roomCode || !rooms[roomCode]) return;

      const room = rooms[roomCode];
      
      // Kullanıcıyı üye listesinden çıkar
      room.members = room.members.filter(member => member !== socket.username);
      
      // Socket'ten odayı çıkar
      socket.leave(roomCode);
      socket.roomCode = null;

      console.log('👋 Kullanıcı odadan ayrıldı:', socket.username, 'Oda:', roomCode);

      // Odadaki diğer kullanıcılara bildir
      io.to(roomCode).emit('room_updated', room);
      io.to(roomCode).emit('user_left', { 
        username: socket.username, 
        members: room.members,
        message: `${socket.username} odadan ayrıldı`
      });

      // Eğer odada kimse kalmadıysa odayı temizle (1 saat sonra)
      if (room.members.length === 0) {
        console.log('🏁 Oda boş kaldı, temizlenecek:', roomCode);
        // Gerçek uygulamada burada veritabanı temizliği yapılır
      }

    } catch (error) {
      console.error('Odadan ayrılma hatası:', error);
    }
  });

  // Bağlantı kesildiğinde
  socket.on('disconnect', (reason) => {
    console.log('❌ Kullanıcı ayrıldı:', socket.id, socket.username, 'Sebep:', reason);
    
    // Eğer bir odadaysa odadan çıkar
    if (socket.roomCode) {
      const roomCode = socket.roomCode;
      const room = rooms[roomCode];
      
      if (room) {
        room.members = room.members.filter(member => member !== socket.username);
        
        // Odadaki diğer kullanıcılara bildir
        io.to(roomCode).emit('room_updated', room);
        io.to(roomCode).emit('user_left', { 
          username: socket.username, 
          members: room.members,
          message: `${socket.username} bağlantısı koptu`
        });

        // Eğer odada kimse kalmadıysa
        if (room.members.length === 0) {
          console.log('🏁 Oda boş kaldı (disconnect):', roomCode);
        }
      }
    }

    // Kullanıcıyı listeden sil
    delete users[socket.id];
  });

  // Ping-pong (bağlantı kontrolü)
  socket.on('ping', (cb) => {
    if (typeof cb === 'function') {
      cb('pong');
    }
  });
});

// Hata yönetimi
process.on('uncaughtException', (error) => {
  console.error('❌ Beklenmeyen Hata:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ İşlenmemiş Promise:', reason);
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🚀 =================================');
  console.log('🚀 Zahir Chat Server Başlatıldı!');
  console.log('🚀 Port:', PORT);
  console.log('🚀 URL: http://localhost:' + PORT);
  console.log('🚀 API Status: http://localhost:' + PORT + '/api/status');
  console.log('🚀 =================================');
  
  // Her 5 dakikada bir sistem durumunu logla
  setInterval(() => {
    console.log('📊 Sistem Durumu:', {
      activeRooms: Object.keys(rooms).length,
      activeUsers: Object.keys(users).length,
      totalMessages: Object.values(messages).reduce((acc, msgs) => acc + msgs.length, 0)
    });
  }, 300000); // 5 dakika
});

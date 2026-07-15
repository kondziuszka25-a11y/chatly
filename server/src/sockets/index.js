const { verifyToken } = require('../utils/jwt');
const prisma = require('../utils/db');

// Keep track of active users and their socket counts (to support multiple tabs)
const activeUsers = new Map(); // userId -> Set of socketIds

const initSockets = (io) => {
  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      // Fallback: Parse token from cookies if present
      if (!token && socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
        if (tokenCookie) {
          token = tokenCookie.split('=')[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.id) {
        return next(new Error('Authentication error: Invalid token'));
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true, avatarUrl: true }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    // 1. Manage active connections map
    if (!activeUsers.has(userId)) {
      activeUsers.set(userId, new Set());
    }
    activeUsers.get(userId).add(socket.id);

    // 2. Join a personal room for direct events/notifications
    socket.join(`user_${userId}`);

    // 3. Mark user online if this is their first connection
    if (activeUsers.get(userId).size === 1) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'ONLINE', lastActive: new Date() }
        });
        
        // Broadcast user status update to all connected users
        io.emit('user_status_changed', {
          userId,
          status: 'ONLINE',
          lastActive: new Date()
        });
      } catch (error) {
        console.error('Error updating user online status:', error);
      }
    }

    // 4. Handle joining a specific conversation room
    socket.on('join_conversation', (conversationId) => {
      const roomName = `conv_${conversationId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room ${roomName}`);
    });

    // 5. Handle leaving a conversation room
    socket.on('leave_conversation', (conversationId) => {
      const roomName = `conv_${conversationId}`;
      socket.leave(roomName);
      console.log(`Socket ${socket.id} left room ${roomName}`);
    });

    // 6. Handle typing status indicators
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conv_${conversationId}`).emit('typing_status', {
        conversationId,
        userId,
        username: socket.user.username,
        isTyping
      });
    });

    // 7. Handle Disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      const userSockets = activeUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        
        // If no more open connections/tabs for this user, mark offline
        if (userSockets.size === 0) {
          activeUsers.delete(userId);
          
          try {
            const lastActiveDate = new Date();
            await prisma.user.update({
              where: { id: userId },
              data: { status: 'OFFLINE', lastActive: lastActiveDate }
            });

            // Broadcast status change
            io.emit('user_status_changed', {
              userId,
              status: 'OFFLINE',
              lastActive: lastActiveDate
            });
          } catch (error) {
            console.error('Error updating user offline status:', error);
          }
        }
      }
    });
  });
};

module.exports = {
  initSockets,
  activeUsers
};

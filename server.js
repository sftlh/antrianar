/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3001

// Initialize Next.js
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    
    // Handle /uploads separately to ensure dynamic files are served
    if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/uploads/')) {
      const fs = require('fs')
      const path = require('path')
      // Ensure we look in the right place. process.cwd() is usually the project root.
      const filePath = path.join(process.cwd(), 'public', parsedUrl.pathname)

      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath)
        const ext = path.extname(filePath).toLowerCase()
        
        let contentType = 'application/octet-stream'
        if (ext === '.pdf') contentType = 'application/pdf'
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
        if (ext === '.png') contentType = 'image/png'

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size
        })
        
        const readStream = fs.createReadStream(filePath)
        readStream.pipe(res)
        return
      }
    }

    handle(req, res, parsedUrl)
  })

  // Initialize Socket.IO
  const io = new Server(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:3001",
      methods: ["GET", "POST"],
      credentials: true
    },
    addTrailingSlash: false
  })

  // Store connected clients by AR NIP
  const arClients = new Map()

  // Store connected users for chat
  const chatClients = new Map()

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // AR joins their room
    socket.on('join-ar-room', (arNip) => {
      socket.join(`ar-${arNip}`)
      console.log(`AR ${arNip} joined room`)

      // Store the socket ID for this AR
      if (!arClients.has(arNip)) {
        arClients.set(arNip, [])
      }
      arClients.get(arNip).push(socket.id)
    })

    // Kepala Kantor joins their room
    socket.on('join-kepala-kantor-room', () => {
      socket.join('kepala-kantor')
      console.log('✅ Kepala Kantor joined room, socket ID:', socket.id)
      console.log('📊 Current clients in kepala-kantor room:', io.sockets.adapter.rooms.get('kepala-kantor')?.size || 0)
    })

    // Admin joins their room
    socket.on('join-admin-room', () => {
      socket.join('admin')
      console.log('✅ Admin joined room, socket ID:', socket.id)
      console.log('📊 Current clients in admin room:', io.sockets.adapter.rooms.get('admin')?.size || 0)
    })

    // User joins chat
    socket.on('join', (data) => {
      const { userId } = data
      socket.userId = userId  // Store userId on socket
      socket.join(`user-${userId}`)
      console.log(`User ${userId} joined chat`)

      // Store the socket ID for this user
      if (!chatClients.has(userId)) {
        chatClients.set(userId, [])
      }
      chatClients.get(userId).push(socket.id)
    })

    // Handle chat message
    socket.on('chat-message', (data) => {
      const { chatId, message, participants } = data
      console.log('Server received chat-message:', { chatId, message, participants })
      // Add chatId to the message and broadcast to all participants in the chat
      socket.to(`chat-${chatId}`).emit('message', { ...message, chatId })

      // Emit notifications to each participant's user room (except sender)
      if (participants) {
        participants.forEach(participant => {
          if (participant.id !== socket.userId) {
            console.log('Emitting chat-message to user room:', `user-${participant.id}`)
            io.to(`user-${participant.id}`).emit('chat-message', {
              chatId,
              content: message.content,
              sender: message.sender,
              sentAt: message.sentAt
            })
          }
        })
      }
    })

    // Handle chat creation
    socket.on('chat-created', (data) => {
      const { chat } = data
      // Broadcast to all participants except the creator
      chat.participants.forEach(participant => {
        if (participant.id !== socket.userId) {
          // Emit to the specific user's room
          io.to(`user-${participant.id}`).emit('chat-created', chat)
        }
      })
    })

    // User joins a specific chat room
    socket.on('join-chat', (data) => {
      const chatId = data.chatId || data
      socket.join(`chat-${chatId}`)
      console.log(`Socket ${socket.id} joined chat ${chatId}`)
    })

    // Handle message sent status
    socket.on('message-sent', (data) => {
      const { messageId, chatId, participants } = data
      console.log('Message sent status:', { messageId, chatId, participants })

      // Emit delivered status to all participants except sender
      if (participants) {
        participants.forEach(participant => {
          io.to(`user-${participant.id}`).emit('message-status', {
            messageId,
            status: 'delivered',
            userId: participant.id
          })
        })
      }
    })

    // Handle message read status
    socket.on('message-read', (data) => {
      const { messageId, chatId, userId } = data
      console.log('Message read status:', { messageId, chatId, userId })

      // Emit read status back to sender
      io.to(`user-${socket.userId}`).emit('message-status', {
        messageId,
        status: 'read',
        userId: socket.userId
      })
    })

    // Handle typing indicators
    socket.on('start-typing', (data) => {
      const { chatId, userId } = data
      console.log('User started typing:', { chatId, userId })

      // For now, create a basic user object - in production you'd fetch from database
      const user = { id: userId, name: 'User', role: 'user', nip: '00000' }

      // Emit to all participants in the chat except sender
      socket.to(`chat-${chatId}`).emit('user-typing', {
        chatId,
        user,
        isTyping: true
      })
    })

    socket.on('stop-typing', (data) => {
      const { chatId, userId } = data
      console.log('User stopped typing:', { chatId, userId })

      const user = { id: userId, name: 'User', role: 'user', nip: '00000' }

      // Emit to all participants in the chat except sender
      socket.to(`chat-${chatId}`).emit('user-typing', {
        chatId,
        user,
        isTyping: false
      })
    })

    // Handle user online status
    socket.on('user-online', (data) => {
      const { userId, isOnline } = data
      console.log('User online status:', { userId, isOnline })

      // Broadcast online status to all connected clients
      socket.broadcast.emit('user-online', {
        userId,
        isOnline
      })
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)

      // Remove socket from AR clients
      for (const [arNip, sockets] of arClients.entries()) {
        const index = sockets.indexOf(socket.id)
        if (index > -1) {
          sockets.splice(index, 1)
          if (sockets.length === 0) {
            arClients.delete(arNip)
          }
          break
        }
      }

      // Remove socket from chat clients
      for (const [userId, sockets] of chatClients.entries()) {
        const index = sockets.indexOf(socket.id)
        if (index > -1) {
          sockets.splice(index, 1)
          if (sockets.length === 0) {
            chatClients.delete(userId)
          }
          break
        }
      }
    })
  })

  // Make io available globally for API routes
  global.io = io

  httpServer.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
}).catch((ex) => {
  console.error(ex.stack)
  process.exit(1)
})
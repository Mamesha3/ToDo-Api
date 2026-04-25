import { config } from 'dotenv'
config()
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import { Server } from 'socket.io'

import todoRoutes from './routes/TodoRoutes.js'
import userRoutes from './routes/userRoute.js'
import messageRoutes from './routes/messageRoute.js'
import prisma from './client.js'

const app = express()

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
    credentials: true
}))

app.use(express.json())
app.use(cookieParser())

app.use('/api', todoRoutes)
app.use('/api', userRoutes)
app.use('/api', messageRoutes)

const PORT = process.env.PORT

const httpServer = createServer(app)

const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL,
        credentials: true
    }
})

// Track online users
const onlineUsers = new Map()

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    // User comes online
    socket.on('user_online', (userId) => {
        onlineUsers.set(userId, socket.id)
        io.emit('user_status', { userId, status: 'online' })
        console.log(`User ${userId} is online`)
    })

    // User goes offline
    socket.on('user_offline', (userId) => {
        onlineUsers.delete(userId)
        io.emit('user_status', { userId, status: 'offline' })
        console.log(`User ${userId} is offline`)
    })

    // Check if user is online
    socket.on('check_online_status', (userId) => {
        const isOnline = onlineUsers.has(userId)
        socket.emit('user_status', { userId, status: isOnline ? 'online' : 'offline' })
    })

    // Join a conversation room
    socket.on('join_conversation', ({ userId, receiverId }) => {
        const roomId = [userId, receiverId].sort().join('_')
        socket.join(roomId)
        console.log(`User ${userId} joined room ${roomId}`)
    })

    // Send message
    socket.on('send_message', async (data) => {
        const { senderId, receiverId, message } = data

        try {
            // Save message to database
            const newMessage = await prisma.message.create({
                data: {
                    senderId: Number(senderId),
                    receiverId: Number(receiverId),
                    message
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            })

            // Get room ID
            const roomId = [senderId, receiverId].sort().join('_')

            // Emit to both users in the room
            io.to(roomId).emit('receive_message', newMessage)
        } catch (error) {
            console.error('Error sending message:', error)
            socket.emit('message_error', { error: 'Failed to send message' })
        }
    })

    // Leave conversation
    socket.on('leave_conversation', ({ userId, receiverId }) => {
        const roomId = [userId, receiverId].sort().join('_')
        socket.leave(roomId)
        console.log(`User ${userId} left room ${roomId}`)
    })

    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id)
    })
})

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})
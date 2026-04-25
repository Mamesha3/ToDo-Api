import prisma from '../client.js'
import express from 'express'
import authenticate from '../middleware/middleware.js'

const router = express.Router()

// Get conversation history between current user and another user
router.get('/messages/:receiverId', authenticate, async (req, res) => {
    const { receiverId } = req.params
    const { id: senderId } = req.user

    if (!receiverId || !senderId) {
        return res.status(400).json({
            msg: 'Receiver ID and sender ID are required'
        })
    }

    try {
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    {
                        AND: [
                            { senderId: Number(senderId) },
                            { receiverId: Number(receiverId) }
                        ]
                    },
                    {
                        AND: [
                            { senderId: Number(receiverId) },
                            { receiverId: Number(senderId) }
                        ]
                    }
                ]
            },
            orderBy: {
                createdAt: 'asc'
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

        res.status(200).json({
            msg: 'Messages fetched',
            messages
        })
    } catch (error) {
        console.error('Error fetching messages:', error)
        res.status(500).json({
            msg: 'Internal server error'
        })
    }
})

// Get all conversations for current user
router.get('/conversations', authenticate, async (req, res) => {
    const { id: userId } = req.user

    if (!userId) {
        return res.status(400).json({
            msg: 'User ID is required'
        })
    }

    try {
        // Get all messages where user is either sender or receiver
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: Number(userId) },
                    { receiverId: Number(userId) }
                ]
            },
            orderBy: {
                createdAt: 'desc'
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

        // Group messages by conversation and get the last message for each
        const conversations = {}
        messages.forEach(msg => {
            const otherUserId = msg.senderId === Number(userId) ? msg.receiverId : msg.senderId
            const otherUser = msg.senderId === Number(userId) ? msg.receiver : msg.sender

            if (!conversations[otherUserId]) {
                conversations[otherUserId] = {
                    user: otherUser,
                    lastMessage: msg,
                    unreadCount: 0
                }
            }
        })

        res.status(200).json({
            msg: 'Conversations fetched',
            conversations: Object.values(conversations)
        })
    } catch (error) {
        console.error('Error fetching conversations:', error)
        res.status(500).json({
            msg: 'Internal server error'
        })
    }
})

// Get list of all users (for starting new conversations)
router.get('/users', authenticate, async (req, res) => {
    const { id: currentUserId } = req.user

    try {
        const users = await prisma.user.findMany({
            where: {
                id: {
                    not: Number(currentUserId)
                }
            },
            select: {
                id: true,
                name: true,
                email: true
            }
        })

        res.status(200).json({
            msg: 'Users fetched',
            users
        })
    } catch (error) {
        console.error('Error fetching users:', error)
        res.status(500).json({
            msg: 'Internal server error'
        })
    }
})

export default router
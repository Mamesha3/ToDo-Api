import prisma from '../client.js'
import express from 'express'
import authenticate from '../middleware/middleware.js'
import checkSmartTodoLimit from '../middleware/countSmartTodo.js'
import { InferenceClient } from '@huggingface/inference'

const router = express.Router()
const hf = new InferenceClient(process.env.HF_ACCESS_TOKEN)

router.post("/todo", authenticate, async (req, res) => {
    const { title, content, completedAt, isSmart, autoChangeStatus } = req.body
    const { id } = req.user

    if(!title || !content || !id) {
        return res.status(400).json({
            msg: 'All fields are required'
        })
    }
    
    const todo = await prisma.todo.create({
        data: {
            title,
            content,
            authorId: Number(id),
            completedAt: completedAt ? new Date(completedAt) : null,
            isSmart: isSmart || false,
            autoChangeStatus: autoChangeStatus || false
        }
    })

    // Increment countSmart if this is a smart todo
    if (isSmart) {
        await prisma.user.update({
            where: { id: Number(id) },
            data: {
                countSmart: {
                    increment: 1
                }
            }
        })
    }
    
    res.status(200).json({
        msg: 'Todo created',
        todo
    })
})

router.get('/todo', authenticate, async (req, res) => {
    const { id } = req.user
    if(!id) {
        return res.status(400).json({
            msg: 'ID is required'
        })
    }
    
    const todo = await prisma.todo.findMany({
        where: {
            authorId: id
        },
        include: {
            sharedWith: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            }
        }
    })

    if(todo.length === 0) {
        return res.json({msg: `User with ${id} doesn't have Todo yet!`})
    }
    
    const todosWithMetadata = todo.map(t => ({
        ...t,
        sharedWith: t.sharedWith.map(s => s.user),
        isOwner: true
    }))
    
    res.status(200).json({
        msg: 'Todo fetched',
        todo: todosWithMetadata
    })
})

router.put('/todo/:id', authenticate, async (req, res) => {
    const { id } = req.params
    const { title, content, completedAt, autoChangeStatus } = req.body
    if(!id || !title || !content) {
        return res.status(400).json({
            msg: 'ID, title and content are required'
        })
    }
    
    const todo = await prisma.todo.update({
        where: {
            id: parseInt(id)
        },
        data: {
            title,
            content,
            completedAt: completedAt ? new Date(completedAt) : null,
            autoChangeStatus: autoChangeStatus !== undefined ? autoChangeStatus : undefined
        }
    })
    
    res.status(200).json({
        msg: 'Todo updated',
        todo
    })
})

// update todo completion where id change !complete
router.patch('/todo/:id', authenticate, async (req, res) => {
    // const userId = Number(req.user.id)
    const id = Number(req.params.id)
    try {
        if(!id || isNaN(id)) {
            return res.status(400).json({
                msg: 'ID is required or invalid'
            })
        }
    
        const currentTodo = await prisma.todo.findUnique({
            where: {id}
        })
        if(!currentTodo) {
            return res.status(404).json({
                msg: 'Todo not found'
            })
        }    

        const todo = await prisma.todo.update({
            where: {
                id
            },
            data: {
                completed: !currentTodo.completed
            }
        })
        
        res.status(200).json({
            msg: 'Todo updated',
            todo
        })
    } catch (error) {
        return res.status(500).json({
            msg: 'Internal server error'
        })
    }
})

router.delete('/todo/:id', authenticate, async (req, res) => {
    const { id } = req.params
    if(!id) {
        return res.status(400).json({
            msg: 'ID is required'
        })
    }
    
    const todo = await prisma.todo.delete({
        where: {
            id: parseInt(id)
        }
    })
    
    res.status(200).json({
        msg: 'Todo deleted',
        todo
    })
})

// Share a todo with another user
router.post('/todo/:id/share', authenticate, async (req, res) => {
    const { id } = req.params
    const { userId } = req.body
    const currentUserId = req.user.id

    if(!id || !userId) {
        return res.status(400).json({
            msg: 'Todo ID and User ID are required'
        })
    }

    // Check if the current user owns the todo
    const todo = await prisma.todo.findUnique({
        where: { id: parseInt(id) }
    })

    if(!todo) {
        return res.status(404).json({
            msg: 'Todo not found'
        })
    }

    if(todo.authorId !== Number(currentUserId)) {
        return res.status(403).json({
            msg: 'You can only share your own todos'
        })
    }

    // Check if already shared with this user
    const existingShare = await prisma.todoShare.findUnique({
        where: {
            todoId_userId: {
                todoId: parseInt(id),
                userId: Number(userId)
            }
        }
    })

    if(existingShare) {
        return res.status(400).json({
            msg: 'Todo is already shared with this user'
        })
    }

    // Create the share relationship
    const share = await prisma.todoShare.create({
        data: {
            todoId: parseInt(id),
            userId: Number(userId)
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        }
    })

    res.status(200).json({
        msg: 'Todo shared successfully',
        share
    })
})

// Unshare a todo from a user
router.delete('/todo/:id/share/:userId', authenticate, async (req, res) => {
    const { id, userId } = req.params
    const currentUserId = req.user.id

    if(!id || !userId) {
        return res.status(400).json({
            msg: 'Todo ID and User ID are required'
        })
    }

    // Check if the current user owns the todo
    const todo = await prisma.todo.findUnique({
        where: { id: parseInt(id) }
    })

    if(!todo) {
        return res.status(404).json({
            msg: 'Todo not found'
        })
    }

    if(todo.authorId !== Number(currentUserId)) {
        return res.status(403).json({
            msg: 'You can only unshare your own todos'
        })
    }

    // Delete the share relationship
    await prisma.todoShare.delete({
        where: {
            todoId_userId: {
                todoId: parseInt(id),
                userId: Number(userId)
            }
        }
    })

    res.status(200).json({
        msg: 'Todo unshared successfully'
    })
})

// Get todos shared with the current user
router.get('/todo/shared-with-me', authenticate, async (req, res) => {
    const currentUserId = req.user.id

    const sharedTodos = await prisma.todoShare.findMany({
        where: {
            userId: Number(currentUserId)
        },
        include: {
            todo: {
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    sharedWith: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            }
        }
    })

    res.status(200).json({
        msg: 'Shared todos fetched',
        sharedTodos: sharedTodos.map(share => ({
            ...share.todo,
            sharedBy: share.todo.author,
            isOwner: false,
            sharedWith: share.todo.sharedWith.map(s => s.user)
        }))
    })
})

// Get due todos (completedAt <= now and not completed)
router.get('/todo/due', authenticate, async (req, res) => {
    const currentUserId = req.user.id
    const now = new Date()

    const dueTodos = await prisma.todo.findMany({
        where: {
            authorId: Number(currentUserId),
            completedAt: {
                lte: now
            },
            completed: false
        }
    })

    res.status(200).json({
        msg: 'Due todos fetched',
        dueTodos
    })
})

// Smart todo generator using AI (multiple todos)
router.post('/todo/generate', authenticate, checkSmartTodoLimit, async (req, res) => {
    const { goal } = req.body

    if (!goal) {
        return res.status(400).json({
            msg: 'Goal is required'
        })
    }

    try {
        const result = await hf.chatCompletion({
            model: 'meta-llama/Llama-3.1-8B-Instruct',
            messages: [{
                role: 'user',
                content: `You are a todo list generator. Create 3-5 specific, actionable todo items for this goal: "${goal}". Return ONLY a numbered list. No introduction or explanation.`
            }],
            max_tokens: 512
        })

        const content = result.choices[0].message.content

        // Parse the response to extract todo items
        const todos = content
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.replace(/^\d+\.?\s*/, '').replace(/^\*\s*/, '').trim())
            .filter(item => item.length > 0)

        res.status(200).json({
            msg: 'Todos generated successfully',
            todos
        })
    } catch (error) {
        console.error('Error generating todos:', error)
        res.status(500).json({
            msg: 'Failed to generate todos',
            error: error.message
        })
    }
})

// Special smart todo generator using AI (single todo with title and detailed plan)
router.post('/todo/generate-special', authenticate, checkSmartTodoLimit, async (req, res) => {
    const { goal } = req.body

    if (!goal) {
        return res.status(400).json({
            msg: 'Goal is required'
        })
    }

    try {
        const result = await hf.chatCompletion({
            model: 'meta-llama/Llama-3.1-8B-Instruct',
            messages: [{
                role: 'user',
                content: `You are a todo planner. For this goal: "${goal}", create a comprehensive todo with a title and detailed plan. Return your response in this exact JSON format: {"title": "short descriptive title", "content": "detailed plan with steps and details"}. IMPORTANT: The title MUST be exactly 3-5 words only, not a full sentence. Example: "Stomach Health Plan" or "Doctor Visit Schedule". The content should be detailed with actionable steps using markdown formatting.`
            }],
            max_tokens: 1024
        })

        const content = result.choices[0].message.content

        // Parse JSON response
        let parsedData
        try {
            // Try to extract JSON from the response
            let jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                let jsonString = jsonMatch[0]
                // Fix common JSON errors (extra commas, trailing commas)
                jsonString = jsonString.replace(/,\s*}/g, '}')
                jsonString = jsonString.replace(/,\s*]/g, ']')
                parsedData = JSON.parse(jsonString)
                
                // Handle case where content is an object instead of string
                if (parsedData.content && typeof parsedData.content === 'object') {
                    parsedData.content = Object.entries(parsedData.content)
                        .map(([key, value]) => `**${key}**\n${value}`)
                        .join('\n\n')
                }
                
                // Clean up title and content - remove any remaining JSON artifacts
                if (parsedData.title && typeof parsedData.title === 'string') {
                    parsedData.title = parsedData.title.replace(/^["']|["']$/g, '').trim()
                    // Remove special characters from title (keep only letters, numbers, spaces, and basic punctuation)
                    parsedData.title = parsedData.title.replace(/[*_{}\[\]<>]/g, '').trim()
                }
                if (parsedData.content && typeof parsedData.content === 'string') {
                    parsedData.content = parsedData.content.replace(/^["']|["']$/g, '').trim()
                }
            } else {
                // Try parsing the whole content
                let jsonString = content
                jsonString = jsonString.replace(/,\s*}/g, '}')
                jsonString = jsonString.replace(/,\s*]/g, ']')
                parsedData = JSON.parse(jsonString)
                
                // Handle case where content is an object instead of string
                if (parsedData.content && typeof parsedData.content === 'object') {
                    parsedData.content = Object.entries(parsedData.content)
                        .map(([key, value]) => `**${key}**\n${value}`)
                        .join('\n\n')
                }
                
                // Clean up title and content - remove any remaining JSON artifacts
                if (parsedData.title && typeof parsedData.title === 'string') {
                    parsedData.title = parsedData.title.replace(/^["']|["']$/g, '').trim()
                    // Remove special characters from title (keep only letters, numbers, spaces, and basic punctuation)
                    parsedData.title = parsedData.title.replace(/[*_{}\[\]<>]/g, '').trim()
                }
                if (parsedData.content && typeof parsedData.content === 'string') {
                    parsedData.content = parsedData.content.replace(/^["']|["']$/g, '').trim()
                }
            }
        } catch (parseError) {
            // Fallback if JSON parsing fails - try to extract title and content manually
            const lines = content.split('\n').filter(line => line.trim())
            
            // Try to extract title (first short, non-JSON line - title should be 3-5 words)
            let title = 'Generated Todo'
            let contentLines = []
            
            let inContent = false
            for (const line of lines) {
                const trimmedLine = line.trim()
                // Skip JSON artifacts
                if (trimmedLine.match(/^["']?\{/) || trimmedLine.match(/^["']?\}/) || 
                    trimmedLine.match(/^["']?title/) || trimmedLine.match(/^["']?content/) ||
                    trimmedLine === '",' || trimmedLine === '"') {
                    continue
                }
                
                // Check if this could be a title (short, not a list item, not bold)
                const wordCount = trimmedLine.split(/\s+/).length
                const isShortTitle = wordCount >= 2 && wordCount <= 8
                const isListItem = trimmedLine.match(/^[0-9]+\./) || trimmedLine.match(/^-\s/)
                const isBold = trimmedLine.match(/^\*\*/)
                
                if (!inContent && isShortTitle && !isListItem && !isBold) {
                    title = trimmedLine.replace(/^["']|["']$/g, '')
                    // Remove special characters from title (keep only letters, numbers, spaces, and basic punctuation)
                    title = title.replace(/[*_{}\[\]<>]/g, '').trim()
                    inContent = true
                } else {
                    contentLines.push(trimmedLine.replace(/^["']|["']$/g, ''))
                }
            }
            
            // If no suitable title found, use first line as title
            if (title === 'Generated Todo' && contentLines.length > 0) {
                title = contentLines.shift() || 'Generated Todo'
                title = title.replace(/^["']|["']$/g, '').replace(/[*_{}\[\]<>]/g, '').trim()
            }
            
            parsedData = {
                title: title,
                content: contentLines.join('\n') || content
            }
        }

        res.status(200).json({
            msg: 'Special todo generated successfully',
            title: parsedData.title,
            content: parsedData.content
        })
    } catch (error) {
        console.error('Error generating special todo:', error)
        res.status(500).json({
            msg: 'Failed to generate special todo',
            error: error.message
        })
    }
})

// AI Chat endpoint
router.post('/ai/chat', authenticate, async (req, res) => {
    const { message, conversationHistory } = req.body
    const { id } = req.user

    if (!message) {
        return res.status(400).json({
            msg: 'Message is required'
        })
    }

    try {
        // Get or create AI conversation for user
        let conversation = await prisma.aIConversation.findFirst({
            where: { userId: Number(id) },
            orderBy: { updatedAt: 'desc' }
        })

        if (!conversation) {
            conversation = await prisma.aIConversation.create({
                data: { userId: Number(id) }
            })
        }

        // Save user message
        await prisma.aIMessage.create({
            data: {
                conversationId: conversation.id,
                role: 'user',
                content: message
            }
        })

        // Build conversation context
        let systemPrompt = `You are a helpful AI assistant for a todo application. You help users with task planning, productivity tips, and managing their todos. Be concise, friendly, and practical. Keep responses under 200 words unless the user asks for detailed information.`
        
        let messages = [
            { role: 'system', content: systemPrompt }
        ]

        // Add conversation history (last 10 messages to avoid context overflow)
        if (conversationHistory && Array.isArray(conversationHistory)) {
            const recentHistory = conversationHistory.slice(-10)
            messages = messages.concat(recentHistory)
        }

        // Add current message
        messages.push({ role: 'user', content: message })

        const result = await hf.chatCompletion({
            model: 'meta-llama/Llama-3.1-8B-Instruct',
            messages: messages,
            max_tokens: 512
        })

        const response = result.choices[0].message.content

        // Remove markdown formatting from response
        const cleanedResponse = response
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
            .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
            .replace(/#{1,6}\s/g, '') // Remove headers
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
            .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Remove code blocks
            .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough
            .replace(/^\s*[-*+]\s/gm, '') // Remove list markers
            .replace(/^\s*\d+\.\s/gm, '') // Remove numbered list markers

        // Save AI response
        await prisma.aIMessage.create({
            data: {
                conversationId: conversation.id,
                role: 'assistant',
                content: cleanedResponse
            }
        })

        // Keep only last 50 messages per conversation
        const allMessages = await prisma.aIMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: 'asc' }
        })

        if (allMessages.length > 50) {
            const messagesToDelete = allMessages.slice(0, allMessages.length - 50)
            await prisma.aIMessage.deleteMany({
                where: {
                    id: { in: messagesToDelete.map(m => m.id) }
                }
            })
        }

        res.status(200).json({
            msg: 'AI response generated successfully',
            response: cleanedResponse
        })
    } catch (error) {
        console.error('Error generating AI response:', error)
        res.status(500).json({
            msg: 'Failed to generate AI response',
            error: error.message
        })
    }
})

// Get AI conversation history
router.get('/ai/conversation', authenticate, async (req, res) => {
    const { id } = req.user

    try {
        const conversation = await prisma.aIConversation.findFirst({
            where: { userId: Number(id) },
            orderBy: { updatedAt: 'desc' },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                    take: 50
                }
            }
        })

        if (!conversation) {
            return res.status(200).json({
                msg: 'No conversation found',
                messages: []
            })
        }

        res.status(200).json({
            msg: 'Conversation retrieved successfully',
            messages: conversation.messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: m.createdAt
            }))
        })
    } catch (error) {
        console.error('Error retrieving AI conversation:', error)
        res.status(500).json({
            msg: 'Failed to retrieve conversation',
            error: error.message
        })
    }
})

// AI Image Generation endpoint
router.post('/ai/generate-image', authenticate, async (req, res) => {
    const { prompt, count = 1 } = req.body
    const { id } = req.user

    if (!prompt) {
        return res.status(400).json({
            msg: 'Prompt is required'
        })
    }

    try {
        // Check daily image limit
        const user = await prisma.user.findUnique({
            where: { id: Number(id) }
        })

        if (!user) {
            return res.status(404).json({
                msg: 'User not found'
            })
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Reset count if it's a new day
        if (!user.lastImageResetDate || new Date(user.lastImageResetDate) < today) {
            await prisma.user.update({
                where: { id: Number(id) },
                data: {
                    dailyImageCount: 0,
                    lastImageResetDate: today
                }
            })
            user.dailyImageCount = 0
        }

        // Check if user has exceeded daily limit (10 images)
        if (user.dailyImageCount + count > 10) {
            return res.status(429).json({
                msg: `Daily image limit exceeded. You have generated ${user.dailyImageCount}/10 images today. Try again tomorrow.`,
                remaining: 10 - user.dailyImageCount
            })
        }

        // Generate multiple images in parallel
        const imagePromises = Array.from({ length: count }, async (_, index) => {
            const result = await hf.textToImage({
                model: 'stabilityai/stable-diffusion-xl-base-1.0',
                inputs: prompt,
                parameters: {
                    negative_prompt: 'blurry, bad quality, distorted, ugly, low resolution',
                    num_inference_steps: 30,
                    seed: Date.now() + index // Different seed for each image
                }
            })

            // Convert blob to base64
            const buffer = await result.arrayBuffer()
            const base64 = Buffer.from(buffer).toString('base64')
            return `data:image/png;base64,${base64}`
        })

        const images = await Promise.all(imagePromises)

        // Update daily image count
        await prisma.user.update({
            where: { id: Number(id) },
            data: {
                dailyImageCount: user.dailyImageCount + count
            }
        })

        res.status(200).json({
            msg: 'Images generated successfully',
            images: images,
            remaining: 10 - (user.dailyImageCount + count)
        })
    } catch (error) {
        console.error('Error generating AI images:', error)
        res.status(500).json({
            msg: 'Failed to generate images',
            error: error.message
        })
    }
})

// Search endpoints
router.get('/search/todos', authenticate, async (req, res) => {
    const { id } = req.user
    const { q } = req.query

    if (!id) {
        return res.status(401).json({ msg: 'Unauthorized' })
    }

    try {
        const todos = await prisma.todo.findMany({
            where: {
                authorId: Number(id),
                OR: [
                    { title: { contains: q || '', mode: 'insensitive' } },
                    { content: { contains: q || '', mode: 'insensitive' } }
                ]
            },
            select: {
                id: true,
                title: true,
                content: true,
                completed: true,
                isSmart: true,
                completedAt: true
            },
            orderBy: { createdAt: 'desc' }
        })

        res.status(200).json({
            msg: 'Todos found',
            todos
        })
    } catch (error) {
        console.error('Search todos error:', error)
        res.status(500).json({
            msg: 'Failed to search todos',
            error: error.message
        })
    }
})

router.get('/search/users', authenticate, async (req, res) => {
    const { id } = req.user
    const { q } = req.query

    if (!id) {
        return res.status(401).json({ msg: 'Unauthorized' })
    }

    try {
        const users = await prisma.user.findMany({
            where: {
                id: { not: Number(id) },
                OR: [
                    { name: { contains: q || '', mode: 'insensitive' } },
                    { email: { contains: q || '', mode: 'insensitive' } }
                ]
            },
            select: {
                id: true,
                name: true,
                email: true
            }
        })

        res.status(200).json({
            msg: 'Users found',
            users
        })
    } catch (error) {
        console.error('Search users error:', error)
        res.status(500).json({
            msg: 'Failed to search users',
            error: error.message
        })
    }
})

export default router

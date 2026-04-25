import prisma from "../client.js"

async function checkSmartTodoLimit(req, res, next) {
    try {
        const { id } = req.user

        // Get the user's current countSmart value
        const user = await prisma.user.findUnique({
            where: { id: Number(id) },
            select: { countSmart: true }
        })

        if (!user) {
            return res.status(404).json({
                msg: 'User not found'
            })
        }

        // Check if user has reached the daily limit of 10 smart todos
        if (user.countSmart >= 10) {
            // Check if the last smart todo was created today
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const lastSmartTodo = await prisma.todo.findFirst({
                where: {
                    authorId: Number(id),
                    isSmart: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })

            if (lastSmartTodo) {
                const lastTodoDate = new Date(lastSmartTodo.createdAt)
                lastTodoDate.setHours(0, 0, 0, 0)

                // If the last smart todo was created today, block the request
                if (lastTodoDate.getTime() === today.getTime()) {
                    return res.status(429).json({
                        msg: 'You reached your todays limit'
                    })
                }
            }

            // If last smart todo was from a previous day, reset the count
            await prisma.user.update({
                where: { id: Number(id) },
                data: { countSmart: 0 }
            })
        }

        // Allow the request to proceed
        next()
    } catch (error) {
        console.error('Error checking smart todo limit:', error)
        return res.status(500).json({
            msg: 'Failed to check smart todo limit'
        })
    }
}

export default checkSmartTodoLimit

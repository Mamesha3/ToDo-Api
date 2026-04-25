import Prisma from "../client.js";
import express from "express";
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import authenticate from "../middleware/middleware.js";

const router = express.Router();
router.use(cookieParser())

const generateToken = (user) => {
    return jwt.sign( { user }, process.env.JWT_TOKEN, { expiresIn: '1d' })
}

router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;
    try {
        if(!name || !email || !password) {
            return res.status(400).json({
                msg: 'All fields are required'
            })
        }

        const user = await Prisma.user.findUnique({
            where: {
                email
            }
        })
        if(user) {
            return res.status(400).json({
                msg: 'User already exists'
            })
        }
    
        const newUser = await Prisma.user.create({
            data: {
                name,
                email,
                password
            }
        })
    
        res.status(200).json({
            msg: 'User created',
            newUser
        })
    } catch (error) {
        return res.status(500).json({
            msg: 'Internal server error'
        })
    }
})

router.post('/login', async (req, res) => {
    try {
        const {email, password} = req.body
        if(!email || !password) {
            return res.status(400).json({
                msg: 'All fields are required'
            })
        }

        const user = await Prisma.user.findUnique({
            where: {
                email
            }
        })
        
        if(!user) {
            return res.status(400).json({
                msg: 'Invalid credentials'
            })
        }

        const isPasswordValid = user.password === password
        if(!isPasswordValid) {
            return res.status(400).json({
                msg: 'Invalid credentials'
            })
        }

        const token = generateToken(user)
        // pass token as cookie
        res.cookie('token', token, { httpOnly: true })

        res.status(200).json({
            msg: 'User logged in',
            user
        })
    } catch (error) {
        return res.status(500).json({
            msg: "server error"
        })
    }
})

router.post('/logout', authenticate, (req, res) => {
    res.clearCookie('token')
    res.status(200).json({
        msg: 'User logged out'
    })
})

// refresh token
router.post('/refresh', authenticate, (req, res) => {
    const token = generateToken(req.user)
    res.cookie('token', token, { httpOnly: true })
    res.status(200).json({
        msg: 'Token refreshed',
        user: req.user
    })
})

// update user profile
router.put('/user/profile', authenticate, async (req, res) => {
    const { name, email } = req.body
    const { id } = req.user

    try {
        if(!name || !email) {
            return res.status(400).json({
                msg: 'Name and email are required'
            })
        }

        // Check if email is already taken by another user
        const existingUser = await Prisma.user.findUnique({
            where: {
                email
            }
        })

        if(existingUser && existingUser.id !== Number(id)) {
            return res.status(400).json({
                msg: 'Email already in use'
            })
        }

        const updatedUser = await Prisma.user.update({
            where: {
                id: Number(id)
            },
            data: {
                name,
                email
            }
        })

        res.status(200).json({
            msg: 'Profile updated successfully',
            user: updatedUser
        })
    } catch (error) {
        console.error('Profile update error:', error)
        return res.status(500).json({
            msg: 'Internal server error'
        })
    }
})

export default router;
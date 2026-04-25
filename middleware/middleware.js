import jwt from 'jsonwebtoken'

const authenticate = (req, res, next) => {
    const token = req.cookies.token
    if(!token) {
        return res.status(401).json({
            msg: 'Unauthorized'
        })
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_TOKEN)
        req.user = decoded.user
        next()
    } catch (error) {
        return res.status(401).json({
            msg: 'Unauthorized'
        })
    }
}

export default authenticate
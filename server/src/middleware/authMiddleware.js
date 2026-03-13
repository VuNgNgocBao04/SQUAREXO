const { verifyAccessToken } = require('../utils/jwt')

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: 'Missing access token' })
  }

  try {
    req.user = verifyAccessToken(token)
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid access token' })
  }
}

module.exports = { authMiddleware }

const bcrypt = require('bcrypt')
const User = require('../models/User')
const { signAccessToken } = require('../utils/jwt')

async function register(req, res, next) {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email và password là bắt buộc' })
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] })
    if (existing) {
      return res.status(409).json({ message: 'Username hoặc email đã tồn tại' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ username, email, passwordHash })
    const token = signAccessToken({ userId: user._id.toString(), username: user.username })

    return res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
      token,
    })
  } catch (error) {
    return next(error)
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'email và password là bắt buộc' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: 'Sai thông tin đăng nhập' })
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return res.status(401).json({ message: 'Sai thông tin đăng nhập' })
    }

    const token = signAccessToken({ userId: user._id.toString(), username: user.username })

    return res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
      token,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  register,
  login,
}

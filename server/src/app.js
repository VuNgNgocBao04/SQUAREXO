const cors = require('cors')
const express = require('express')
const authRoutes = require('./routes/authRoutes')
const protectedRoutes = require('./routes/protectedRoutes')
const healthRoutes = require('./routes/healthRoutes')
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware')
const { env } = require('../config/env')

const app = express()

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  })
)
app.use(express.json())

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/protected', protectedRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

module.exports = app

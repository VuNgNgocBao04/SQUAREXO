const express = require('express')
const { authMiddleware } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/', authMiddleware, (req, res) => {
  res.json({
    message: 'Protected data',
    user: {
      userId: req.user.userId,
      username: req.user.username,
    },
  })
})

module.exports = router

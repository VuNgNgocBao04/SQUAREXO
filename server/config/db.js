const mongoose = require('mongoose')
const { env } = require('./env')

async function connectDatabase() {
  await mongoose.connect(env.mongoUri)
  console.log('MongoDB connected')
}

module.exports = { connectDatabase }

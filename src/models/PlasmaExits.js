const mongoose = require('mongoose')

const PlasmaExitsSchema = mongoose.Schema({
  withdrawTxHash: {
    type: String,
    required: true
  },
  burnTransactionHash: {
    type: String,
    required: true
  },
  exitableAt: {
    type: Number,
    required: true
  },
  counter: {
    type: Number,
    required: true
  },
  exitTxHash: {
    type: String,
    required: false
  }
})

module.exports = mongoose.model('PlasmaExits', PlasmaExitsSchema)

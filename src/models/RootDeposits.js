const mongoose = require('mongoose')

const RootDepositSchema = mongoose.Schema({
  transactionHash: {
    type: String,
    required: true
  },
  userAddress: {
    type: String,
    required: true
  },
  rootToken: {
    type: String,
    required: false
  },
  amount: {
    type: String,
    required: false
  },
  counter: {
    type: Number,
    required: true
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  resolveTransaction: {
    type: String,
    required: false
  },
  blockNumber: {
    type: Number,
    required: false
  },
  timestamp: {
    type: Number,
    required: false
  },
  isDecoded: {
    type: Boolean,
    required: false
  }
})

module.exports = mongoose.model('RootDeposits', RootDepositSchema)

const mongoose = require('mongoose')

const RootDepositEtherSchema = mongoose.Schema({
  transactionHash: {
    type: String,
    required: true
  },
  userAddress: {
    type: String,
    required: true
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
  timestamp: {
    type: Number,
    required: false
  }
})

module.exports = mongoose.model('RootDepositsEther', RootDepositEtherSchema)

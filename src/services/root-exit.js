const RootExits = require('../models/RootExits')
const PlasmaExits = require('../models/PlasmaExits')
const { request, gql } = require('graphql-request')
const { mainnetWeb3 } = require('../index')
require('dotenv').config()
const Web3 = require('web3')
const { mapWithdrawTxToBurnTx } = require('./decoder')

// Save Exit Transaction from Subgraph with nonces
export const getAndSavePosExitTransactions = async() => {
  try {
    // const mainnetWeb3 = new Web3(process.env.NETWORK_PROVIDER)
    let start = await RootExits.countDocuments()
    let findMore = true

    while (findMore) {
      let exits = await getExitsFromSubgraph(start)
      if (exits.length === 1000) {
        start = start + 1000
      } else {
        findMore = false
      }
      const datatoInsert = []
      for (const exit of exits) {
        const {
          transactionHash,
          timestamp,
          counter
        } = exit
        const burnTransactionResult = await mapWithdrawTxToBurnTx(transactionHash, true, null, true)
        if (!burnTransactionResult) throw new Error("error in getting burntransaction")
        const burnTransactionHash = burnTransactionResult.result.toLowerCase()
        const data = {
          transactionHash,
          burnTransactionHash,
          timestamp,
        }
        datatoInsert.push(data)
      }

      await RootExits.insertMany(datatoInsert)
    }
  } catch (error) {
    console.log('error in getting and saving deposit transaction for POS', error)
  }
}

export const getExitsFromSubgraph = async(start) => {
  try {
    const limit = 1000
    const direction = 'asc'
    const sortBy = 'counter'
    const query = gql`query{
        rootexits(first:${limit}, where:{ counter_gt: ${start}}, orderDirection:${direction}, orderBy:${sortBy}) {
            transactionHash,
            counter,
            timestamp,
        }
        }`
    const resp = await request(process.env.SUBGRAPH_ENDPOINT, query)
    return resp.rootexits
  } catch (error) {
    console.log('error in getting deposits from subgraph', error)
  }
}

export const checkExitTransactionIfReplaced = async(reqParams) => {
  try {
    let { burnTransactionHash, isPos } = reqParams.query
    burnTransactionHash = burnTransactionHash.toLowerCase()
    let rootExit
    if (isPos === 'true') {
      rootExit = await RootExits.findOne({ burnTransactionHash })
    } else {
      rootExit = await PlasmaExits.findOne({ burnTransactionHash })
    }
    let response
    let plasmaResponse
    if (rootExit) {
      let transactionHash
      if (isPos === 'true') {
        transactionHash = rootExit.transactionHash
      } else {
        transactionHash = rootExit.withdrawTxHash
      }
      response = {
        success: true,
        result: transactionHash,
        rootExit: rootExit,
        status: 1
      }
    } else {
      response = {
        success: false,
        status: 2,
        message: 'transaction might still be pending as subgraph did not pick this data up.'
      }
    }
    return response
  } catch (error) {
    console.log('error in checking transaction', error)
    const response = {
      success: false,
      error: error.message
    }
    return response
  }
}

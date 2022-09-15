require('dotenv').config()
const PlasmaExits = require('../models/PlasmaExits')
const { request, gql } = require('graphql-request')
const { mapWithdrawTxToBurnTx } = require('./decoder')
const Web3 = require('web3')
const web3 = new Web3(process.env.ETH_NETWORK_PROVIDER)
web3.eth.defaultBlock = 'safe'

const getPlasmaExitsFromSubgraph = async(start, timestamp = null) => {
  try {
    const limit = 1000
    const direction = 'asc'
    const sortBy = 'counter'
    let condition = ''
    if (timestamp) {
      condition = `, exitStartedTimeStamp_lte: ${timestamp}`
    }
    const query = gql`query{
    plasmaExits(first:${limit}, where:{ exitStartedTxHash_not: null, counter_gt: ${start} ${condition} }, orderDirection:${direction}, orderBy:${sortBy}) {
            counter,
            exitStartedTxHash,
            exitCompletedTxHash,
            exitCancelledTxHash,
            exitStartedTimeStamp,
            token,
            exited,
            exitId,
        }
    }`
    const resp = await request(process.env.SUBGRAPH_PLASMA_ENDPOINT, query)
    return resp.plasmaExits
  } catch (error) {
    console.log('error in getting plasma exits from subgraph', error)
  }
}

export const getAndSavePlasmaExits = async() => {
  try {
    const ERC20TokenSet = new Set()
    const ERC721TokenSet = new Set()
    ERC721TokenSet.add('0x2c04e6dd23c33a66f58dfb79dfb15285336c92d0')
    ERC20TokenSet.add('0x3db715989da05c1d17441683b5b41d4510512722')
    ERC20TokenSet.add('0x6b175474e89094c44da98b954eedeac495271d0f')
    ERC20TokenSet.add('0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0')
    ERC721TokenSet.add('0x96cddf45c0cd9a59876a2a29029d7c54f6e54ad3')
    ERC20TokenSet.add('0xa45b966996374e9e65ab991c6fe4bfce3a56dde8')
    let start = await PlasmaExits.countDocuments()
    let findMore = true
    while (findMore) {
      const safeBlock = await web3.eth.getBlock('safe')
      let plasmaExits = await getPlasmaExitsFromSubgraph(start, safeBlock.timestamp)
      if (plasmaExits.length === 1000) {
        start = start + 1000
      } else {
        findMore = false
      }
      const datatoInsert = []
      for (const plasmaExit of plasmaExits) {
        const { exitStartedTxHash, counter, token, exitStartedTimeStamp, exitCompletedTxHash } = plasmaExit
        let burnTransactionResult
        if (ERC721TokenSet.has(token)) {
          burnTransactionResult = await mapWithdrawTxToBurnTx(exitStartedTxHash, false, 'ERC721')
        } else {
          burnTransactionResult = await mapWithdrawTxToBurnTx(exitStartedTxHash, false, 'ERC20')
        }
        if (!burnTransactionResult) throw new Error('error in getting burntransaction')
        const burnTransactionHash = burnTransactionResult.result.toLowerCase()
        const burnTxTimeStamp = parseInt(burnTransactionResult.timestamp)
        const withdrawTimeStamp = parseInt(exitStartedTimeStamp)
        const exitableAt = Math.max((burnTxTimeStamp + 2 * 302400), (withdrawTimeStamp + 302400))
        const data = {
          withdrawTxHash: exitStartedTxHash,
          counter,
          exitableAt,
          burnTransactionHash,
          exitTxHash: exitCompletedTxHash
        }
        datatoInsert.push(data)
        console.log(`Plasma exit saved for ${counter}`)
      }
      await PlasmaExits.insertMany(datatoInsert)
    }
  } catch (error) {
    console.log('error in getting and saving plasma exits', error)
  }
}

export const getPlasmaExitPosition = async(reqParams) => {
  try {
    const { query } = reqParams
    const { burnTransactionHash } = query

    const plasmaExit = await PlasmaExits.findOne({ burnTransactionHash: burnTransactionHash })
    if (plasmaExit) {
      const { exitableAt: exitableAtConsidered } = plasmaExit
      const numberOfPlasmaExitsToBeExitedBefore = await PlasmaExits.count({ exitableAt: { $lt: exitableAtConsidered }, exitTxHash: { $eq: null } })
      return {
        success: true,
        result: {
          exitableAt: exitableAtConsidered,
          plasmaExitsBefore: numberOfPlasmaExitsToBeExitedBefore
        }
      }
    } else {
      return { success: false, message: 'Burn tx does not exist in Database.' }
    }
  } catch (error) {
    console.log('error in getting plasma exits', error)
    return { success: false }
  }
}

export const updatePlasmaExits = async() => {
  try {
    let start = 0
    let findMore = true

    while (findMore) {
      let plasmaExits = await getPlasmaExitsFromSubgraph(start)
      if (plasmaExits.length === 1000) {
        start = start + 1000
      } else {
        findMore = false
      }

      const bulk = PlasmaExits.collection.initializeUnorderedBulkOp()
      for (const plasmaExit of plasmaExits) {
        let { counter } = plasmaExit
        const { exitCompletedTxHash } = plasmaExit
        counter = parseInt(counter, 10)
        bulk.find({ counter }).update({ $set: { exitTxHash: exitCompletedTxHash } })
      }

      await bulk.execute()
      console.log('Executing bulk plasma update')
    }
  } catch (error) {
    console.log('Error in updating plasma exits', error)
  }
}

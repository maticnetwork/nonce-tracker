const RootDeposits = require('../models/RootDeposits')
const RootDepositEther = require('../models/RootDepositsEther')
const { request, gql } = require('graphql-request')
// const { mainnetWeb3 } = require('../index')
require('dotenv').config()
const Web3 = require('web3')
const { ROOT_CHAIN_MANAGER_ABI } = require('../constants')
const { getParsedTxDataFromAbiDecoder } = require('./decoder')

// Save Deposit Transaction from Subgraph with nonces
export const getAndSavePosDepositTransactions = async() => {
  try {
    const mainnetWeb3 = new Web3(process.env.ETH_NETWORK_PROVIDER)
    mainnetWeb3.eth.defaultBlock = 'safe'
    let start = await RootDeposits.countDocuments()
    let findMore = true
    // console.log(start)

    while (findMore) {
      const safeBlock = await mainnetWeb3.eth.getBlock('safe')
      let deposits = await getDepositsFromSubgraph(start, safeBlock.timestamp)
      if (deposits.length === 1000) {
        start = start + 1000
      } else {
        findMore = false
      }
      const datatoInsert = []
      for (const deposit of deposits) {
        const {
          transactionHash,
          timestamp,
          user: userAddress,
          rootToken,
          counter
        } = deposit
        const transactionDetails = await mainnetWeb3.eth.getTransaction(transactionHash)
        // console.log('transactionDetails', transactionDetails)
        const { input, blockNumber, from: fromAddress } = transactionDetails
        let data
        const code = await mainnetWeb3.eth.getCode(fromAddress)
        if (code === '0x') {
          const decodedAbiDataResponse = await getParsedTxDataFromAbiDecoder(input, ROOT_CHAIN_MANAGER_ABI.abi)
          if (!decodedAbiDataResponse.success) throw new Error('error in decoding abi')
          const decodedInputData = decodedAbiDataResponse.result
          if (decodedInputData) {
            const depositData = decodedInputData.params[2].value
            const amount = await mainnetWeb3.eth.abi.decodeParameter('uint256', depositData).toString()
            data = {
              transactionHash,
              timestamp,
              userAddress: userAddress.toLowerCase(),
              rootToken: rootToken.toLowerCase(),
              amount,
              counter,
              blockNumber,
              isDecoded: true
            }
            datatoInsert.push(data)
          } else {
            data = {
              transactionHash,
              timestamp,
              userAddress: userAddress.toLowerCase(),
              rootToken,
              // amount,
              counter,
              blockNumber,
              isDecoded: false
            }
            datatoInsert.push(data)
          }
        } else {
          data = {
            transactionHash,
            timestamp,
            userAddress: userAddress.toLowerCase(),
            rootToken,
            // amount,
            counter,
            blockNumber,
            isDecoded: false
          }
          datatoInsert.push(data)
        }
        console.log('Deposit counter', counter)
      }

      await RootDeposits.insertMany(datatoInsert)
    }
  } catch (error) {
    console.log('error in getting and saving deposit transaction for POS', error)
  }
}

export const getDepositsFromSubgraph = async(start, timestamp) => {
  try {
    const limit = 1000
    const direction = 'asc'
    const sortBy = 'counter'
    const query = gql`query{
        rootDeposits(first:${limit}, where:{ counter_gt: ${start}, timestamp_lte: ${timestamp}}, orderDirection:${direction}, orderBy:${sortBy}) {
            transactionHash,
            user,
            rootToken,
            counter,
            timestamp,
        }
        }`
    const resp = await request(process.env.SUBGRAPH_ENDPOINT, query)
    return resp.rootDeposits
  } catch (error) {
    console.log('error in getting deposits from subgraph', error)
  }
}

export const getDepositsEthersFromSubgraph = async(start, timestamp) => {
  try {
    const limit = 1000
    const direction = 'asc'
    const sortBy = 'counter'
    const query = gql`query{
      rootDepositEthers(first:${limit}, where:{ counter_gt: ${start}, timestamp_lte: ${timestamp}}, orderDirection:${direction}, orderBy:${sortBy}) {
            transactionHash,
            user,
            value,
            counter,
            timestamp,
        }
        }`
    const resp = await request(process.env.SUBGRAPH_ENDPOINT, query)
    return resp.rootDepositEthers
  } catch (error) {
    console.log('error in getting deposits from subgraph', error)
  }
}

export const checkDepositTransactionIfReplaced = async(reqParams) => {
  try {
    let { transactionHash: initialTransactionHash, userAddress, amount, isEther, rootToken } = reqParams.query
    let rootDeposit
    if (isEther === 'true') {
      rootDeposit = await RootDepositEther.findOne({ resolveTransaction: initialTransactionHash, isResolved: true })
      if (!rootDeposit) {
        rootDeposit = await RootDepositEther.findOne({ userAddress, amount, isResolved: false })
      }
    } else {
      rootDeposit = await RootDeposits.findOne({ resolveTransaction: initialTransactionHash, isResolved: true })
      if (!rootDeposit) {
        rootDeposit = await RootDeposits.findOne({ userAddress, amount, rootToken, isResolved: false })
      }
    }
    let response
    if (rootDeposit) {
      const { transactionHash, counter } = rootDeposit
      response = {
        success: true,
        status: 1,
        initialTransactionHash,
        newTransactionHash: transactionHash
      }
      if (isEther === 'true') {
        await RootDepositEther.findOneAndUpdate({ counter }, { resolveTransaction: initialTransactionHash, isResolved: true })
      } else {
        await RootDeposits.findOneAndUpdate({ counter }, { resolveTransaction: initialTransactionHash, isResolved: true })
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

export const getAndSaveDepositEtherTransaction = async() => {
  try {
    const mainnetWeb3 = new Web3(process.env.ETH_NETWORK_PROVIDER)
    mainnetWeb3.eth.defaultBlock = 'safe'
    let start = await RootDepositEther.countDocuments()
    let findMore = true
    console.log(start)

    while (findMore) {
      const safeBlock = await mainnetWeb3.eth.getBlock('safe')
      let deposits = await getDepositsEthersFromSubgraph(start, safeBlock.timestamp)
      if (deposits.length === 1000) {
        start = start + 1000
      } else {
        findMore = false
      }
      const datatoInsert = []
      for (const deposit of deposits) {
        const {
          transactionHash,
          timestamp,
          user: userAddress,
          value: amount,
          counter
        } = deposit

        const data = {
          transactionHash,
          timestamp,
          userAddress,
          amount,
          counter,
          isResolved: false
        }
        datatoInsert.push(data)
        console.log('Deposit counter', counter)
      }

      await RootDepositEther.insertMany(datatoInsert)
    }
  } catch (error) {
    console.log('error in get and save deposit ether transactions', error)
  }
}

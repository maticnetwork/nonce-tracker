require('dotenv').config()
const abiDecoder = require('abi-decoder')
const rlp = require('rlp')
const { ROOT_CHAIN_MANAGER_ABI, ERC721_PREDICATE_ABI, ERC20_PREDICATE_ABI } = require('../constants')
const Web3 = require('web3')

export const mapWithdrawTxToBurnTx = async(transactionHash, isPos, tokenType = null, isExit = false) => {
  try {
    //   const { transactionHash } = event
    const web3 = new Web3(process.env.ETH_NETWORK_PROVIDER)
    web3.eth.defaultBlock = 'safe'
    const maticWeb3 = new Web3(process.env.MATIC_NETWORK_PROVIDER)
    let abi
    if (isPos) {
      abi = ROOT_CHAIN_MANAGER_ABI.abi
    } else {
      if (tokenType === 'ERC721') {
        abi = ERC721_PREDICATE_ABI.abi
      } else {
        abi = ERC20_PREDICATE_ABI.abi
      }
    }

    // Get Transaction from transaction hash
    const confirmWithdrawTransaction = await web3.eth.getTransaction(transactionHash)
    const { input } = confirmWithdrawTransaction
    // console.log('tx',transactionHash)

    // Decode the data using abi decoder
    const decodedAbiDataResponse = await getParsedTxDataFromAbiDecoder(input, abi)
    if (!decodedAbiDataResponse.success) throw new Error('error in decoding abi')
    const decodedInputData = decodedAbiDataResponse.result
    // console.log('decodedInputData',decodedInputData);

    if (isExit && decodedInputData && decodedInputData.name !== 'exit') {
      return { success: true, result: 'not-decoded' }
    }

    if (!decodedInputData) {
      return { success: true, result: 'not-decoded' }
    }

    // RLP decode the decoded abi data
    const rlpDecodedDataResponse = await rlpDecodeData(decodedInputData)
    if (!rlpDecodedDataResponse.success) throw new Error('error in rlp decoding the input data')
    const blockNumber = rlpDecodedDataResponse.result.blockNumber
    const transactionIndex = rlpDecodedDataResponse.result.transactionIndex
    // console.log('logIndex', logIndex, 'blockNumber', blockNumber);

    const blockData = await maticWeb3.eth.getBlock(blockNumber)
    // console.log(blockData);
    const { transactions, timestamp } = blockData
    // console.log(transactions.length)
    const burnTransaction = transactions[transactionIndex]

    return { success: true, result: burnTransaction, timestamp }
  } catch (error) {
    console.log('error in mapwithdrawTxtoBurnTx', error)
    return { success: false }
  }
}
// Get decoded input data to pass for rlp decode
export const getParsedTxDataFromAbiDecoder = async(inputData, abi) => {
  try {
    abiDecoder.addABI(abi)
    // console.log('ip',inputData)
    const decodedData = abiDecoder.decodeMethod(inputData)
    return {
      success: true,
      result: decodedData
    }
  } catch (error) {
    console.log('error in getParsedTxDataFromAbiDecoder', error)
    return {
      success: false
    }
  }
}

// RLP decode the input data for log index and blocknumber
const rlpDecodeData = async(data) => {
  try {
    const decodedBuffer = rlp.decode(data.params[0].value)
    // console.log('djasndjlansjldna',decodedBuffer);
    const blockNumber = parseInt(decodedBuffer[2].toString('hex'), 16)
    // console.log('xyz', blockNumber)
    // const rlpDecodedTransactionIndex
    const receiptPath = decodedBuffer[8]
    const formattedBuffer = receiptPath.slice(1, receiptPath.length)
    let transactionIndex
    if (formattedBuffer.toString('hex') === '80') {
      transactionIndex = 0
    } else {
      transactionIndex = parseInt(rlp.decode(formattedBuffer).toString('hex'), 16)
    }
    // console.log('transactionIndex', transactionIndex)
    // if (transactionIndex === 80) {
    //     transactionIndex = 0
    // }
    return {
      success: true,
      result: {
        blockNumber,
        transactionIndex
      }
    }
  } catch (error) {
    console.log('error in rlpDecodeData', error)
    return {
      success: false
    }
  }
}

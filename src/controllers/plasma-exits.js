const { getPlasmaExitPosition } = require('../services/plasma-exits')

export const callGetPlasmaExitPosition = async(req, res) => {
  try {
    // All your validation can be done here before calloing the main function
    const { query, params } = req
    const reqParams = { query, params }
    const result = await getPlasmaExitPosition(reqParams)

    // Can make a successReponder which can be called for sending res. (Will make a Poc for this too)
    res.status(200).json(result)
  } catch (error) {
    console.log('error', error)
    // Similarly A failedResponder can be structured.
    return res.status(500).json({ error: error.mesage })
  }
}

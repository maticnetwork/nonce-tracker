const express = require('express')
const posExitRoutes = require('./pos-exits')
const posDepositRoutes = require('./pos-deposits')
const plasmaExitRoutes = require('./plasma-exits')

const router = express.Router()
router.use('/exit', posExitRoutes)
router.use('/deposit', posDepositRoutes)
router.use('/plasma-exit', plasmaExitRoutes)

module.exports = router

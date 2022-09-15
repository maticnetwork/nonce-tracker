const express = require('express')
const plasmaExitController = require('../controllers/plasma-exits')

const router = express.Router()

router.get('/position', plasmaExitController.callGetPlasmaExitPosition)

module.exports = router

const { supported, trongrid, wrapAsync, calculateValue, calculateValueRevert } = require('./util')
const keys = require('./key.json')
const express = require('express')
const TronWeb = require('tronweb')

const router = express.Router()

const platform = supported['tron']

const tronWeb = new TronWeb({
  fullHost: keys.production ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io',
  headers: { "TRON-PRO-API-KEY": keys.trongrid }
})

/**
 * @apiGroup RESTAPI-Tron
 * @api {post} /v1/tron/addresses/generate Address 생성
 */
router.post('/addresses/generate', wrapAsync(async (req, res) => {
  const { privateKey, address } = await tronWeb.createAccount()
  res.json({ privateKey, address: address.base58 })
}))

/**
 * @apiGroup RESTAPI-Tron
 * @api {get} /v1/tron/addresses/:address Address 거래 내역 조회
 * @apiParam {String} address 코인 주소.
 */
router.get('/addresses/:address', wrapAsync(async (req, res) => {
  const { address } = req.params

  if (!address) {
    return res.status(400).json({ message: '요청에 주소를 포함해주세요.' })
  }

  const { data } = await trongrid.get(`/v1/accounts/${address}/transactions`, {
    params: {
      limit: 200,
    }
  })  
  
  const transactions = data.data
  
  const result = transactions.map(item => {
    let sent = {}
    let received = {}
    let tokenType;
    
    const fee = item.ret[0].fee ? item.ret[0].fee : 0

    const contract = item.raw_data.contract[0]

    const { amount, owner_address, to_address } = contract.parameter.value
    const { type } = contract
    type === 'TransferContract'? tokenType = 'TRX' : type === 'TransferAssetContract'? tokenType = 'TRC10' : ''
    
    sent[owner_address] = calculateValue(platform, amount)
    if (to_address) {
      received[to_address] = calculateValue(platform, amount)
    }

    return {
      transactionId: item.txID,
      tokenType: tokenType,
      status: item.ret[0].contractRet,
      fee: calculateValue(platform, fee),
      netFee: calculateValue(platform, item.net_fee),
      netUsage: (platform, item.net_usage),
      energyFee: calculateValue(platform, item.energy_fee),
      energyUsage: (platform, item.energy_usage),
      energyUsageTotal: (platform, item.energy_usage_total),
      sent: sent,
      received: received,
      timestamp: item.raw_data.timestamp
    }
  })

  res.json(result)
}))

/**
 * @apiGroup RESTAPI-Tron
 * @api {get} /v1/tron/addresses/:address/balance Address 잔액 조회
 * @apiParam {String} address 코인 주소.
 */
router.get('/addresses/:address/balance', wrapAsync(async (req, res) => {
  const { address } = req.params

  if (!address) {
    return res.status(400).json({ message: '요청에 주소를 포함해주세요.' })
  }

  const balance = await tronWeb.trx.getBalance(address)

  res.json({
    address: address,
    name: platform.name,
    unit: platform.unit,
    balance: calculateValue(platform, balance)
  })
}))

/**
 * @apiGroup RESTAPI-Tron
 * @api {get} /v1/tron/txs/:id Transaction 내역 조회
 * @apiParam {String} id Transaction id
 */
router.get('/txs/:id', wrapAsync(async (req, res) => {
  const { id } = req.params
  
  if (!id) {
    return res.status(400).json({ message: '요청에 트랜잭션 ID를 포함해주세요.' })
  }

  const { ret, raw_data } = await tronWeb.trx.getTransaction(id)

  const responseBody = { 
    transactionId: id,
    type: raw_data.contract[0].type,
    timestamp: raw_data.timestamp, 
    value: 0,
    isConfirmed: ret[0].contractRet === 'SUCCESS', 
    statusCode: ret[0].contractRet,
  }

  if(raw_data.contract[0].type === 'TransferContract') {
    const log = raw_data.contract[0].parameter.value
    const value = calculateValue(platform, log.amount)
    const from = tronWeb.address.fromHex(log.owner_address)
    const to = tronWeb.address.fromHex(log.to_address)
    const sent = { [from]: value }
    const received = { [to]: value }

    responseBody.value = value
    responseBody.sent = sent
    responseBody.received = received
    responseBody.from = from
    responseBody.to = to
  }

  console.log(raw_data.contract[0].parameter)
  console.log(tronWeb.address.fromHex('4a0798f9b595c6662a801d9a8935826d1895ec6dee57fa64a478ab59b88eca07'))

  res.json(await tronWeb.trx.getTransaction(id))
}))

/**
 * @apiGroup RESTAPI-Tron
 * @api {post} /v1/tron/txs/new Transaction 생성
 * @apiParam {String} from 보내는 주소.
 * @apiParam {String} to 받는 주소.
 * @apiParam {Number} value 보내는 코인의 양.
 * @apiParam {String} privateKey 비밀키.
 */
router.post('/txs/new', wrapAsync(async (req, res) => {
  const { from, to, value, privateKey } = req.body

  if (!value) {
    return res.status(400).json({ message: '요청에 value(보내는 코인의 양)를 입력해주세요' })
  }

  if (!from) {
    return res.status(400).json({ message: '요청에 from(보내는 주소)을 입력해주세요' })
  }

  if (!to) {
    return res.status(400).json({ message: '요청에 to(받는 주소)를 입력해주세요' })
  }

  if (!privateKey) {
    return res.status(400).json({ message: '요청에 privateKey(비밀키)를 입력해주세요' })
  }

  const result = await tronWeb.trx.sendTransaction(to, calculateValueRevert(platform, value), privateKey)

  res.json(result)
}))

module.exports = router
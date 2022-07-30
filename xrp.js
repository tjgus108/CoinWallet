const { supported, v1, wrapAsync } = require('./util')
const apiKeys = require('./key.json')
const express = require('express')
const RippleAPI = require('ripple-lib').RippleAPI

const api = new RippleAPI({
  server: apiKeys.production ?  'wss://s2.ripple.com' : 'wss://s.altnet.rippletest.net:51233'
})

api.connect().then(async () => {
  console.log('Connected XRP network.')
}).catch(console.error)

const router = express.Router()

const platform = supported['xrp']

/**
 * @apiGroup RESTAPI-XRP
 * @api {post} /v1/xrp/addresses/generate Address 생성
 */
router.post('/addresses/generate', wrapAsync(async (req, res) => {
  res.json(api.generateXAddress({ includeClassicAddress: true }))
}))

/**
 * @apiGroup RESTAPI-XRP
 * @api {get} /v1/xrp/addresses/:address Address 거래 내역 조회
 * @apiParam {String} address 코인 주소.
 */
router.get('/addresses/:address', wrapAsync(async (req, res) => {
  const { address } = req.params

  if (!address) {
    return res.status(400).json({ message: '요청에 주소를 포함해주세요.' })
  }

  const { completeLedgers } = await api.getServerInfo()

  const [minLedgerVersion] = completeLedgers.split('-')

  const transactions = await api.getTransactions(address, { 
    minLedgerVersion: Number(minLedgerVersion)
  })

  const result = transactions.map(item => {
    let sent = {}
    let received = {}

  if (item.outcome.result !== 'tesSUCCESS') {
    var amount = 0;
  } else {
    var amount = item.outcome.deliveredAmount.value
  }
    const fee = item.outcome.fee
    
    sent[item.specification.source.address] = amount
    if (item.specification.destination) {
      received[item.specification.destination.address] = amount
    }

    return {
      type: item.type,
      transactionId: item.id,
      sent: sent,
      received: received,
      fee: fee,
      amount: amount,
      timestamp: new Date(item.outcome.timestamp).getTime(),
      destinationTag: item.specification.destination.tag,
      sourceTag: item.specification.source.tag
    }
  })

  res.json(result)
}))

/**
 * @apiGroup RESTAPI-XRP
 * @api {get} /v1/xrp/addresses/:address/balance Address 잔액 조회
 * @apiParam {String} address 코인 주소.
 */
router.get('/addresses/:address/balance', wrapAsync(async (req, res) => {
  const { address } = req.params
  const info = await api.getAccountInfo(address)

  res.json({
    address: address,
    name: platform.name,
    unit: platform.unit,
    balance: info.xrpBalance 
  })
}))

/**
 * @apiGroup RESTAPI-XRP
 * @api {get} /v1/xrp/txs/:id Transaction 내역 조회
 * @apiParam {String} id Transaction id
 */
router.get('/txs/:id', wrapAsync(async (req, res) => {
  const { id } = req.params
  
  if (!id) {
    return res.status(400).json({ message: '요청에 트랜잭션 ID를 포함해주세요.' })
  }

  const { data } = await v1.get(`/bc/${platform.alias}/${platform.network}/txs/hash/${id}`) 
  const { from, to, fee, timestamp, confirmations, status, value, specific, additional_data } = data.payload
  const sent = { [from]: value && value.value }
  const received = { [to]: value && value.value }
  const responseBody = { 
    transactionId: id,
    type: specific.type,
    from,
    sent, 
    received, 
    fee, 
    timestamp, 
    confirmations, 
    value, 
    isConfirmed: status === 'tesSUCCESS', 
    statusCode: status, 
    additional_data, specific 
  }

  res.json(responseBody)
}))

/**
 * @apiGroup RESTAPI-XRP
 * @api {post} /v1/xrp/txs/new Transaction 생성
 * @apiParam {String} from 보내는 주소.
 * @apiParam {String} to 받는 주소.
 * @apiParam {Number} maxFee 최대 수수료.
 * @apiParam {Number} value 보내는 코인의 양.
 * @apiParam {String} secret 비밀번호.
 * @apiParam {Number} destinationTag Destination Tag
 * @apiParam {Number} sourceTag Source Tag
 */
router.post('/txs/new', wrapAsync(async (req, res) => {
  const { from, to, maxFee, value, secret, destinationTag, sourceTag } = req.body

  if (!value) {
    return res.status(400).json({ message: '요청에 value(보내는 코인의 양)를 입력해주세요' })
  }

  if (!from) {
    return res.status(400).json({ message: '요청에 from(보내는 주소)을 입력해주세요' })
  }

  if (!to) {
    return res.status(400).json({ message: '요청에 to(받는 주소)를 입력해주세요' })
  }

  if (!secret) {
    return res.status(400).json({ message: '요청에 secret(비밀 번호)를 입력해주세요' })
  }

  const prepared = await api.preparePayment(from, { 
    destination: {
      address: to,
      amount: {
        currency: 'XRP',
        value: value.toString()
      },
      tag: destinationTag
    },
    source: {
      address: from,
      maxAmount: {
        currency: 'XRP',
        value: value.toString()
      },
      tag: sourceTag
    }
  }
  )

  const { signedTransaction } = api.sign(prepared.txJSON, secret)
  const result = await api.submit(signedTransaction)

  res.json(result)
}))

module.exports = router
const { supported, supportedToken, v1, wrapAsync } = require('./util')
const express = require('express')

const router = express.Router()

/**
 * @apiGroup RESTAPI
 * @api {get} /v1/:name/addresses/:address Address 거래 내역 조회
 * @apiParam {String} name 코인 이름 [bitcoin, ethereum].
 * @apiParam {String} address 코인 주소.
 */
router.get('/:name/addresses/:address', wrapAsync(async (req, res) => {
  const { name, address } = req.params

  const platform = supported[name]

  if (!address) {
    return res.status(400).json({ message: '요청에 주소를 포함해주세요.' })
  }

  if (!name) {
    return res.status(400).json({ message: '요청에 코인이나 토큰의 이름을 포함해주세요.' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }

  const { data } = await v1.get(`/bc/${platform.alias}/${platform.network}/address/${address}/basic/transactions`, {
    params: {
      limit: 50
    }
  })

  const transactions = data.payload

  const result = transactions.map(item => {
    let sent = {}
    let received = {}
    
    if (typeof item.sent === 'string') {
      sent[item.sent] = item.amount
      if (item.received) {
        received[item.received] = item.amount
      }
    } else if (typeof item.sent === 'object') {
      sent = item.sent
      received = item.received
    }

    return {
      transactionId: item.txid || item.hash,
      sent: sent,
      received: received,
      fee: item.fee,
      amount: item.amount,
      timestamp: item.timestamp
    }
  })

  res.json(result)
}))

/**
 * @apiGroup RESTAPI
 * @api {get} /v1/:name/addresses/:address/balance Address 잔액 조회
 * @apiParam {String} name 코인 이름 [bitcoin, ethereum].
 * @apiParam {String} address 코인 주소.
 */
router.get('/:name/addresses/:address/balance', wrapAsync(async (req, res) => {
  const { name, address } = req.params
  
  const platform = supported[name]

  if (!address) {
    return res.status(400).json({ message: '요청에 주소를 포함해주세요.' })
  }

  if (!name) {
    return res.status(400).json({ message: '요청에 코인이나 토큰의 이름을 포함해주세요.' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }

  const responseBody = {
    address: address,
    name: platform.name,
    unit: platform.unit
  }

  if(platform.type === 'coin') { 
    const { data } = await v1.get(`/bc/${platform.alias}/${platform.network}/address/${address}`)
    const { balance } = data.payload
    responseBody.balance = balance

    if (platform.name === 'Ethereum') {
      const { data: tokenData } = await v1.get(`/bc/${platform.alias}/${platform.network}/tokens/address/${address}`)
      responseBody.tokens = tokenData.payload 
    }
  }
  else if(platform.type === 'token') {
    const { data } = await v1.get(`/bc/${platform.parentAlias}/${platform.network}/tokens/address/${address}`)
    const result = data.payload
    
    const token = result.find(item => item.name === platform.name)

    if (!token) {
      return res.json({})
    }

    const { balance, contract } = token
    responseBody.balance = balance
    responseBody.contract = contract
  }

  res.json(responseBody)
}))

/**
 * @apiGroup RESTAPI-Ethereum
 * @api {get} /v1/ethereum/addresses/:address/tokens/:token Address 토큰 조회 (Ethereum)
 * @apiParam {String} address 코인 주소.
 * @apiParam {String} token 토큰 이름 [tether].
 */
router.get('/ethereum/addresses/:address/tokens/:token', wrapAsync(async (req, res) => {
  const { address, token } = req.params

  const platform = supported['ethereum']
  const ethToken = supportedToken[token]

  if (!address) {
    return res.status(400).json({ message: '요청에 주소를 포함해주세요.' })
  }

  if (!token) {
    return res.status(400).json({ message: '요청에 토큰의 이름을 포함해주세요.' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }

  if (!ethToken) {
    return res.status(400).json({ message: '지원하지 않는 토큰입니다.' })
  }

  const { data } = await v1.get(`/bc/${platform.alias}/${platform.network}/tokens/address/${address}/transfers`)

  const responseBody = data.payload
    .filter(item => item.name === ethToken.name)
    .map(item => {
      return {
        amount: item.value,
        transactionId: item.txHash,
        timestamp: item.timestamp,
        from: item.from,
        to: item.to,
        name: item.name,
        unit: ethToken.unit
      }
    })

  res.json(responseBody)
}))

/**
 * @apiGroup RESTAPI-Ethereum
 * @api {get} /v1/ethereum/addresses/:address/tokens/:token/balance Address 토큰 잔액 조회 (Ethereum)
 * @apiParam {String} address 코인 주소.
 * @apiParam {String} token 토큰 이름 (tether).
 */
router.get('/ethereum/addresses/:address/tokens/:token/balance', wrapAsync(async (req, res) => {
  const { address, token } = req.params
  
  const platform = supported['ethereum']
  const ethToken = supportedToken[token]

  if (!address) {
    return res.status(400).json({ message: '요청에 주소를 포함해주세요.' })
  }

  if (!token) {
    return res.status(400).json({ message: '요청에 토큰을 포함해주세요.' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }

  if (!ethToken) {
    return res.status(400).json({ message: '지원하지 않는 토큰입니다.' })
  }

  const { data } = await v1.get(`/bc/${platform.alias}/${platform.network}/tokens/address/${address}`)

  const result = data.payload.find(item => item.name === ethToken.name)

  res.json({ ...result, address })
}))

/**
 * @apiGroup RESTAPI
 * @api {post} /v1/:name/addresses/generate Address 생성
 * @apiParam {String} name 코인 이름 [bitcoin, ethereum].
 */
router.post('/:name/addresses/generate', wrapAsync(async (req, res) => {
  const { name } = req.params

  const platform = supported[name]

  if (!name) {
    return res.status(400).json({ message: '요청에 코인의 이름을 포함해주세요.' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }

  const { data } = await v1.post(`/bc/${platform.alias}/${platform.network}/address`)

  res.json(data)
}))

/**
 * @apiGroup RESTAPI-Ethereum
 * @api {post} /v1/ethereum/account/generate Ethereum Account 생성
 * @apiParam {String} password Account 비밀번호.
 */
router.post('/ethereum/account/generate', wrapAsync(async (req, res) => {
  const name = 'ethereum'

  const { password } = req.body

  const platform = supported[name]

  if (!name) {
    return res.status(400).json({ message: '요청에 코인이나 토큰의 이름을 포함해주세요.' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }

  if (!password) {
    return res.status(400).json({ message: '비밀번호가 반드시 포함되어야합니다.' })
  }

  const { data } = await v1.post(`/bc/${platform.alias}/${platform.network}/account`,{
    "password" : password,
  })

  res.json(data)
}))

/**
 * @apiGroup RESTAPI
 * @api {get} /v1/:name/tsx/:id Transaction 정보 조회
 * @apiParam {String} name 코인 이름 [bitcoin, ethereum].
 * @apiParam {String} id Transaction hash id.
 */
router.get('/:name/txs/:id', wrapAsync(async (req, res) => {
  const { name, id } = req.params

  const platform = supported[name]

  if (!id) {
    return res.status(400).json({ message: '요청에 트랜잭션 ID를 포함해주세요.' })
  }

  if (!name) {
    return res.status(400).json({ message: '요청에 코인이나 토큰의 이름을 포함해주세요.' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }

  let responseBody = {}
  
  if (platform.name === 'Bitcoin') {
    const { data } = await v1.get(`/bc/${platform.alias}/${platform.network}/txs/basic/${platform.name === 'Bitcoin' ? 'txid' : 'hash'}/${id}`)  
    const { sent, received, fee, timestamp, confirmations, amount } = data.payload
    responseBody = { transactionId: id, sent, received, fee, timestamp, confirmations, amount, isConfirmed: !!confirmations }
  }
  else {
    const { data } = await v1.get(`/bc/${platform.alias}/${platform.network}/txs/${platform.name === 'Bitcoin' ? 'txid' : 'hash'}/${id}`)  
    const { hash, from, to, fee, timestamp, confirmations, status, token_transfers, value } = data.payload
    const sent = { [from]: value / 10**18 }
    const received = { [to]: value / 10**18 }
    responseBody = { transactionId: id, sent, received, fee, timestamp, confirmations, value, isConfirmed: status === '0x1', statusCode: status, token_transfers }
  }

  /**
   * StatusCode 는 아래 링크 참조. (Ethereum에서 사용됨)
   * https://eips.ethereum.org/EIPS/eip-1066#code-table
   */

  res.json(responseBody)
}))

/**
 * @apiGroup RESTAPI
 * @api {post} /v1/:name/txs/new Transaction 생성
 * @apiParam {String} name 코인 이름 [bitcoin, ethereum].
 * @apiParam {String} from 보내는 주소.
 * @apiParam {String} to 받는 주소.
 * @apiParam {Number} fee 수수료.
 * @apiParam {Number} value 보내는 코인, 토큰의 양.
 * @apiParam {String} token 토큰 이름. [tether]
 * @apiParam {String} wif Address wif (Bitcoin).
 * @apiParam {String} password Account 비밀번호 (Ethereum).
 * @apiParam {String} privateKey Address Private Key (Ethereum).
 * @apiParam {String} gasPrice Gas Price (Ethereum).
 * @apiParam {String} gasLimit Gas Limit (Ethereum).
 */
router.post('/:name/txs/new', wrapAsync(async (req, res) => {
  const { name } = req.params
  const { from, to, fee, gasPrice, gasLimit, value, privateKey, token, wif } = req.body
  const platform = supported[name]

  let _transactionBody = undefined
  let _url = `/bc/${platform.alias}/${platform.network}/txs/new`

  if (!name) {
    return res.status(400).json({ message: '요청에 코인이나 토큰의 이름을 포함해주세요.' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }

  if (!from) {
    return res.status(400).json({ message: '요청에 from(보내는 주소)을 입력해주세요' })
  }

  if (!to) {
    return res.status(400).json({ message: '요청에 to(받는 주소)를 입력해주세요' })
  }

  if (platform.name === 'Bitcoin') {
    if (!wif) {
      return res.status(400).json({ message: '요청에 wif(비트코인 Address WIF)를 입력해주세요' })
    }

    _transactionBody = {
      createTx: {
        inputs: [{ address: from, value }],
        outputs: [{ address: to, value }],
        fee: { address: from, value: fee || 0 },
      },
      wifs: [wif]
    }

    if (!fee) {
      const { data: sizeData } = await v1.post(`/bc/${platform.alias}/${platform.network}/txs/size`, _transactionBody.createTx)
      const { data: feeData } = await v1.get(`/bc/${platform.alias}/${platform.network}/txs/fee`)
      const { tx_size_bytes } = sizeData.payload
      const { min_fee_per_byte, average_fee_per_byte } = feeData.payload
      const minimumFee = tx_size_bytes * average_fee_per_byte
      _transactionBody.createTx.fee.value = minimumFee
    }
  } 

  if (platform.name === 'Ethereum') {

    const ethereumToken = supported[token]
    
    if (!privateKey) {
      return res.status(400).json({ message: '비밀키를 입력해주세요' })
    }
    
    if (!value) {
      return res.status(400).json({ message: '요청에 value(보낼 양)를 입력해주세요' })
    }
    
    if (token && !ethereumToken) {
      return res.status(400).json({ message: '지원하지 않는 토큰입니다.' })
    }
    
    _transactionBody = {
      fromAddress: from,
      toAddress: to,
      gasPrice: gasPrice,
      gasLimit: gasLimit,
      privateKey: privateKey,
    }
    
    const coinInfo = {
      fromAddress: from,
      toAddress: to,
      value: value
    }
    
    if (token) {
      const { data: getNonce } = await v1.post(`/bc/${platform.alias}/${platform.network}/txs/send`, coinInfo)
      _transactionBody.nonce = parseInt(getNonce.payload.nonce);
      if (!gasPrice) {
        const { data: gasPriceData } = await v1.get(`/bc/${platform.alias}/${platform.network}/contracts/gas-price`)
        _transactionBody.gasPrice = Math.ceil(gasPriceData.payload.slow) * 1000000000
      }
      _transactionBody.token = parseFloat(value)
      
      const { data } = await v1.get(`/bc/${platform.alias}/${platform.network}/tokens/address/${from}`)
      const result = data.payload;
      const tokeninfo = result.find(item => item.name === ethereumToken.name);
      
      if (!tokeninfo) {
        return res.json({})
      }
      
      const { contract } = tokeninfo
      _transactionBody.contract = contract;
      
      const glimitobj = {
        fromAddress: from,
        toAddress: to,
        contract: contract,
        tokenAmount: value
      }
      if (!gasLimit) {
        const { data: gasLimitData } = await v1.post(`/bc/${platform.alias}/${platform.network}/tokens/transfer/gas-limit`, glimitobj)
        _transactionBody.gasLimit = parseInt(gasLimitData.payload.gasLimit)
      }
      
      _url = `/bc/${platform.alias}/${platform.network}/tokens/transfer`
    } else {
      if (!gasPrice) {
        const { data: gasPriceData } = await v1.get(`/bc/${platform.alias}/${platform.network}/txs/fee`)
        _transactionBody.gasPrice = Math.ceil(gasPriceData.payload.slow) * 1000000000;
      }
      if (!gasLimit) {
        const { data: gasLimitData } = await v1.post(`/bc/${platform.alias}/${platform.network}/txs/gas`, coinInfo)
        _transactionBody.gasLimit = parseInt(gasLimitData.payload.gasLimit)
      }
      if (privateKey) {
        _url = `${_url}-pvtkey`
      }
      _transactionBody.value = parseFloat(value)
    }
  }
    
    const { data } = await v1.post(_url, _transactionBody)
    
    res.json(data)
  }))
  
/**
 * @apiGroup RESTAPI-Bitcoin
 * @api {post} /bitcoin/txs/hdwallet Wallet Transaction 생성 (Bitcoin)
 * @apiParam {String} walletName 지갑 이름.
 * @apiParam {String} password 지갑 비밀번호.
 * @apiParam {String} to 받는 주소.
 * @apiParam {Number} fee 수수료.
 * @apiParam {Number} value 보내는 코인의 양.
 */
router.post('/bitcoin/txs/hdwallet', wrapAsync(async (req, res) => {
  const { name } = req.params
  const { walletName, password, to, fee } = req.body
  const platform = supported[name]

  if (!name) {
    return res.status(400).json({ message: '요청에 코인이나 토큰의 이름을 포함해주세요.' })
  }

  if (!walletName) {
    return res.status(400).json({ message: '요청에 walletName을 입력해주세요' })
  }

  if (!password) {
    return res.status(400).json({ message: '요청에 password를 입력해주세요' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }

  if (!to) {
    return res.status(400).json({ message: '요청에 to(받는 주소)를 입력해주세요' })
  }

  const transactionBody = {
    createTx: {
      walletName: walletName,
      password: password,
      outputs: [{ address: to, value }],
      fee: { value: fee || 0 },
    }
  }

  if (!fee) {
    const { data: sizeData } = await v1.post(`/bc/${platform.alias}/${platform.network}/wallets/hd/txs/size`, transactionBody.createTx)
    const { data: feeData } = await v1.get(`/bc/${platform.alias}/${platform.network}/txs/fee`)
    const { tx_size_bytes } = sizeData.payload
    const { min_fee_per_byte } = feeData.payload
    const minimumFee = tx_size_bytes * min_fee_per_byte
    transactionBody.createTx.fee.value = minimumFee
  }

  const { data } = await v1.post(`/bc/${platform.alias}/${platform.network}/txs/hdwallet`, transactionBody)

  res.json(data)
}))


/**
 * @apiGroup RESTAPI-Bitcoin
 * @api {post} /v1/bitcoin/wallet/generate Bitcoin Wallet 생성
 * @apiParam {String} walletName 지갑 이름.
 * @apiParam {String} password 지갑 비밀번호.
 * @apiParam {String} addressCount 생성할 Address 갯수.
 */
 router.post('/bitcoin/wallet/generate', wrapAsync(async (req, res) => {
  const name = 'bitcoin'

  const { walletName, addressCount, password, addresses } = req.body

  const platform = supported[name]

  if (!name) {
    return res.status(400).json({ message: '요청에 코인이나 토큰의 이름을 포함해주세요.' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }

  if (!walletName || !password || !addressCount) {
    return res.status(400).json({ message: '지갑이름과 비밀번호, 주소갯수가 반드시 포함되어야합니다.' })
  }

  const result = await v1.post(`/bc/${platform.alias}/${platform.network}/wallets/hd`,{
    "walletName" : walletName,
    "addressCount" : addressCount,
    "password" : password,
  })

  // 지갑이름 중복시, result : undefined
  if(result) {
    res.json(result.data)
  } else {
    res.json({ error: '지갑 생성에 실패했습니다.'})
  }
}))


module.exports = router;

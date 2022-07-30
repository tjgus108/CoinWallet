const { supported, v2, wrapAsync } = require('./util')
const express = require('express')

const router = express.Router()

/**
 * @apiGroup RESTAPI
 * @api {get} /v2/ /blockchain-data/{blockchain}/{network}/addresses/{address}/tokens List Tokens By Address
 * @apiParam {String} name : Represents the specific blockchain protocol name [ethereum, ethereum-classic, binance-smart-chain].
 * @apiParam {String} network : Represents the name of the blockchain network used; blockchain networks are usually identical as technology and software [mainnet, ropsten].
 * @apiParam {String} address : Represents the public address, which is a compressed and shortened form of a public key.
 */
router.get('/blockchain-data/:name/:network/addresses/:address/tokens', wrapAsync(async (req, res) => {
  const { name, network, address} = req.params

  const platform = supported[name]

  if (!address) {
    return res.status(400).json({ message: '요청에 주소를 포함해주세요.' })
  }

  if (!name) {
    return res.status(400).json({ message: '요청에 코인이나 토큰의 이름을 포함해주세요.' })
  }

  if (!network) {
    return res.status(400).json({ message: '지원하지 않는 네트워크입니다.' })
  }

  if (!platform) {
    return res.status(400).json({ message: '지원하지 않는 타입입니다.' })
  }
  const { data: tokenData } = await v2.get(`/blockchain-data/${name}/${network}/addresses/${address}/tokens`)

  res.json(tokenData)
}))

/**
 * @apiGroup RESTAPI
 * @api {get} /v2/blockchain-data/{blockchain}/{network}/addresses/{address}/tokens Get Wallet Asset Details
 * @apiParam {String} walletId : Defines the unique ID of the Wallet.
 * @apiParam {String} blockchain : Represents the specific blockchain protocol name [ethereum].
 * @apiParam {String} network : Represents the name of the blockchain network used; blockchain networks are usually identical as technology and software.
 */
router.get('/wallet-as-a-service/wallets/:walletId/:blockchain/:network', wrapAsync(async (req, res) => {
  const { walletId, blockchain, network } = req.params

  if (!walletId) {
    return res.status(400).json({ message: '요청에 주소를 포함해주세요.' })
  }

  if (!blockchain) {
    return res.status(400).json({ message: '요청에 코인이나 토큰의 이름을 포함해주세요.' })
  }

  if (!network) {
    return res.status(400).json({ message: '지원하지 않는 네트워크입니다.' })
  }

  const { data: tokenData } = await v2.get(`/wallet-as-a-service/wallets/${walletId}/${blockchain}/${network}`)

    const NFTs = tokenData.data.item.nonFungibleTokens
    if (NFTs.len > 0) {
      NFTs.forEach(function (item, index) {
        console.log("Index : " + index + ", TokenId" + item.tokenId);
      });
      return res.json(NFTs)
    }

  res.json(tokenData)
}))

/**
 * @apiGroup RESTAPI
 * @api {post} /wallet-as-a-service/wallets/{walletId}/{blockchain}/{network}/addresses/{address}/transaction-requests : Create Coins Transaction Request from Address
 * @apiParam {String} walletId : Represents the sender's specific and unique Wallet ID of the sender.
 * @apiParam {String} network  : Represents the name of the blockchain network used; blockchain networks are usually identical as technology and software.
 * @apiParam {String} blockchain  : Represents the specific blockchain protocol name. [ethereum]
 * @apiParam {String} address  : Defines the specific source address for the transaction.
 * @apiParam {String} amount  : Represents the specific amount of the transaction.
 * @apiParam {String} feePriority  : Represents the fee priority of the automation, whether it is "slow", "standard" or "fast".
 * @apiParam {String} recipientAddressress  : Defines the specific recipient address for the transaction.
*/
router.post('/wallet-as-a-service/wallets/:walletId/:blockchain/:network/addresses/:address/transaction-requests', wrapAsync(async (req, res) => {
  const { walletId, blockchain, network, address } = req.params
  const { amount, feePriority, recipientAddress} = req.body
  let _transactionBody = undefined

  if (!blockchain) {
    return res.status(400).json({ message: '요청에 코인이나 토큰의 이름을 포함해주세요.' })
  }

  if (!address) {
    return res.status(400).json({ message: '요청에 from(보내는 주소)을 입력해주세요' })
  }

  if (!recipientAddress) {
    return res.status(400).json({ message: '요청에 to(받는 주소)를 입력해주세요' })
  }

  _transactionBody = {
    data: {
      item: {
        amount: amount,
        feePriority: feePriority,
        recipientAddress: recipientAddress
      }
    }
  }

  const { data } = await v2.post(`/wallet-as-a-service/wallets/${walletId}/${blockchain}/${network}/addresses/${address}/transaction-requests`, _transactionBody)
  res.json(data)
}))

/**
 * @apiGroup RESTAPI
 * @api {get} /v2/wallet-as-a-service/wallets/{walletId}/{blockchain}/{network}/addresses/{address}/all-transaction-requests 잔액 조회 : Create Coins Transaction From Address For Whole Amount
*/
router.get('/wallet-as-a-service/wallets/all-assets', wrapAsync(async (req, res) => {
  const { data: tokenData } = await v2.get(`/wallet-as-a-service/wallets/all-assets`)
  const NFTs = tokenData.data.item.nonFungibleTokens
  if (NFTs.len > 0) {
    NFTs.forEach(function (item, index) {
      console.log("Index : " + index + ", TokenId" + item.tokenId);
    });
    return res.json(NFTs)
  }
  res.json(tokenData)
}))


module.exports = router;

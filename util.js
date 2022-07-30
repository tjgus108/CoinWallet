
const axios = require('axios').default;
const keys = require('./key.json')

const v1 = axios.create({
  baseURL: 'https://api.cryptoapis.io/v1',
  headers: {
    'X-API-Key': keys.cryptoAPI,
    'Content-Type': 'application/json',
  }
})

const v2 = axios.create({
  baseURL: 'https://rest.cryptoapis.io/v2',
  headers: {
    'X-API-Key': keys.cryptoAPI,
    'Content-Type': 'application/json',
  }
})

const trongrid = axios.create({
  baseURL: keys.production ? 'https://api.trongrid.io' : 'https://api.shasta.trongrid.io',
  headers: {
    'TRON-PRO-API-KEY': keys.trongrid,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
});

[v1, v2, trongrid].forEach(api => 
  api.interceptors.response.use(null, (error) => {
    if (error.isAxiosError) {
      console.error('API 요청 에러. CODE:', error.response.status)
      console.error(error.config.method, ':', error.config)

      throw error.response.data
    }

    throw error
  })
)

const supportedToken = {
  tether: { type: 'token', parent: 'ethereum', name: 'Tether USD', unit: 'USDT', contract: '0xdac17f958d2ee523a2206206994597c13d831ec7' }
}
/**
* 100,000,000 = 1 bitcoin.  
* 1,000,000,000,000,000,000 = 1 ethereum.  
* 1,000,000 = 1 tron.  
* 1,000,000 = 1 xrp.
*/

const _supported = {
  bitcoin: { network: 'mainnet', type: 'coin', name: 'Bitcoin', alias: 'btc', unit: 'BTC', valueRate: 100000000 },
  xrp: { network: 'mainnet', type: 'coin', name: 'XRP', alias: 'xrp', unit: 'XRP', valueRate: 1000000 },
  tron: { network: 'mainnet', type: 'coin', name: 'Tron', alias: 'trx', unit: 'TRX', valueRate: 1000000 },
  ethereum: { network: 'mainnet', type: 'coin', name: 'Ethereum', alias: 'eth', unit: 'ETH', valueRate: 10**18 },
  tether: { network: 'mainnet', type: 'token', parent: 'ethereum', name: 'Tether USD', parentAlias: 'eth', alias: 'eth', unit: 'USDT' }
}

const _supported_dev = {
  bitcoin: { network: 'testnet', type: 'coin', name: 'Bitcoin', alias: 'btc', unit: 'BTC', valueRate: 100000000 },
  xrp: { network: 'testnet', type: 'coin', name: 'XRP', alias: 'xrp', unit: 'XRP', valueRate: 1000000 },
  tron: { network: 'shasta', type: 'coin', name: 'Tron', alias: 'trx', unit: 'TRX', valueRate: 1000000 },
  ethereum: { network: 'ropsten', type: 'coin', name: 'Ethereum', alias: 'eth', unit: 'ETH', valueRate: 10**18 },
  tether: { network: 'ropsten', type: 'token', parent: 'ethereum', parentAlias: 'eth', name: 'Tether USD', alias: 'eth', unit: 'USDT' }
}

const supported = keys.production ? _supported : _supported_dev

const wrapAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

const calculateValue = (platform, value) => {
  return Math.abs(parseInt(value)) / platform.valueRate
}

const calculateValueRevert = (platform, value) => {
  return Math.abs(parseInt(value)) * platform.valueRate
}

module.exports = {
  supported,
  supportedToken,
  v1,
  v2,
  trongrid,
  wrapAsync,
  calculateValue,
  calculateValueRevert
}
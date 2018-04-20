'use strict'
const crypto = require('crypto')
const { deriveAddress, deriveKeypair } = require('ripple-keypairs')
const { createSubmitter } = require('ilp-plugin-xrp-paychan-shared')
const { RippleAPI } = require('ripple-lib')
const parentBtpHmacKey = 'parent_btp_uri'

class Config {
  constructor (opts) {
    if (!opts.parent || !opts.secret) {
      throw new Error('--parent and --secret must be defined')
    }
    this.btpName = opts.name
    this.parentBtpHost = opts.parent
    this.xrpSecret = opts.secret
    this.xrpAddress = opts.address || deriveAddress(deriveKeypair(this.xrpSecret).publicKey)
    this.xrpServer = opts.rippled
    this.environment = opts.environment
    this.adminApiPort = opts.adminApiPort
    this.api = null
    this.subscribed = false
  }

  xrpPluginOptions () {
    // TODO: wss
    const btpSecret = hmac(hmac(parentBtpHmacKey, this.parentBtpHost + this.btpName), this.xrpSecret).toString('hex')
    const parentUri = 'btp+wss://' + this.btpName + ':' + btpSecret + '@' + this.parentBtpHost
    return {
      server: parentUri,
      secret: this.xrpSecret,
      address: this.xrpAddress,
      xrpServer: this.xrpServer
    }
  }

  async rippleApi () {
    if (!this.api) {
      this.api = new RippleAPI({ server: this.xrpServer })
      await this.api.connect()
    }
    return this.api
  }

  async submitter () {
    const api = await this.rippleApi()

    if (!this.subscribed) {
      this.subscribed = true
      await api.connection.request({
        command: 'subscribe',
        accounts: [ this.xrpAddress ]
      })
    }

    return createSubmitter(api, this.xrpAddress, this.xrpSecret)
  }
}

function hmac (key, message) {
  const h = crypto.createHmac('sha256', key)
  h.update(message)
  return h.digest()
}

module.exports = Config
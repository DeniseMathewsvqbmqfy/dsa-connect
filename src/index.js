// constant
const address = require("./constant/addresses.js");
const ABI = require("./constant/abis.js");

// internal
const Internal = require("./internal.js");

// utils
const Erc20 = require("./utils/erc20.js");
const Cast = require("./utils/cast.js");
const Txn = require("./utils/txn.js");
const Math = require("./utils/math.js");

// resolvers
const Account = require("./resolvers/account.js");

const Tokens = require("./resolvers/tokens.js");

module.exports = class DSA {
  /**
   * @param config // === web3
   * OR
   * @param config.web3
   * @param config.mode (optional) in case of "node"
   * @param config.privateKey (optional) private keys, in case of "node"
   */
  constructor(config) {
    if (!config) config = {};
    this.web3 = config.web3 ? config.web3 : config;
    this.mode = config.mode ? config.mode.toLowerCase() : "browser";
    if (this.mode == "node") {
      if (!config.privateKey)
        return console.error("Private key is not defined.");
      this.privateKey =
        config.privateKey.slice(0, 2) != "0x"
          ? "0x" + config.privateKey
          : config.privateKey;
    }

    this.address = address;
    this.ABI = ABI;
    this.instance = {
      id: 0,
      address: address.genesis,
      version: 1,
    };
    this.origin = address.genesis;

    this.internal = new Internal(this);
    this.math = new Math(this);
    this.tokens = new Tokens(this);

    this.castUtil = new Cast(this);
    this.txnUtil = new Txn(this);
    this.erc20 = new Erc20(this);

    this.account = new Account(this);

    // defining methods to simplify the calls for frontend developers
    this.sendTxn = this.txnUtil.send; // send transaction // node || browser
    this.transfer = this.erc20.transfer;
    this.castEncoded = this.castUtil.encoded;
    // this.estimateCastGas = this.castUtil.estimateGas;
    this.encodeCastABI = this.castUtil.encodeABI;
    this.count = this.account.count;
    this.getAccounts = this.account.getAccounts;
    this.getAuthById = this.account.getAuthById;
    this.getAuthByAddress = this.account.getAuthByAddress;

    // value of uint(-1).
    this.maxValue =
      "115792089237316195423570985008687907853269984665640564039457584007913129639935";
  }

  /**
   * returns the estimate gas cost
   * @param _d.from the from address
   * @param _d.to the to address
   * @param _d.value eth value
   * @param _d.spells cast spells
   */
  async estimateCastGas(_d) {
    return new Promise(async (resolve, reject) => {
      await this.castUtil
        .estimateGas(_d)
        .then((gas) => resolve(gas))
        .catch((err) => reject(err));
    });
  }

  /**
   * sets the current DSA instance
   */
  async setInstance(_o, _c) {
    if (typeof _o == "object") {
      if (!_o.id) throw new Error("`dsaId` is not defined.");
      _id = _o.id;
    } else {
      _id = _o;
    }

    if (!isFinite(String(_id))) throw new Error("Invaild `dsaId`.");

    let _obj = {
      protocol: "core",
      method: "getAccountIdDetails",
      args: [_id],
    };
    return new Promise((resolve, reject) => {
      return this.read(_obj)
        .then((res) => {
          this.instance.id = res[0];
          this.instance.address = res[1];
          this.instance.version = res[2];
          resolve(this.instance);
        })
        .catch(async (err) => {
          let count = await this.account.count();
          if (count < Number(_id)) {
            return reject(
              "dsaId does not exist. Run `dsa.build()` to create new DSA."
            );
          }
          reject(err);
        });
    });
  }

  /**
   * sets the current DSA ID instance
   * @param {number | string} _o DSA ID
   * @param {object} _c config
   */
  async setAccount(_o, _c) {
    return this.setInstance(_o, _c);
  }

  /**
   * sets the origin of interactions
   * @param {address} address the origin address for affiliation and on-chain analytics
   */
  setOrigin(_origin) {
    this.origin = _origin;
  }

  /**
   * build new DSA
   * @param {address} _d.authority (optional)
   * @param {address} _d.origin (optional)
   * @param {address} _d.from (optional)
   * @param {number|string} _d.gasPrice (optional) not optional in "node"
   * @param {number|string} _d.gas (optional) not optional in "node"
   * @param {number|string} _d.nonce (optional) not optional in "node"
   */
  async build(_d) {
    let _addr = await this.internal.getAddress();
    if (!_d) _d = {};
    if (!_d.authority) _d.authority = _addr;
    if (!_d.version) _d.version = 1;
    if (!_d.origin) _d.origin = this.origin;
    if (!_d.from) _d.from = _addr;
    _d.to = this.address.core.index;

    let _c = await new this.web3.eth.Contract(
      this.ABI.core.index,
      this.address.core.index
    );

    _d.callData = _c.methods
      .build(_d.authority, _d.version, _d.origin)
      .encodeABI();

    return new Promise(async (resolve, reject) => {
      let txObj = await this.internal.getTxObj(_d);
      return this.sendTxn(txObj)
        .then((tx) => resolve(tx))
        .catch((err) => reject(err));
    });
  }

  /**
   * build new DSA txObj
   * @param {address} _d.authority (optional)
   * @param {address} _d.origin (optional)
   * @param {number|string} _d.gasPrice (optional) not optional in "node"
   * @param {number|string} _d.gas (optional) not optional in "node"
   * @param {number|string} _d.nonce (optional) not optional in "node"
   */
  async buildTxObj(_d) {
    if (!_d) _d = {};
    if (!_d.authority) _d.authority = _addr;
    if (!_d.version) _d.version = 1;
    if (!_d.origin) _d.origin = this.origin;
    _d.to = this.address.core.index;

    let _c = await new this.web3.eth.Contract(
      this.ABI.core.index,
      this.address.core.index
    );

    _d.callData = _c.methods
      .build(_d.authority, _d.version, _d.origin)
      .encodeABI();

    let txObj = await this.internal.getTxObj(_d);
    return txObj;
  }

  /**
   * execute all the spells
   * @param _d the spells instance
   * OR
   * @param _d.spells the spells instance
   * @param _d.origin (optional)
   * @param _d.to (optional)
   * @param _d.from (optional)
   * @param _d.value (optional)
   * @param _d.gasPrice (optional only for "browser" mode)
   * @param _d.gas (optional)
   * @param {number|string} _d.nonce (optional) txn nonce (mostly for node implementation)
   */
  async cast(_d) {
    let _addr = await this.internal.getAddress();
    let _espell = this.internal.encodeSpells(_d);
    if (!_d.to) _d.to = this.instance.address;
    if (!_d.from) _d.from = _addr;
    if (!_d.origin) _d.origin = this.origin;

    let _c = new this.web3.eth.Contract(
      this.ABI.core.account,
      this.instance.address
    );

    _d.callData = _c.methods.cast(..._espell, _d.origin).encodeABI();

    return new Promise(async (resolve, reject) => {
      let txObj = await this.internal.getTxObj(_d);
      console.log("Casting spells to DSA.");
      return this.sendTxn(txObj)
        .then((tx) => {
          resolve(tx);
        })
        .catch((err) => reject(err));
    });
  }

  /**
   * Return txObj for cast
   * @param _d the spells instance
   * OR
   * @param _d.spells the spells instance
   * @param _d.origin (optional)
   * @param _d.to (optional)
   * @param _d.value (optional)
   * @param _d.gasPrice (optional only for "browser" mode)
   * @param _d.gas (optional)
   * @param {number|string} _d.nonce (optional) txn nonce (mostly for node implementation)
   */
  async castTxObj(_d) {
    let _espell = this.internal.encodeSpells(_d);
    if (!_d.to) _d.to = this.instance.address;
    if (!_d.origin) _d.origin = this.origin;
    _d.type = this.instance.config.type;

    let _c = new this.web3.eth.Contract(
      this.ABI.core.account,
      this.instance.address
    );

    _d.callData = _c.methods.cast(..._espell, _d.origin).encodeABI();

    let txObj = await this.internal.getTxObj(_d);
    return txObj;
  }

  /**
   * creating a new spell instance
   */
  Spell() {
    return new (class Spell {
      /**
       * empty spells array
       */
      constructor() {
        this.data = [];
      }

      /**
       * add new spells
       * @param _d.connector the from address
       * @param _d.method the to address
       * @param _d.args the ABI interface
       */
      add(_s) {
        if (!_s.connector) return console.error(`connector not defined.`);
        if (!_s.method) return console.error(`method not defined.`);
        if (!_s.args) return console.error(`args not defined.`);
        this.data.push(_s);
      }
    })();
  }

  /**
   * to call read functions and get raw data return (kind of a helper)
   */
  async read(_s) {
    var _c = new this.web3.eth.Contract(
      this.ABI.read[_s.protocol],
      this.address.read[_s.protocol]
    );
    return new Promise((resolve, reject) => {
      return _c.methods[_s.method](..._s.args)
        .call()
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
};

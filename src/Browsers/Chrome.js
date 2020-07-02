const os = require("os")

class Chrome {
    platform

    constructor() {
        platform = os.platform()
    }

    GetCookie() {

    }
}

module.exports = Chrome

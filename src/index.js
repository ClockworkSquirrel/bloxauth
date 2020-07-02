const win32 = require("./win32"),
    os = require("os")

function AutoDeterminePlatform() {
    if (os.platform() === "win32") {
        return win32
    }
}

module.exports = AutoDeterminePlatform()
exports.windows = win32

const { Registry } = require("rage-edit"),
    DPAPI = require("@bradhugh/node-dpapi"),
    sqlite = require("sqlite-async"),
    fs = require("fs"),
    path = require("path"),
    ini = require("ini")

const CookieQuery = {
    Chrome: "SELECT * FROM \"cookies\" WHERE name=\".ROBLOSECURITY\" AND host_key=\".roblox.com\" LIMIT 1",
    Firefox: "SELECT * FROM \"moz_cookies\" WHERE name=\".ROBLOSECURITY\" AND host=\".roblox.com\" LIMIT 1"
}

const RbxRegistry = new Registry("HKCU\\Software\\Roblox\\RobloxStudioBrowser\\roblox.com")

const FetchCookieFromRegistry = () => RbxRegistry.get(".ROBLOSECURITY").then(entry => {
    const data = {}

    entry.split(",").map(dataSet => {
        const pairs = dataSet.split("::")
        data[pairs[0].toLowerCase()] = pairs[1].substr(1, pairs[1].length - 2)
    })

    if (data.cook && data.exp) {
        if (new Date(data.exp).getTime() - Date.now() <= 0)
            throw new Error("Cookie has expired")
    } else {
        throw new Error("Couldn't find cookie in Registry")
    }

    return data.cook
})

const ResolveAppDataDirectory = () => path.join(process.env.APPDATA, "..")
const ResolveChromeCookiePath = (profile = "Default") => {
    const cookiePath = path.join(ResolveAppDataDirectory(), "Local", "Google", "Chrome", "User Data", profile, "Cookies")

    if (!fs.existsSync(cookiePath))
        throw new Error("Unable to locate Chrome cookies")

    return cookiePath
}

const FetchRobloxCookieChrome = (profile = "Default") => {
    const cookiePath = ResolveChromeCookiePath(profile)

    return sqlite.open(cookiePath, sqlite.OPEN_READONLY).then(database =>
        database.get(CookieQuery.Chrome)
    ).then(cookie => {
        if (cookie.value.length)
            return cookie.value

        return DPAPI.unprotectData(cookie.encrypted_value, null, "CurrentUser")
    }).then(buffer => buffer.toString())
}

const ResolveFirefoxProfile = (profile = "Profile0") => {
    const ffDirectory = path.join(ResolveAppDataDirectory(), "Roaming", "Mozilla", "Firefox")
    const ffProfilesConfig = path.join(ffDirectory, "profiles.ini")

    if (!fs.existsSync(ffProfilesConfig))
        throw new Error("Unable to locate profiles.ini")

    const config = ini.parse(fs.readFileSync(ffProfilesConfig, "utf-8"))

    if (!config[profile].Path)
        throw new Error(`Unable to locate ${profile}`)

    return path.join(ffDirectory, config[profile].Path)
}

const ResolveFirefoxCookiePath = (profile = "Profile0") => {
    const cookiePath = path.join(ResolveFirefoxProfile(profile), "cookies.sqlite")

    if (!fs.existsSync(cookiePath))
        throw new Error("Unable to locate Firefox cookies")

    return cookiePath
}

const FetchRobloxCookieFirefox = (profile = "Profile0") => {
    const cookiePath = ResolveFirefoxCookiePath(profile)

    return sqlite.open(cookiePath, sqlite.OPEN_READONLY).then(database =>
        database.get(CookieQuery.Firefox)
    ).then(cookie => {
        if (cookie.value.length)
            return cookie.value

        throw new Error("Unable to find Roblox cookie in Firefox")
    })
}

const FetchRobloxCookieAutoSelect = () => new Promise(async (resolve, reject) => {
    let resolvedCookie

    try {
        resolvedCookie = await FetchRobloxCookieChrome()
    } catch (_) {
        try {
            resolvedCookie = await FetchRobloxCookieFirefox()
        } catch (_) {
            try {
                resolvedCookie = await FetchCookieFromRegistry()
            } catch (err) {
                reject(err.message)
            }
        }
    }

    if (resolvedCookie)
        return resolve(resolvedCookie)

    reject("Unable to locate a cookie")
})

module.exports = {
    fromRegistry: FetchCookieFromRegistry,
    fromChrome: FetchRobloxCookieChrome,
    fromFirefox: FetchRobloxCookieFirefox,
    autoResolve: FetchRobloxCookieAutoSelect
}

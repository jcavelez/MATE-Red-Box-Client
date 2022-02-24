const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function validateProductKey(key, productId) {
    console.log(key)
    const secret = 'compucom'
    const pathToPrivate = path.join(__dirname, '../private.pem')
    let decrypted = ''
    try {
        const buffer = Buffer.from(key, 'base64')
        decrypted = crypto.privateDecrypt(
            {
                key: fs.readFileSync(pathToPrivate, 'utf8'),
                passphrase: secret,
            },
            buffer,
          )
          .toString("base64")
          .replaceAll('+', '-')
    } catch (error) {
        console.log(error)
    }

    return (decrypted == productId)
}

module.exports = { validateProductKey }
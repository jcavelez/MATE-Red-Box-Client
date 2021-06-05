const fs = require('fs')
const path = require('path')

function rename (callData) {
    let newName = 
        callData.RBRCallGUID + '_' +
        callData.Extension + '_' +
        callData.OtherParty + '_' +
        callData.AgentGroup + '_' +
        callData.StartDateTime.replaceAll(' ', '_').replaceAll('.', '').replaceAll('/', '-')
            .replaceAll(':', '-')
    const dir = path.dirname(callData.ruta)
    const ext = path.extname(callData.ruta)
    // console.log(dir)
    //console.log('Rename to: ' + newName)
    // console.log(ext)

    const newPath = path.join(dir, `${newName}${ext}`)
    console.log('New name: ' + newPath)
    fs.rename(callData.ruta, newPath, (err) => {
        if (err){
            console.log(err)
            return callData.ruta
        }
        else console.log('Rename complete!')
    })

    return newPath
}

module.exports = { rename }
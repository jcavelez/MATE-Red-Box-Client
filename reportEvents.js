const fs = require('fs')
const path = require('path')

function createNewName (callData, ext) {
    let newName = 
        callData.RBRCallGUID + '_' +
        callData.Extension + '_' +
        callData.OtherParty + '_' +
        callData.AgentGroup + '_' +
        callData.StartDateTime.replaceAll(' ', '_').replaceAll('.', '').replaceAll('/', '-')
            .replaceAll(':', '-')
    const dir = path.dirname(callData.ruta)
    const subdir = subfolderName(callData)
    const newDir = path.join(dir, subdir)
    makeSubdir(newDir)
    //const dstFile = path.join(newDir, `${newName}${ext}`)
    const dstFile = path.join(newDir, `${newName}.${ext}`)
    //moveFile(callData.ruta, dstFile)

    //console.log('New name: ' + dstFile)
    // fs.rename(callData.ruta, newPath, (err) => {
    //     if (err) {
    //         return callData.ruta
    //     }
    //     else {
    //         console.log('Rename complete!')
    //     }
    // })

    return dstFile
}

function subfolderName(callData) {
    let subdir = []
    subdir.push(callData.AgentGroup? callData.AgentGroup : 'NO_GROUP')
    let date = callData.StartDateTime.split(' ')[0].split('/')
    subdir.push(date[2])
    subdir.push(date[1])
    subdir.push(date[0])

    return subdir.join('\\')
}

function makeSubdir(newDir) {
    fs.mkdirSync(newDir, { recursive: true}, (err) => {
        console.log(err)
    })
}

function moveFile(src, dst) {
    console.log(src)
    console.log(dst)
    fs.copyFile(src, dst, (err) => {
        
    })
}

module.exports = { createNewName }
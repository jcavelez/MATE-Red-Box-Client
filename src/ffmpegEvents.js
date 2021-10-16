const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg')
const deleteFile = require('fs').unlink

const log = require('electron-log')
log.transports.file.level = 'error'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

ffmpeg.setFfmpegPath(ffmpegPath);

function convert(filePath, outputFormat, dstFile, overwrite='yes') {
    const conversion = new Promise((resolve, reject) => {
        let ffmpegCmd = new ffmpeg()
        ffmpegCmd.input(filePath)
        ffmpegCmd.output(dstFile)
        ffmpegCmd.format(outputFormat)
        ffmpegCmd.audioBitrate('48k')

        ffmpegCmd.on('error', (err, stdout, stderr) => {
            log.error(`FFMPEG: Cannot process audio: ${err.message}`)
            reject(false)
        })
        
        ffmpegCmd.on('end', function(stdout, stderr) {
            log.info(`FFMPEG: Transcoding succeeded`);
            if (overwrite === 'yes') {
                deleteFile(filePath, (err) => {
                    if (err) {
                        log.error(`File System: ${err}`)
                    }
                    log.info(`File System: Archivo wav borrado exitosamente ${filePath}`)
                })
            }
            resolve(true)
        })

        ffmpegCmd.run()
    })

    return conversion
}

module.exports = { convert }
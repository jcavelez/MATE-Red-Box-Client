const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const path = require('path')
const deleteFile = require('fs').unlink

function convert(filePath, outputFormat, overwrite) {
    let newName = path.basename(filePath, '.wav')
    let dir = path.dirname(filePath)
    let ffmpegCmd = new ffmpeg()
    ffmpegCmd.input(filePath)
    console.log(path.join(dir,`${newName}.${outputFormat}`))
    ffmpegCmd.output(path.join(dir,`${newName}.${outputFormat}`))
    ffmpegCmd.format(outputFormat)
    ffmpegCmd.audioBitrate('48k')

    ffmpegCmd.on('error', (err, stdout, stderr) => {
        console.log('Cannot process audio: ' + err.message);
      })
    ffmpegCmd.on('end', function(stdout, stderr) {
        console.log('Transcoding succeeded !');
        if (overwrite === 'yes') {
            deleteFile(filePath, (err) => {
                if (err) {
                    console.log(err)
                }
                console.log('Archivo wav borrado')
            })
        }
      })
    ffmpegCmd.run()
}

module.exports = { convert }
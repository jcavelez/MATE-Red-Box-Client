const { getExternalCallID } = require('../../databaseEvents.js')

const log = require('electron-log')
log.transports.file.level = 'info'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

function ExternalCallIDCheck(details) {
    let { StartDateTime, Extension } = details
    log.info(`EMTELCO lib: Buscando ExternalCallID asociado a ${Extension}, ${StartDateTime}`)
    let range = createRange(StartDateTime)
    let newExternalCallID = getExternalCallID(range, Extension)
    log.info(`EMTELCO lib: CallID ${details.callID} Nuevo ExternalCallID ${newExternalCallID}`)

    return newExternalCallID
}

function createRange(StartDateTime) {
    //Window time in seconds
    const windowTime = 2
    const conditions = [StartDateTime]
    const date = StartDateTime.split(' ')[0]
    const hour = StartDateTime.split(' ')[1].split(':')
    const period =  StartDateTime.split(' ')[2]

    const zeroFill = (number, width ) => {
        width -= number.toString().length;
        if ( width > 0 )
        {
            return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
        }
        return number + ""; // always return a string
    }

    for (let i = 1; i <= windowTime; i++) {
        let newSec = parseInt(hour[2])
        let newMin = parseInt(hour[1])
        let newHour = parseInt(hour[0])
        let newPeriod = period
        newSec = newSec + i
        if (newSec > 59) {
            newSec = 0
            newMin = newMin + 1
            if(newMin > 59) {
                newMin = 0
                newHour = newHour + 1
                if(newHour > 12) {
                    newHour = 1
                    if (period == 'AM') {
                        newPeriod = 'PM'
                    }
                }
            }
        }

        let newRange = 
            date + ' ' +
            newHour + ':' + zeroFill(newMin, 2) + ':' + zeroFill(newSec, 2) + ' ' +
            newPeriod
        conditions.push(newRange)
    }

    for (let i = 1; i <= windowTime; i++) {
        let newSec = parseInt(hour[2])
        let newMin = parseInt(hour[1])
        let newHour = parseInt(hour[0])
        let newPeriod = period
        newSec = newSec - i
        if (newSec > 0) {
            newSec = 59
            newMin = hour[1] - 1
            if(newMin > 0) {
                newMin = 59
                newHour = hour[0] - 1
                if(newHour > 1) {
                    newHour = 12
                    if (period == 'PM') {
                        newPeriod = 'AM'
                    }
                }
            }
        }

        let newRange = 
            date + ' ' +
            newHour + ':' + zeroFill(newMin, 2) + ':' + zeroFill(newSec, 2) + ' ' +
            newPeriod
        conditions.push(newRange)
    }
    return conditions
}

module.exports = { ExternalCallIDCheck }
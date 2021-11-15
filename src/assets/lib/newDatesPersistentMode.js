const { getLastRecordingDownloaded } = require('../../databaseEvents')
const zeroFill = require('./zeroFill.js')

function getNewStartTime(delay) {

    let newStart = getLastRecordingDownloaded()

    if (newStart.length) {
        let newStartDate = newStart.split(' ')[0]
        let newStartHour = newStart.split(' ')[1]
        let time = newStart.split(' ')[2]
        let yyyy = newStartDate.split('/')[2]
        let MM = zeroFill(newStartDate.split('/')[1], 2)
        let dd = zeroFill(newStartDate.split('/')[0], 2)
        let hh = zeroFill(newStartHour.split(':')[0], 2)
        let mm = zeroFill(newStartHour.split(':')[1], 2)
        let ss = zeroFill(parseInt(newStartHour.split(':')[2]) + 1 , 2)
        hh = time === 'a.m.' ? hh : (parseInt(hh) + 12).toString()
        hh = time === 'a.m.' && hh == '12' ? '00' : hh
        if (parseInt(ss) + 1 > 59) {
            ss = '00'
            mm = zeroFill((parseInt(mm) + 1).toString(), 2)
        }
        if (parseInt(mm) > 59) {
            mm = '00'
            hh = zeroFill((parseInt(hh) + 1).toString(), 2)
        }
        if (parseInt(hh) > 23) {
            hh = '00'
            dd = zeroFill((parseInt(dd) + 1).toString(), 2)
        }
        switch (dd) {
            case '32':
            dd = '01'
            mm = zeroFill((parseInt(mm) + 1).toString(), 2)
            break
    
            case '31':
            //si el nuevo mes está entres los meses que tiene 30 dias
            if (['04', '06', '07', '11'].indexOf(mm)) {
                dd = '01'
                mm = zeroFill((parseInt(mm) + 1).toString(), 2)
            }
            break
    
            case '30':
            if (mm == '02') {
                dd = '01'
                mm = '03'
            }
            break
    
            case '29':
            //si es febrero de año no bisiesto
            if(mm == '02' && parseInt(yyyy) % 4 > 0) {
                dd = '01'
                mm = '03'
            }
            break
    
            default:
            break;
        }
    
        if (mm == '13') {
            mm = '01'
            yyyy = (parseInt(yyyy) + 1).toString()
        }
    
        return yyyy+MM+dd+hh+mm+ss  
    }

    else { 
        return null
    }

}

function getNewEndTime(delay = 0) {
    //calculo basado en la fecha y hora ACTUAL (sin retrasos)
    let d = new Date()
    
    return d.getFullYear() + 
            zeroFill(d.getMonth() + 1, 2) + 
            zeroFill(d.getDate(), 2) + 
            zeroFill(d.getHours(),2) + 
            zeroFill(d.getMinutes(),2) + 
            zeroFill(d.getSeconds(),2)
}


module.exports = { getNewStartTime, getNewEndTime }
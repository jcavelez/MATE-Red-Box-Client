const fetch = require('node-fetch')
const sleep = require('./sleep.js')
const zeroFill = require('./assets/lib/zeroFill.js')
const fs = require('fs')
const path = require('path')

const log = require('electron-log')
//const settings = require('electron-settings')
log.transports.file.level = 'error'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

const SERVER_URL = 'http://<IP>:1480'
const LOGIN_URL = '/api/v1/sessions/login'
const LOGOUT_URL = '/api/v1/sessions/logout'
const SEARCH_URL = '/api/v1/search'
const SEARCH_STATUS_URL = '/api/v1/search/status'
const SEARCH_RESULTS_URL = '/api/v1/search/results'
const CALL_AUDIO_URL = '/api/v1/search/callaudio/<callID>'
const CALL_DETAILS_URL = '/api/v1/search/calldetails/<callID>'
const KEEP_ALIVE_URL = '/api/v1/sessions/keepAlive'

const SEARCH_STATUS_PENDING =['Requested', 'Initialization', 'Queued', 'SettingUp', 'Executing', 'ReadingResults']


async function fetchData(method, url, headers, data={}) {
    let options = {
        method: method,
        mode: 'cors', 
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: headers,
        redirect: 'follow', 
        referrerPolicy: 'no-referrer'
    }

    if (method === 'POST') {
        options.body = JSON.stringify(data)
    }

    try {
        log.info(`Fetch ${method} ${url}: Iniciando`)
        let response = await fetch(url, options)
        log.info(`Fetch ${method} ${url}: Respuesta ${response.status} ${response.statusText}`)
        let results = await response.json()
        if (results.hasOwnProperty('error')) log.error(`Fetch ${method} ${url}: ${results.error} `)

        return results
    } catch (e) {
        log.error(`Fetch: ${e}`)
        return e
    }
}


async function loginRecorder(IP, username, password) {
    let url = `${SERVER_URL.replace('<IP>',IP)}${LOGIN_URL}`
    let dataFetched = await fetchData('POST', url,
                                    {
                                        'username': username,
                                        'password': password
                                    })
    return dataFetched
}

async function logoutRecorder(IP, token) {
    let url = `${SERVER_URL.replace('<IP>',IP)}${LOGOUT_URL}`
    let dataFetched = await fetchData('POST', url,
                                    {
                                        'authToken': token
                                    })
    return dataFetched
}

async function keepAlive(IP, token) {
    let url = `${SERVER_URL.replace('<IP>',IP)}${KEEP_ALIVE_URL}`
    let dataFetched = await fetchData('PUT', url,
                                    {
                                        'authToken': token
                                    })
    return dataFetched
}


async function placeNewSearch(opt, token) {
    log.info('Search: Iniciando nueva consulta.')
    let url = `${SERVER_URL.replace('<IP>',opt.lastRecorderIP)}${SEARCH_URL}`
    let header = {'authToken': token, 'Content-Type': 'application/json'}
    let opts = {
        'resultsToSkip': opt.resultsToSkip,
        'searchMode': opt.searchMode,
        'startTime': opt.startTime,
        'endTime': opt.endTime
    }
    opts.criteriaList = []

    if (opt.hasOwnProperty('extension')) {
        
        opt.extension.map((ext) => {
            opts.criteriaList.push({'fieldName': 'Extension','fieldData': ext})
        })
    }

    if (opt.hasOwnProperty('group')) {
        
        opt.group.map((group) => {
            opts.criteriaList.push({'fieldName': 'AgentGroup','fieldData': group})
        })
    }

    await fetchData('POST', url, header, opts)
            .then((res) => {
                log.info('Search: Procesando busqueda.')
            })

    let searchStatus = { 
        statusShort: 'Requested'
    }

    //mientras el resultado del fetch este entre los estados de busqueda pendientes,
    //continue haciendo el cliclo. Termina en complete o error
    while(SEARCH_STATUS_PENDING.includes(searchStatus.statusShort)) {
        url = `${SERVER_URL.replace('<IP>',opt.lastRecorderIP)}${SEARCH_STATUS_URL}`
        header = {'authToken': token,'Content-Type': 'application/json'}
        searchStatus = await fetchData('GET', url, header)
        log.info('Search: status ' + searchStatus.statusShort)
        // Esperar ~2 seg entre requests
        await sleep(2000)
    } 
    
    log.info(`Search: Busqueda terminada. ${searchStatus.resultsFound} resultados encontrados.`)
    //log.info(searchStatus)

    return searchStatus
    
}

async function getResults(IP, token) {
    log.info('Results: Descargando Call IDs')
    let url = `${SERVER_URL.replace('<IP>',IP)}${SEARCH_RESULTS_URL}`
    let header = { 'authToken': token, 'Content-Type': 'application/json' }
    let dataFetched = await fetchData('GET', url, header)
    if (dataFetched.hasOwnProperty('callIDs')) {
        log.info(`Results: Numero de Call IDs obtenidos ${dataFetched.callIDs.length}`)
        return dataFetched.callIDs
    }
}

async function downloadDetails(IP, token, callID) {
	log.info(`Details: CallID ${callID} - Descargando detalles de llamada.`)

	let options = {
			method: 'GET',
			headers: {
					'authToken': token
			}
	}
	let url = `${SERVER_URL.replace('<IP>', IP)}${CALL_DETAILS_URL.replace('<callID>', callID)}`

	log.info(`Details: ${options.method} ${url}`)

    try {
        let response = await fetch(url, options)
        log.info(`Details: CallID ${callID}  - Respuesta del grabador recibida - ${response.status} - ${response.statusText}`)
        let data = await response.json()

        if (response.ok) {
            let callDetails = {}
				data.fields.forEach(field => { callDetails[field.Key] = field.Value })
				log.info(`Details: CallID ${callID} - Finaliza descarga detalles.`)
				return callDetails
        } else {
            //promesa resuelta, pero con error
            if(data.hasOwnProperty('error')) {
            log.error(`Details: CallID ${callID} - Error - ${data.error}`)
            return data
        }
    }
        
    } catch (error) {
        //promesa sin resolver
        log.error(`Details: CallID ${callID} - Promise Rejected - Error ${error}`)
        return { error: error}
    }
}

async function downloadAudio(IP, token, callID, savePath) {
    let options = {
        method: 'GET',
        headers: {
            'authToken': token
        }
    }

    log.info(`Audio: CallID ${callID} - Descargando audio.`)

    let finalPath
    let url = `${SERVER_URL.replace('<IP>', IP)}${CALL_AUDIO_URL.replace('<callID>', callID)}`
    log.info(`Audio: ${options.method} ${url}`)
    try {

        let response = await fetch(url, options)
        log.info(`Audio: CallID ${callID} - Respuesta recibida `)
        let data = await response.json()

        if (response.ok && data.hasOwnProperty('wavFile')) {
            log.info(`Audio: CallID ${callID} - Respuesta valida`)
            
            const wavFile = path.join(savePath, `${callID}.wav`)
            finalPath = path.join(savePath, `${callID}.wav`)
            log.info(`Audio: CallID ${callID} - Guardando en buffer`)
            let buffer = Buffer.from(data.wavFile)
            log.info(`Audio: CallID ${callID} - Escribiendo en disco ${wavFile} `)
            fs.writeFileSync(wavFile ,buffer, (error) => {
                if (error) {
                    log.error(`File System: CallID ${callID} - ${error}`)
                }
            })
            log.info(`Audio: CallID ${callID} - Grabacion descargada`)
    
            const date = new Date()
    
            return {
                    respuestaGrabador: 'OK',
                    ruta: finalPath,
                    fechaDescarga: `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()} ${zeroFill(date.getHours(),2)}:${zeroFill(date.getMinutes(),2)}:${zeroFill(date.getSeconds(),2)} `
                    }
        } else {
            log.error(`Audio: CallID ${callID} - Respuesta inavalida`)

            let errorResponse = {}

            if(data.hasOwnProperty('error')) {
                log.error(`Audio: CallID ${callID} - Error descargando audio: ${response.status} - ${response.statusText}. ${data.error}`)
                errorResponse = {
                    status: response.status, 
                    statusText: response.statusText, 
                    ...data
                }
            } else {
                errorResponse.error = 'TIMEOUT'
            }
    
            return errorResponse
        }
    } catch (e)  {
        log.error(`Audio: CallID ${callID} - Promise Rejected - ${e}`)
        // e = [ 'message', 'type', 'errno', 'code' ]
        const error = {
            status: e.type, 
            statusText: e.code, 
            error: e.errno
        }
        return error
    }
}



module.exports = { loginRecorder, placeNewSearch, getResults, logoutRecorder, downloadDetails, downloadAudio, keepAlive }

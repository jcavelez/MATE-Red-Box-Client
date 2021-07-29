const fetch = require('node-fetch')
const sleep = require('./sleep.js')
const zeroFill = require('./assets/lib/zeroFill.js')
const fs = require('fs')
const path = require('path')
const log = require('electron-log')

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
    if (opt.hasOwnProperty('group')) {
        opts.criteriaList = [
            {
                'fieldName': 'AgentGroup',
                'fieldData': opt.group
            }

        ]
        log.info('opts')
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
    
    if(searchStatus.statusShort === 'Complete') {
        log.info(`Search: Busqueda completada. ${searchStatus.resultsFound} resultados encontrados. ${searchStatus.resultsInRange} resultados en rango`)
        return searchStatus.resultsInRange
    } else  {
        return searchStatus
    }
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

    let response = await fetch(url, options)
        .then((res) => {
            log.info(`Details: CallID ${callID}  - Respuesta del grabador recibida - ${res.status} - ${res.statusText}`)
            return res.json()
        })
        .then((res) => {
            if(res.hasOwnProperty('error')) {
                log.error(`Details: CallID ${callID} - Error - ${res.error}`)
                return ([res])
            }
            let callDetails = {}
            res.fields.forEach(field => { callDetails[field.Key] = field.Value })
            log.info(`Details: CallID ${callID} - Finaliza descarga detalles.`)
            return callDetails
        })
        .catch((err) => {
            log.error(`Details: CallID ${callID} - Fetch Error - ${err}`)
        })


    return response
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
    let response = await fetch(url, options)
        .then(async (res) => {
            const formatRes = await res.json()
            log.info(`Audio: CallID ${callID} - Respuesta del grabador recibida -> ${Object.keys(formatRes)}`)
            return formatRes
        })
        .then(async (res) => {
            if(res.hasOwnProperty('error')) {
                log.error(`Audio: CallID ${callID} - Error descargando audio ${res.error}`)
                return res
            }
            if(res.hasOwnProperty('wavFile')) {
                const wavFile = path.join(savePath, `${callID}.wav`)
                finalPath = path.join(savePath, `${callID}.wav`)
                log.info(`Audio: CallID ${callID} - Guardando en buffer`)
                let buffer = Buffer.from(res.wavFile)
                log.info(`Audio: CallID ${callID} - Escribiendo en disco ${wavFile} `)
                fs.writeFileSync(wavFile ,buffer, (error) => {
                    if (error) {
                        log.error(`File System: CallID ${callID} - ${error}`)
                    }
                })
                log.info(`Audio: CallID ${callID} - Grabacion descargada`)
            }

            const date = new Date()

            return {
                    respuestaGrabador: 'OK',
                    ruta: finalPath,
                    fechaDescarga: `${date.getDate()}/${date.getMonth()}/${date.getFullYear()} ${zeroFill(date.getHours(),2)}:${zeroFill(date.getMinutes(),2)}:${zeroFill(date.getSeconds(),2)} `
                    }
        })
        .catch((err) => {
            log.error(`Audio: CallID ${callID} - Error descargando audio. ${err}`)
            return err
        })

    return response
}


async function search(downloadOptions, token) {
    const { saveIDs } = require('./databaseEvents.js')
    downloadOptions.token = token
    downloadOptions.status = 'incomplete'
    downloadOptions.progress = 0
    downloadOptions.numberOfResults = await placeNewSearch(downloadOptions)
    
    while (downloadOptions.status === 'incomplete') {
        const newSearch = await getResults(
                                downloadOptions.lastRecorderIP,
                                downloadOptions.token)
        if(newSearch) {
            downloadOptions.resultsToSkip += 1000
            downloadOptions.progress += newSearch.length
            const IDs = newSearch.map(res => res.callID)
            log.info('Search: Guardando resultados en BD')
            saveIDs(IDs.sort((a, b) => a - b))
            log.info(`Search: ${newSearch.length} IDs guardados en BD`)
            downloadOptions.numberOfResults = await placeNewSearch(downloadOptions)
        } else {
            downloadOptions.status = 'complete'
        }
    }
    
    return downloadOptions.progress
}


module.exports = { loginRecorder, placeNewSearch, getResults, logoutRecorder, downloadDetails, downloadAudio, keepAlive }

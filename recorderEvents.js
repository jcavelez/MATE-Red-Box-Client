const fetch = require('node-fetch')
const http = require('http')
const querystring = require('querystring')
const sleep = require('./sleep.js')
const fs = require('fs')
const path = require('path')
const { saveIDs, getRecordsUnprocesed, updateRecords } = require('./databaseEvents')
const { convert } = require('./ffmpegEvents.js')
const { get } = require('electron-settings')

const SERVER_URL = 'http://<IP>:1480'
const LOGIN_URL = '/api/v1/sessions/login'
const LOGOUT_URL = '/api/v1/sessions/logout'
const SEARCH_URL = '/api/v1/search'
const SEARCH_STATUS_URL = '/api/v1/search/status'
const SEARCH_RESULTS_URL = '/api/v1/search/results'
const CALL_AUDIO_URL = '/api/v1/search/callaudio/<callID>'
const CALL_DETAILS_URL = '/api/v1/search/calldetails/<callID>'

const SEARCH_STATUS_PENDING =['Requested', 'Initialization', 'Queued', 'SettingUp', 'Executing', 'ReadingResults']


async function loginRecorder(IP, username, password) {
    let dataFetched = await fetchData('POST',
                                    `${SERVER_URL.replace('<IP>',IP)}${LOGIN_URL}`,
                                    {
                                        'username': username,
                                        'password': password
                                    })
    return dataFetched.authToken
}

async function logoutRecorder(IP, token) {
    let dataFetched = await fetchData('POST',
                                    `${SERVER_URL.replace('<IP>',IP)}${LOGOUT_URL}`,
                                    {
                                        'authToken': token
                                    })
    console.log(dataFetched)
}


async function placeNewSearch(opt) {
    await fetchData('POST',
        `${SERVER_URL.replace('<IP>',opt.lastRecorderIP)}${SEARCH_URL}`,
        {
            'authToken': opt.token,
            'Content-Type': 'application/json'
        },
        {
            'resultsToSkip': opt.resultsToSkip,
            'searchMode': opt.searchMode,
            'startTime': opt.startTime,
            'endTime': opt.endTime
        }).then((res, rej) => {
            console.log('search url')
            console.log(res)
            console.log(rej)
        })
    

    let searchStatus = { 
        statusShort: 'Requested'
    }

    while(SEARCH_STATUS_PENDING.includes(searchStatus.statusShort)) {
        searchStatus = await fetchData(
            'GET',
             `${SERVER_URL.replace('<IP>',opt.lastRecorderIP)}${SEARCH_STATUS_URL}`,
             {
                 'authToken': opt.token,
                 'Content-Type': 'application/json'
             })
        // Esperar ~3 seg entre requests
        await sleep(3000)
    } 
    

    if(searchStatus.statusShort === 'Complete') {
        console.log(`Termina busqueda, ${searchStatus.resultsInRange} encontrados`)
        return searchStatus.resultsInRange
    }
}

async function getResults(IP, token) {
    let dataFetched = await fetchData(
        'GET',
        `${SERVER_URL.replace('<IP>',IP)}${SEARCH_RESULTS_URL}`,
        {
            'authToken': token,
            'Content-Type': 'application/json'
        })
    if (dataFetched) {
        return dataFetched.callIDs
    }
}

async function downloadAudio(IP, token, callID, savePath) {
    let options = {
        method: 'GET',
        headers: {
            'authToken': token
        }
    }

    console.log(`downloadAudio - callID: ${callID}`)

    let response = await fetch(
        `${SERVER_URL.replace('<IP>', IP)}${CALL_AUDIO_URL.replace('<callID>', callID)}`, options)
        .then((res) => {
            if(res.status === 200) {
                console.log("Solicitud descargar audio 200 OK")
            } else {
                console.log('---- respuesta no satisfactoria')
                console.log(res.status)
            }
            return res.json()
        })
        .then(async (res) => {
            console.log('respuesta descargar audio')
            if(res.hasOwnProperty('error')) {
                return res
            }
            console.log('Descargando archivo ' + callID)
            let finalPath = path.join(savePath, `${callID}.wav`)
            if(res.hasOwnProperty('wavFile')) {
                let buffer = Buffer.from(res.wavFile)
                await fs.writeFile(path.join(savePath, `${callID}.wav`),buffer, (error) => {
                    if (error) {
                        console.log('error escribiendo archivo')
                        console.error(error)
                    }
                })
                console.log('Archivo descargado')
            }

            return {
                    respuestaGrabador: 'OK',
                    ruta: finalPath,
                    fechaDescarga: (new Date()).toISOString()
                    }
        })
        .catch((err) => {
            console.log('error descargando audio '  + callID)
            console.log(err)
            return err
        })

        console.log('enviando respuestado estado descarga')

        return response
        
}

async function downloadDetails(IP, token, callID) {
    let options = {
        method: 'GET',
        headers: {
            'authToken': token
        }
    }

    let response = await fetch(
        `${SERVER_URL.replace('<IP>', IP)}${CALL_DETAILS_URL.replace('<callID>', callID)}`, options)
        .then((res) => {
            if(res.status === 200) {
                console.log("Solicitud descargar detalles: 200 OK")
            } else {
                console.log('---- respuesta no satisfactoria')
                console.log(res.status)
            }
            return res.json()
        })
        .then((res) => {
            console.log(`Respuesta convertida a formato json`)
            //console.log(res)
            if(res.hasOwnProperty('error')) {
                console.log(res)
                return ([res])
            }
            return res.fields
            
        })
        .catch((err) => {
            console.log('error fetch')
            console.log(err)
        })

    let callDetails = {}
    response.forEach(field => { callDetails[field.Key] = field.Value })
    console.log(`Termina downloaDetails - callID: ${callID}\n`)

    return callDetails
}


async function startDownload(downloadOptions) {

    let searchResults =[]
    downloadOptions.token = await loginRecorder(
        downloadOptions.lastRecorderIP,
        downloadOptions.username,
        downloadOptions.password)
    downloadOptions.status = 'incomplete'
    downloadOptions.progress = 0
    downloadOptions.numberOfResults = await placeNewSearch(downloadOptions)

    while (downloadOptions.status === 'incomplete') {
        const newSearch = await getResults(
            downloadOptions.lastRecorderIP,
            downloadOptions.token
            )
        Array.prototype.push.apply(searchResults, newSearch)
        downloadOptions.progress = searchResults.length
        downloadOptions.resultsToSkip += 1000
        if (downloadOptions.resultsToSkip < downloadOptions.numberOfResults) {
            downloadOptions.numberOfResults = await placeNewSearch(downloadOptions)
        } else {
            downloadOptions.status = 'complete'

            const IDs = searchResults.map(res => res.callID)
            saveIDs(IDs)
        }
    }
    console.log(`Total ids obtenidos ${searchResults.length}`)

    if(searchResults.length === 0) {
        await logoutRecorder(downloadOptions.lastRecorderIP,downloadOptions.token)
        .then(res => {
            console.log(res)
            console.log('logout')
        })
        console.log('EOP')

        return
    }
    
    let idsPackage = getRecordsUnprocesed(10)

    while (idsPackage) {
        for (const obj of idsPackage) {
            console.log('\nenviando senal descarga ' + obj.callID)
            let callData = {}
            let {...dets} = await downloadDetails(
                                    downloadOptions.lastRecorderIP,
                                    downloadOptions.token,
                                    obj.callID)
            if (!dets.hasOwnProperty('error'))
            {
                callData = {
                    StartDateTime: dets.StartDateTime,
                    EndDateTime: dets.EndDateTime,
                    Duration: dets.Duration,
                    Direction: dets.Direction,
                    Extension: dets.Extension,
                    ChannelName: dets.ChannelName,
                    OtherParty: dets.OtherParty,
                    AgentGroup: dets.AgentGroup,
                    RBRCallGUID: dets.RBRCallGUID
                }
            }

            let { ...download } = await downloadAudio(
                                            downloadOptions.lastRecorderIP,
                                            downloadOptions.token,
                                            obj.callID,
                                            downloadOptions.downloadPath)
            
            if (download.hasOwnProperty('error')) {
                callData.respuestaGrabador = download.error
            } else {
                callData = { ...download, ...callData }
            }

            if (callData.respuestaGrabador === 'OK') {
                callData.idEstado = 3
                
                if (downloadOptions.outputFormat != 'wav') {
                    let conv = convert(callData.ruta, downloadOptions.outputFormat, downloadOptions.overwrite)
                }
            }
            else {
                console.log('error descarga')
                callData.idEstado = 6
            }
            
            updateRecords(callData, obj.callID)


            await sleep(500)
        }
        idsPackage = getRecordsUnprocesed(10)
    }

    console.log('Termina ciclo de descargas. iniciando logout')
    await logoutRecorder(downloadOptions.lastRecorderIP,downloadOptions.token)
        .then(res => {
            console.log(res)
            console.log('logout')
        })
    console.log('EOP')
}

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
        console.log(options.body)
    }

    console.log(url)

    let response = await fetch(url, options)

    console.log(response.status)

    if(response.status === 200) {
        let results = await response.json()
       
        return results   
    } else {
        console.log(response.statusText)
        console.log(await response.json())
    }
}


module.exports = startDownload

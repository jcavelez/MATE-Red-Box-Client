const fetch = require('node-fetch')
const http = require('http')
const querystring = require('querystring')
const sleep = require('./sleep.js')
const fs = require('fs')
const path = require('path')

const SERVER_URL = 'http://192.168.221.128:1480'
const LOGIN_URL = '/api/v1/sessions/login'
const LOGOUT_URL = '/api/v1/sessions/logout'
const SEARCH_URL = '/api/v1/search'
const SEARCH_STATUS_URL = '/api/v1/search/status'
const SEARCH_RESULTS_URL = '/api/v1/search/results'
const CALL_AUDIO_URL = '/api/v1/search/callaudio/<callID>'
const CALL_DETAILS_URL = '/api/v1/search/calldetails/<callID>'

const SEARCH_STATUS_PENDING =['Requested', 'Initialization', 'Queued', 'SettingUp', 'Executing', 'ReadingResults']


async function loginRecorder() {
    let dataFetched = await fetchData('POST',
                                    `${SERVER_URL}${LOGIN_URL}`,
                                    {
                                        'username': 'admin',
                                        'password': 'recorder'
                                    })
    return dataFetched.authToken
}

async function logoutRecorder(token) {
    let dataFetched = await fetchData('POST',
                                    `${SERVER_URL}${LOGOUT_URL}`,
                                    {
                                        'authToken': token
                                    })
    console.log(dataFetched)
}


async function placeNewSearch(downloadOptions) {
    await fetchData('POST',
        `${SERVER_URL}${SEARCH_URL}`,
        {
            'authToken': downloadOptions.token,
            'Content-Type': 'application/json'
        },
        {
            'resultsToSkip': downloadOptions.resultsToSkip,
            'searchMode': downloadOptions.searchMode,
            'startTime': downloadOptions.startTime,
            'endTime': downloadOptions.endTime
        }).then((res, rej) => {
            console.log('search url')
            console.log(res)
            console.log(rej)
        })
    

    let searchStatus = { 
        statusShort: 'Requested'
    }

    while(SEARCH_STATUS_PENDING.includes(searchStatus.statusShort)) {
        searchStatus = await fetchData('GET',
                                        `${SERVER_URL}${SEARCH_STATUS_URL}`,
                                        {
                                            'authToken': downloadOptions.token,
                                            'Content-Type': 'application/json'
                                        })
        // Waiting ~2 second between requests
        await sleep(2000)
    } 
    

    if(searchStatus.statusShort === 'Complete') {
        console.log(`Termina busqueda, ${searchStatus.resultsInRange} encontrados`)
        return searchStatus.resultsInRange
    }
}

async function getResults(token) {
    let dataFetched = await fetchData('GET',
                                        `${SERVER_URL}${SEARCH_RESULTS_URL}`,
                                        {
                                            'authToken': token,
                                            'Content-Type': 'application/json'
                                        })
    return dataFetched.callIDs
}


async function downloadAudio(token, callID, savePath) {
    let options = {
        method: 'GET',
        headers: {
            'authToken': token
        }
    }

    console.log(`callID: ${callID}`)

    let response = await fetch(`${SERVER_URL}${CALL_AUDIO_URL.replace('<callID>', callID)}`, options)
        .then((res) => {
            if(res.status === 200) {
                console.log("200 OK")
                return res.json()
            } else {
                console.log('---- respuesta no satisfactoria')
                console.log(res.status)
            }
        })
        .then((res) => {
            if(res.error) {
                console.log('erro segundo then')
                console.log(res.error)
                return res.error
            }
            console.log(res)
            let buffer = Buffer.from(res.wavFile)
            fs.writeFile(path.join(savePath, `${callID}.wav`),buffer, (error) => {
                if (error) {
                    console.log('error escribiendo archivo')
                    console.error(error)
                }
                else {
                    return 'OK'
                }
            })
        })
        .catch((err) => {
            console.log('error fetch')
            console.log(err)
        })
}

//TODO: Write IDs in a DB
async function startDownload(downloadOptions) {

    let searchResults =[]
    downloadOptions.token = await loginRecorder()
    downloadOptions.status = 'incomplete'
    downloadOptions.progress = 0
    downloadOptions.numberOfResults = await placeNewSearch(downloadOptions)

    while (downloadOptions.status === 'incomplete') {
        const newSearch = await getResults(downloadOptions.token)
        console.log(newSearch)
        Array.prototype.push.apply(searchResults, newSearch)
        downloadOptions.progress = searchResults.length
        downloadOptions.resultsToSkip += 1000
        if (downloadOptions.resultsToSkip < downloadOptions.numberOfResults) {
            downloadOptions.numberOfResults = await placeNewSearch(downloadOptions)
        } else {
            downloadOptions.status = 'complete'
        }
    }
    console.log(` total ids obtenidos ${searchResults.length}`)
    
    for (let record of searchResults) {
        await downloadAudio(downloadOptions.token, record.callID, downloadOptions.downloadPath )
            .then(res => record.status = res)
        
        
        await sleep(2000)
    }

    console.log(searchResults)

    await logoutRecorder(downloadOptions.token)
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
        //console.log(response.headers)
       // console.log(response)
       
        return results   
    } else {
        console.log(response.statusText)
        console.log(await response.json())
    }
}


module.exports = startDownload

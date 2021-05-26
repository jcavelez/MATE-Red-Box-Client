const fetch = require('node-fetch')
const http = require('http')
const querystring = require('querystring')
const sleep = require('./sleep.js')
const fs = require('fs')
const path = require('path')

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
        // Waiting ~2 second between requests
        await sleep(2000)
    } 
    

    if(searchStatus.statusShort === 'Complete') {
        console.log(`Termina busqueda, ${searchStatus.resultsInRange} encontrados`)
        return searchStatus.resultsInRange
    }
}

async function getResults(IP, token) {
    let dataFetched = await fetchData('GET',
                                        `${SERVER_URL.replace('<IP>',IP)}${SEARCH_RESULTS_URL}`,
                                        {
                                            'authToken': token,
                                            'Content-Type': 'application/json'
                                        })
    return dataFetched.callIDs
}


async function downloadAudio(IP, token, callID, savePath) {
    let options = {
        method: 'GET',
        headers: {
            'authToken': token
        }
    }

    console.log(`callID: ${callID}`)

    let response = await fetch(`${SERVER_URL.replace('<IP>', IP)}${CALL_AUDIO_URL.replace('<callID>', callID)}`, options)
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
            })

            return 'OK'
        })
        .catch((err) => {
            console.log('error fetch')
            console.log(err)
        })

        let det = await fetch(`${SERVER_URL.replace('<IP>', IP)}${CALL_DETAILS_URL.replace('<callID>', callID)}`, options)
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
                console.log(res.error)
                return res.error
            }
            return res.fields
            
        })
        .catch((err) => {
            console.log('error fetch')
            console.log(err)
        })

        let callDetails = {
            status: response
        }
        
        det.forEach(field => {
            callDetails[field.Key] = field.Value
        });
        

        return callDetails
}

//TODO: Write IDs in a DB
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
    
    for (let i = 0; i < searchResults.length; i++) {
        await downloadAudio(
            downloadOptions.lastRecorderIP,
            downloadOptions.token,
            searchResults[i].callID,
            downloadOptions.downloadPath
            )
            .then((res) => {
                searchResults[i] = {...searchResults[i], ...res}
            })

            console.log(searchResults[i])
        
        await sleep(1000)
    }

    console.log(searchResults)

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

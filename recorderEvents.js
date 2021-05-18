const fetch = require('node-fetch')
const http = require('http')
const querystring = require('querystring')

const SERVER_URL = 'http://192.168.221.128:1480'
const LOGIN_URL = '/api/v1/sessions/login'
const SEARCH_URL = '/api/v1/search'
const SEARCH_STATUS_URL = '/api/v1/search/status'
const SEARCH_RESULTS_URL = '/api/v1/search/results'
const CALL_AUDIO_URL = '/api/v1/search/callaudio/<callID>'
const CALL_DETAILS_URL = '/api/v1/search/calldetails/<callID>'

const SEARCH_STATUS_PENDING =['Requested', 'Initialization', 'Queued', 'SettingUp', 'Executing', 'ReadingResults']

async function loginRecorder() {
    
}


async function getToken() {
    let dataFetched = await fetchData('POST',
                                    `${SERVER_URL}${LOGIN_URL}`,
                                    {
                                        username: 'admin',
                                        password: 'recorder'
                                    })
    return dataFetched.authToken
}

async function getNumberOfResults(downloadOptions) {
    let dataFetched = await fetchData('POST',
                                    `${SERVER_URL}${SEARCH_URL}`,
                                    {
                                        authToken: downloadOptions.token,
                                        'Content-Type': 'application/json'
                                    },
                                    {
                                        'resultsToSkip': downloadOptions.resultsToSkip,
                                        'searchMode': downloadOptions.searchMode,
                                        'startTime': downloadOptions.startTime,
                                        'endTime': downloadOptions.endTime
                                    })

    let searchStatus = { 
        statusShort: 'Requested'
    }

    while(SEARCH_STATUS_PENDING.includes(searchStatus.statusShort)) {
        searchStatus = await fetchData('GET',
                                        `${SERVER_URL}${SEARCH_STATUS_URL}`,
                                        {
                                            authToken: downloadOptions.token,
                                            'Content-Type': 'application/json'
                                        })
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
                                            authToken: token,
                                            'Content-Type': 'application/json'
                                        })
    return dataFetched.callIDs
}

async function getSearchStatus(token) {
    
}

async function downloadAudio(token, callID) {
    let dataFetched = await fetchData('GET',
                                 `${SERVER_URL}${CALL_AUDIO_URL.replace('<callID>', callID)}`,
                                    {
                                        authToken: downloadOptions.token,
                                         'Content-Type': 'application/json'
                                    }) 
    
}

//TODO: Write IDs in a DB
async function startDownload(downloadOptions) {
    let searchIDs =[]
    downloadOptions.token = await getToken()
    downloadOptions.status = 'incomplete'
    downloadOptions.progress = 0
    downloadOptions.numberOfResults = await getNumberOfResults(downloadOptions)

    while (downloadOptions.status === 'incomplete') {
        const newSearch = await getResults(downloadOptions.token)
        console.log(newSearch)
        Array.prototype.push.apply(searchIDs, newSearch)
        downloadOptions.progress = searchIDs.length
        downloadOptions.resultsToSkip += 1000
        console.log(downloadOptions.resultsToSkip)
        console.log(downloadOptions.numberOfResults)
        if (downloadOptions.resultsToSkip < downloadOptions.numberOfResults) {
            downloadOptions.numberOfResults = await getNumberOfResults(downloadOptions)
        } else {
            downloadOptions.status = 'complete'
        }
    }
    console.log(` total ids obtenidos ${searchIDs.length}`)

    
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
    //console.log(options)

    let response = await fetch(url, options)

    console.log(response.status)

    if(response.status === 200) {
        let results = await response.json()
        //console.log(results)
        return results   
    } else {
        console.log(response)
        console.log(response.statusText)
        console.log(await response.json())
    }
}

module.exports = startDownload

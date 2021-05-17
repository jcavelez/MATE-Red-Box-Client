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
    console.log('conectando al grabador ...')
    let headers = {
        username: 'admin',
        password: 'recorder'
    }

    let options = {
        method: 'POST',
        mode: 'cors', 
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: headers,
        redirect: 'follow', 
        referrerPolicy: 'no-referrer'
      }

    let response = await fetch(`${SERVER_URL}${LOGIN_URL}`, options)
    
    return response
}


async function getToken() {

    let response = await loginRecorder()
    let data = await response.json()

    return data.authToken
}

async function getNumberOfResults(downloadOptions) {
    
    let body = JSON.stringify({
            "resultsToSkip": downloadOptions.resultsToSkip,
            "searchMode": "EarliestFirst",
            "startTime":"20200512000000",
            "endTime":"20210530235959"
        })
    let headers = {
        authToken: downloadOptions.token,
        'Content-Type': 'application/json'
        //'Content-Length': body,
    }

    let options = {
        method: 'POST',
        mode: 'cors', 
        cache: 'no-cache',
        
        credentials: 'same-origin',
        headers: headers,
        redirect: 'follow', 
        referrerPolicy: 'no-referrer',
        body: body
    }

    let response = await fetch(`${SERVER_URL}${SEARCH_URL}`, options)
    console.log(response.status)

    let searchStatus = { 
        statusShort: 'Requested'
    }

    let results = []

    if(response.status == 200) {

        while(SEARCH_STATUS_PENDING.includes(searchStatus.statusShort)) {
            searchStatus = await getSearchStatus(downloadOptions.token)
            //console.log(searchStatus)
        }

        if(searchStatus.statusShort === 'Complete') {
            console.log(`Termina busqueda, ${searchStatus.resultsInRange} encontrados`)
            return searchStatus.resultsInRange
        }

    } else {
        alarm('error')
    }
}

async function getSearchStatus(token) {
    let headers = {
        authToken:token,
        'Content-Type': 'application/json'
    }

    let options = {
        method: 'GET',
        mode: 'cors', 
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: headers,
        redirect: 'follow', 
        referrerPolicy: 'no-referrer'
      }
    
    let response = await fetch(`${SERVER_URL}${SEARCH_STATUS_URL}`, options)

    if(response.status === 200) {
        let status = await response.json()
        //console.log(status.statusShort)
        return status
    }
}

async function getResults(token) {
    let headers = {
        authToken: token,
        'Content-Type': 'application/json'
    }

    let options = {
        method: 'GET',
        mode: 'cors', 
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: headers,
        redirect: 'follow', 
        referrerPolicy: 'no-referrer'
    }

    let response = await fetch(`${SERVER_URL}${SEARCH_RESULTS_URL}`, options)

    console.log(response.status)
    //console.log(await response.json())

    if(response.status === 200) {
        let results = await response.json()
        //console.log(results.callIDs)
        return results.callIDs
    }
}

async function getSearchStatus(token) {
    let headers = {
        authToken:token,
        'Content-Type': 'application/json'
    }

    let options = {
        method: 'GET',
        mode: 'cors', 
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: headers,
        redirect: 'follow', 
        referrerPolicy: 'no-referrer'
      }
    
    let response = await fetch(`${SERVER_URL}${SEARCH_STATUS_URL}`, options)

    if(response.status === 200) {
        let status = await response.json()
        //console.log(status.statusShort)
        return status
    }
}

async function downloadAudio(token, callID) {
    let headers = {
        authToken: token,
        'Content-Type': 'application/json'
    }

    let options = {
        method: 'GET',
        mode: 'cors', 
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: headers,
        redirect: 'follow', 
        referrerPolicy: 'no-referrer'
    }

    let response = await fetch(`${SERVER_URL}${CALL_AUDIO_URL.replace('<callID>', callID)}`, options)

    console.log(response.status)
    //console.log(await response.json())

    if(response.status === 200) {
        let results = await response.json()
        console.log(results)
        
    }
}

//TODO: Write IDs in a DB
async function startDownload(downloadOptions) {
    downloadOptions.token =  await getToken()
    downloadOptions.numberOfResults = await getNumberOfResults(downloadOptions)
    downloadOptions.pending = downloadOptions.numberOfResults
    let searchIDs =[]
    console.log(downloadOptions)
    while (downloadOptions.pending > 0) {
        let newSearch = await getResults(downloadOptions.token)
        //console.log(newSearch)
        Array.prototype.push.apply(searchIDs, newSearch)
        downloadOptions.pending -= searchIDs.length
        downloadOptions.resultsToSkip += 1000
        if (downloadOptions.resultsToSkip < downloadOptions.numberOfResults) {
            downloadOptions.numberOfResults = await getNumberOfResults(downloadOptions)
        }
    }
    console.log(` total ids obtenidos ${searchIDs.length}`)

    const call = await downloadAudio(downloadOptions.token, searchIDs[0].callID)
    console.log(call)

    // for (let index = 0; index < searchIDs.length; index++) {
    //     const call = searchIDs[index];
        
    // }

}

async fetchData(method, url, token, data={}) {
    let headers = {
        authToken: token
    } 

    let options = {
        method: method,
        mode: 'cors', 
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: headers,
        redirect: 'follow', 
        referrerPolicy: 'no-referrer', 
        body: JSON.stringify(data)
    }

    let response = await fetch(`${SERVER_URL}${CALL_AUDIO_URL.replace('<callID>', callID)}`, options)

    console.log(response.status)
    //console.log(await response.json())

    if(response.status === 200) {
        let results = await response.json()
        console.log(results)
        
    }

}

module.exports = startDownload

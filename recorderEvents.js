const fetch = require('node-fetch')
const http = require('http')
const querystring = require('querystring')

const SERVER_URL = 'http://192.168.221.128:1480'
const LOGIN_URL = '/api/v1/sessions/login'
const SEARCH_URL = '/api/v1/search'
const SEARCH_STATUS_URL = '/api/v1/search/status'

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

async function search(downloadOptions) {
    
    let body = JSON.stringify({
            "resultsToSkip":123,
            "searchMode": "EarliestFirst",
            "startTime":"20210512000000",
            "endTime":"20210530235959"
        })
    let headers = {
        authToken: downloadOptions.token,
        'Content-Type': 'application/json'
        //'Content-Length': body,
    }

    console.log(body)
    console.log(headers)

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
    console.log(response)

    let searchResults = await response.json()
    console.log('-----------------')
    console.log(searchResults)
    console.log('-----------------')
    let searchStatus
    while(searchStatus != 'Complete') {

        searchStatus = await getSearchStatus(downloadOptions.token)
        console.log(searchStatus)
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
    //console.log(response)
    let status = await response.json()
    console.log(status.statusShort)
    return status.statusShort
}

async function startDownload(downloadOptions) {
    downloadOptions.token =  await getToken()
    console.log(downloadOptions)
    search(downloadOptions)

}

async function postData(url, data='', headers='') {
    // Opciones por defecto estan marcadas con un *
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors', // no-cors, *cors, same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      credentials: 'same-origin', // include, *same-origin, omit
      headers: headers,
              //'Content-Type': 'application/json'
        // 'Content-Type': 'application/x-www-form-urlencoded',
      redirect: 'follow', // manual, *follow, error
      referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: JSON.stringify(data) // body data type must match "Content-Type" header
    })
    return response.json(); // parses JSON response into native JavaScript objects
  }


module.exports = startDownload

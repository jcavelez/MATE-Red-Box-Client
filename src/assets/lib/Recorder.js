const fetch = require('node-fetch')
const fetchData = require('./fetchData.js')
const log = require('electron-log')

class Recorder {
    constructor(IPAddress) {
        this.IPAddress = IPAddress
        this.authToken = ''
        this.api = { 
                    SERVER_URL: `http://${IPAddress}:1480`,
                    PORT: '1480',
                    LOGIN_URL: '/api/v1/sessions/login',
                    LOGOUT_URL: '/api/v1/sessions/logout',
                    SEARCH_URL: '/api/v1/search',
                    SEARCH_STATUS_URL: '/api/v1/search/status',
                    SEARCH_RESULTS_URL: '/api/v1/search/results',
                    CALL_AUDIO_URL: '/api/v1/search/callaudio/<callID>',
                    CALL_DETAILS_URL: '/api/v1/search/calldetails/<callID>'
        }
    }

    login(username, password) {
        const loggingIn = new Promise(async (resolve, reject) => {
            let url = `${SERVER_URL}${LOGIN_URL}`
            let headers = {
                'username': username,
                'password': password
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
            try {
                let post = await fetch(url, options)
                let results = await post.json()
                resolve(results)
            } catch (e) {
                log.error(`Fetch: ${e}`)
                reject(e)
            }
        })

        return loggingIn
    }
}

//export default Recorder
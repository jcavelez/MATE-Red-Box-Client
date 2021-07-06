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
        log.info(`Fetch: ${method} ${url}`)
        let response = await fetch(url, options)
        log.info('Fetch: Respuesta ' + response.status + ' ' + response.statusText)
        let results = await response.json()

        return results
    } catch (e) {
        log.error(`Fetch: ${e}`)
        return e
    }
}
module.exports = { fetchData }
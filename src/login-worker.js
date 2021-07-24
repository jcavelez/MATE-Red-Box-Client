'use strict'

const { parentPort, workerData, threadId } = require('worker_threads')
const log = require('electron-log')
const { loginRecorder, logoutRecorder } = require('./recorderEvents.js')
const sleep = require('./sleep.js')

log.info(`Worker Login ID ${threadId}: Creado`)

let options = workerData.options

let recorderIP = options.recorderIP
let username = options.username
let password = options.password

let currentToken = null
let loginError = null;

(async () => {
  await login()
  sendToken()
})()

log.info(`Token: ${currentToken}`)

parentPort.on('message', async (msg) => {
    if (msg.type === 'getToken') {
      sendToken()
    }
    if (msg.type === 'updateCredentials') {
      log.info('Worker Login: Actualizando credenciales')
      log.info('Worker Login: Verificando sesion abierta')
      if (currentToken != null) {
        log.info('Worker Login: Cerrando sesion abierta')
        const res = await logout()
        log.info('Worker Login: Cerrando sesion abierta' + res)
      }

      currentToken = null
      loginError = null
      recorderIP = msg.data.recorderIP
      username = msg.data.username,
      password = msg.data.password
      await login()
      sendToken()
    }
})


async function login () {
    log.info('Worker Login: Solicitud login a ' + recorderIP)
    const res = await loginRecorder(recorderIP, username, password)
    await checkLogin(res)
}

async function checkLogin (response) {
    if (response.hasOwnProperty('authToken')) {
      log.info(`Worker Login: Login OK`)
      currentToken = response.authToken
      loginError = null
      //event.sender.send('newToken', login.authToken)
      //event.sender.send('recorderSearching')
    } else if (response.hasOwnProperty('error')) {
      log.error('Main: Validando login Error ' + response.error)
      currentToken = null
      loginError = response.error
      //event.sender.send('recorderLoginError', login.error)
    }
    else {
      log.error('Main: Validando login Error: ' + response.type + ' ' + response.errno)
      //event.sender.send('recorderLoginError', response.type + ' ' + response.errno )
      currentToken = null
      loginError = response.type + ' ' + response.errno
    }
  }

  function sendToken() {
    log.info(`Worker Login: Enviando data a Main`)
    if (currentToken != null) {
      parentPort.postMessage({type:'token', data: currentToken})
    } else {
      parentPort.postMessage({type: 'error', data: loginError})
    }
  }

  
async function logout () {
  log.info('Worker Login: Solicitud logout a ' + recorderIP)
  const res = await logoutRecorder(recorderIP, currentToken)
}
const btnLicense = document.getElementById('btn-license')
const lblError = document.getElementById('error')

//.............Events ...............

btnLicense.addEventListener('click', validateCode)


window.addEventListener('load', async () => {
    
    document.getElementById('contract').innerText =  await getAgreement()
    
})


//............. functions .............

async function getAgreement() {
    const contract = await window.api.invoke('getContractAgreement')

    return contract
}

async function validateCode() {
    const code = document.getElementById('license-code').value
    let isValid = await window.api.invoke('validateCode', code)

    if (isValid) {
        window.api.send('openLogin')
    }
    else {
        error.innerText = 'Código de licencia inválido'
    }


}
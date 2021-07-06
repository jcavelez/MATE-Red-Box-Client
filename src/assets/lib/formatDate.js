function formatStartDate (date, hour) {
    const s = date.split('/')
    const t = hour.split(':')

    return  `${s[2]}${s[1]}${s[0]}${t[0]?t[0]:'00'}${t[1]?t[1]:'00'}00`
}
function formatEndDate (date, hour) {
    const s = date.split('/')
    const t = hour.split(':')

    return  `${s[2]}${s[1]}${s[0]}${t[0]?t[0]:'00'}${t[1]?t[1]:'00'}59`
}

export { formatStartDate, formatEndDate }
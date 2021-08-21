const Database = require('better-sqlite3')
const log = require('electron-log')
log.transports.file.level = 'info'
log.transports.file.maxSize = 5242880
log.transports.file.resolvePath = () => 'C:\\MATE\\Mate.log'

let db = null
const folder = 'C:\\MATE'

function createDatabase (databaseName) {
    const fs = require('fs')
    const join = require('path').join
    let options = {
        timeout: 10000
        //verbose: console.log
    }
    if(!fs.existsSync(folder)) {
        fs.mkdirSync(folder)
    }
    const database = join(folder, databaseName)
    db = new Database(database, options)
    log.info(`SQLite3: Base de datos creada`)
}

function createSchema() {
    try {
        const info = db
                    .prepare(`CREATE TABLE Estados (
                        id int PRIMARY KEY,
                        Descripcion text)`)
                    .run()

        if (info) {
            const status = [
            [0, 'No Procesado'],
            [1, 'Procesando'],
            [2, 'Listo para descargar'],
            [3, 'Descargando'],
            [4, 'Descargado'], 
            [5, 'Convirtiendo'],
            [6, 'Convertido'],
            [7, 'Error']
            ]
            status.forEach(element => {
                db
                .prepare(`INSERT INTO Estados VALUES (?, ?)`)
                .run(element)
            log.info(`SQLite3: Tabla Estados creada`)
            })
    }

    } catch (error) {
        log.error(`SQLite3: ${error}`)
    }

    try {
        const info = db
                    .prepare(`CREATE TABLE Grabaciones (
                            callID int PRIMARY KEY,
                            ruta text, 
                            idEstado int,
                            fechaDescarga text,
                            respuestaGrabador text,
                            StartDateTime text,
                            EndDateTime text,
                            Duration text,
                            Direction text,
                            Extension text,
                            ChannelName text,
                            OtherParty text,
                            AgentGroup text,
                            RBRCallGUID text,
                            ExternalCallID text,
                            FOREIGN KEY(idEstado) REFERENCES Estados(Id))`)
                    .run()

          if (info) {
            log.info(`SQLite3: Tabla Grabaciones creada`)
        }
    } catch (error) {
        log.error(`SQLite3: ${error}`)
        clearRecordsTable()
        
    }

    try {
        const info = db
            .prepare(`CREATE TABLE Busquedas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                searchDate text,
                lastRecorderIP text,
                username text,
                searchMode text,
                startTime text,
                endTime text,
                Extension text,
                AgentGroup text,
                client text, 
                resultsToSkip int
                )`)
            .run()

          if (info) {
            log.info(`SQLite3: Tabla Grabaciones creada`)
          }
    } catch (error) {
        log.error(`SQLite3: ${error}`)
    }
}

function clearRecordsTable() {
    try {
        log.info(`SQLite3: Limpiando tabla de grabaciones.`)
        // Resetea la tabla cuando se inicia el programa o cuando se ehecuta una nueva búsqueda
        db.prepare('DELETE FROM Grabaciones').run() // <----------------DELETE ON PRODUCTION??
    } catch (error2) {
        log.error(`SQLite3: ${error2}`)
    }
}

function getTop(table, columns, condition, top=1) {
    try {
        let query = `SELECT ${columns}
                    FROM ${table} `
        query = condition ? query + `WHERE ${condition} ` : query
        query = query + `
        ORDER BY
        callID ASC
        LIMIT ${top}`
        const select = db.prepare(query)
        const res = select.all()
        log.info('SQLite3: Select Query succeeded')
        return res
        
    } catch (error) {
        log.error(`SQLite3: Select ${error}`)
    }
}

function insertMany(columns, values) {
    try {
        const template = new Array(columns.length).fill('?')
        
        const insert = db.prepare(`INSERT INTO Grabaciones (${columns}) VALUES (${template})`)
        const transaction = db.transaction((values) => { for (const value of values) insert.run(value) })

        transaction(values)

        log.info('SQLite3: Insert IDs succeeded')
    } catch (error) {
        log.error(`SQLite3: Insert ${error}`)
    }
}

function saveIDs(IDs) {
    const values = IDs.map((id) => [id, 0])
    insertMany(['callID', 'idEstado'], values)
}

function saveSearch(data) {
    try {
        
        const columns = Object.keys(data)
        columns.push('searchDate')
        const values = Object.values(data)

        const template = new Array(values.length).fill('?')
        template.push(`datetime('now', 'localtime')`)
        
        const insert = db.prepare(`INSERT INTO Busquedas (${columns}) VALUES (${template})`)
        //const transaction = db.transaction(insert.run(values))
        insert.run(values)

        //transaction(values)

        log.info('SQLite3: Insert Search succeeded')
    } catch (error) {
        log.error(`SQLite3: Insert ${error}`)
    }
}


function getRecordsNoProcesed(top=1) {
    let columns = ['callID']
    let records = getTop('Grabaciones', columns, 'idEstado = 0', top)

    return records
}

function getRecordsReadyToDownload(top=1) {
    try {
        let query = `SELECT *
                    FROM Grabaciones 
                    WHERE idEstado = 2
                    
                    ORDER BY
                    callID ASC
                    LIMIT ${top}`
        
        const select = db.prepare(query)
        const res = select.all()
        log.info('SQLite3: Select Query Ready To Download succeeded')
        return res
        
    } catch (error) {
        log.error(`SQLite3: Select ${error}`)
    }
}

function getRecordsNoChecked(top=1) {
    try {
        let query = `SELECT *
                    FROM Grabaciones 
                    WHERE idEstado = 2 AND ExternalCallID = ''
                    LIMIT ${top}`
        
        const select = db.prepare(query)
        const res = select.all()
        log.info('SQLite3: Select Query No Checked succeeded')
        return res
        
    } catch (error) {
        log.error(`SQLite3: ${error}`)
        return 'error'
    }
}


function updateRecords(data, callID) {
    try {
        const columns = Object.keys(data)
        const values = Object.values(data)
        const template = new Array(values.length).fill('?')
        const update = db.prepare(`
            UPDATE Grabaciones
            SET (${columns}) = (${template}) 
            WHERE callID = ?`)
        
        update.run(values, callID)
        log.info(`SQLite3: CallID ${callID} - Update Record succeeded`)

    } catch (error){
        log.error(`SQLite3: CallID ${callID} - Update ${error}`)
    }
}

function updateSearch(data, searchID) {
    try {
        const columns = Object.keys(data)
        const values = Object.values(data)
        const template = new Array(values.length).fill('?')
        const update = db.prepare(`
            UPDATE Busquedas
            SET (${columns}) = (${template}) 
            WHERE searchID = ?`)
        log.info(update)
        update.run(values, searchID)
        log.info(`SQLite3: CallID ${searchID} - Update Search succeeded`)

    } catch (error){
        log.error(`SQLite3: CallID ${searchID} - Update ${error}`)
    }
}

//Special check for EMTELCO 
function getExternalCallID(range, Extension) {
    try {
        let query = `SELECT ExternalCallID
                    FROM Grabaciones 
                    WHERE (<condition1>)
                    AND Extension = ${Extension}
                    AND ExternalCallID != '' `
        let conditions = []
        for (const item of range) {
            conditions.push(`StartDateTime = '${item}'`)
        }

        let condition1 = conditions.join(' OR ')

        query = query.replace('<condition1>', condition1)
        
        const select = db.prepare(query)
        let newID = select.all()
        log.info('SQLite3: Select Query External Call ID succeeded')

        if (newID.length > 0) {
            newID = newID[0].ExternalCallID
            return newID
        } else {
            return 'undefined'
        } 
                
    } catch (error) {
        log.error(`SQLite3: Select ${error}`)
    }
}

function getTotalDownloads(){
    try {
        let query = `SELECT count(callID) as total
                    FROM Grabaciones 
                    WHERE idEstado = 6`
        
        const select = db.prepare(query)
        const res = select.all()
        log.info('SQLite3: Select Query Total Downloads succeeded')
        return res
                
    } catch (error) {
        log.error(`SQLite3: Select ${error}`)
    }
}

function getTotalErrors(){
    try {
        let query = `SELECT count(callID) as total
                    FROM Grabaciones 
                    WHERE idEstado = 7`
        
        const select = db.prepare(query)
        const res = select.all()
        log.info('SQLite3: Select Query Total Errors succeeded')
        return res
                
    } catch (error) {
        log.error(`SQLite3: Select ${error}`)
    }
}

function getTotalPartials(){
    try {
        let query = `SELECT count(callID) as total
                    FROM Grabaciones 
                    WHERE idEstado != 6 AND idEstado !=7`
        
        const select = db.prepare(query)
        const res = select.all()
        log.info('SQLite3: Select Query Total Partials succeeded')
        return res
                
    } catch (error) {
        log.error(`SQLite3: Select ${error}`)
    }
}

function getTotalRows(){
    try {
        let query = `SELECT count(callID) as total
                    FROM Grabaciones `
        
        const select = db.prepare(query)
        const res = select.all()
        log.info('SQLite3: Select Query Total Rows succeeded')
        return res
                
    } catch (error) {
        log.error(`SQLite3: Select ${error}`)
    }
}



module.exports = {
    createDatabase,
    createSchema,
    clearRecordsTable,
    updateSearch,
    saveIDs,
    saveSearch,
    getRecordsNoProcesed,
    getRecordsNoChecked,
    getRecordsReadyToDownload,
    getTotalDownloads,
    getTotalErrors,
    getTotalPartials,
    getTotalRows,
    updateRecords,
    getExternalCallID,
    }


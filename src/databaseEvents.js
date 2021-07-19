const Database = require('better-sqlite3')
const log = require('electron-log')

let db = null

function createDatabase (databaseName) {
    let options = {
        //verbose: console.log
      }
    db = new Database(databaseName, options)
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
            [1, 'Listo para descargar'],
            [2, 'Descargando'],
            [3, 'Descargado'], 
            [4, 'Convirtiendo'],
            [5, 'Convertido'],
            [6, 'Error']
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
        try {
            // Resetea la tabla cuando se inicia el programa.
            db.prepare('DELETE FROM Grabaciones').run() // <----------------DELETE ON PRODUCTION??
        } catch (error2) {
            log.error(`SQLite3: ${error2}`)
        }
    }

    try {
        const info = db
            .prepare(`CREATE TABLE Busquedas (
                FechaInicial smalldatetime,
                FechaFinal smalldatetime,
                NroResultados int,
                NroDescargas int
                )`)
            .run()

          if (info) {
            log.info(`SQLite3: Tabla Grabaciones creada`)
          }
    } catch (error) {
        log.error(`SQLite3: ${error}`)
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

        log.info('SQLite3: Insert succeeded')
    } catch (error) {
        log.error(`SQLite3: Insert ${error}`)
    }
}

function saveIDs(IDs) {
    const values = IDs.map((id) => [id, 0])
    insertMany(['callID', 'idEstado'], values)
}

function getRecordsNoProcesed(top=100) {
    let columns = ['callID']
    let records = getTop('Grabaciones', columns, 'idEstado = 0', top)

    return records
}

function getRecordsReadyToDownload(top=1) {
    try {
        let query = `SELECT *
                    FROM Grabaciones 
                    WHERE idEstado = 1
                    
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

function getRecordsNoChecked(top=1) {
    try {
        let query = `SELECT *
                    FROM Grabaciones 
                    WHERE idEstado = 1 AND ExternalCallID = ''
                    ORDER BY
                    callID ASC
                    LIMIT ${top}`
        
        const select = db.prepare(query)
        const res = select.all()
        log.info('SQLite3: Select Query succeeded')
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
        log.info(`SQLite3: CallID ${callID} - Update succeeded`)

    } catch (error){
        log.error(`SQLite3: CallID ${callID} - Update ${error}`)
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
        log.info('SQLite3: Select Query succeeded')

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

module.exports = {
    createDatabase,
    createSchema,
    saveIDs,
    getRecordsNoProcesed,
    getRecordsNoChecked,
    getRecordsReadyToDownload,
    updateRecords,
    getExternalCallID
    }
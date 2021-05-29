const Database = require('better-sqlite3');

let db = null

function createDatabase (databaseName) {
    let options = {
        //verbose: console.log
      }
    db = new Database(databaseName, options);
}

function createSchema() {
    try {
        const info = db.prepare(`CREATE TABLE Estados (
            id int PRIMARY KEY,
            Descripcion text)`).run()
            
        console.log(info)
        if (info) {
            const status = [
            [1, 'No Procesado'],
            [2, 'Descargando'],
            [3, 'Descargado'], 
            [4, 'Convirtiendo'],
            [5, 'Convertido'],
            [6, 'Terminado']
            ]
            console.log('tabla estados creada')
            status.forEach(element => {
                const insert = db.prepare(`INSERT INTO Estados VALUES (?, ?)`).run(element)
                console.log(`insert: ${insert}`)
            })
    }

    } catch (error) {
        console.log(error)
    }

    try {
        const info = db.prepare(`CREATE TABLE Grabaciones (
          callID int PRIMARY KEY,
          ruta text, 
          idEstado int,
          fechaDescarga smalldate,
          respuestaGrabador text,
		  FOREIGN KEY(idEstado) REFERENCES Estados(Id))`)
            .run()

          if (info) {
            //const insert = db.prepare(`INSERT INTO Estados`)
            console.log('tabla grabaciones creada')
        }
    } catch (error) {
        console.log('Error creando tabla')
        console.error(error)
    }

    try {
        db.prepare(`CREATE TABLE Busquedas (
          FechaInicial smalldatetime,
          FechaFinal smalldatetime,
          NroResultados int,
          NroDescargas int
          )`).run()
    } catch (error) {
        console.log(error)
    }
    
}

function insertMany(columns, values) {
    try {
        const template = new Array(columns.length).fill('?')
        
        const insert = db.prepare(`INSERT INTO Grabaciones (${columns}) VALUES (${template})`)
        const transaction = db.transaction((values) => { for (const value of values) insert.run(value) })

        transaction(values)

        console.log(insert)
    } catch (error) {
        console.log(error)
    }
}

function saveIDs(IDs) {
    try {
        db.prepare('DELETE FROM Grabaciones').run() // <----------------------------DELETE ON PRODUCTION
    } catch (error) {
        console.error(error)
    }
    const values = IDs.map((id) => [id, 1])
    insertMany(['callID', 'idEstado'], values)

}

module.exports = { createDatabase, createSchema, saveIDs }
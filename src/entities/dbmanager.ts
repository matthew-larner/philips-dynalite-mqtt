import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';

let db;
export const dbinit = async (bridges: any) => {
    var dir = './data';
    //needs when db is changed
    //fs.unlinkSync("./data/lightstate.db");
    //open the database
    db = new sqlite3.Database('./data/lightstate.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.error(err.message)
        } else {
            console.log('connected to lightstate db')
        }
    });
    //creat the table if it doens't exist
    db.serialize(async function () {
        db.run("CREATE TABLE IF NOT EXISTS rgbw (area INTEGER, state TEXT, red INTEGER DEFAULT 0, green INTEGER DEFAULT 0, blue INTEGER DEFAULT 0, white INTEGER DEFAULT 0, brightness INTEGER DEFAULT 0)");
    });
};

export const dbclose = () => {
    if (db) {
        db.close();
        return true;
    }
    console.warn("db is not initialized")
    return false;
};

const preparesqlinsertquery = (db: any, callback: any, area: number, state: string, red?: string, green?: string, blue?: string, white?: string, brightness?: string) => {
    var sql = 'INSERT INTO rgbw (area,state,red,green,blue,white,brightness) VALUES (?,?,?,?,?,?,?)';
    var arr = [area, state];
    console.log('inputs: ', red, green, blue, white, brightness);
    if (!(red === undefined)) {
        arr.push(red);
    } else {

        sql = sql.replace(/red,/g, '').replace(/,\?\)/g, ')');
    }

    if (!(green === undefined)) {
        arr.push(green);
    } else {

        sql = sql.replace(/green,/g, '').replace(/,\?\)/g, ')');
    }

    if (!(blue === undefined)) {
        arr.push(blue);
    } else {
        sql = sql.replace(/blue,/g, '').replace(/,\?\)/g, ')');
    }

    if (!(white === undefined)) {
        arr.push(white);
    } else {
        sql = sql.replace(/white,/g, '').replace(/,\?\)/g, ')');
    }

    if (!(brightness === undefined)) {
        arr.push(brightness);
    } else {
        sql = sql.replace(/,brightness/g, '').replace(/,\?\)/g, ')');
    }
    console.log(sql);
    db.run(sql, arr, (err) => {
        if (err) {
            return console.error(err.message);
        }
        callback();
    });
}

const preparesqupdatequery = (db: any, callback: any, area: number,state: string, red?: string, green?: string, blue?: string, white?: string, brightness?: string) => {
    var sql = `UPDATE rgbw SET state = '${state}'`;
    if (!(red === undefined)) {
        sql += ', red = ' + red;
    }

    if (!(green === undefined)) {
        sql += ', green = ' + green;
    }

    if (!(blue === undefined)) {
        sql += ', blue = ' + blue;
    }

    if (!(white === undefined)) {
        sql += ', white = ' + white;
    }

    if (!(brightness === undefined)) {
        sql += ', brightness = ' + brightness;
    }

    sql += ' WHERE area=? ';
    console.log(sql);
    db.run(sql, area, (err) => {
        if (err) {
            return console.error(err.message);
        }
        callback();
    });
}

export const dbFetchArea = (area: number, callback: (row:Object)=>void) => {
    if (db) {
        var sql = `SELECT rowid as id,state, red,green,blue,white,brightness FROM rgbw WHERE area=?`;
        db.get(sql, area, function (err, row) {
            if (err) {
                console.error(err);
            } else {
               // console.log('row found id: ' + row.id + ": " + row.state, row.red, row.green, row.blue);
                callback(row);
            }
        });
    } else {
        console.warn("db is not initialized");
    }
}

export const dbinsertorupdate = (callback: any, area: number,  state: string, red?: string, green?: string, blue?: string, white?: string, brightness?: string) => {
    if (db) {
        //todo check the pararmeters for secuirty 
        //checkif the record exists
        var sql = `SELECT rowid as id,state, red,green,blue,white,brightness FROM rgbw WHERE area=? `;
        //console.log(a,ch);
        db.get(sql, area, function (err, row) {
            if (err) {
                console.error(err);
            } else {
                if (row) {
                    console.log('row found id: ' + row.id + ": " + row.state, row.red, row.green, row.blue);
                    preparesqupdatequery(db, callback, area,  state, red, green, blue, white, brightness);
                }
                else {
                    console.log('record not found so inserting new record');
                    preparesqlinsertquery(db, callback, area,  state, red, green, blue, white, brightness);
                }

            }

        });


    } else {
        console.warn("db is not initialized");
    }

};


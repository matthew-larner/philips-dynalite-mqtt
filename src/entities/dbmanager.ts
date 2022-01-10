import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';

let db;
export const dbinit = (bridges: any) => {
    var dir = './data';
    //create the directory data if it doesn't exist
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    } else {
        //only temp since I db is not cleared
        fs.unlinkSync('./data/lightstate.db');
    }
    //open the database
    db = new sqlite3.Database('./data/lightstate.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.error(err.message)
        } else {
            console.log('connected to lightstate db')
        }
    });
    //creat the table if it doens't exist
    db.serialize(function () {
        db.run("CREATE TABLE IF NOT EXISTS rgbw (area INTEGER,channel INTEGER, state INTEGER, red INTEGER, green INTEGER, blue INTEGER, white INTEGER, brigthness INTEGER )");
        //testing insert dummy data testing
        dbinsert(3, 1, 1, 200, 0, 0, 0, 0);
    });

    //loop the channels to who's type is light and mode == rgbw
    let arek = Object.keys(bridges.area);
    //console.log(arek);
    for (let a of arek) {
        //console.log(bridges.area[a]);
        var chk = Object.keys(bridges.area[a].channel);
        //console.log(chk);
        for (var ch of chk) {
            if (bridges.area[a].channel[ch].type == 'light' && bridges.area[a].channel[ch].mode == 'rgbw') {
                //console.log(bridges.area[a].channel[ch]);
                var sql = `SELECT rowid as id,state, red,green,blue,white,brigthness FROM rgbw WHERE area=? and channel=?`;
                //console.log(a,ch);
                db.get(sql, a, ch, function (err, row) {
                    if (err) {
                        console.error(err);
                    } else {
                        if (row) {
                            console.log('row found id: ' + row.id + ": " + row.state, row.red, row.green, row.blue);
                        }
                        else {
                            //do nothing
                        }

                    }

                });
            }
        }
    }

};

export const dbclose = () => {
    if (db) {
        db.close();
        return true;
    }
    console.warn("db is not initialized")
    return false;
};

export const dbinsert = (area: number, channel: number, state: number, red: number, green: number, blue: number, white: number, brigthness: number) => {
    if (db) {
        //todo check the pararmeters for secuirty 
        var stmt = db.prepare('INSERT INTO rgbw  VALUES (?,?,?,?,?,?,?,?)');
        stmt.run(area, channel, state, red, green, blue, white, brigthness);
        stmt.finalize();
        return true;
    }
    console.warn("db is not initialized")
    return false;
};
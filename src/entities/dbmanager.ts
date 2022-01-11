import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';

let db;
export const dbinit = async (bridges: any) => {
    var dir = './data';
    //create the directory data if it doesn't exist
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    } else {
        //only temp since I db is not cleared
        //fs.unlinkSync('./data/lightstate.db');
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
    db.serialize(async function () {
        db.run("CREATE TABLE IF NOT EXISTS rgbw (area INTEGER,channel INTEGER, state TEXT, red INTEGER, green INTEGER, blue INTEGER, white INTEGER, brigthness INTEGER )");
        //testing insert dummy data testing
        dbinsertorupdate( (err) => {
            console.log('record inserted !');
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
                                    console.log('row found id: ' + row.id + ": " + row.state, row.red, row.green, row.blue,row.white,row.brightness);
                                }
                                else {
                                    //do nothing
                                }
        
                            }
        
                        });
                    }
                }
            }
        },3, 1, 'ON', 200, 0, 0, 0 ,10);
    });

    //loop the channels to who's type is light and mode == rgbw

   

};

export const dbclose = () => {
    if (db) {
        db.close();
        return true;
    }
    console.warn("db is not initialized")
    return false;
};

const preparesqlinsertquery=(db:any,callback:any,area: number, channel: number, state: string,red?: number, green?: number, blue?: number, white?: number, brigthness?: number)=>{
    var sql='INSERT INTO rgbw (area,channel,state,red,green,blue,white,brigthness) VALUES (?,?,?,?,?,?,?,?)';
    var arr=[area,channel,state];
    console.log('inputs: ',red,green,blue,white,brigthness);
    if(!(red === undefined)){
        arr.push(red);
    }else{
    
        sql=sql.replace(/red,/g,'').replace(/,\?\)/g, ')');
    }

    if(!(green === undefined)){
        arr.push(green);
    }else{
       
        sql=sql.replace(/green,/g,'').replace(/,\?\)/g, ')');
    }

    if(!(blue=== undefined)){
        arr.push(blue);
    }else{
        sql=sql.replace(/blue,/g,'').replace(/,\?\)/g, ')');
    }

    if(!(white=== undefined)){
        arr.push(white);
    }else{
        sql=sql.replace(/white,/g,'').replace(/,\?\)/g, ')');
    }

    if(!(brigthness=== undefined)){
        arr.push(brigthness);
    }else{
        sql=sql.replace(/,brigthness/g,'').replace(/,\?\)/g, ')');
    }
    console.log(sql);
    db.run(sql, arr, (err) => {
        if (err) {
            return console.error(err.message);
        }
        callback();
    });
}

const preparesqupdatequery=(db:any,callback:any,area: number, channel: number, state: string,red?: number, green?: number, blue?: number, white?: number, brigthness?: number)=>{
    var sql=`UPDATE rgbw SET state = '${state}'`;
    if(!(red === undefined)){
        sql+=', red = '+red;
    }

    if(!(green === undefined)){
        sql+=', green = '+green;
    }

    if(!(blue=== undefined)){
        sql+=', blue = '+blue;
    }

    if(!(white=== undefined)){
        sql+=', white = '+white;
    }

    if(!(brigthness=== undefined)){
        sql+=', brigthness = '+brigthness;
    }

    sql+=' WHERE area=? and channel=?';
    console.log(sql);
    db.run(sql, [area,channel], (err) => {
        if (err) {
            return console.error(err.message);
        }
        callback();
    });
}

export const  dbinsertorupdate =  (callback: any,area: number, channel: number, state: string, red?: number, green?: number, blue?: number, white?: number, brigthness?: number) => {
    if (db) {
        //todo check the pararmeters for secuirty 
        //checkif the record exists
        var sql = `SELECT rowid as id,state, red,green,blue,white,brigthness FROM rgbw WHERE area=? and channel=?`;
        //console.log(a,ch);
        db.get(sql, area, channel, function (err, row) {
            if (err) {
                console.error(err);
            } else {
                if (row) {
                    console.log('row found id: ' + row.id + ": " + row.state, row.red, row.green, row.blue);
                    preparesqupdatequery(db,callback,area, channel, state, red, green, blue, white, brigthness);
                }
                else {
                    console.log('record not found so inserting new record');
                    preparesqlinsertquery(db,callback,area, channel, state, red, green, blue, white, brigthness);
                }

            }

        });
       
       
    }
    console.warn("db is not initialized")
    return false;
};


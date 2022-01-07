import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';


export const dbinit = () => {
    var dir = './data';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    var db = new sqlite3.Database('./data/lightstate.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.error(err.message)
        } else {
            console.log('connected to lightstate db')
        }
    });

    db.serialize(function () {
        db.run("CREATE TABLE IF NOT EXISTS rgbw (state INTEGER, red INTEGER, green INTEGER, blue INTEGER, white INTEGER, brigthness INTEGER )");

        var stmt = db.prepare("INSERT INTO rgbw (state) VALUES (?)");
        for (var i = 0; i < 10; i++) {
            stmt.run(0);
        }
        stmt.finalize();

        db.each("SELECT rowid AS id, state FROM rgbw", function (err, row) {
            console.log(row.id + ": " + row.state);
        });
    });

    db.close();
};
"use strict";

const mysql = require('mysql');

var TAG = "mysql_proxy::";

function MysqlProxy() {
    this.mysqlConnection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'root',
        database: 'robot_schema',
        port: '3306',
        charset: 'utf8_unicode_ci'
    });
}

MysqlProxy.getInstance = function () {
    if (typeof MysqlProxy.instance !== "object") {
        MysqlProxy.instance = new MysqlProxy();
    }
    return MysqlProxy.instance;
};

MysqlProxy.prototype.connect = function () {
    this.mysqlConnection.connect();
};

MysqlProxy.prototype.end = function () {
    this.mysqlConnection.end();
};

MysqlProxy.prototype.query = function (sql, sqlParams) {
    var self = this;

    return new Promise(function (resolve, reject) {
        self.mysqlConnection.query(sql, sqlParams, function (err, result) {
            if (err) {
                console.log(TAG, '[QUERY ERROR] - ', err.message);
                reject();
            }

            console.log(TAG, 'result:', result);
            resolve(result);
        });
    });
};

module.exports = MysqlProxy;

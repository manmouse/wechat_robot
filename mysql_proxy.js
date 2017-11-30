"use strict";

const mysql = require('mysql');

var TAG = "mysql_proxy::";

var handleError = function (err) {
    if (err) {
        // 如果是连接断开，自动重新连接
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            MysqlProxy.getInstance().connect();
        } else {
            console.error(err.stack || err);
        }
    }
}

function MysqlProxy() {
    this.config = {
        host: 'localhost',
        user: 'root',
        password: 'root',
        database: 'robot_schema',
        port: '3306',
        charset: 'utf8_unicode_ci'
    };
}

MysqlProxy.getInstance = function () {
    if (typeof MysqlProxy.instance !== "object") {
        MysqlProxy.instance = new MysqlProxy();
    }
    return MysqlProxy.instance;
};

MysqlProxy.prototype.connect = function () {
    this.mysqlConnection = mysql.createConnection(this.config);
    this.mysqlConnection.connect(handleError);
    this.mysqlConnection.on('error', handleError);
};

MysqlProxy.prototype.end = function () {
    this.mysqlConnection.end();
};

MysqlProxy.prototype.query = function (sql, sqlParams) {
    var self = this;

    return new Promise(function (resolve, reject) {
        if (self.pool) {
            self.pool.getConnection(function (err, connection) {
                if (err) {
                    console.log(TAG, '[QUERY ERROR] - ', err.message);
                    reject();
                }
                else {
                    connection.query(sql, sqlParams, function (err, result) {
                        connection.release();
                        if (err) {
                            console.log(TAG, '[QUERY ERROR] - ', err.message);
                            reject();
                        }
                        else {
                            //console.log(TAG, 'result:', result);
                            resolve(result);
                        }
                    });
                }
            });
        }
        else {
            self.mysqlConnection.query(sql, sqlParams, function (err, result) {
                if (err) {
                    console.log(TAG, '[QUERY ERROR] - ', err.message);
                    reject();
                }

                //console.log(TAG, 'result:', result);
                resolve(result);
            });
        }
    });
};

MysqlProxy.prototype.createPool = function () {
    this.pool = mysql.createPool(this.config);
};

module.exports = MysqlProxy;

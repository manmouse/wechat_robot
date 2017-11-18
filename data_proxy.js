"use strict";

const mysql = require('mysql');
const mysql_proxy = require('./mysql_proxy.js').getInstance();
const fs = require("fs");
const audio_proxy = require('./audio_proxy.js').getInstance();

const voice_path = "./audio/";

const point_rule = {
    text: { length: 50, point: 1 },
    voice: { length: 40000, point: 2 }
}

var TAG = "data_proxy::";

function DataProxy() {
    this.groups = [];
    this.op_types = null;
}

DataProxy.getInstance = function () {
    if (typeof DataProxy.instance !== "object") {
        DataProxy.instance = new DataProxy();
    }
    return DataProxy.instance;
};

DataProxy.prototype.loadData = function () {
    var self = this;
    // load from database
    /*
        var sql = 'SELECT * FROM op_type where id = ?';
        var sqlParams = [2];
        mysql_proxy.query(sql, sqlParams).then(function(ret){
            for(let i = 0; i < ret.length; i++){
                console.log(ret[i].op_name);
            }

            mysql_proxy.end();
        },
        function(){
            mysql_proxy.end();
        });
    */

    var sql = 'SELECT * FROM groups';
    var sqlParams = [];
    mysql_proxy.query(sql, sqlParams).then(
        function (ret) {
            for (let i = 0; i < ret.length; i++) {
                self.groups.push({ 'id': ret[i].id, 'name': ret[i].group_name });
                fs.stat(voice_path + ret[i].group_name, function (err, stats) {
                    if (err) {
                        fs.mkdir(voice_path + ret[i].group_name, function (err) {
                            if (err) {
                                console.log(TAG, err);
                            }
                            console.log(TAG, voice_path + ret[i].group_name + "目录创建成功。");
                        });
                    } else {
                    }
                });
            }
        },
        function () {
        }
    );

};

DataProxy.prototype.update_data = function (group_name, user_name, type, length, time, wechat_proxy, group_code) {
    var self = this;

    var timeStr = (new Date(time * 1000)).toLocaleString();
    var point = this.checkpoint(type, length);
    var record_table = null;
    switch (type) {
        case 1:
            record_table = "user_text_records";
            break;
        case 2:
            record_table = "user_voice_records";
            break;
        default:
            break;
    }

    var group_id = null;
    for (let i = 0; i < self.groups.length; i++) {
        if (self.groups[i].name == group_name) {
            group_id = self.groups[i].id;
        }
    }

    var updateNewRecord = function (user_id) {
        var sql_insert_record = "insert into " + record_table + "(user_id, group_id, length, time, create_time) values(?,?,?,?,?)";
        var Params = [user_id, group_id, length, time, timeStr];
        mysql_proxy.query(sql_insert_record, Params).then(
            function (ret) {
                var record_id = ret.insertId;
                var sql_insert_score = "insert into his_score(user_id, group_id, op_type, record_id, point, create_time) values(?,?,?,?,?,?)";
                var Params1 = [user_id, group_id, type, record_id, point, timeStr];
                mysql_proxy.query(sql_insert_score, Params1).then(
                    function () {

                    },
                    function () {

                    }
                );
            },
            function () {

            }
        );
    }

    var sql = 'SELECT * FROM users where user_name = ? and group_id = ?';
    var sqlParams = [user_name, group_id];

    mysql_proxy.query(sql, sqlParams).then(
        function (ret) {
            var user_id = null;
            if (ret.length) {
                user_id = ret[0].id;
                updateNewRecord(user_id);
            }
            else {
                var sql_insert_user = "insert into users(user_name, group_id) values(?,?)";
                var Params_user = [user_name, group_id];
                mysql_proxy.query(sql_insert_user, Params_user).then(
                    function (ret) {
                        user_id = ret.insertId;
                        updateNewRecord(user_id);
                    },
                    function () {

                    }
                );
            }
        },
        function () {

        }
    );

    wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, group_code, "本次发言得分：" + point).then(
        function () {
        },
        function () {
        }
    );
}

DataProxy.prototype.checkpoint = function (type, length) {
    var point = 0;
    switch (type) {
        case 1://text
            if (length >= point_rule.text.length) {
                point = point_rule.text.point;
            }
            break;
        case 2://voice
            if (length >= point_rule.voice.length) {
                point = point_rule.voice.point;
            }
            break;
        default:
            break;
    }
    return point;
}

DataProxy.prototype.user_cmd = function (userCode, cmdStr, wechat_proxy) {
    console.log(TAG, "command:", userCode, cmdStr);

    var self = this;
    var group_id = null, user_id = null;
    var strArr = cmdStr.split(":");
    switch (strArr[0].toLowerCase()) {
        case "point":
            console.log("获取得分情况");
            let detailArr = strArr[1].split("@");

            if (detailArr.length == 2) {
                console.log("对象：" + detailArr[0], "讨论组：" + detailArr[1]);
                for (var value of self.groups) {
                    if (value.name == detailArr[1]) {
                        console.log("群号：", value.id);
                        group_id = value.id;
                        break;
                    }
                }

                if (group_id) {
                    let sql = 'SELECT * FROM users where user_name = ? and group_id = ?';
                    let sqlParams = [detailArr[0], group_id];
                    mysql_proxy.query(sql, sqlParams).then(
                        function (ret) {
                            if (ret.length) {
                                user_id = ret[0].id;
                                console.log("用户ID: ", user_id);

                                let sql_score = 'SELECT sum(point) as total FROM his_score where user_id = ? and group_id = ?';
                                let sqlParams_score = [user_id, group_id];
                                mysql_proxy.query(sql_score, sqlParams_score).then(
                                    function (ret) {
                                        if (ret.length) {
                                            console.log("得分：", ret[0].total);
                                            wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, userCode, "总得分：" + ret[0].total).then(
                                                function () {
                                                },
                                                function () {
                                                }
                                            );
                                        }
                                        else {
                                        }
                                    },
                                    function () {
                                    }
                                );
                            }
                            else {
                            }
                        },
                        function () {
                        }
                    );
                }
            }
            break;
        case "rank":
            console.log("获取排名情况");
            for (var value of self.groups) {
                if (value.name == strArr[1]) {
                    console.log("群号：", value.id);
                    group_id = value.id;
                    break;
                }
            }
            if (group_id) {
                let sql = 'SELECT users.user_name,score.total from (SELECT user_id, sum(point) as total FROM his_score where group_id = ? group by user_id) AS score right join (SELECT * from users where group_id = ?) AS users on users.id = score.user_id where score.total is not NULL order by score.total desc';
                let sqlParams = [group_id, group_id];
                mysql_proxy.query(sql, sqlParams).then(
                    function (ret) {
                        if (ret.length) {
                            console.log("排名：", ret);
                            let retStr = "";
                            for (var rank_info of ret) {
                                retStr += rank_info.user_name + ":  " + rank_info.total + "\r\n";
                            }

                            wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, userCode, retStr).then(
                                function () {
                                },
                                function () {
                                }
                            );
                        }
                        else {
                        }
                    },
                    function () {
                    }
                );
            }
            break;
        case "audio":
            console.log("获取语音信息");
            let infoArr = strArr[1].split("@");

            if (infoArr.length == 2) {
                console.log("对象：" + infoArr[0], "讨论组：" + infoArr[1]);
                for (var value of self.groups) {
                    if (value.name == infoArr[1]) {
                        console.log("群号：", value.id);
                        group_id = value.id;
                        break;
                    }
                }

                if (group_id) {
                    let sql = 'SELECT * FROM users where user_name = ? and group_id = ?';
                    let sqlParams = [infoArr[0], group_id];
                    mysql_proxy.query(sql, sqlParams).then(
                        function (ret) {
                            if (ret.length) {
                                user_id = ret[0].id;
                                console.log("用户ID: ", user_id);

                                let sql_voice = 'SELECT time FROM user_voice_records where user_id = ? and group_id = ? order by time asc';
                                let sqlParams_voice = [user_id, group_id];
                                mysql_proxy.query(sql_voice, sqlParams_voice).then(
                                    function (ret) {
                                        if (ret.length) {
                                            console.log("语音消息：", ret);
                                            var clips = [];
                                            for (var piece of ret) {
                                                let curFile = piece.time + ".mp3";

                                                if (fs.existsSync(voice_path + infoArr[1] + '/' + infoArr[0] + '/' + curFile)) {
                                                    clips.push(piece.time + ".mp3");
                                                }
                                            }

                                            var timestamp = Date.now();
                                            let tarFile = timestamp + ("" + Math.random().toFixed(4)).substring(2, 6) + '.mp3';
                                            let tarPath = './tmp/' + tarFile;
                                            audio_proxy.concatAudio(clips, voice_path + infoArr[1] + '/' + infoArr[0] + '/', tarPath).then(
                                                function () {
                                                    console.log(TAG, "合并语音成功");
                                                    wechat_proxy.uploadFile(tarFile, './tmp/', wechat_proxy.user_info.UserName, "filehelper").then(
                                                        function (result) {
                                                            console.log(TAG, "上传文件最终成功！");
                                                            wechat_proxy.sendFileMsg(wechat_proxy.user_info.UserName, userCode, result.MediaId, infoArr[0] + '.mp3', result.StartPos).then(
                                                                function () {

                                                                },
                                                                function () {

                                                                }
                                                            );
                                                        },
                                                        function () {
                                                            console.log(TAG, "上传文件最终失败！");
                                                        }
                                                    );
                                                },
                                                function () {
                                                    console.log(TAG, "合并语音失败");
                                                }
                                            );
                                        }
                                        else {
                                        }
                                    },
                                    function () {
                                    }
                                );
                            }
                        },
                        function () {
                        }
                    );
                }
            }
            break;
        default:
            break;

    }
}

module.exports = DataProxy;

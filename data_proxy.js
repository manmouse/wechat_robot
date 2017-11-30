"use strict";

const mysql = require('mysql');
const mysql_proxy = require('./mysql_proxy.js').getInstance();
const fs = require("fs");
const audio_proxy = require('./audio_proxy.js').getInstance();

const voice_path = "./audio/";
const concat_path = "./tmp/";

const point_rule = {
    text: { length: 50, point: 1 },
    voice: { length: 40000, point: 2 }
}

var TAG = "data_proxy::";

function DataProxy() {
    this.groups = [];
    this.op_types = null;
    this.admins = [];
}

DataProxy.getInstance = function () {
    if (typeof DataProxy.instance !== "object") {
        DataProxy.instance = new DataProxy();
    }
    return DataProxy.instance;
};

DataProxy.prototype.loadData = function () {
    var self = this;

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

    var sql_admin = 'SELECT * FROM admins';
    var sqlParams_admin = [];
    mysql_proxy.query(sql_admin, sqlParams_admin).then(
        function (ret) {
            for (let i = 0; i < ret.length; i++) {
                self.admins.push({ 'id': ret[i].id, 'name': ret[i].admin_name });
            }
            console.log(TAG, "管理员：", self.admins);
        },
        function () {
        }
    );
};

DataProxy.prototype.getCurRoundTime = function (group_id) {
    let curTime = (new Date()).toLocaleString();
    let sql_round = 'SELECT * FROM project_round where group_id = ? and ? >= start_time and ? < end_time';
    let sqlParams_round = [group_id, curTime, curTime];

    return new Promise(function (resolve, reject) {
        mysql_proxy.query(sql_round, sqlParams_round).then(
            function (ret) {
                if (ret.length) {
                    console.log("当前轮数：", ret[0].round_id);
                    let roundTime = {};
                    roundTime.starttime = ret[0].start_time;
                    roundTime.endtime = ret[0].end_time;
                    resolve(roundTime);
                }
                else {
                    reject(null);
                }
            },
            function () {
                reject(null);
            }
        );
    });
};

DataProxy.prototype.getRank = function (group_id, time) {
    var sql, sqlParams;
    if (time) {
        sql = 'SELECT users.user_name,score.total from (SELECT user_id, sum(point) as total FROM his_score where group_id = ? and create_time >= ? and create_time < ? group by user_id) AS score right join (SELECT * from users where group_id = ?) AS users on users.id = score.user_id where score.total is not NULL order by score.total desc limit 10';
        sqlParams = [group_id, time.starttime, time.endtime, group_id];
    }
    else {
        sql = 'SELECT users.user_name,score.total from (SELECT user_id, sum(point) as total FROM his_score where group_id = ? group by user_id) AS score right join (SELECT * from users where group_id = ?) AS users on users.id = score.user_id where score.total is not NULL order by score.total desc limit 10';
        sqlParams = [group_id, group_id];
    }

    return new Promise(function (resolve, reject) {
        mysql_proxy.query(sql, sqlParams).then(
            function (ret) {
                if (ret.length) {
                    console.log("排名：", ret);
                    resolve(ret);
                }
                else {
                    resolve([]);
                }
            },
            function () {
                reject();
            }
        );
    });
};

DataProxy.prototype.getPoint = function (user_id, group_id, time) {
    var sql, sqlParams;
    if (time) {
        sql = 'SELECT sum(point) as total FROM his_score where user_id = ? and group_id = ? and create_time >= ? and create_time < ?';
        sqlParams = [user_id, group_id, time.starttime, time.endtime];
    }
    else {
        sql = 'SELECT sum(point) as total FROM his_score where user_id = ? and group_id = ?';
        sqlParams = [user_id, group_id];
    }

    return new Promise(function (resolve, reject) {
        mysql_proxy.query(sql, sqlParams).then(
            function (ret) {
                if (ret.length) {
                    console.log("得分：", ret[0].total);
                    let totalPoint = 0;
                    if (ret[0].total) {
                        totalPoint = ret[0].total;
                    }

                    resolve(totalPoint);
                }
                else {
                    resolve(0);
                }
            },
            function () {
                reject();
            }
        );
    });
};

DataProxy.prototype.getVoicePiece = function (user_id, user_name, group_id, group_name, time) {
    var sql, sqlParams;
    if (time) {
        sql = 'SELECT time FROM user_voice_records where user_id = ? and group_id = ? and create_time >= ? and create_time < ? order by time asc';
        sqlParams = [user_id, group_id, time.starttime, time.endtime];
    }
    else {
        sql = 'SELECT time FROM user_voice_records where user_id = ? and group_id = ? order by time asc';
        sqlParams = [user_id, group_id];
    }

    return new Promise(function (resolve, reject) {
        mysql_proxy.query(sql, sqlParams).then(
            function (ret) {
                if (ret.length) {
                    console.log("语音消息：", ret);
                    var clips = [];
                    for (var piece of ret) {
                        let curFile = piece.time + ".mp3";

                        if (fs.existsSync(voice_path + group_name + '/' + user_name + '/' + curFile)) {
                            clips.push(piece.time + ".mp3");
                        }
                    }
                    resolve(clips);
                }
                else {
                    resolve([]);
                }
            },
            function () {
                reject();
            }
        );
    });
};

DataProxy.prototype.concatVoice = function (user_name, group_name, clips) {
    var timestamp = Date.now();
    var tarFile = timestamp + ("" + Math.random().toFixed(4)).substring(2, 6) + '.mp3';
    var tarPath = concat_path + tarFile;

    return new Promise(function (resolve, reject) {
        audio_proxy.concatAudio(clips, voice_path + group_name + '/' + user_name + '/', tarPath).then(
            function () {
                console.log(TAG, "合并语音成功");
                resolve(tarFile);
            },
            function () {
                console.log(TAG, "合并语音失败");
                reject();
            }
        );
    });
};

DataProxy.prototype.getUserId = function (user_name, group_id) {
    let sql = 'SELECT * FROM users where user_name = ? and group_id = ?';
    let sqlParams = [user_name, group_id];

    return new Promise(function (resolve, reject) {
        mysql_proxy.query(sql, sqlParams).then(
            function (ret) {
                if (ret.length) {
                    resolve(ret[0].id);
                }
                else {
                    resolve(null);
                }
            },
            function () {
                reject();
            }
        );
    });
}

DataProxy.prototype.addUser = function (user_name, group_id) {
    var sql = "insert into users(user_name, group_id) values(?,?)";
    var sqlParams = [user_name, group_id];

    return new Promise(function (resolve, reject) {
        mysql_proxy.query(sql, sqlParams).then(
            function (ret) {
                resolve(ret.insertId);
            },
            function () {
                reject();
            }
        );
    });
}

DataProxy.prototype.addRecord = function (user_id, group_id, length, time, timeStr, type, point) {
    var record_table = null;
    switch (type) {
        case 1:
            record_table = "user_text_records";
            break;
        case 2:
            record_table = "user_voice_records";
            break;
        default:
            return null;
            break;
    }

    var sql_insert_record = "insert into " + record_table + "(user_id, group_id, length, time, create_time) values(?,?,?,?,?)";
    var sqlParams = [user_id, group_id, length, time, timeStr];

    return new Promise(function (resolve, reject) {
        mysql_proxy.query(sql_insert_record, sqlParams).then(
            function (ret) {
                let record_id = ret.insertId;
                let sql_insert_score = "insert into his_score(user_id, group_id, op_type, record_id, point, create_time) values(?,?,?,?,?,?)";
                let Params = [user_id, group_id, type, record_id, point, timeStr];
                mysql_proxy.query(sql_insert_score, Params).then(
                    function () {
                        resolve(1);
                    },
                    function () {
                        reject();
                    }
                );
            },
            function () {
                reject();
            }
        );
    });
};

DataProxy.prototype.getRankStr = function (rankArr, endtime) {
    let curTime = new Date();
    let curTimeStr = curTime.toLocaleString()
    let retStr = "";
    if (endtime) {
        let endTimeStr = endtime.toLocaleString();
        let diff = parseInt((endtime.getTime() - curTime.getTime()) / (24 * 60 * 60 * 1000));
        retStr = `截止到${curTimeStr}，目前本轮的排名如下。本轮结束时间为${endTimeStr}，还有${diff}天。革命尚未成功，同志们继续努力[拳头]。\n\n`;
    }
    else {
        retStr = `截止到${curTimeStr}，目前的总排名如下。\n\n`;
    }

    for (var rank_info of rankArr) {
        retStr += rank_info.user_name + ":  " + rank_info.total + "\n";
    }
    return retStr;
};

DataProxy.prototype.isDate = function (dateString) {
    if (dateString.trim() == "") return true;
    var r = dateString.match(/^(\d{1,4})(-|\/)(\d{1,2})\2(\d{1,2})$/);
    if (r == null) {
        //console.log("请输入格式正确的日期\n\r日期格式：yyyy-mm-dd\n\r例  如：2008-08-08\n\r");
        return false;
    }
    var d = new Date(r[1], r[3] - 1, r[4]);
    var num = (d.getFullYear() == r[1] && (d.getMonth() + 1) == r[3] && d.getDate() == r[4]);
    if (num == 0) {
        //console.log("请输入格式正确的日期\n\r日期格式：yyyy-mm-dd\n\r例  如：2008-08-08\n\r");
    }
    return (num != 0);
}

DataProxy.prototype.update_data = async function (group_name, user_name, type, length, time, wechat_proxy, group_code, text, memberCount, adminCount) {
    var self = this;

    var timeStr = (new Date(time * 1000)).toLocaleString();
    var point = this.checkpoint(type, length);
    var msgTypeStr = "";
    var lenStr = "";
    switch (type) {
        case 1:
            msgTypeStr = "文字";
            lenStr = length + "字";
            break;
        case 2:
            msgTypeStr = "语音";
            lenStr = length / 1000 + "秒";
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

    var roundTime = await self.getCurRoundTime(group_id).catch(function () { });

    var user_id = null;

    var reply = async function () {
        if (group_id && roundTime) {
            let ret = await self.getRank(group_id, roundTime).catch(function () { });
            if (ret && ret.length) {
                let not_behind = 0;
                let score = -1;
                for (var rank_info of ret) {
                    if (rank_info.user_name == user_name) {
                        score = rank_info.total;
                    }

                    if (rank_info.total >= score) {
                        not_behind++;
                    }
                    else {
                        break;
                    }
                }

                let beat = Math.round((memberCount - adminCount - not_behind) * 100 / (memberCount - 1 - adminCount));

                if (score <= 0) {
                    beat = 0;
                }
                console.log("群总人数：", memberCount, "管理员人数：", adminCount);
                var retStr = "";
                if (point == 0) {
                    retStr = `[玫瑰]加油${user_name}，您刚完成了${lenStr}的${msgTypeStr}作业，本次作业没有达标哦，请继续努力[拳头]。\n您本轮目前总分${score}，打败了${beat}%的选手。加油！`;
                }
                else {
                    retStr = `[玫瑰]加油${user_name}，您刚完成了${lenStr}的${msgTypeStr}作业，又得${point}分。\n您本轮目前总分${score}，打败了${beat}%的选手。加油！[拳头]`;
                }
                wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, group_code, retStr).then(
                    function () {
                    },
                    function () {
                    }
                );
            }
        }
    }

    var checkAdmin = function (name) {
        for (var value of self.admins) {
            if (value.name == name) {
                return true;
            }
        }
        return false;
    }

    var updateNewRecord = async function () {
        if (checkAdmin(user_name)) {
            console.log("当前用户是管理员");
            return;
        }

        let ret = await self.addRecord(user_id, group_id, length, time, timeStr, type, point).catch(function () { });
        if (ret) {
            reply();
        }
    }

    var checkCmd = async function () {
        if (type == 1) {
            var strArr = text.split(":");
            if (text.toLowerCase() == "rank") {
                if (group_id && roundTime) {
                    let ret = await self.getRank(group_id, roundTime).catch(function () { });
                    if (ret) {
                        let retStr = self.getRankStr(ret, roundTime.endtime);
                        wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, group_code, retStr).then(
                            function () {
                            },
                            function () {
                            }
                        );
                    }
                }
            }
            else {
                if (!group_id || !roundTime) {
                    return;
                }

                if (!strArr[1]) {
                    updateNewRecord();
                    return;
                }

                let tar_user_name = strArr[1];
                let tar_user_id = await self.getUserId(tar_user_name, group_id).catch(function () { });
                if (!tar_user_id) {
                    return;
                }

                switch (strArr[0].toLowerCase()) {
                    case "point":
                        let totalPoint = await self.getPoint(tar_user_id, group_id, roundTime).catch(function () { });
                        if (totalPoint != null) {
                            wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, group_code, strArr[1] + "本轮总得分：" + totalPoint).then(
                                function () {
                                },
                                function () {
                                }
                            );
                        }
                        break;
                    case "audio":
                        let clips = await self.getVoicePiece(tar_user_id, tar_user_name, group_id, group_name, roundTime).catch(function () { });
                        if (clips) {
                            let tarFile = await self.concatVoice(tar_user_name, group_name, clips).catch(function () { });
                            if (tarFile) {
                                wechat_proxy.uploadFile(tarFile, concat_path, wechat_proxy.user_info.UserName, "filehelper").then(
                                    function (result) {
                                        console.log(TAG, "上传文件最终成功！");
                                        fs.unlinkSync(concat_path + tarFile);
                                        wechat_proxy.sendFileMsg(wechat_proxy.user_info.UserName, group_code, result.MediaId, 'record' + '.mp3', result.StartPos).then(
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
                            }
                        }
                        break;
                    default:
                        updateNewRecord();
                        break;
                }
            }
        }
        else {
            updateNewRecord();
        }
    }

    if (!group_id || !roundTime) {
        return;
    }

    user_id = await self.getUserId(user_name, group_id).catch(function () { });

    if (user_id) {
        checkCmd();
    }
    else {
        user_id = await self.addUser(user_name, group_id).catch(function () { });
        if (user_id) {
            checkCmd();
        }
    }
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

DataProxy.prototype.user_cmd = async function (userCode, cmdStr, wechat_proxy) {
    console.log(TAG, "command:", userCode, cmdStr);

    var self = this;
    var group_id = null, user_id = null, group_name = null, user_name = null, timeStr = null;
    var strArr = cmdStr.split(":");

    if (strArr.length < 2) {
        return;
    }

    var detailArr = strArr[1].split("@");
    if (detailArr.length == 2) {
        let timeArr = detailArr[1].split("$");

        if (timeArr.length == 2) {
            group_name = timeArr[0];
            timeStr = timeArr[1];
            user_name = detailArr[0];
        }
        else {
            group_name = detailArr[1];
            user_name = detailArr[0];
        }
    }
    else {
        let timeArr = detailArr[0].split("$");

        if (timeArr.length == 2) {
            group_name = timeArr[0];
            timeStr = timeArr[1];
        }
        else {
            group_name = strArr[1];
        }

    }

    var tarTime = null;
    if (timeStr) {
        let timeStrArr = timeStr.split(" ");
        if (timeStrArr.length == 2) {
            if (self.isDate(timeStrArr[0]) && self.isDate(timeStrArr[1])) {
                tarTime = {};
                tarTime.starttime = timeStrArr[0] + " 00:00:00";
                let tmpStamp = Date.parse(new Date(timeStrArr[1] + " 23:59:59")) + 1000;
                tarTime.endtime = (new Date(tmpStamp)).toLocaleString();
                console.log(TAG, "时间：", tarTime);
            }
        }

        if (!tarTime) {
            return;
        }
    }

    for (var value of self.groups) {
        if (value.name == group_name) {
            group_id = value.id;
            break;
        }
    }

    if (user_name && group_id) {
        user_id = await self.getUserId(user_name, group_id).catch(function () { });
    }

    var roundTime = await self.getCurRoundTime(group_id).catch(function () { });

    switch (strArr[0].toLowerCase()) {
        case "point":
            if (group_id && user_id && roundTime) {
                let totalPoint = await self.getPoint(user_id, group_id, roundTime).catch(function () { });
                if (totalPoint != null) {
                    wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, userCode, "本轮总得分：" + totalPoint).then(
                        function () {
                        },
                        function () {
                        }
                    );
                }
            }
            break;
        case "pointtotal":
            if (group_id && user_id) {
                let totalPoint = await self.getPoint(user_id, group_id, null).catch(function () { });
                if (totalPoint != null) {
                    wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, userCode, "总得分：" + totalPoint).then(
                        function () {
                        },
                        function () {
                        }
                    );
                }
            }
            break;
        case "pointtime":
            if (group_id && user_id && tarTime) {
                let totalPoint = await self.getPoint(user_id, group_id, tarTime).catch(function () { });
                if (totalPoint != null) {
                    wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, userCode, "总得分：" + totalPoint).then(
                        function () {
                        },
                        function () {
                        }
                    );
                }
            }
            break;
        case "rank":
            if (group_id && roundTime) {
                let ret = await self.getRank(group_id, roundTime).catch(function () { });
                if (ret) {
                    let retStr = self.getRankStr(ret, roundTime.endtime);
                    wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, userCode, retStr).then(
                        function () {
                        },
                        function () {
                        }
                    );
                }
            }
            break;
        case "ranktotal":
            if (group_id) {
                let ret = await self.getRank(group_id, null).catch(function () { });
                if (ret) {
                    let retStr = self.getRankStr(ret);
                    wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, userCode, retStr).then(
                        function () {
                        },
                        function () {
                        }
                    );
                }
            }
            break;
        case "ranktime":
            if (group_id && tarTime) {
                let ret = await self.getRank(group_id, tarTime).catch(function () { });
                if (ret) {
                    let retStr = "";
                    for (var rank_info of ret) {
                        retStr += rank_info.user_name + ":  " + rank_info.total + "\n";
                    }
                    wechat_proxy.sendTextMsg(wechat_proxy.user_info.UserName, userCode, retStr).then(
                        function () {
                        },
                        function () {
                        }
                    );
                }
            }
            break;
        case "audio":
            if (group_id && group_name && user_id && user_name && roundTime) {
                let clips = await self.getVoicePiece(user_id, user_name, group_id, group_name, roundTime).catch(function () { });
                if (clips) {
                    let tarFile = await self.concatVoice(user_name, group_name, clips).catch(function () { });
                    if (tarFile) {
                        wechat_proxy.uploadFile(tarFile, concat_path, wechat_proxy.user_info.UserName, "filehelper").then(
                            function (result) {
                                console.log(TAG, "上传文件最终成功！");
                                fs.unlinkSync(concat_path + tarFile);
                                wechat_proxy.sendFileMsg(wechat_proxy.user_info.UserName, userCode, result.MediaId, 'record' + '.mp3', result.StartPos).then(
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
                    }
                }
            }
            break;
        case "audiototal":
            if (group_id && group_name && user_id && user_name) {
                let clips = await self.getVoicePiece(user_id, user_name, group_id, group_name, null).catch(function () { });
                if (clips) {
                    let tarFile = await self.concatVoice(user_name, group_name, clips).catch(function () { });
                    if (tarFile) {
                        wechat_proxy.uploadFile(tarFile, concat_path, wechat_proxy.user_info.UserName, "filehelper").then(
                            function (result) {
                                console.log(TAG, "上传文件最终成功！");
                                fs.unlinkSync(concat_path + tarFile);
                                wechat_proxy.sendFileMsg(wechat_proxy.user_info.UserName, userCode, result.MediaId, 'record' + '.mp3', result.StartPos).then(
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
                    }
                }
            }
            break;
        case "audiotime":
            if (group_id && group_name && user_id && user_name && tarTime) {
                let clips = await self.getVoicePiece(user_id, user_name, group_id, group_name, tarTime).catch(function () { });
                if (clips) {
                    let tarFile = await self.concatVoice(user_name, group_name, clips).catch(function () { });
                    if (tarFile) {
                        wechat_proxy.uploadFile(tarFile, concat_path, wechat_proxy.user_info.UserName, "filehelper").then(
                            function (result) {
                                console.log(TAG, "上传文件最终成功！");
                                fs.unlinkSync(concat_path + tarFile);
                                wechat_proxy.sendFileMsg(wechat_proxy.user_info.UserName, userCode, result.MediaId, 'record' + '.mp3', result.StartPos).then(
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
                    }
                }
            }
            break;
        default:
            break;
    }
}

module.exports = DataProxy;

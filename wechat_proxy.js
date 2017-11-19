"use strict";

const https = require('https');
const fs = require("fs");
const select = require('xpath.js');
const dom = require('xmldom').DOMParser;
const querystring = require('querystring');
const crypto = require('crypto');
const data_proxy = require('./data_proxy.js').getInstance();

// export NODE_PATH="/usr/lib/node_modules:/usr/local/lib/node_modules"

var TAG = "wechat_proxy::";

var wechat_login = {
    wechat_login_host: "https://login.weixin.qq.com/jslogin?",
    appid: "wx782c26e4c19acffb",
    redirect_uri: "https%3A%2F%2Fwx.qq.com%2Fcgi-bin%2Fmmwebwx-bin%2Fwebwxnewloginpage",
    fun: "new",
    lang: "zh_CN"
}

var wechat_qrcode = {
    wechat_qrcode_host: "https://login.weixin.qq.com/qrcode/"
}

var wechat_reqForScan = {
    wechat_reqForScan_host: "https://login.wx.qq.com/cgi-bin/mmwebwx-bin/login?",
    loginicon: true,
    tip: 1 //未扫码为1，扫码后为0
}

var wechat_synccheck = {
    wechat_synccheck_host: "https://webpush.wx.qq.com/cgi-bin/mmwebwx-bin/synccheck?"
}

function WeChatProxy() {
    this.uuid = null;
    this.wxsid = null;
    this.wxuin = null;
    this.pass_ticket = null;
    this.skey = null;
    this.deviceId = "e" + ("" + Math.random().toFixed(15)).substring(2, 17);
    this.user_info = null;
    this.synckey = null;
    this.cookie = null;
    this.groups = [];
}

WeChatProxy.getInstance = function () {
    if (typeof WeChatProxy.instance !== "object") {
        WeChatProxy.instance = new WeChatProxy();
    }
    return WeChatProxy.instance;
};

WeChatProxy.prototype.getUUID = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "发送jslogin请求");

        var timestamp = Date.now();
        var login_req = wechat_login.wechat_login_host + "appid=" + wechat_login.appid + "&redirect_uri=" + wechat_login.redirect_uri + "&fun=" + wechat_login.fun + "&lang=" + wechat_login.lang + "&_=" + timestamp;
        console.log(login_req);
        https.get(login_req, (res) => {
            //console.log('statusCode:', res.statusCode);
            //console.log('headers:', res.headers);

            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var arr = buf.toString().split(";");

                var retCode_arr = arr[0].split("=");
                if (Number(retCode_arr[1].trim()) === 200) {
                    var uuid_arr = arr[1].split("= ");
                    self.uuid = uuid_arr[1].trim().split("\"")[1];
                    console.log(TAG, "获取uuid: " + self.uuid);
                    resolve(self.uuid);
                }
                else {
                    console.log(TAG, "获取uuid失败!");
                    reject(-1);
                }
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
    });
};

WeChatProxy.prototype.getQRCode = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "发送qrcode请求");

        var login_req = wechat_qrcode.wechat_qrcode_host + self.uuid;
        console.log(TAG, "获取二维码请求：", login_req);

        https.get(login_req, (res) => {
            //console.log('statusCode:', res.statusCode);
            //console.log('headers:', res.headers);

            res.setEncoding('binary');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                fs.writeFile('qrcode.jpeg', buf, 'binary', function (err) {
                    if (err) {
                        console.error(err);
                        reject(-1);
                    }
                    console.log(TAG, "二维码图片写入成功: qrcode.jpeg");
                    resolve();
                });
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
    });
};

WeChatProxy.prototype.reqForScan = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "等待扫描二维码");

        var timestamp = Date.now();
        var forScan_req = wechat_reqForScan.wechat_reqForScan_host + "loginicon=" + wechat_reqForScan.loginicon + "&uuid=" + self.uuid + "&tip=" + wechat_reqForScan.tip + "&_=" + timestamp;
        console.log(TAG, "发送扫码确认请求：", forScan_req);

        https.get(forScan_req, (res) => {
            //console.log('statusCode:', res.statusCode);
            //console.log('headers:', res.headers);

            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var arr = buf.toString().split(";");

                var retCode_arr = arr[0].split("=");
                var retCode = Number(retCode_arr[1].trim());
                if (retCode === 201) {
                    console.log(TAG, "用户扫码成功！");
                    wechat_reqForScan.tip = 0;
                    resolve(retCode);
                }
                else if (retCode === 200) {
                    console.log(TAG, "用户确认登录！");
                    wechat_reqForScan.tip = 1;

                    var uri_arr = arr[1].split("redirect_uri=");
                    var uri = uri_arr[1].trim().split("\"")[1];
                    resolve(uri);
                }
                else {
                    console.log(TAG, "获取扫码验证失败!");
                    reject(-1);
                }
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
    });
};

WeChatProxy.prototype.newLoginPage = function (req_uri) {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "获取登录信息");

        console.log(TAG, "发送获取登录信息请求：", req_uri);

        https.get(req_uri, (res) => {
            //console.log('statusCode:', res.statusCode);
            //console.log('headers:', res.headers['set-cookie']);
            self.cookie = res.headers['set-cookie'];
            console.log(self.cookie);

            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                console.log(TAG, "登录信息: ", buf);
                var doc = new dom().parseFromString(buf);
                var ret_nodes = select(doc, "/error/ret");
                var wxsid_nodes = select(doc, "/error/wxsid");
                var wxuin_nodes = select(doc, "/error/wxuin");
                var pass_ticket_nodes = select(doc, "/error/pass_ticket");
                var skey_nodes = select(doc, "/error/skey");

                if (ret_nodes[0].firstChild.data == 0) {
                    self.wxsid = wxsid_nodes[0].firstChild.data;
                    self.wxuin = wxuin_nodes[0].firstChild.data;
                    self.pass_ticket = pass_ticket_nodes[0].firstChild.data;
                    self.skey = skey_nodes[0].firstChild.data;

                    console.log(TAG, "登录信息: ", self.wxsid, self.wxuin, self.pass_ticket, self.skey);

                    resolve();
                }
                else {
                    reject(-1);
                }

            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
    });
};

WeChatProxy.prototype.initPage = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "初始化页面");

        var post_data = JSON.stringify({
            BaseRequest: {
                Uin: self.wxuin,
                Sid: self.wxsid,
                Skey: self.skey,
                DeviceID: self.deviceId
            }
        });

        console.log(post_data);

        var timestamp = Date.now();
        var options = {
            host: "wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/webwxinit?r=" + timestamp + "&lang=zh_CN&pass_ticket=" + self.pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Content-Length': post_data.length
            }
        };

        var req = https.request(options, (res) => {
            //console.log("statusCode: ", resHttps.statusCode);
            //console.log("headers: ", res.headers);

            res.setEncoding('utf8');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var data = JSON.parse(buf);
                if (data.BaseResponse.Ret == 0) {
                    self.user_info = data.User;
                    self.synckey = data.SyncKey;
                    var count = data.Count;
                    for (let i = 0; i < count; i++) {
                        //console.log(TAG, "联系人：", data.ContactList[i].UserName, data.ContactList[i].NickName);
                        //if (data.ContactList[i].MemberCount > 0) {
                        //    self.groups[data.ContactList[i].UserName] = data.ContactList[i].NickName;
                        //}
                    }
                    console.log(TAG, "成功初始化微信！", self.groups);
                    resolve();
                }
                else {
                    console.log(TAG, "初始化微信失败！");
                    reject(-1);
                }
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(post_data);
        req.end();
    });
}

WeChatProxy.prototype.statusNotify = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "打开状态通知");

        var timestamp = Date.now();
        var post_data = JSON.stringify({
            BaseRequest: {
                Uin: self.wxuin,
                Sid: self.wxsid,
                Skey: self.skey,
                DeviceID: self.deviceId
            },
            Code: 3,
            FromUserName: self.user_info.UserName,
            ToUserName: self.user_info.UserName,
            ClientMsgId: timestamp
        });

        console.log(post_data);

        var options = {
            host: "wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/webwxstatusnotify?pass_ticket=" + self.pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Content-Length': post_data.length
            }
        };

        var req = https.request(options, (res) => {
            //console.log("statusCode: ", resHttps.statusCode);
            //console.log("headers: ", resHttps.headers);

            res.setEncoding('utf8');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var data = JSON.parse(buf);
                if (data.BaseResponse.Ret == 0) {
                    var msgID = data.MsgID;
                    console.log(TAG, "成功打开状态通知！");
                    resolve();
                }
                else {
                    console.log(TAG, "打开状态通知失败！");
                    reject(-1);
                }
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(post_data);
        req.end();
    });
}

WeChatProxy.prototype.syncCheck = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "发送同步请求");

        var timestamp = Date.now();
        var deviceId = "e" + ("" + Math.random().toFixed(15)).substring(2, 17);
        var synckey = "";
        for (let i = 0; i < self.synckey.Count; i++) {
            if (i != 0) {
                synckey += "|";
            }
            synckey += self.synckey.List[i].Key + "_" + self.synckey.List[i].Val;
        }
        //var sync_req = wechat_synccheck.wechat_synccheck_host + "r=" + timestamp + "&skey=" + encodeURIComponent(self.skey) + "&sid=" + self.wxsid + "&uin=" + self.wxuin + "&deviceid=" + deviceId + "&synckey=" + encodeURIComponent(synckey) + "&_=" + timestamp;
        //console.log(TAG, "请求信息同步", sync_req);

        var get_data = JSON.stringify({});

        var options = {
            host: "webpush.wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/synccheck?" + "r=" + timestamp + "&skey=" + encodeURIComponent(self.skey) + "&sid=" + self.wxsid + "&uin=" + self.wxuin + "&deviceid=" + deviceId + "&synckey=" + encodeURIComponent(synckey) + "&_=" + timestamp,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Content-Length': get_data.length,
                'Cookie': self.cookie
            }
        };
        var req = https.request(options, (res) => {
            //console.log("statusCode: ", resHttps.statusCode);
            //console.log("headers: ", resHttps.headers);

            res.setEncoding('utf8');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var arr = buf.split("=");
                if (!arr[1] || arr[1] == undefined) {
                    reject(-1);
                }
                var retCode_arr = arr[1].split(",");
                if (retCode_arr[0].split(":")[1] == '"0"') {
                    console.log(TAG, "同步状态成功！", buf);
                    if (retCode_arr[1].split(":")[1].split('"')[1] == '2') {
                        console.log(TAG, "有新消息！");
                        self.webWxSync().then(
                            function () {
                                resolve();
                            },
                            function () {
                                reject(-3);
                            }
                        );
                    }
                    else {
                        resolve();
                    }
                }
                else {
                    console.log(TAG, "同步状态失败！");
                    reject(-1);
                }

            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(get_data);
        req.end();
    });
};

WeChatProxy.prototype.getContact = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "发送获取联系人请求");

        var timestamp = Date.now();
        var deviceId = "e" + ("" + Math.random().toFixed(15)).substring(2, 17);
        var synckey = "";
        for (let i = 0; i < self.synckey.Count; i++) {
            if (i != 0) {
                synckey += "|";
            }
            synckey += self.synckey.List[i].Key + "_" + self.synckey.List[i].Val;
        }
        //var contact_req = "https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxgetcontact?lang=zh_CN&pass_ticket=" + self.pass_ticket + "&r=" + timestamp + "&seq=0&skey=" + self.skey;
        //console.log(TAG, "请求获取联系人同步", contact_req);

        var get_data = JSON.stringify({});

        var options = {
            host: "wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/webwxgetcontact?" + "lang=zh_CN&pass_ticket=" + self.pass_ticket + "&r=" + timestamp + "&seq=0&skey=" + self.skey,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Content-Length': get_data.length,
                'Cookie': self.cookie
            }
        };

        var req = https.request(options, (res) => {
            //console.log("statusCode: ", resHttps.statusCode);
            //console.log("headers: ", resHttps.headers);

            res.setEncoding('utf8');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                //var data = JSON.parse(buf);
                console.log(buf);
                resolve();
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(get_data);
        req.end();
    });
};

WeChatProxy.prototype.webWxSync = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "同步消息");

        var timestamp = Date.now();
        var post_data = JSON.stringify({
            BaseRequest: {
                Uin: self.wxuin,
                Sid: self.wxsid,
                Skey: self.skey,
                DeviceID: self.deviceId
            },
            SyncKey: self.synckey
        });

        console.log(post_data);

        var options = {
            host: "wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/webwxsync?sid=" + self.wxsid + "&skey=" + self.skey + "&lang=zh_CN&pass_ticket=" + self.pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Content-Length': post_data.length
            }
        };

        var req = https.request(options, (res) => {
            //console.log("statusCode: ", resHttps.statusCode);
            //console.log("headers: ", resHttps.headers);

            res.setEncoding('utf8');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var data = JSON.parse(buf);
                var checkMsg = function (msg) {
                    var msgArr = msg.Content.split(":<br/>");
                    var sender = msgArr[0];
                    var detail = msgArr[1];
                    if (msg.MsgType == 34) {
                        console.log(TAG, "语音消息：", msg.MsgId, msg.VoiceLength);

                        var create_time = msg.CreateTime;
                        var path = './audio/' + self.groups[msg.FromUserName].NickName + '/' + self.groups[msg.FromUserName].members[sender];

                        fs.stat(path, function (err, stats) {
                            if (err) {
                                fs.mkdir(path, function (err) {
                                    if (err) {
                                        console.log(TAG, err);
                                    }
                                    else {
                                        self.getVoice(msg.MsgId, path, create_time).then(
                                            function () {
                                                data_proxy.update_data(self.groups[msg.FromUserName].NickName, self.groups[msg.FromUserName].members[sender], 2, msg.VoiceLength, create_time, self, msg.FromUserName, '', self.groups[msg.FromUserName].memberCount);
                                            },
                                            function () {
                                            });
                                    }
                                });
                            } else {
                                self.getVoice(msg.MsgId, path, create_time).then(
                                    function () {
                                        data_proxy.update_data(self.groups[msg.FromUserName].NickName, self.groups[msg.FromUserName].members[sender], 2, msg.VoiceLength, create_time, self, msg.FromUserName, '', self.groups[msg.FromUserName].memberCount);
                                    },
                                    function () {
                                    });
                            }
                        });

                    }
                    else if (msg.MsgType == 1) {
                        var reg = new RegExp("[\\u4E00-\\u9FFF]+", "g");
                        var length = 0;
                        var isWord = false;
                        if (reg.test(detail)) {
                            for (var i = 0; i < detail.length; i++) {
                                if (reg.test(detail.charAt(i))) {
                                    length++;
                                    isWord = false;
                                }
                                else {
                                    if (!isWord) {
                                        length++;
                                    }
                                    isWord = true;
                                }
                            }
                        }
                        else {
                            length = detail.split(" ").length;
                        }
                        console.log(TAG, "文字消息：", detail, length);

                        //var curTime = (new Date()).toLocaleString();
                        data_proxy.update_data(self.groups[msg.FromUserName].NickName, self.groups[msg.FromUserName].members[sender], 1, length, msg.CreateTime, self, msg.FromUserName, detail, self.groups[msg.FromUserName].memberCount);
                    }

                };
                var checkGroup = function (group_name) {
                    for (let i = 0; i < data_proxy.groups.length; i++) {
                        if (data_proxy.groups[i].name == group_name) {
                            return true;
                        }
                    }
                    return false;
                };
                if (data.BaseResponse.Ret == 0) {
                    console.log(TAG, "成功获取消息！");
                    self.synckey = data.SyncKey;
                    console.log(TAG, "获取消息数量：", data.AddMsgCount);
                    console.log(TAG, "获取消息内容：", data.AddMsgList);
                    for (let i = 0; i < data.AddMsgCount; i++) {
                        if (data.AddMsgList[i].FromUserName.indexOf('@@') == 0) {
                            console.log(TAG, "收到群消息");
                            var sender = data.AddMsgList[i].Content.split(":")[0];
                            if (!self.groups[data.AddMsgList[i].FromUserName]) {
                                self.getBatchContact(1, [{ UserName: data.AddMsgList[i].FromUserName, EncryChatRoomId: "" }]).then(
                                    function (ret) {
                                        console.log(ret);
                                        self.groups[data.AddMsgList[i].FromUserName] = ret[0];
                                        if (checkGroup(ret[0].NickName)) {
                                            checkMsg(data.AddMsgList[i]);
                                        }
                                    },
                                    function () {
                                        console.log(TAG, "获取群信息失败！");
                                    }
                                );
                            }
                            else {
                                if (!self.groups[data.AddMsgList[i].FromUserName].members[sender]) {
                                    self.getBatchContact(1, [{ UserName: data.AddMsgList[i].FromUserName, EncryChatRoomId: "" }]).then(
                                        function (ret) {
                                            self.groups[data.AddMsgList[i].FromUserName] = ret[0];
                                            if (checkGroup(ret[0].NickName)) {
                                                checkMsg(data.AddMsgList[i]);
                                            }
                                        },
                                        function () {
                                            console.log(TAG, "获取群信息失败！");
                                        }
                                    );
                                }
                                else {
                                    if (checkGroup(self.groups[data.AddMsgList[i].FromUserName].NickName)) {
                                        checkMsg(data.AddMsgList[i]);
                                    }
                                }

                            }


                            /*
                                                        if (self.groups[data.AddMsgList[i].FromUserName]) {
                                                            console.log(TAG, "群消息：", self.groups[data.AddMsgList[i].FromUserName], data.AddMsgList[i].Content);

                                                            //checkMsg(data.AddMsgList[i]);
                                                            if (data.AddMsgList[i].MsgType == 34) {
                                                                console.log(TAG, "语音消息：", data.AddMsgList[i].MsgId, data.AddMsgList[i].VoiceLength);

                                                                self.getVoice(data.AddMsgList[i].MsgId).then(
                                                                    function () {
                                                                    },
                                                                    function () {
                                                                    });
                                                            }
                                                            else {
                                                                if (self.groups[data.AddMsgList[i].FromUserName] == "test") {
                                                                    //self.sendTextMsg(self.user_info.UserName, data.AddMsgList[i].FromUserName, "hello");
                                                                    //self.sendFileMsg(self.user_info.UserName, data.AddMsgList[i].FromUserName);
                                                                    //var upload = function () {
                                                                    self.uploadFile('2.mp3', './audio/', self.user_info.UserName, "filehelper").then(
                                                                        function (ret) {
                                                                            console.log(TAG, "上传文件最终成功！");
                                                                            self.sendFileMsg(self.user_info.UserName, data.AddMsgList[i].FromUserName, ret.MediaId, '2.mp3', ret.StartPos).then(
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
                                                                    //}
                                                                    //upload();
                                                                }
                                                            }
                                                        }
                                                        else {
                                                            self.getBatchContact(1, [{ UserName: data.AddMsgList[i].FromUserName, EncryChatRoomId: "" }]).then(
                                                                function (ret) {
                                                                    self.groups[data.AddMsgList[i].FromUserName] = ret[0].NickName;
                                                                    console.log(TAG, "群消息：", self.groups[data.AddMsgList[i].FromUserName] + ": ", data.AddMsgList[i].Content);
                                                                    checkMsg(data.AddMsgList[i]);
                                                                },
                                                                function () {
                                                                    console.log(TAG, "获取群信息失败！");
                                                                }
                                                            );
                                                        }
                            */
                        }
                        else {
                            console.log(TAG, "收到个人消息");

                            if (data.AddMsgList[i].MsgType == 1) {
                                data_proxy.user_cmd(data.AddMsgList[i].FromUserName, data.AddMsgList[i].Content, self);
                            }

                            if (data.AddMsgList[i].FromUserName == self.user_info.UserName) {
                                /*self.uploadFile('333.mp3', './audio/', self.user_info.UserName, "filehelper").then(
                                    function (ret) {
                                        console.log(TAG, "上传文件最终成功！");
                                        self.sendFileMsg(self.user_info.UserName, data.AddMsgList[i].FromUserName, ret.MediaId, '333.mp3', ret.StartPos).then({
                                            fucntion() {

                                            },
                                            function() {

                                            }
                                        });
                                    },
                                    function () {
                                        console.log(TAG, "上传文件最终失败！");
                                    }
                                );*/
                            }
                        }

                    }
                    resolve();
                }
                else {
                    console.log(TAG, "获取消息失败！");
                    reject(-1);
                }
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(post_data);
        req.end();
    });
}

WeChatProxy.prototype.getBatchContact = function (listCount, groupList) {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "获取群信息");

        var abc = "";
        for (var Key in self.groups) {
            abc = Key;
            break;
        }

        var timestamp = Date.now();
        var post_data = JSON.stringify({
            BaseRequest: {
                Uin: self.wxuin,
                Sid: self.wxsid,
                Skey: self.skey,
                DeviceID: self.deviceId
            },
            Count: listCount,//群信息列表数量
            List: groupList
            /*List: [
                {
                    UserName: abc,//群用户ID（初始化数据中挖掘）
                    EncryChatRoomId: ""
                }
            ]*/
        });

        console.log(post_data);

        var options = {
            host: "wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/webwxbatchgetcontact?type=ex&r=" + timestamp + "&lang=zh_CN&pass_ticket=" + self.pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Content-Length': post_data.length
            }
        };

        var req = https.request(options, (res) => {
            //console.log("statusCode: ", resHttps.statusCode);
            //console.log("headers: ", resHttps.headers);

            res.setEncoding('utf8');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var data = JSON.parse(buf);
                console.log(TAG, "我的信息我的信息：", data.ContactList[0].MemberList);
                if (data.BaseResponse.Ret == 0) {
                    //var msgID = data.MsgID;
                    console.log(TAG, "成功获取群信息！");
                    var ret = [];
                    for (let i = 0; i < data.Count; i++) {
                        let tmp_obj = {};
                        tmp_obj.UserName = data.ContactList[i].UserName;
                        tmp_obj.NickName = data.ContactList[i].NickName;
                        tmp_obj.memberCount = data.ContactList[0].MemberList.length;
                        tmp_obj.members = {};
                        for (let j = 0; j < data.ContactList[0].MemberList.length; j++) {
                            tmp_obj.members[data.ContactList[0].MemberList[j].UserName] = data.ContactList[0].MemberList[j].NickName;
                        }
                        ret.push(tmp_obj);
                    }
                    resolve(ret);
                }
                else {
                    console.log(TAG, "获取群信息失败！");
                    reject(-1);
                }
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(post_data);
        req.end();
    });
}

WeChatProxy.prototype.getVoice = function (msgId, path, create_time) {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "获取语音消息");

        //var curTime = (new Date()).toLocaleString();
        var filePath = path + '/' + create_time + '.mp3';

        var get_data = JSON.stringify({});

        var options = {
            host: "wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/webwxgetvoice?msgid=" + msgId + "&skey=" + self.skey,
            method: 'GET',
            headers: {
                'Content-Length': get_data.length,
                'Cookie': self.cookie
            }
        };

        var req = https.request(options, (res) => {
            console.log('statusCode:', res.statusCode);
            console.log('headers:', res.headers);

            res.setEncoding('binary');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                fs.writeFile(filePath, buf, 'binary', function (err) {
                    if (err) {
                        console.error(err);
                        reject(-1);
                    }
                    console.log(TAG, "语音消息写入成功: ", filePath);
                    resolve();
                });
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(get_data);
        req.end();
    });
};

WeChatProxy.prototype.sendTextMsg = function (from, to, contentText) {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "发送文字消息");

        var timestamp = Date.now();
        var local = timestamp + ("" + Math.random().toFixed(4)).substring(2, 6);
        var post_data = JSON.stringify({
            BaseRequest: {
                Uin: self.wxuin,
                Sid: self.wxsid,
                Skey: self.skey,
                DeviceID: self.deviceId
            },
            Msg: {
                Type: 1,
                Content: contentText,
                FromUserName: from,
                LocalID: local,
                ToUserName: to,
                ClientMsgId: local
            },
            Scene: 0
        });

        console.log(post_data);
        var buf = new Buffer(post_data, "utf-8");
        console.log("content length:", post_data.length, buf.length);

        var options = {
            host: "wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/webwxsendmsg?lang=zh_CN&pass_ticket=" + self.pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Content-Length': buf.length
            }
        };

        var req = https.request(options, (res) => {
            //console.log("statusCode: ", resHttps.statusCode);
            //console.log("headers: ", resHttps.headers);

            res.setEncoding('utf8');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var data = JSON.parse(buf);
                console.log(data);
                if (data.BaseResponse.Ret == 0) {
                    console.log(TAG, "成功发送消息");
                    resolve();
                }
                else {
                    console.log(TAG, "发送消息失败");
                    reject(-1);
                }
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(post_data);
        req.end();
    });
}

WeChatProxy.prototype.uploadPre = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "预发送文件消息");

        var post_data = JSON.stringify({
        });

        var options = {
            host: "file.wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/webwxuploadmedia?f=json",
            method: 'OPTIONS',
            headers: {
                'Access-Control-Request-Method': 'POST'
            }
        };

        var req = https.request(options, (res) => {
            //console.log("statusCode: ", resHttps.statusCode);
            //console.log("headers: ", resHttps.headers);

            res.setEncoding('utf8');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var data = JSON.parse(buf);
                if (data.BaseResponse.Ret == 1) {
                    console.log(TAG, "预上传文件成功", buf);
                    resolve();
                }
                else {
                    console.log(TAG, "预上传文件失败", buf);
                    resolve();
                }
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(post_data);
        req.end();
    });
}

WeChatProxy.prototype.uploadFile = function (fileName, path, from, to) {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "发送文件消息");

        var timestamp = Date.now();
        var stat = fs.statSync(path + fileName);
        var data = fs.readFileSync(path + fileName);

        console.log("文件大小：", Buffer.byteLength(data));

        var md5Code = crypto.createHash('md5').update(data, 'binary').digest('hex');

        var data_ticket = self.cookie.toString().split('webwx_data_ticket=')[1].split(';')[0];
        console.log(TAG, "data_ticket", data_ticket);

        var post_data = JSON.stringify({
            UploadType: 2,
            BaseRequest: {
                Uin: self.wxuin,
                Sid: self.wxsid,
                Skey: self.skey,
                DeviceID: self.deviceId
            },
            ClientMediaId: timestamp,
            TotalLen: stat.size,
            StartPos: 0,
            DataLen: stat.size,
            MediaType: 4,
            FromUserName: from,
            ToUserName: to,
            FileMd5: md5Code
        });

        var boundary = '----WebKitFormBoundary' + 'Z5u1uzDeZ7s9OqZC';//Math.random().toFixed(16).substring(2, 17);
        var boundaryGroup = '--' + boundary + '\r\n';

        var payload = boundaryGroup + 'Content-Disposition: form-data; name="id"\r\n\r\n' + 'WU_FILE_0' + '\r\n'
            + boundaryGroup + 'Content-Disposition: form-data; name="name"\r\n\r\n' + fileName + '\r\n'
            + boundaryGroup + 'Content-Disposition: form-data; name="type"\r\n\r\n' + 'audio/mp3' + '\r\n'
            + boundaryGroup + 'Content-Disposition: form-data; name="lastModifiedDate"\r\n\r\n' + stat.mtime + '\r\n'
            + boundaryGroup + 'Content-Disposition: form-data; name="size"\r\n\r\n' + stat.size + '\r\n'
            + boundaryGroup + 'Content-Disposition: form-data; name="mediatype"\r\n\r\n' + 'doc' + '\r\n'
            + boundaryGroup + 'Content-Disposition: form-data; name="uploadmediarequest"\r\n\r\n' + post_data + '\r\n'
            + boundaryGroup + 'Content-Disposition: form-data; name="webwx_data_ticket"\r\n\r\n' + data_ticket + '\r\n'
            + boundaryGroup + 'Content-Disposition: form-data; name="pass_ticket"\r\n\r\n' + self.pass_ticket + '\r\n'
            + boundaryGroup + 'Content-Disposition: form-data; name="filename"; filename="' + fileName + '"\r\nContent-Type: audio/mp3' + '\r\n\r\n';
        var enddata = '\r\n--' + boundary + '--\r\n';

        var options = {
            host: "file.wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/webwxuploadmedia?f=json",
            method: 'POST',
            headers: {
                'Content-Length': Buffer.byteLength(payload) + stat.size + Buffer.byteLength(enddata),
                'Content-Type': 'multipart/form-data; boundary=' + boundary
            }
        };

        //console.log(payload + data + enddata);
        //console.log("数据大小：", Buffer.byteLength(payload + data + enddata));
        console.log("数据大小：", Buffer.byteLength(payload) + stat.size + Buffer.byteLength(enddata));


        var req = https.request(options, (res) => {
            //console.log("statusCode: ", resHttps.statusCode);
            //console.log("headers: ", resHttps.headers);

            res.setEncoding('utf8');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var data = JSON.parse(buf);
                if (data.BaseResponse.Ret == 0) {
                    console.log(TAG, "上传文件成功", buf);
                    resolve(data);
                }
                else {
                    console.log(TAG, "上传文件失败", buf);
                    reject(-1);
                }
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(payload);
        req.write(data);
        req.write(enddata);

        req.end();
    });
}

WeChatProxy.prototype.sendFileMsg = function (from, to, mediaId, filename, size) {
    var self = this;

    return new Promise(function (resolve, reject) {
        console.log(TAG, "发送文件消息");

        var timestamp = Date.now();
        var local = timestamp + ("" + Math.random().toFixed(4)).substring(2, 6);
        var post_data = JSON.stringify({
            BaseRequest: {
                Uin: self.wxuin,
                Sid: self.wxsid,
                Skey: self.skey,
                DeviceID: self.deviceId
            },
            Msg: {
                Type: 6,
                Content: "<appmsg appid='wxeb7ec651dd0aefa9' sdkver=''><title>" + filename + "</title><des></des><action></action><type>6</type><content></content><url></url><lowurl></lowurl><appattach><totallen>" + size + "</totallen><attachid>" + mediaId + "</attachid><fileext>mp3</fileext></appattach><extinfo></extinfo></appmsg>",
                FromUserName: from,
                LocalID: local,
                ToUserName: to,
                ClientMsgId: local
            },
            Scene: 0
        });

        console.log(post_data);

        var options = {
            host: "wx.qq.com",
            path: "/cgi-bin/mmwebwx-bin/webwxsendappmsg?fun=async&f=json&lang=zh_CN&pass_ticket=" + self.pass_ticket,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Content-Length': post_data.length,
                'Cookie': self.cookie
            }
        };

        var req = https.request(options, (res) => {
            //console.log("statusCode: ", resHttps.statusCode);
            //console.log("headers: ", resHttps.headers);

            res.setEncoding('utf8');
            var buf = '';
            res.on('data', (d) => {
                buf += d;
            });

            res.on('end', () => {
                var data = JSON.parse(buf);
                if (data.BaseResponse.Ret == 0) {
                    console.log(TAG, "成功发送消息");
                    resolve();
                }
                else {
                    console.log(TAG, "发送消息失败");
                    reject(-1);
                }
            });
        }).on('error', (e) => {
            console.error(TAG, e);
            reject(-2);
        });
        req.write(post_data);
        req.end();
    });
}

module.exports = WeChatProxy;
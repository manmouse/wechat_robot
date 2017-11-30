"use strict";

const https = require('https');
const http = require('http');
const fs = require("fs");
const select = require('xpath.js');
const dom = require('xmldom').DOMParser;

const wechat_proxy = require('./wechat_proxy.js').getInstance();
const audio_proxy = require('./audio_proxy.js').getInstance();
const mysql_proxy = require('./mysql_proxy.js').getInstance();
const data_proxy = require('./data_proxy.js').getInstance();

// export NODE_PATH="/usr/lib/node_modules:/usr/local/lib/node_modules"
var TAG = "Main::";


//mysql_proxy.connect();
mysql_proxy.createPool();
// 载入数据
data_proxy.loadData();

var getUUID = function () {
	console.log(TAG, "请求UUID");
	wechat_proxy.getUUID().then(
		function (uuid) {
			console.log(TAG, "获取UUID成功：", uuid);
			getQRCode();
		},
		function (errcode) {
			console.log(TAG, "获取UUID失败：", errcode);
			setTimeout(getUUID, 5000);
		});
}

var getQRCode = function () {
	wechat_proxy.getQRCode().then(
		function () {
			http.createServer(function (request, response) {
				response.writeHead(200, { 'Content-Type': 'text/plain' });

				var content = fs.readFileSync("./qrcode.jpeg", "binary");
				response.writeHead(200, "Ok");
				response.write(content, "binary"); //格式必须为 binary，否则会出错
				response.end();
			}).listen(8888);

			reqForScan();
		},
		function () {

		});
}

var reqForScan = function () {
	wechat_proxy.reqForScan().then(
		function (ret) {
			if (ret == 201) {
				reqForScan();
			}
			else {
				newLoginPage(ret);
			}
		},
		function () {

		});
}

var newLoginPage = function (uri) {
	wechat_proxy.newLoginPage(uri).then(
		function (ret) {
			initPage();
		},
		function () {

		});
}

var initPage = function () {
	wechat_proxy.initPage().then(
		function (ret) {
			statusNotify();
			//wechat_proxy.getBatchContact();
		},
		function () {

		});
}

var statusNotify = function () {
	wechat_proxy.statusNotify().then(
		function (ret) {
			getContact();
		},
		function () {
			setTimeout(statusNotify, 3000);
		});
}

var getContact = function () {
	wechat_proxy.getContact().then(
		function (ret) {
			syncCheck();
			//wechat_proxy.getBatchContact();
		},
		function () {
			setTimeout(getContact, 3000);
		});
}

var syncCheck = function () {
	wechat_proxy.syncCheck().then(
		function (ret) {
			setTimeout(syncCheck, 5000);
		},
		function () {
			setTimeout(syncCheck, 5000);
		});
}

getUUID();
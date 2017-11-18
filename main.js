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


mysql_proxy.connect();
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

//var data = fs.readFileSync('aaa.txt');

//console.log("文件大小：", Buffer.byteLength(data));

//var stat = fs.statSync('./audio/2.mp3');
//console.log(stat.mtime);



/*
var files = fs.readdirSync('./audio');

var clips = [];

files.forEach(function (file) {
	if (file.indexOf('.') != 0) {
		clips.push(file);
	}
});

clips.sort(function (a, b) {
	return a - b;
});

console.log(clips);

audio_proxy.concatAudio(clips, './audio/', 'new.mp3').then(
	function () {
		console.log(TAG, "合并语音成功");
	},
	function () {
		console.log(TAG, "合并语音失败");
	});
*/
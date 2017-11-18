"use strict";

const fs = require("fs");

var TAG = "audio_proxy::";

function AudioProxy() {
}

AudioProxy.getInstance = function () {
    if (typeof AudioProxy.instance !== "object") {
        AudioProxy.instance = new AudioProxy();
    }
    return AudioProxy.instance;
};

AudioProxy.prototype.concatAudio = function (filesArr, srcPath, tarFile) {
    var self = this;

    return new Promise(function (resolve, reject) {
        var target = fs.createWriteStream(tarFile);
        var curFile, streamCur;

        var concatAudioArr = function () {
            if (!filesArr.length) {
                target.end("Done");
                resolve();
                return;
            }
            curFile = srcPath + filesArr.shift();
            streamCur = fs.createReadStream(curFile);
            streamCur.pipe(target, { end: false });
            streamCur.on("end", function () {
                console.log(TAG, curFile + ' appended');
                concatAudioArr();

            });
            streamCur.on('error', function (err) {
                reject(-1);
            });
        }

        concatAudioArr();
    });
}

module.exports = AudioProxy;
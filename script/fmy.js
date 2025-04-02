/*
------------------------------------------
@Author: Your Name
@Date: 2024.07.01
@Description: 飞蚂蚁 每日签到和步数兑换(每天三次)
------------------------------------------

重写：打开飞蚂蚁小程序，进行登录操作

[Script]
http-response ^https:\/\/openapp\.fmy90\.com\/auth\/wx\/login script-path=https://raw.githubusercontent.com/username/repository/fmy.js, requires-body=true, timeout=60, tag=飞蚂蚁获取token

[MITM]
hostname = openapp.fmy90.com

⚠️【免责声明】
------------------------------------------
1、此脚本仅用于学习研究，不保证其合法性、准确性、有效性，请根据情况自行判断，本人对此不承担任何保证责任。
2、由于此脚本仅用于学习研究，您必须在下载后 24 小时内将所有内容从您的计算机或手机或任何存储设备中完全删除，若违反规定引起任何事件本人对此均不负责。
3、请勿将此脚本用于任何商业或非法目的，若违反规定请自行对此负责。
4、此脚本涉及应用与本人无关，本人对因此引起的任何隐私泄漏或其他后果不承担任何责任。
5、本人对任何脚本引发的问题概不负责，包括但不限于由脚本错误引起的任何损失和损害。
6、如果任何单位或个人认为此脚本可能涉嫌侵犯其权利，应及时通知并提供身份证明，所有权证明，我们将在收到认证文件确认后删除此脚本。
7、所有直接或间接使用、查看此脚本的人均应该仔细阅读此声明。本人保留随时更改或补充此声明的权利。一旦您使用或复制了此脚本，即视为您已接受此免责声明。
*/
const $ = new Env("飞蚂蚁");
const ckName = "fmy_data";
const userCookie = $.toObj($.isNode() ? process.env[ckName] : $.getdata(ckName)) || [];
//notify
const notify = $.isNode() ? require('./sendNotify') : '';
$.notifyMsg = []
//debug
$.is_debug = ($.isNode() ? process.env.IS_DEDUG : $.getdata('is_debug')) || 'false';
$.doFlag = { "true": "✅", "false": "⛔️" };

// 运行模式
$.runMode = 'signin'; // 默认为签到模式

//------------------------------------------
const baseUrl = "https://openapp.fmy90.com"
const _headers = {
    "Host": "openapp.fmy90.com",
    "content-type": "application/json;charset=utf8",
    "device-version": "iOS 17.5.1",
    "device-model": "iPhone 14<iPhone14,7>",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.57(0x1800392b) NetType/WIFI Language/zh_CN",
    "Referer": "https://servicewechat.com/wx501990400906c9ff/443/page-frame.html",
    "Authorization": ""
};

const fetch = async (o) => {
    try {
        if (typeof o === 'string') o = { url: o };
        if (o?.url?.startsWith("/") || o?.url?.startsWith(":")) o.url = baseUrl + o.url
        const res = await Request({ ...o, headers: o.headers || _headers, url: o.url })
        debug(res, o?.url?.replace(/\/+$/, '').substring(o?.url?.lastIndexOf('/') + 1));
        return res;
    } catch (e) {
        $.ckStatus = false;
        $.log(`⛔️ 请求发起失败！${e}`);
    }
}
//------------------------------------------
async function main() {
    try {
        // 判断当前运行模式
        const scriptName = $argument || process.argv[1] || '';
        if (scriptName.includes('exchange')) {
            $.runMode = 'exchange';
        }

        //check accounts
        if (!userCookie?.length) throw new Error("no available accounts found");
        $.log(`⚙️ a total of ${userCookie?.length ?? 0} accounts were identified during this operation.`);
        let index = 0;
        //doTask of userList
        for (let user of userCookie) {
            //init of user
            $.log(`\n🚀 user:${user?.userName || ++index} start work\n`),
                $.notifyMsg = [],
                $.ckStatus = true,
                $.title = "",
                _headers["Authorization"] = `bearer ${user.token}`;

            // 根据运行模式执行不同任务
            if ($.runMode === 'signin') {
                await doSignIn();
                if ($.ckStatus) {
                    DoubleLog(`「${user.userName}」签到完成`);
                } else {
                    DoubleLog(`⛔️ 「${user.userName ?? `账号${index}`}」签到失败，请检查token是否有效`);
                }
            } else if ($.runMode === 'exchange') {
                await doExchangeSteps();
                if ($.ckStatus) {
                    DoubleLog(`「${user.userName}」步数兑换完成`);
                } else {
                    DoubleLog(`⛔️ 「${user.userName ?? `账号${index}`}」步数兑换失败，请检查token是否有效`);
                }
            }

            //notify
            await sendMsg($.notifyMsg.join("\n"));
        }
    } catch (e) {
        throw e
    }
}

//执行签到
async function doSignIn() {
    try {
        const options = {
            url: `${baseUrl}/sign/new/do`,
            headers: _headers,
            body: {
                "version": "V2.00.01",
                "platformKey": "F2EE24892FBF66F0AFF8C0EB532A9394",
                "mini_scene": 1089,
                "partner_ext_infos": ""
            }
        };
        let res = await fetch(options);
        if (res?.code != 200) throw new Error(`签到失败: ${res?.message || "未知错误"}`);

        let signMsg = `签到成功: ${res?.message || "获取成功"}`;
        $.log(`${$.doFlag[res?.code == 200]} ${signMsg}`);
        $.notifyMsg.push(signMsg);
        return signMsg;
    } catch (e) {
        $.ckStatus = false;
        $.log(`⛔️ 签到执行失败！原因为${e}`);
        $.notifyMsg.push(`签到失败: ${e}`);
    }
}

//执行步数兑换
async function doExchangeSteps() {
    try {
        // 随机生成8000-12000之间的步数
        const randomSteps = Math.floor(Math.random() * (12000 - 8000 + 1)) + 8000;

        // 先获取当前可兑换次数
        const checkOptions = {
            url: `${baseUrl}/step/exchange/check`,
            headers: _headers
        };

        let checkRes = await fetch(checkOptions);
        if (checkRes?.code != 200) throw new Error(`获取兑换次数失败: ${checkRes?.message || "未知错误"}`);

        const remainingTimes = checkRes?.data?.remainingTimes || 0;
        if (remainingTimes <= 0) {
            const noTimesMsg = `今日兑换次数已用完，无法继续兑换`;
            $.log(`${$.doFlag.false} ${noTimesMsg}`);
            $.notifyMsg.push(noTimesMsg);
            return noTimesMsg;
        }

        // 执行兑换
        const options = {
            url: `${baseUrl}/step/exchange`,
            headers: _headers,
            body: {
                "steps": randomSteps,
                "version": "V2.00.01",
                "platformKey": "F2EE24892FBF66F0AFF8C0EB532A9394",
                "mini_scene": 1089,
                "partner_ext_infos": ""
            }
        };
        let res = await fetch(options);
        if (res?.code != 200) throw new Error(`步数兑换失败: ${res?.message || "未知错误"}`);

        let exchangeMsg = `步数兑换成功: 兑换了${randomSteps}步 ${res?.message || ""}`;
        $.log(`${$.doFlag[res?.code == 200]} ${exchangeMsg}`);
        $.notifyMsg.push(exchangeMsg);

        // 再次获取剩余次数
        checkRes = await fetch(checkOptions);
        if (checkRes?.code == 200) {
            const newRemainingTimes = checkRes?.data?.remainingTimes || 0;
            const remainingMsg = `剩余兑换次数: ${newRemainingTimes}次`;
            $.log(`${$.doFlag.true} ${remainingMsg}`);
            $.notifyMsg.push(remainingMsg);
        }

        return exchangeMsg;
    } catch (e) {
        $.ckStatus = false;
        $.log(`⛔️ 步数兑换执行失败！原因为${e}`);
        $.notifyMsg.push(`步数兑换失败: ${e}`);
    }
}

//获取Cookie
async function getCookie() {
    try {
        if ($request && $request.method === 'OPTIONS') return;

        const body = $.toObj($response.body);
        if (!body?.data?.token) throw new Error("获取token失败，返回数据异常");

        const token = body.data.token;
        const userId = body.data.user.userId;
        const userName = body.data.user.userName || body.data.user.mobile;

        const newData = {
            "userId": userId,
            "token": token,
            "userName": userName,
        }

        const index = userCookie.findIndex(e => e.userId == newData.userId);
        userCookie[index] ? userCookie[index] = newData : userCookie.push(newData);

        $.setjson(userCookie, ckName);
        $.msg($.name, `🎉${newData.userName}更新token成功!`, ``);

    } catch (e) {
        $.msg($.name, `❌获取token失败`, e.message || e);
        throw e;
    }
}

//主程序执行入口
!(async () => {
    try {
        if (typeof $request != "undefined") {
            await getCookie();
        } else {
            await main();
        }
    } catch (e) {
        $.log("", `❌失败! 原因: ${e}!`, "");
        $.notifyMsg.push(`❌失败! 原因: ${e}!`);
        await sendMsg($.notifyMsg.join('\n'));
    } finally {
        $.done();
    }
})();

//debug
function debug(content, title = "") {
    let start = `\n----- ${title} -----\n`;
    if ($.is_debug === 'true') {
        if (typeof content == "string") {
            $.log(start, content, "\n------------end------------");
        } else if (typeof content == "object") {
            $.log(start, $.toStr(content), "\n------------end------------");
        }
    }
}

//双平台log输出
function DoubleLog(data) {
    if ($.isNode()) {
        if (data) {
            $.log(`${data}`);
            $.notifyMsg.push(`${data}`);
        }
    } else {
        $.log(`${data}`);
        $.notifyMsg.push(`${data}`);
    }
}

//发送消息
async function sendMsg(message) {
    if (!message) return;
    try {
        if ($.isNode()) {
            await notify.sendNotify($.name, message)
        } else {
            $.msg($.name, '', message)
        }
    } catch (e) {
        $.log('发送通知失败', e);
    }
}

// 请求函数
function Request(options) {
    return new Promise((resolve, reject) => {
        if (!options.method) {
            options.method = options.body ? 'POST' : 'GET';
        }
        if (options.method.toUpperCase() === 'POST' && !options.headers) {
            options.headers = {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }
        if (options.body && typeof options.body !== 'string') {
            options.body = JSON.stringify(options.body);
        }
        $.http[options.method.toLowerCase()](options)
            .then(response => {
                try {
                    const res = response.body ? JSON.parse(response.body) : response;
                    resolve(res);
                } catch (e) {
                    $.log(`解析响应数据发生错误: ${e}`);
                    resolve(response);
                }
            })
            .catch(err => {
                $.log(`请求发生错误: ${err}`);
                reject(err);
            });
    });
}
// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}isStash(){return"undefined"!=typeof $environment&&$environment["stash-version"]}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,a]=i.split("@"),n={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".\$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),a=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){if(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:i,statusCode:r,headers:o,rawBody:a}=t,n=s.decode(a,this.encoding);e(null,{status:i,statusCode:r,headers:o,rawBody:a,body:n},n)},t=>{const{message:i,response:r}=t;e(i,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let i=require("iconv-lite");this.initGotEnv(t);const{url:r,...o}=t;this.got[s](r,o).then(t=>{const{statusCode:s,statusCode:r,headers:o,rawBody:a}=t,n=i.decode(a,this.encoding);e(null,{status:s,statusCode:r,headers:o,rawBody:a,body:n},n)},t=>{const{message:s,response:r}=t;e(s,r,r&&i.decode(r.rawBody,this.encoding))})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.\$1,(s.getFullYear()+"").substr(4-RegExp.\$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.\$1,1==RegExp.\$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl,i=t["update-pasteboard"]||t.updatePasteboard;return{"open-url":e,"media-url":s,"update-pasteboard":i}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}

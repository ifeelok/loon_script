/*
飞蚂蚁小程序 每日签到和步数兑换
功能：每日签到、步数兑换(8000-12000随机步数)
变量：fmytoken 多账号@分割

定时：一天一次
cron: 30 8 * * *

*/

const $ = new Env('飞蚂蚁小程序');
const notify = $.isNode() ? require('./sendNotify') : '';
let fmytoken = $.isNode() ? (process.env.fmytoken ? process.env.fmytoken : '') : ($.getdata('fmytoken') ? $.getdata('fmytoken') : '');
let fmytokenArr = [];
let message = '';
let userInfo = '';
let runMode = 0; // 0为签到和步数兑换都执行，1为只执行签到，2为只执行步数兑换

!(async () => {
    if (typeof $request !== "undefined") {
        await getToken();
    } else {
        if (!fmytoken) {
            $.msg($.name, '【提示】请先获取飞蚂蚁小程序的token', '小程序首页点击"签到"获取', {
                "open-url": ""
            });
            return;
        }
        if (fmytoken.indexOf('@') != -1) {
            fmytokenArr = fmytoken.split('@');
        } else {
            fmytokenArr = [fmytoken];
        }
        console.log(`------------- 共${fmytokenArr.length}个账号-------------\n`);
        for (let i = 0; i < fmytokenArr.length; i++) {
            if (fmytokenArr[i]) {
                fmytoken = fmytokenArr[i];
                $.index = i + 1;
                console.log(`\n开始【第 ${$.index} 个账号】`);

                // 获取用户信息
                await getUserInfo();

                // 根据运行模式执行不同任务
                if (runMode === 0 || runMode === 1) {
                    await doSign(); // 执行签到
                    await $.wait(1000); // 等待1秒
                }

                if (runMode === 0 || runMode === 2) {
                    await exchangeSteps(); // 执行步数兑换
                }
            }
        }
        if (message) {
            if ($.isNode()) {
                await notify.sendNotify($.name, message);
            } else {
                $.msg($.name, '', message);
            }
        }
    }
})()
    .catch((e) => {
        $.log('', `❌ ${$.name}, 失败! 原因: ${e}!`, '')
    })
    .finally(() => {
        $.done();
    })

// 获取用户信息
function getUserInfo() {
    return new Promise((resolve) => {
        const options = {
            url: `https://api.fmapp.com/h5/user/info`,
            headers: {
                'Host': 'api.fmapp.com',
                'Content-Type': 'application/json',
                'token': fmytoken
            }
        }
        $.get(options, async (err, resp, data) => {
            try {
                if (err) {
                    console.log(`${JSON.stringify(err)}`)
                    console.log(`${$.name} 获取用户信息API请求失败，请检查网路重试`)
                } else {
                    if (data) {
                        const result = JSON.parse(data);
                        if (result.code === 200) {
                            userInfo = `账号: ${result.data.nickname || '未知用户'} 当前积分: ${result.data.integral || 0}`;
                            console.log(`获取用户信息成功: ${userInfo}`);
                        } else {
                            console.log(`获取用户信息失败: ${result.msg}`);
                        }
                    } else {
                        console.log(`获取用户信息异常，请检查网络或账号`);
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

// 执行签到
function doSign() {
    return new Promise((resolve) => {
        const options = {
            url: `https://api.fmapp.com/h5/sign/doSign`,
            headers: {
                'Host': 'api.fmapp.com',
                'Content-Type': 'application/json',
                'token': fmytoken
            }
        }
        $.post(options, async (err, resp, data) => {
            try {
                if (err) {
                    console.log(`${JSON.stringify(err)}`)
                    console.log(`${$.name} 签到API请求失败，请检查网路重试`)
                } else {
                    if (data) {
                        const result = JSON.parse(data);
                        if (result.code === 200) {
                            console.log(`签到成功: 获得 ${result.data.integral || 0} 积分`);
                            message += `${userInfo}\n签到成功: 获得 ${result.data.integral || 0} 积分\n`;
                        } else if (result.code === 500 && result.msg.includes('已签到')) {
                            console.log(`今日已签到`);
                            message += `${userInfo}\n今日已签到\n`;
                        } else {
                            console.log(`签到失败: ${result.msg}`);
                            message += `${userInfo}\n签到失败: ${result.msg}\n`;
                        }
                    } else {
                        console.log(`签到异常，请检查网络或账号`);
                        message += `${userInfo}\n签到异常，请检查网络或账号\n`;
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

// 执行步数兑换
function exchangeSteps() {
    return new Promise((resolve) => {
        // 随机生成8000-12000的步数
        const steps = Math.floor(Math.random() * (12000 - 8000 + 1)) + 8000;

        const options = {
            url: `https://api.fmapp.com/h5/step/exchange`,
            headers: {
                'Host': 'api.fmapp.com',
                'Content-Type': 'application/json',
                'token': fmytoken
            },
            body: JSON.stringify({ "steps": steps })
        }

        $.post(options, async (err, resp, data) => {
            try {
                if (err) {
                    console.log(`${JSON.stringify(err)}`)
                    console.log(`${$.name} 步数兑换API请求失败，请检查网路重试`)
                } else {
                    if (data) {
                        const result = JSON.parse(data);
                        if (result.code === 200) {
                            console.log(`步数兑换成功: ${steps}步 兑换 ${result.data.integral || 0} 积分`);
                            message += `步数兑换成功: ${steps}步 兑换 ${result.data.integral || 0} 积分\n`;
                        } else if (result.code === 500 && result.msg.includes('已兑换')) {
                            console.log(`今日已兑换步数`);
                            message += `今日已兑换步数\n`;
                        } else {
                            console.log(`步数兑换失败: ${result.msg}`);
                            message += `步数兑换失败: ${result.msg}\n`;
                        }
                    } else {
                        console.log(`步数兑换异常，请检查网络或账号`);
                        message += `步数兑换异常，请检查网络或账号\n`;
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

// 获取token
function getToken() {
    if ($request.url.indexOf("doSign") > -1) {
        const token = $request.headers.token || $request.headers.Token;
        if (token) {
            $.setdata(token, 'fmytoken');
            $.msg($.name, "", `获取飞蚂蚁Token成功🎉`);
        } else {
            $.msg($.name, "", `获取飞蚂蚁Token失败⚠️`);
        }
    }
}

// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}isStash(){return"undefined"!=typeof $environment&&$environment["stash-version"]}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,a]=i.split("@"),n={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".\$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),a=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){if(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:i,statusCode:r,headers:o,rawBody:a}=t,n=s.decode(a,this.encoding);e(null,{status:i,statusCode:r,headers:o,rawBody:a,body:n},n)},t=>{const{message:i,response:r}=t;e(i,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t&&t.error||"UndefinedError"));else if(this.isNode()){let i=require("iconv-lite");this.initGotEnv(t);const{url:r,...o}=t;this.got[s](r,o).then(t=>{const{statusCode:s,statusCode:r,headers:o,rawBody:a}=t,n=i.decode(a,this.encoding);e(null,{status:s,statusCode:r,headers:o,rawBody:a,body:n},n)},t=>{const{message:s,response:r}=t;e(s,r,r&&i.decode(r.rawBody,this.encoding))})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.\$1,(s.getFullYear()+"").substr(4-RegExp.\$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.\$1,1==RegExp.\$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl,i=t["update-pasteboard"]||t.updatePasteboard;return{"open-url":e,"media-url":s,"update-pasteboard":i}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}

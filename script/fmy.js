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
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}isStash(){return"undefined"!=typeof $environment&&$environment["stash-version"]}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,a]=i.split("@"),n={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/$$(\d+)$$/g,".\$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),a=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}

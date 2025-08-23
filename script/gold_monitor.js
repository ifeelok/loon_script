/******************************************
 * @description 实时获取10家主流品牌黄金价格
 * @version 1.0.0
 ******************************************/

(() => {
    "use strict";

    // 1. 环境检测与基础工具
    const env = (() => {
        const globals = Object.keys(globalThis);
        if (globals.includes("$task")) return "Quantumult X";
        if (globals.includes("$loon")) return "Loon";
        if (globals.includes("$rocket")) return "Shadowrocket";
        if (globals.includes("$environment")) {
            return $environment["surge-version"] ? "Surge" : $environment["stash-version"] ? "Stash" : "Unknown";
        }
        return "Unknown";
    })();

    const logger = {
        log: (...args) => console.log(`[黄金监控] ${args.filter(Boolean).join(" ")}`),
        warn: (...args) => console.log(`[黄金监控][警告] ${args.filter(Boolean).join(" ")}`),
        error: (...args) => console.log(`[黄金监控][错误] ${args.filter(Boolean).join(" ")}`)
    };

    const request = (options) => {
        return new Promise((resolve, reject) => {
            if (!options.url) {
                reject(new Error("请求URL不能为空"));
                return;
            }

            const method = (options.method || "GET").toLowerCase();
            const requestOptions = {
                url: options.url,
                headers: options.headers || {},
                timeout: options.timeout || 20000 // 黄金接口响应较慢，延长超时
            };

            try {
                switch (env) {
                    case "Quantumult X":
                        $task.fetch(requestOptions).then(
                            (res) => resolve({ status: res.statusCode || "未知", body: res.body || "" }),
                            (err) => reject(new Error(`请求失败: ${err.message}`))
                        );
                        break;
                    case "Loon":
                    case "Surge":
                    case "Shadowrocket":
                    case "Stash":
                        $httpClient[method](requestOptions, (err, res, data) => {
                            err ? reject(new Error(`请求失败: ${err.message}`)) :
                                resolve({ status: res.statusCode || res.status || "未知", body: data || "" });
                        });
                        break;
                    default:
                        reject(new Error(`不支持的环境: ${env}`));
                }
            } catch (e) {
                reject(new Error(`请求初始化异常: ${e.message}`));
            }
        });
    };

    const notify = (title, content) => {
        try {
            const plainContent = content.replace(/[#*|`]/g, "").trim();
            const plainTitle = title.replace(/[#*|`]/g, "").trim();

            switch (env) {
                case "Quantumult X":
                    $notify({ title: plainTitle, content: plainContent });
                    break;
                case "Loon":
                case "Surge":
                case "Shadowrocket":
                case "Stash":
                    $notification.post(plainTitle, "", plainContent);
                    break;
                default:
                    logger.log(`[本地通知] ${plainTitle}\n${plainContent}`);
            }
            logger.log("黄金通知发送成功");
        } catch (e) {
            logger.error("通知发送失败:", e.message);
        }
    };

    // 2. 核心配置
    const goldMap = {
        "周大生黄金": { code: "JO_52678", icon: "👑" },
        "周六福黄金": { code: "JO_42653", icon: "🌟" },
        "老凤祥黄金": { code: "JO_42657", icon: "🐦" },
        "周大福黄金": { code: "JO_42660", icon: "🏆" },
        "老庙黄金": { code: "JO_42634", icon: "🏅" },
        "菜百黄金": { code: "JO_42638", icon: "🥇" },
        "周生生黄金": { code: "JO_42625", icon: "💎" },
        "潮宏基黄金": { code: "JO_52670", icon: "🌙" },
        "金至尊黄金": { code: "JO_42632", icon: "⭐" },
        "六福珠宝黄金": { code: "JO_56044", icon: "🔶" }
    };
    let goldContent = "";

    // 3. 时间工具
    const getBeijingTime = () => {
        return new Date().toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }).replace(/\//g, "-");
    };

    const formatTime = (timeData) => {
        if (!timeData || timeData === "未知") return "未知";
        try {
            const timestamp = typeof timeData === "string" ? new Date(timeData).getTime() : timeData;
            return new Date(timestamp).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
                hour: "2-digit",
                minute: "2-digit"
            }).replace(/\//g, "-");
        } catch (e) {
            return "未知";
        }
    };

    // 4. 黄金价格获取与处理
    // 解析var quote_json格式数据
    const parseGoldResponse = (rawContent) => {
        const targetPrefix = "var quote_json = ";
        const lowerRaw = rawContent.toLowerCase();
        const lowerPrefix = targetPrefix.toLowerCase();
        const prefixIndex = lowerRaw.indexOf(lowerPrefix);

        if (prefixIndex !== -1) {
            // 移除前缀和末尾分号
            let jsonStr = rawContent.substring(prefixIndex + targetPrefix.length).replace(/;$/, "").trim();
            return JSON.parse(jsonStr);
        } else if (rawContent.startsWith("{")) {
            return JSON.parse(rawContent);
        } else {
            throw new Error(`未识别格式，前100字符: ${rawContent.substring(0, 100)}`);
        }
    };

    // 处理黄金价格数据（压缩格式）
    const processGoldPrices = (goldData) => {
        const goldLines = [];
        goldLines.push(`💎 国内黄金价格（元/克）`);

        for (const [name, { code, icon }] of Object.entries(goldMap)) {
            const merchantData = goldData[code];
            if (!merchantData) {
                goldLines.push(`${icon} ${name}：无数据`);
                continue;
            }

            const price = merchantData.q63; // 有效价格字段
            const updateTime = formatTime(merchantData.time);

            if (typeof price !== "number" || price <= 0) {
                goldLines.push(`${icon} ${name}：价格无效`);
                continue;
            }

            goldLines.push(`${icon} ${name}：${price.toFixed(2)}（${updateTime}更新）`);
        }

        goldLines.push("📌 涨跌数据暂未返回（接口限制）");
        goldContent = goldLines.join("\n");
    };

    // 主黄金获取逻辑
    const fetchGoldPrices = async () => {
        logger.log("开始获取黄金价格...");
        try {
            const codes = Object.values(goldMap).map(item => item.code).join(",");
            const goldUrl = `https://api.jijinhao.com/quoteCenter/realTime.htm?codes=${codes}&_=${Date.now()}`;
            const headers = {
                "authority": "api.jijinhao.com",
                "accept": "*/*",
                "accept-encoding": "gzip, deflate",
                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1",
                "accept-language": "zh-CN,zh-Hans;q=0.9",
                "referer": "https://m.quheqihuo.com/",
                "cache-control": "no-cache"
            };

            const res = await request({ url: goldUrl, headers });
            if (res.status !== 200) throw new Error(`状态码: ${res.status}`);
            if (!res.body) throw new Error("返回空内容");

            const goldData = parseGoldResponse(res.body);
            if (!goldData.flag || goldData.errorCode.length > 0) {
                throw new Error(`接口异常：errorCode=${goldData.errorCode.join(",")}`);
            }

            processGoldPrices(goldData);
            logger.log("黄金价格处理完成");
        } catch (e) {
            logger.error("黄金价格获取失败:", e.message);
            goldContent = `❌ 黄金监控异常：${e.message}`;
        }
    };

    // 5. 主执行函数
    const main = async () => {
        try {
            logger.log("黄金监控程序开始运行，当前时间:", getBeijingTime());
            await fetchGoldPrices();

            // 发送黄金通知
            notify(`黄金监控 ${getBeijingTime().split(" ")[0]}`, goldContent);
        } catch (e) {
            notify("❌ 黄金监控异常", `错误：${e.message || "未知错误"}`);
        } finally {
            logger.log("黄金监控程序结束");
            env.match(/Quantumult X|Loon|Surge|Shadowrocket|Stash/) && $done();
        }
    };

    main();
})();
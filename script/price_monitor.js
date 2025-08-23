/******************************************
 * @description 压缩通知内容，移除空行，适配有限展示空间
 * @version 1.0.5
 * @opt 精简格式、移除空行、合并冗余信息
 ******************************************/

(() => {
    "use strict";

    // 1. 环境检测与基础工具定义
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

    // 日志工具
    const logger = {
        log: (...args) => console.log(`[汇率黄金监控] ${args.filter(Boolean).join(" ")}`),
        warn: (...args) => console.log(`[汇率黄金监控][警告] ${args.filter(Boolean).join(" ")}`),
        error: (...args) => console.log(`[汇率黄金监控][错误] ${args.filter(Boolean).join(" ")}`)
    };

    // 存储工具
    const storage = {
        get: (key, defaultValue = null) => {
            try {
                switch (env) {
                    case "Quantumult X":
                        return $prefs.valueForKey(key) || defaultValue;
                    case "Loon":
                    case "Surge":
                    case "Shadowrocket":
                    case "Stash":
                        return $persistentStore.read(key) || defaultValue;
                    default:
                        return defaultValue;
                }
            } catch (e) {
                logger.error("存储读取失败:", e.message);
                return defaultValue;
            }
        },
        set: (key, value) => {
            try {
                switch (env) {
                    case "Quantumult X":
                        return $prefs.setValueForKey(String(value), key);
                    case "Loon":
                    case "Surge":
                    case "Shadowrocket":
                    case "Stash":
                        return $persistentStore.write(String(value), key);
                    default:
                        return false;
                }
            } catch (e) {
                logger.error("存储写入失败:", e.message);
                return false;
            }
        }
    };

    // 网络请求工具
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
                timeout: options.timeout || 15000,
                ...(options.body && { body: options.body })
            };

            try {
                switch (env) {
                    case "Quantumult X":
                        $task.fetch(requestOptions).then(
                            (res) => resolve({
                                status: res.statusCode || "未知",
                                body: res.body || "",
                                headers: res.headers || {}
                            }),
                            (err) => reject(new Error(`请求失败: ${err.message || "未知错误"}`))
                        );
                        break;
                    case "Loon":
                    case "Surge":
                    case "Shadowrocket":
                    case "Stash":
                        $httpClient[method](requestOptions, (err, res, data) => {
                            if (err) {
                                reject(new Error(`请求失败: ${err.message || "未知错误"}`));
                            } else {
                                resolve({
                                    status: res.statusCode || res.status || "未知",
                                    body: data || "",
                                    headers: res.headers || {}
                                });
                            }
                        });
                        break;
                    default:
                        reject(new Error(`不支持的运行环境: ${env}`));
                }
            } catch (e) {
                reject(new Error(`请求初始化异常: ${e.message}`));
            }
        });
    };

    // 本地通知工具（保持不变）
    const notify = (title, content, subtitle = "") => {
        try {
            const plainContent = content.replace(/[#*|`]/g, "").trim();
            const plainTitle = title.replace(/[#*|`]/g, "").trim();

            switch (env) {
                case "Quantumult X":
                    $notify({ title: plainTitle, subtitle, content: plainContent });
                    break;
                case "Loon":
                case "Surge":
                case "Shadowrocket":
                case "Stash":
                    $notification.post(plainTitle, subtitle, plainContent);
                    break;
                default:
                    logger.log(`[本地通知] ${plainTitle}\n${subtitle}\n${plainContent}`);
            }
            logger.log("本地通知发送成功");
        } catch (e) {
            logger.error("通知发送失败:", e.message);
        }
    };

    // 2. 核心配置常量
    const baseCurrency = "CNY";
    const threshold = 1;
    const googleCurrencies = ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY", "TWD", "AUD", "PHP", "THB"];
    const apiUrls = [
        "https://open.er-api.com/v6/latest/CNY",
        "https://api.exchangerate-api.com/v4/latest/CNY",
        "https://api.frankfurter.app/latest?from=CNY"
    ];

    // 币种配置（保持不变）
    const currencyConfig = {
        USD: { name: "美元", decimals: 4, flag: "🇺🇸" },
        EUR: { name: "欧元", decimals: 4, flag: "🇪🇺" },
        GBP: { name: "英镑", decimals: 4, flag: "🇬🇧" },
        HKD: { name: "港币", decimals: 4, flag: "🇭🇰" },
        JPY: { name: "日元", decimals: 4, flag: "🇯🇵" },
        KRW: { name: "韩元", decimals: 4, flag: "🇰🇷" },
        TRY: { name: "里拉", decimals: 4, flag: "🇹🇷" },
        TWD: { name: "台币", decimals: 4, flag: "🏴‍☠️" },
        AUD: { name: "澳元", decimals: 4, flag: "🇦🇺" },
        PHP: { name: "披索", decimals: 4, flag: "🇵🇭" },
        THB: { name: "泰铢", decimals: 4, flag: "🇹🇭" }
    };

    // 黄金商家配置（保持不变）
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

    // 全局变量（保持不变）
    let globalRates = {};
    let globalLastUpdate = "未知";
    let rateContent = "";
    let goldContent = "";
    let fluctuationList = [];

    // 3. 时间工具函数（保持不变）
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
            const timestamp = typeof timeData === "string"
                ? new Date(timeData).getTime()
                : typeof timeData === "number"
                    ? timeData
                    : null;
            if (!timestamp) return "未知";
            return new Date(timestamp).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
                hour: "2-digit",
                minute: "2-digit"
            }).replace(/\//g, "-");
        } catch (e) {
            return "未知";
        }
    };

    // 4. 汇率相关函数（核心优化：压缩汇率内容）
    const fetchFromGoogle = async () => {
        return new Promise((resolve) => {
            const results = {};
            let completed = 0;
            let maxTimestamp = 0;

            googleCurrencies.forEach(curr => {
                if (curr === baseCurrency) {
                    results[curr] = 1;
                    completed++;
                    checkComplete();
                    return;
                }

                request({ url: `https://www.google.com/finance/quote/${curr}-${baseCurrency}`, timeout: 10000 })
                    .then((res) => {
                        if (res.status === 200 && res.body) {
                            const match = res.body.match(
                                /data-last-price="([\d\.]+)".*data-last-normal-market-timestamp="(\d+)"/
                            );
                            if (match) {
                                results[curr] = 1 / parseFloat(match[1]);
                                maxTimestamp = Math.max(maxTimestamp, parseInt(match[2]));
                            }
                        }
                    })
                    .catch((e) => logger.warn(`Google获取${curr}汇率失败:`, e.message))
                    .finally(() => {
                        completed++;
                        checkComplete();
                    });
            });

            const checkComplete = () => {
                if (completed === googleCurrencies.length) {
                    const hasData = Object.keys(results).length > 0;
                    resolve(hasData ? {
                        rates: results,
                        lastUpdate: formatTime(maxTimestamp * 1000)
                    } : null);
                }
            };
        });
    };

    const fetchFromApi = async (missingCurrencies) => {
        for (const url of apiUrls) {
            try {
                const res = await request({ url });
                if (res.status !== 200) continue;

                const data = JSON.parse(res.body);
                const apiRates = data.rates || {};
                const filteredRates = {};

                missingCurrencies.forEach(curr => {
                    if (apiRates[curr] && !isNaN(apiRates[curr])) {
                        filteredRates[curr] = apiRates[curr];
                    }
                });

                if (Object.keys(filteredRates).length > 0) {
                    return {
                        rates: filteredRates,
                        lastUpdate: formatTime(
                            data.time_last_update_utc ||
                            data.date ||
                            (data.time_last_updated ? data.time_last_updated * 1000 : null)
                        )
                    };
                }
            } catch (e) {
                logger.warn(`API ${url} 请求失败:`, e.message);
                continue;
            }
        }
        return null;
    };

    // 核心优化1：压缩汇率内容，合并正反汇率为1行，移除空行
    const processRates = () => {
        const rateLines = [];
        // 汇率标题（精简）
        rateLines.push(`📊 人民币汇率（更新：${globalLastUpdate}）`);

        Object.keys(currencyConfig).forEach(curr => {
            const cfg = currencyConfig[curr];
            const rate = globalRates[curr];

            if (!rate || isNaN(rate)) return;

            const rateCnyToCurr = rate.toFixed(cfg.decimals);
            const rateCurrToCny = (1 / rate).toFixed(cfg.decimals);

            // 合并正反汇率为1行，移除冗余空行
            rateLines.push(`${cfg.flag} ${cfg.name}: 1CNY≈${rateCnyToCurr}${curr} | 1${curr}≈${rateCurrToCny}CNY`);

            // 波动提醒逻辑（保持不变）
            const prevCnyToCurr = parseFloat(storage.get(`rate_${curr}`)) || NaN;
            const prevCurrToCny = parseFloat(storage.get(`rate_inverse_${curr}`)) || NaN;

            if (!isNaN(prevCnyToCurr)) {
                const change = ((rate - prevCnyToCurr) / prevCnyToCurr) * 100;
                if (Math.abs(change) >= threshold) {
                    fluctuationList.push(
                        `${cfg.flag} ${cfg.name}${change > 0 ? "↑" : "↓"}${change.toFixed(2)}%（1CNY→${rateCnyToCurr}${curr}）`
                    );
                }
            }
            if (!isNaN(prevCurrToCny)) {
                const changeInv = ((1/rate - prevCurrToCny) / prevCurrToCny) * 100;
                if (Math.abs(changeInv) >= threshold) {
                    fluctuationList.push(
                        `${cfg.flag} ${cfg.name}${changeInv > 0 ? "↑" : "↓"}${changeInv.toFixed(2)}%（1${curr}→${rateCurrToCny}CNY）`
                    );
                }
            }

            storage.set(`rate_${curr}`, rate);
            storage.set(`rate_inverse_${curr}`, 1/rate);
        });

        fluctuationList = [...new Set(fluctuationList)];
        // 合并汇率行，无空行
        rateContent = rateLines.join("\n");
    };

    const fetchRates = async () => {
        logger.log("开始获取汇率数据...");
        try {
            const googleData = await fetchFromGoogle();
            if (googleData) {
                globalRates = { ...globalRates, ...googleData.rates };
                globalLastUpdate = googleData.lastUpdate;
                logger.log(`Google获取到${Object.keys(googleData.rates).length}种汇率`);
            }

            const missingCurrencies = googleCurrencies.filter(curr => !(curr in globalRates));
            if (missingCurrencies.length > 0) {
                logger.log(`缺失${missingCurrencies.length}种汇率，尝试从API补充:`, missingCurrencies.join(","));
                const apiData = await fetchFromApi(missingCurrencies);
                if (apiData) {
                    globalRates = { ...globalRates, ...apiData.rates };
                    if (globalLastUpdate === "未知") globalLastUpdate = apiData.lastUpdate;
                    logger.log(`API补充到${Object.keys(apiData.rates).length}种汇率`);
                }
            }

            if (Object.keys(globalRates).length === 0) {
                logger.warn("Google和API均未获取到数据，尝试所有备用接口...");
                for (const url of apiUrls) {
                    try {
                        const res = await request({ url });
                        const data = JSON.parse(res.body);
                        if (data.rates) {
                            globalRates = data.rates;
                            globalLastUpdate = formatTime(
                                data.time_last_update_utc ||
                                data.date ||
                                (data.time_last_updated ? data.time_last_updated * 1000 : null)
                            );
                            logger.log(`从${url}获取到完整汇率数据`);
                            break;
                        }
                    } catch (e) {
                        logger.warn(`备用API ${url} 失败:`, e.message);
                        continue;
                    }
                }
            }

            if (Object.keys(globalRates).length > 0) {
                processRates();
                logger.log("汇率数据处理完成，更新时间:", globalLastUpdate);
            } else {
                throw new Error("所有渠道均未获取到有效汇率数据");
            }
        } catch (e) {
            logger.error("汇率获取失败:", e.message);
            throw e;
        }
    };

    // 5. 黄金价格相关函数（核心优化：压缩黄金内容）
    const fetchGoldPrices = async () => {
        logger.log("开始获取黄金价格...");
        try {
            const goldApiList = [
                `https://api.jijinhao.com/quoteCenter/realTime.htm?codes=${Object.values(goldMap).map(i => i.code).join(",")}&_=${Date.now()}`
            ];

            let goldRes = null;
            for (const goldUrl of goldApiList) {
                try {
                    const headers = {
                        "authority": "api.jijinhao.com",
                        "accept": "*/*",
                        "accept-encoding": "gzip, deflate",
                        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1",
                        "accept-language": "zh-CN,zh-Hans;q=0.9",
                        "referer": "https://m.quheqihuo.com/",
                        "cache-control": "no-cache"
                    };

                    logger.log(`尝试请求黄金接口: ${goldUrl}`);
                    goldRes = await request({ url: goldUrl, headers, timeout: 20000 });

                    if (goldRes.body) {
                        logger.log(`黄金接口${goldUrl}请求成功，状态码: ${goldRes.status}`);
                        break;
                    } else {
                        logger.warn(`黄金接口${goldUrl}返回空内容，状态码: ${goldRes.status}`);
                        continue;
                    }
                } catch (e) {
                    logger.warn(`黄金接口${goldUrl}请求失败:`, e.message);
                    continue;
                }
            }

            if (!goldRes || !goldRes.body) {
                throw new Error("所有黄金接口均请求失败（无返回内容）");
            }

            // 前缀处理逻辑（保持不变）
            let rawContent = goldRes.body.trim();
            let jsonStr = "";
            const targetPrefix = "var quote_json = ";
            const lowerRaw = rawContent.toLowerCase();
            const lowerPrefix = targetPrefix.toLowerCase();
            const prefixIndex = lowerRaw.indexOf(lowerPrefix);

            if (prefixIndex !== -1) {
                jsonStr = rawContent.substring(prefixIndex + targetPrefix.length).replace(/;$/, "").trim();
                logger.log("成功移除var quote_json前缀，提取JSON内容");
            } else if (rawContent.startsWith("{")) {
                jsonStr = rawContent;
            } else {
                throw new Error(`未识别的数据格式，原始内容前100字符: ${rawContent.substring(0, 100)}`);
            }

            // 解析JSON（保持不变）
            let goldData;
            try {
                goldData = JSON.parse(jsonStr);
            } catch (parseErr) {
                throw new Error(`JSON解析失败: ${parseErr.message}，处理后内容: ${jsonStr.substring(0, 200)}...`);
            }

            if (!goldData.flag || goldData.errorCode.length > 0) {
                throw new Error(`接口返回异常：errorCode=${goldData.errorCode.join(",")}`);
            }

            processGoldPrices(goldData);
            logger.log("黄金价格获取处理完成");
        } catch (e) {
            logger.error("黄金价格获取失败:", e.message);
            goldContent = `❌ 黄金：${e.message}`;
        }
    };

    // 核心优化2：压缩黄金内容，合并多行信息为1行，移除空行
    const processGoldPrices = (goldData) => {
        const goldLines = [];
        // 黄金标题（精简）
        goldLines.push(`💎 国内黄金价格（元/克）`);

        for (const [name, { code, icon }] of Object.entries(goldMap)) {
            const merchantData = goldData[code];
            if (!merchantData) {
                goldLines.push(`${icon} ${name}：无数据`);
                continue;
            }

            const price = merchantData.q63;
            const updateTime = formatTime(merchantData.time);

            if (typeof price !== "number" || price <= 0) {
                goldLines.push(`${icon} ${name}：价格无效`);
                continue;
            }

            // 合并价格+更新时间为1行，移除冗余空格和空行
            goldLines.push(`${icon} ${name}：${price.toFixed(2)}（${updateTime}更新）`);
        }

        // 合并黄金行，无空行，精简说明
        goldLines.push("📌 涨跌数据暂未返回（接口限制）");
        goldContent = goldLines.join("\n");
    };

    // 6. 主执行函数（优化最终内容合并，无多余空行）
    const main = async () => {
        try {
            logger.log("程序开始运行，当前时间:", getBeijingTime());

            await fetchRates();
            await fetchGoldPrices();

            // 汇率打日志
            logger.log("汇率内容：\n", rateContent);
            // 黄金打日志
            logger.log("黄金内容：\n", goldContent);

            // 核心优化3：合并汇率+黄金内容，无多余分隔符和空行
            const finalContent = [
                rateContent,  // 汇率内容（无空行）
                "",           // 仅1个空行分隔汇率和黄金
                goldContent   // 黄金内容（无空行）
            ].join("\n");

            // 波动提醒（保持不变）
            if (fluctuationList.length > 0) {
                const fluctuationTitle = `📈 汇率波动提醒（>${threshold}%）`;
                const fluctuationContent = fluctuationList.join("\n");
                notify(fluctuationTitle, fluctuationContent);
            }

            // 主通知标题精简
            notify(
                `汇率黄金监控 ${getBeijingTime().split(" ")[0]}`,
                finalContent
            );

        } catch (e) {
            notify("❌ 汇率黄金监控异常", `错误：${e.message || "未知错误"}`);
        } finally {
            logger.log("程序运行结束");
            switch (env) {
                case "Quantumult X":
                case "Loon":
                case "Surge":
                case "Shadowrocket":
                case "Stash":
                    $done();
                    break;
                default:
                    break;
            }
        }
    };

    main();
})();
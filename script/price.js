/******************************************
 * @name 汇率与黄金价格监控
 * @description 实时获取人民币汇率及国内黄金价格，支持本地通知
 * @version 1.0.1
 * @fix 黄金接口请求兼容性、状态码处理、超时配置
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

    // 存储工具（适配不同环境）
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

    // 网络请求工具（修复状态码获取、增加超时）
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
                timeout: options.timeout || 15000, // 延长超时至15秒（黄金接口可能较慢）
                ...(options.body && { body: options.body })
            };

            try {
                switch (env) {
                    case "Quantumult X":
                        $task.fetch(requestOptions).then(
                            (res) => {
                                // 修复：明确获取状态码
                                resolve({
                                    status: res.statusCode || "未知",
                                    body: res.body || "",
                                    headers: res.headers || {}
                                });
                            },
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
                                // 修复：兼容不同环境的res结构，避免statusCode undefined
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

    // 本地通知工具（纯文本适配）
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

    // 币种配置
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

    // 黄金商家配置
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

    // 全局变量
    let globalRates = {};
    let globalLastUpdate = "未知";
    let rateContent = "";
    let goldContent = "";
    let fluctuationList = [];

    // 3. 时间工具函数
    const getBeijingTime = () => {
        return new Date().toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
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
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            }).replace(/\//g, "-");
        } catch (e) {
            return "未知";
        }
    };

    // 4. 汇率相关函数（无修改，已正常工作）
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

    const processRates = () => {
        const rateLines = [];

        Object.keys(currencyConfig).forEach(curr => {
            const cfg = currencyConfig[curr];
            const rate = globalRates[curr];

            if (!rate || isNaN(rate)) return;

            const rateCnyToCurr = rate;
            const rateCurrToCny = 1 / rate;

            const prevCnyToCurr = parseFloat(storage.get(`rate_${curr}`)) || NaN;
            const prevCurrToCny = parseFloat(storage.get(`rate_inverse_${curr}`)) || NaN;

            if (!isNaN(prevCnyToCurr)) {
                const change = ((rateCnyToCurr - prevCnyToCurr) / prevCnyToCurr) * 100;
                if (Math.abs(change) >= threshold) {
                    fluctuationList.push(
                        `${cfg.flag} ${cfg.name} ${change > 0 ? "↑" : "↓"} ${change.toFixed(2)}%` +
                        `（1 CNY → ${rateCnyToCurr.toFixed(cfg.decimals)} ${curr}）`
                    );
                }
            }
            if (!isNaN(prevCurrToCny)) {
                const changeInv = ((rateCurrToCny - prevCurrToCny) / prevCurrToCny) * 100;
                if (Math.abs(changeInv) >= threshold) {
                    fluctuationList.push(
                        `${cfg.flag} ${cfg.name} ${changeInv > 0 ? "↑" : "↓"} ${changeInv.toFixed(2)}%` +
                        `（1 ${curr} → ${rateCurrToCny.toFixed(cfg.decimals)} CNY）`
                    );
                }
            }

            storage.set(`rate_${curr}`, rateCnyToCurr);
            storage.set(`rate_inverse_${curr}`, rateCurrToCny);

            rateLines.push(`${cfg.flag} ${cfg.name}:`);
            rateLines.push(`  1 CNY ≈ ${rateCnyToCurr.toFixed(cfg.decimals)} ${curr}`);
            rateLines.push(`  1 ${curr} ≈ ${rateCurrToCny.toFixed(cfg.decimals)} CNY`);
            rateLines.push("");
        });

        fluctuationList = [...new Set(fluctuationList)];
        rateContent = rateLines.join("\n").trim();
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

    // 5. 黄金价格相关函数（核心修复）
    const fetchGoldPrices = async () => {
        logger.log("开始获取黄金价格...");
        try {
            // 修复1：增加备用黄金接口（原接口可能失效）
            const goldApiList = [
                // 原接口
                `https://api.jijinhao.com/quoteCenter/realTime.htm?codes=${Object.values(goldMap).map(i => i.code).join(",")}&_=${Date.now()}`,
                // 备用接口（若原接口失效，可替换为其他可靠接口）
                `https://api.jijinhao.com/quoteCenter/realTime.htm?codes=${Object.values(goldMap).map(i => i.code).join(",")}&callback=jsonp_${Date.now()}`
            ];

            let goldRes = null;
            // 遍历备用接口，直到获取成功
            for (const goldUrl of goldApiList) {
                try {
                    const headers = {
                        "authority": "api.jijinhao.com",
                        "accept": "*/*",
                        "accept-encoding": "gzip, deflate", // 修复：移除br编码，部分环境不支持
                        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1",
                        "accept-language": "zh-CN,zh-Hans;q=0.9",
                        "referer": "https://m.quheqihuo.com/",
                        "cache-control": "no-cache" // 禁用缓存，确保获取最新数据
                    };

                    // 修复2：明确超时时间，增加请求日志
                    logger.log(`尝试请求黄金接口: ${goldUrl}`);
                    goldRes = await request({ url: goldUrl, headers, timeout: 20000 });

                    // 修复3：更宽松的状态码判断（部分接口返回200但内容异常，先获取内容再判断）
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

            // 所有备用接口均失败
            if (!goldRes || !goldRes.body) {
                throw new Error("所有黄金接口均请求失败（无返回内容）");
            }

            // 修复4：兼容不同格式的JSON提取（处理可能的JSONP包装）
            let jsonStr = goldRes.body;
            // 若返回是JSONP格式（如 callback(json)），提取内部JSON
            if (jsonStr.startsWith("jsonp_")) {
                const jsonpMatch = jsonStr.match(/jsonp_\d+\((\{[\s\S]*?\})\)/);
                if (jsonpMatch) {
                    jsonStr = jsonpMatch[1];
                } else {
                    throw new Error("黄金数据为JSONP格式，但无法提取JSON内容");
                }
            }

            // 提取标准JSON（原逻辑保留，增加容错）
            const jsonMatch = jsonStr.match(/var quote_json\s*=\s*(\{[\s\S]*?\});/);
            const goldData = jsonMatch
                ? JSON.parse(jsonMatch[1])
                : JSON.parse(jsonStr); // 若直接是JSON，直接解析

            processGoldPrices(goldData);
            logger.log("黄金价格获取处理完成");
        } catch (e) {
            // 修复5：更详细的错误提示，便于排查
            logger.error("黄金价格获取失败:", e.message);
            goldContent = `❌ 黄金价格获取失败：\n1. 原因：${e.message}\n2. 建议：检查网络或等待接口恢复`;
        }
    };

    const processGoldPrices = (goldData) => {
        const goldLines = [];

        for (const [name, { code, icon }] of Object.entries(goldMap)) {
            const merchantData = goldData[code];
            if (merchantData && typeof merchantData.q1 === "number") {
                const price = merchantData.q1.toFixed(2);
                const change = merchantData.q70.toFixed(2);
                const changeRate = merchantData.q80.toFixed(2);
                const nameStr = `${icon} ${name}`.padEnd(12, " ");
                const priceStr = `￥${price}`.padStart(8, " ");
                const changeStr = (change >= 0 ? "↑" : "↓") + Math.abs(change);
                goldLines.push(
                    `${nameStr} ${priceStr} 元/克\n` +
                    `        涨跌: ${changeStr.padStart(6, " ")}  涨跌幅: ${changeRate}%`
                );
            } else {
                goldLines.push(`${icon} ${name}  ——  暂无数据（编码：${code}）`);
            }
            goldLines.push("");
        }

        goldContent = goldLines.join("\n").trim();
    };

    // 6. 主执行函数
    const main = async () => {
        try {
            logger.log("程序开始运行，当前时间:", getBeijingTime());

            await fetchRates();
            await fetchGoldPrices();

            const finalContent = [
                `💰 人民币汇率监控（更新时间：${globalLastUpdate}）`,
                "======================================",
                rateContent,
                "",
                "💎 国内黄金价格监控",
                "======================================",
                goldContent
            ].join("\n");

            if (fluctuationList.length > 0) {
                const fluctuationTitle = `📈 汇率波动提醒（阈值>${threshold}%）`;
                const fluctuationContent = fluctuationList.join("\n");
                notify(fluctuationTitle, fluctuationContent);
            }

            notify(
                `汇率与黄金价格监控 ${getBeijingTime()}`,
                finalContent
            );

        } catch (e) {
            notify("❌ 汇率黄金监控异常", `错误信息：${e.message || "未知错误"}`);
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
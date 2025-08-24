/******************************************
 * @description 实时获取11种主流货币汇率，支持波动提醒
 * @version 1.0.4
 * @opt 更新格式
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
        log: (...args) => console.log(`[汇率监控] ${args.filter(Boolean).join(" ")}`),
        warn: (...args) => console.log(`[汇率监控][警告] ${args.filter(Boolean).join(" ")}`),
        error: (...args) => console.log(`[汇率监控][错误] ${args.filter(Boolean).join(" ")}`)
    };

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
                timeout: options.timeout || 15000
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
            logger.log("汇率通知发送成功");
        } catch (e) {
            logger.error("通知发送失败:", e.message);
        }
    };

    // 2. 核心配置
    const baseCurrency = "CNY";
    const threshold = 1; // 波动提醒阈值（%）
    // "PHP",
    const targetCurrencies = ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY", "TWD", "AUD", "THB"];
    const apiUrls = [
        "https://open.er-api.com/v6/latest/CNY",
        "https://api.exchangerate-api.com/v4/latest/CNY",
        "https://api.frankfurter.app/latest?from=CNY"
    ];

    //PHP: { name: "披索", decimals: 4, flag: "🇵🇭" },
    const currencyConfig = {
        USD: { name: "美元", decimals: 1, flag: "🇺🇸" },
        EUR: { name: "欧元", decimals: 1, flag: "🇪🇺" },
        GBP: { name: "英镑", decimals: 1, flag: "🇬🇧" },
        HKD: { name: "港币", decimals: 1, flag: "🇭🇰" },
        JPY: { name: "日元", decimals: 1, flag: "🇯🇵" },
        KRW: { name: "韩元", decimals: 1, flag: "🇰🇷" },
        TRY: { name: "里拉", decimals: 1, flag: "🇹🇷" },
        TWD: { name: "台币", decimals: 1, flag: "🏴‍☠️" },
        AUD: { name: "澳元", decimals: 1, flag: "🇦🇺" },
        THB: { name: "泰铢", decimals: 1, flag: "🇹🇭" }
    };

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

    // 4. 汇率获取与处理
    let globalRates = {};
    let globalLastUpdate = "未知";
    let rateContent = "";
    let fluctuationList = [];

    // 从Google Finance获取汇率
    const fetchFromGoogle = async () => {
        return new Promise((resolve) => {
            const results = {};
            let completed = 0;
            let maxTimestamp = 0;

            targetCurrencies.forEach(curr => {
                if (curr === baseCurrency) {
                    results[curr] = 1;
                    completed++;
                    checkComplete();
                    return;
                }

                request({ url: `https://www.google.com/finance/quote/${curr}-${baseCurrency}`, timeout: 10000 })
                    .then((res) => {
                        if (res.status === 200 && res.body) {
                            const match = res.body.match(/data-last-price="([\d\.]+)".*data-last-normal-market-timestamp="(\d+)"/);
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
                if (completed === targetCurrencies.length) {
                    resolve(Object.keys(results).length ? {
                        rates: results,
                        lastUpdate: formatTime(maxTimestamp * 1000)
                    } : null);
                }
            };
        });
    };

    // 从API补充缺失汇率
    const fetchFromApi = async (missingCurrencies) => {
        for (const url of apiUrls) {
            try {
                const res = await request({ url });
                if (res.status !== 200) continue;

                const data = JSON.parse(res.body);
                const apiRates = data.rates || {};
                const filteredRates = {};
                missingCurrencies.forEach(curr => apiRates[curr] && !isNaN(apiRates[curr]) && (filteredRates[curr] = apiRates[curr]));

                if (Object.keys(filteredRates).length > 0) {
                    return {
                        rates: filteredRates,
                        lastUpdate: formatTime(
                            data.time_last_update_utc || data.date || (data.time_last_updated ? data.time_last_updated * 1000 : null)
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

    // 处理汇率数据（压缩格式+波动检测）
    const processRates = () => {
        const rateLines = [];
        //rateLines.push(`📊 人民币汇率（更新：${globalLastUpdate}）`);

        targetCurrencies.forEach(curr => {
            const cfg = currencyConfig[curr];
            const rate = globalRates[curr];
            if (!rate || isNaN(rate)) return;

            const cnyToCurr = rate.toFixed(cfg.decimals);
            const currToCny = (1 / rate).toFixed(cfg.decimals);
            // rateLines.push(`${cfg.flag} ${cfg.name}: 1CNY≈${cnyToCurr}${curr}, 1${curr}≈${currToCny}CNY`);
            rateLines.push(`${cfg.flag} ${cfg.name}: 1≈${cnyToCurr}${curr}(1${curr}≈${currToCny})`);

            // 波动检测
            const prevCnyToCurr = parseFloat(storage.get(`rate_${curr}`)) || NaN;
            const prevCurrToCny = parseFloat(storage.get(`rate_inv_${curr}`)) || NaN;

            if (!isNaN(prevCnyToCurr)) {
                const change = ((rate - prevCnyToCurr) / prevCnyToCurr) * 100;
                if (Math.abs(change) >= threshold) {
                    fluctuationList.push(`${cfg.flag} ${cfg.name}${change > 0 ? "↑" : "↓"}${change.toFixed(2)}%（1CNY→${cnyToCurr}${curr}）`);
                }
            }
            if (!isNaN(prevCurrToCny)) {
                const changeInv = ((1/rate - prevCurrToCny) / prevCurrToCny) * 100;
                if (Math.abs(changeInv) >= threshold) {
                    fluctuationList.push(`${cfg.flag} ${cfg.name}${changeInv > 0 ? "↑" : "↓"}${changeInv.toFixed(2)}%（1${curr}→${currToCny}CNY）`);
                }
            }

            storage.set(`rate_${curr}`, rate);
            storage.set(`rate_inv_${curr}`, 1/rate);
        });

        fluctuationList = [...new Set(fluctuationList)];
        rateContent = rateLines.join("\n");

        logger.log("汇率数据处理完成\n" + rateContent);
    };

    // 主汇率获取逻辑
    const fetchRates = async () => {
        logger.log("开始获取汇率数据...");
        try {
            // 1. 优先Google获取
            const googleData = await fetchFromGoogle();
            if (googleData) {
                globalRates = { ...globalRates, ...googleData.rates };
                globalLastUpdate = googleData.lastUpdate;
                logger.log(`Google获取到${Object.keys(googleData.rates).length}种汇率`);
            }

            // 2. API补充缺失
            const missing = targetCurrencies.filter(curr => !(curr in globalRates));
            if (missing.length > 0) {
                logger.log(`缺失${missing.length}种汇率，尝试API补充:`, missing.join(","));
                const apiData = await fetchFromApi(missing);
                if (apiData) {
                    globalRates = { ...globalRates, ...apiData.rates };
                    globalLastUpdate = globalLastUpdate === "未知" ? apiData.lastUpdate : globalLastUpdate;
                    logger.log(`API补充到${Object.keys(apiData.rates).length}种汇率`);
                }
            }

            // 3. 备用接口兜底
            if (Object.keys(globalRates).length === 0) {
                logger.warn("Google和API均失败，尝试备用接口...");
                for (const url of apiUrls) {
                    try {
                        const res = await request({ url });
                        const data = JSON.parse(res.body);
                        if (data.rates) {
                            globalRates = data.rates;
                            globalLastUpdate = formatTime(data.time_last_update_utc || data.date || (data.time_last_updated ? data.time_last_updated * 1000 : null));
                            logger.log(`从${url}获取到完整汇率`);
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
                logger.log("汇率数据处理完成");
            } else {
                throw new Error("所有渠道均未获取到有效汇率");
            }
        } catch (e) {
            logger.error("汇率获取失败:", e.message);
            throw e;
        }
    };

    // 5. 主执行函数
    const main = async () => {
        try {
            logger.log("汇率监控程序开始运行，当前时间:", getBeijingTime());
            await fetchRates();

            // 发送波动提醒（如有）
            if (fluctuationList.length > 0) {
                notify(`📈 汇率波动提醒（>${threshold}%）`, fluctuationList.join("\n"));
            }

            // 发送主汇率通知
            notify(`汇率监控 ${getBeijingTime().split(" ")[0]} （更新：${globalLastUpdate}）`, rateContent);
        } catch (e) {
            notify("❌ 汇率监控异常", `错误：${e.message || "未知错误"}`);
        } finally {
            logger.log("汇率监控程序结束");
            env.match(/Quantumult X|Loon|Surge|Shadowrocket|Stash/) && $done();
        }
    };

    main();
})();
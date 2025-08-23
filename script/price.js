/******************************************
 * @name 汇率与黄金价格监控
 * @description 实时获取人民币汇率及国内黄金价格，支持本地通知
 * @version 1.0.0
 * @support Quantumult X / Loon / Surge / Shadowrocket
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

    // 网络请求工具（适配不同环境）
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
                timeout: 10000
            };

            try {
                switch (env) {
                    case "Quantumult X":
                        $task.fetch(requestOptions).then(
                            (res) => resolve({ status: res.statusCode, body: res.body }),
                            (err) => reject(new Error(`请求失败: ${err.message}`))
                        );
                        break;
                    case "Loon":
                    case "Surge":
                    case "Shadowrocket":
                    case "Stash":
                        $httpClient[method](requestOptions, (err, res, data) => {
                            if (err) {
                                reject(new Error(`请求失败: ${err.message}`));
                            } else {
                                resolve({ status: res.statusCode, body: data });
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

    // 本地通知工具（纯文本适配，无外部推送）
    const notify = (title, content, subtitle = "") => {
        try {
            // 移除特殊符号，确保纯文本显示
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
    const threshold = 1; // 汇率波动百分比阈值（%）
    const googleCurrencies = ["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "TRY", "TWD", "AUD", "PHP", "THB"];
    const apiUrls = [
        "https://open.er-api.com/v6/latest/CNY",
        "https://api.exchangerate-api.com/v4/latest/CNY",
        "https://api.frankfurter.app/latest?from=CNY"
    ];

    // 币种配置（名称、精度、国旗标识）
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

    // 黄金商家配置（编码、图标）
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
    let globalRates = {}; // 汇率数据
    let globalLastUpdate = "未知"; // 最后更新时间
    let rateContent = ""; // 汇率通知内容
    let goldContent = ""; // 黄金通知内容
    let fluctuationList = []; // 汇率波动提醒列表

    // 3. 时间工具函数
    /** 获取北京时间（格式：YYYY-MM-DD HH:MM:SS） */
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

    /** 格式化时间戳为北京时间 */
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

    // 4. 汇率相关函数
    /** 从Google Finance获取汇率 */
    const fetchFromGoogle = async () => {
        return new Promise((resolve) => {
            const results = {};
            let completed = 0;
            let maxTimestamp = 0;

            // 遍历需要获取的币种
            googleCurrencies.forEach(curr => {
                if (curr === baseCurrency) {
                    results[curr] = 1;
                    completed++;
                    checkComplete();
                    return;
                }

                // 请求Google Finance汇率页面
                request({ url: `https://www.google.com/finance/quote/${curr}-${baseCurrency}` })
                    .then((res) => {
                        if (res.status === 200 && res.body) {
                            // 匹配汇率和更新时间（正则提取）
                            const match = res.body.match(
                                /data-last-price="([\d\.]+)".*data-last-normal-market-timestamp="(\d+)"/
                            );
                            if (match) {
                                const price = parseFloat(match[1]);
                                const timestamp = parseInt(match[2]);
                                results[curr] = 1 / price; // 转换为1 CNY → X 外币
                                maxTimestamp = Math.max(maxTimestamp, timestamp);
                            }
                        }
                    })
                    .catch((e) => logger.warn(`Google获取${curr}汇率失败:`, e.message))
                    .finally(() => {
                        completed++;
                        checkComplete();
                    });
            });

            // 检查所有请求是否完成
            const checkComplete = () => {
                if (completed === googleCurrencies.length) {
                    const hasData = Object.keys(results).length > 0;
                    resolve(hasData ? {
                        rates: results,
                        lastUpdate: formatTime(maxTimestamp * 1000) // 时间戳转毫秒
                    } : null);
                }
            };
        });
    };

    /** 从备用API获取指定币种汇率 */
    const fetchFromApi = async (missingCurrencies) => {
        for (const url of apiUrls) {
            try {
                const res = await request({ url });
                if (res.status !== 200) continue;

                const data = JSON.parse(res.body);
                const apiRates = data.rates || {};
                const filteredRates = {};

                // 筛选需要补充的币种
                missingCurrencies.forEach(curr => {
                    if (apiRates[curr] && !isNaN(apiRates[curr])) {
                        filteredRates[curr] = apiRates[curr];
                    }
                });

                // 有有效数据则返回
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

    /** 处理汇率数据（计算波动、更新存储、生成内容） */
    const processRates = () => {
        const rateLines = [];

        // 遍历所有配置的币种
        Object.keys(currencyConfig).forEach(curr => {
            const cfg = currencyConfig[curr];
            const rate = globalRates[curr];

            if (!rate || isNaN(rate)) return;

            // 计算正反汇率（1 CNY → X 外币 / 1 外币 → Y CNY）
            const rateCnyToCurr = rate;
            const rateCurrToCny = 1 / rate;

            // 从存储获取历史汇率
            const prevCnyToCurr = parseFloat(storage.get(`rate_${curr}`)) || NaN;
            const prevCurrToCny = parseFloat(storage.get(`rate_inverse_${curr}`)) || NaN;

            // 检查汇率波动（超过阈值则加入提醒列表）
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

            // 更新存储的历史汇率
            storage.set(`rate_${curr}`, rateCnyToCurr);
            storage.set(`rate_inverse_${curr}`, rateCurrToCny);

            // 生成汇率显示内容（纯文本格式）
            rateLines.push(`${cfg.flag} ${cfg.name}:`);
            rateLines.push(`  1 CNY ≈ ${rateCnyToCurr.toFixed(cfg.decimals)} ${curr}`);
            rateLines.push(`  1 ${curr} ≈ ${rateCurrToCny.toFixed(cfg.decimals)} CNY`);
            rateLines.push(""); // 空行分隔
        });

        // 去重波动提醒（避免重复通知）
        fluctuationList = [...new Set(fluctuationList)];
        // 生成最终汇率内容
        rateContent = rateLines.join("\n").trim();
    };

    /** 主汇率获取函数（Google优先，API补充） */
    const fetchRates = async () => {
        logger.log("开始获取汇率数据...");
        try {
            // 1. 优先从Google获取
            const googleData = await fetchFromGoogle();
            if (googleData) {
                globalRates = { ...globalRates, ...googleData.rates };
                globalLastUpdate = googleData.lastUpdate;
                logger.log(`Google获取到${Object.keys(googleData.rates).length}种汇率`);
            }

            // 2. 检查缺失的币种，从API补充
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

            // 3. 若仍无数据，尝试所有备用API
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

            // 4. 处理汇率数据
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

    // 5. 黄金价格相关函数
    /** 获取并处理黄金价格 */
    const fetchGoldPrices = async () => {
        logger.log("开始获取黄金价格...");
        try {
            // 构建黄金API请求参数（拼接商家编码）
            const codes = Object.values(goldMap).map(item => item.code).join(",");
            const goldUrl = `https://api.jijinhao.com/quoteCenter/realTime.htm?codes=${codes}&_=${Date.now()}`;
            const headers = {
                "authority": "api.jijinhao.com",
                "accept": "*/*",
                "accept-encoding": "gzip, deflate, br",
                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1",
                "accept-language": "zh-CN,zh-Hans;q=0.9",
                "referer": "https://m.quheqihuo.com/"
            };

            // 发送请求
            const res = await request({ url: goldUrl, headers });
            if (res.status !== 200) {
                throw new Error(`黄金接口请求失败，状态码: ${res.status}`);
            }

            // 解析返回数据（提取JSON部分）
            const jsonMatch = res.body.match(/var quote_json\s*=\s*(\{[\s\S]*?\});/);
            if (!jsonMatch) {
                throw new Error("黄金数据格式异常，未找到JSON内容");
            }

            const goldData = JSON.parse(jsonMatch[1]);
            processGoldPrices(goldData);
            logger.log("黄金价格获取处理完成");
        } catch (e) {
            logger.error("黄金价格获取失败:", e.message);
            goldContent = "❌ 黄金价格获取失败：" + e.message;
        }
    };

    /** 处理黄金价格数据，生成显示内容 */
    const processGoldPrices = (goldData) => {
        const goldLines = [];

        // 遍历所有黄金商家
        for (const [name, { code, icon }] of Object.entries(goldMap)) {
            const merchantData = goldData[code];
            if (merchantData && typeof merchantData.q1 === "number") {
                // 价格（q1）、涨跌额（q70）、涨跌幅（q80）
                const price = merchantData.q1.toFixed(2);
                const change = merchantData.q70.toFixed(2);
                const changeRate = merchantData.q80.toFixed(2);
                // 格式化显示（对齐文本，增强可读性）
                const nameStr = `${icon} ${name}`.padEnd(12, " ");
                const priceStr = `￥${price}`.padStart(8, " ");
                const changeStr = (change >= 0 ? "↑" : "↓") + Math.abs(change);
                goldLines.push(
                    `${nameStr} ${priceStr} 元/克\n` +
                    `        涨跌: ${changeStr.padStart(6, " ")}  涨跌幅: ${changeRate}%`
                );
            } else {
                // 无数据时的显示
                goldLines.push(`${icon} ${name}  ——  暂无数据`);
            }
            goldLines.push(""); // 空行分隔
        }

        // 生成最终黄金内容
        goldContent = goldLines.join("\n").trim();
    };

    // 6. 主执行函数
    const main = async () => {
        try {
            logger.log("程序开始运行，当前时间:", getBeijingTime());

            // 1. 获取汇率和黄金数据
            await fetchRates();
            await fetchGoldPrices();

            // 2. 生成最终通知内容（纯文本）
            const finalContent = [
                `💰 人民币汇率监控（更新时间：${globalLastUpdate}）`,
                "======================================",
                rateContent,
                "",
                "💎 国内黄金价格监控",
                "======================================",
                goldContent
            ].join("\n");

            // 3. 发送汇率波动提醒（如有）
            if (fluctuationList.length > 0) {
                const fluctuationTitle = `📈 汇率波动提醒（阈值>${threshold}%）`;
                const fluctuationContent = fluctuationList.join("\n");
                notify(fluctuationTitle, fluctuationContent);
            }

            // 4. 发送主通知（汇率+黄金汇总）
            notify(
                `汇率与黄金价格监控 ${getBeijingTime()}`,
                finalContent
            );

        } catch (e) {
            // 异常通知
            notify("❌ 汇率黄金监控异常", `错误信息：${e.message || "未知错误"}`);
        } finally {
            // 结束任务（适配不同环境）
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

    // 启动主程序
    main();
})();
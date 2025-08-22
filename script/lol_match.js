/******************************************
 * @name LOL赛事提醒（排查版）
 * @description 增加详细日志，定位今日赛事筛选问题
 * @version 1.0.5
 ******************************************/

(() => {
    "use strict";

    const env = (() => {
        const globals = Object.keys(globalThis);
        if (globals.includes("$task")) return "Quantumult X";
        if (globals.includes("$loon")) return "Loon";
        if (globals.includes("$rocket")) return "Shadowrocket";
        if (globals.includes("$environment")) {
            if ($environment["surge-version"]) return "Surge";
            if ($environment["stash-version"]) return "Stash";
        }
        return "Unknown";
    })();

    // 增强日志：输出所有关键步骤
    const logger = {
        log: (...args) => {
            const message = args.filter(item => item !== undefined && item !== null).join(" ");
            if (message) console.log(`[LOL赛事] ${message}`);
        },
        debug: (...args) => {
            const message = args.filter(item => item !== undefined && item !== null).join(" ");
            if (message) console.log(`[LOL赛事][调试] ${message}`);
        },
        warn: (...args) => {
            const message = args.filter(item => item !== undefined && item !== null).join(" ");
            if (message) console.log(`[LOL赛事][警告] ${message}`);
        },
        error: (...args) => {
            const message = args.filter(item => item !== undefined && item !== null).join(" ");
            if (message) console.log(`[LOL赛事][错误] ${message}`);
        }
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
                logger.error("存储读取失败:", e.message || e);
                return defaultValue;
            }
        }
    };

    const request = async (options) => {
        return new Promise((resolve, reject) => {
            if (!options.url) {
                reject(new Error("请求URL不能为空"));
                return;
            }

            const method = (options.method || "GET").toUpperCase();
            const headers = options.headers || {};
            const body = options.body ? JSON.stringify(options.body) : null;

            const requestOptions = {
                url: options.url,
                method,
                headers,
                body,
                timeout: options.timeout || 10000
            };

            try {
                switch (env) {
                    case "Quantumult X":
                        $task.fetch(requestOptions).then(
                            (response) => {
                                if (response.statusCode < 200 || response.statusCode >= 300) {
                                    reject(new Error(`HTTP错误: ${response.statusCode}`));
                                    return;
                                }
                                resolve({
                                    status: response.statusCode,
                                    body: response.body,
                                    json: () => {
                                        try {
                                            return JSON.parse(response.body);
                                        } catch (e) {
                                            reject(new Error("JSON解析失败"));
                                            return null;
                                        }
                                    }
                                });
                            },
                            (error) => reject(new Error(`请求失败: ${error.message}`))
                        );
                        break;
                    case "Loon":
                    case "Surge":
                    case "Shadowrocket":
                    case "Stash":
                        $httpClient[method.toLowerCase()](requestOptions, (error, response, data) => {
                            if (error) {
                                reject(new Error(`请求错误: ${error.message}`));
                                return;
                            }
                            if (response.statusCode < 200 || response.statusCode >= 300) {
                                reject(new Error(`HTTP错误: ${response.statusCode}`));
                                return;
                            }
                            resolve({
                                status: response.statusCode,
                                body: data,
                                json: () => {
                                    try {
                                        return JSON.parse(data);
                                    } catch (e) {
                                        reject(new Error("JSON解析失败"));
                                        return null;
                                    }
                                }
                            });
                        });
                        break;
                    default:
                        reject(new Error(`不支持的环境: ${env}`));
                }
            } catch (e) {
                reject(new Error(`请求初始化失败: ${e.message}`));
            }
        });
    };

    const notify = (title, subtitle, content, options = {}) => {
        try {
            const notification = {
                title: title || "LOL赛事提醒",
                subtitle: subtitle || "",
                content: content || "暂无内容",
                ...options
            };

            switch (env) {
                case "Quantumult X":
                    $notify(notification);
                    break;
                case "Loon":
                case "Surge":
                case "Shadowrocket":
                case "Stash":
                    $notification.post(
                        notification.title,
                        notification.subtitle,
                        notification.content,
                        {
                            "open-url": notification.openUrl || "",
                            "media-url": notification.mediaUrl || ""
                        }
                    );
                    break;
                default:
                    logger.log("本地通知:", notification.title, notification.content);
            }
        } catch (e) {
            logger.error("通知发送失败:", e.message || e);
        }
    };

    // 常量定义
    const TARGET_LEAGUES = new Set(["LPL", "LCK"]);
    const GRAPHQL_URL = "https://esports.op.gg/matches/graphql/__query__ListUpcomingMatchesBySerie";
    const SEND_KEY = storage.get("LOL_SEND_KEY") || "";

    // 1. 时间转换：输出详细转换过程
    const utcToChina = (utcStr) => {
        try {
            const dtUtc = new Date(utcStr);
            if (isNaN(dtUtc.getTime())) {
                throw new Error(`无效的时间格式: ${utcStr}`);
            }

            // 计算北京时间（UTC+8）
            const chinaYear = dtUtc.getUTCFullYear();
            const chinaMonth = dtUtc.getUTCMonth();
            const chinaDate = dtUtc.getUTCDate();
            const chinaHours = dtUtc.getUTCHours() + 8; // 核心：UTC小时+8
            const chinaMinutes = dtUtc.getUTCMinutes();
            const chinaSeconds = dtUtc.getUTCSeconds();

            // 处理跨天情况（例如UTC 20:00 +8 = 次日04:00）
            const chinaTime = new Date(
                chinaYear, chinaMonth, chinaDate,
                chinaHours, chinaMinutes, chinaSeconds
            );

            // 输出转换详情
            logger.debug(
                `UTC时间转换: ${utcStr} → ` +
                `北京时间[${chinaYear}-${(chinaMonth+1).toString().padStart(2,'0')}-${chinaDate.toString().padStart(2,'0')} ` +
                `${chinaHours.toString().padStart(2,'0')}:${chinaMinutes.toString().padStart(2,'0')}]`
            );
            return chinaTime;
        } catch (e) {
            logger.error("时间转换失败:", e.message);
            return null;
        }
    };

    // 2. 获取赛事数据
    const fetchUpcomingMatches = async () => {
        try {
            logger.log("开始获取赛事数据...");
            const headers = {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
                "Referer": "https://esports.op.gg/"
            };

            const payload = {
                query: `query { upcomingMatches { id name status scheduledAt tournament { serie { league { shortName } } } } }`
            };

            const response = await request({
                url: GRAPHQL_URL,
                method: "POST",
                headers,
                body: payload
            });

            const result = await response.json();
            if (!result || !result.data || !Array.isArray(result.data.upcomingMatches)) {
                throw new Error("返回数据格式异常");
            }

            logger.log(`获取到${result.data.upcomingMatches.length}场赛事数据`);
            return result.data.upcomingMatches;
        } catch (e) {
            logger.error("获取比赛数据失败:", e.message);
            return [];
        }
    };

    // 3. 筛选今日赛事：输出每一场LPL/LCK赛事的筛选结果
    const filterTodayMatches = (matches) => {
        try {
            // 输出当前时间（用于对比）
            const now = new Date();
            logger.log(`当前北京时间: ${now.toLocaleString("zh-CN")}`);

            // 定义今日范围（北京时间0点至明日0点）
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            // 输出筛选范围
            logger.log(
                `今日筛选范围: 从 ${today.toLocaleDateString("zh-CN")} 00:00 ` +
                `到 ${tomorrow.toLocaleDateString("zh-CN")} 00:00`
            );

            const result = { LPL: [], LCK: [] };

            // 遍历所有赛事，重点输出LPL/LCK的筛选情况
            for (const match of matches) {
                const league = match?.tournament?.serie?.league?.shortName;
                if (!TARGET_LEAGUES.has(league)) continue; // 只关注LPL/LCK

                // 输出单场赛事信息
                logger.debug(`\n===== 检测赛事: ${league} - ${match.name} =====`);
                logger.debug(`UTC时间原始值: ${match.scheduledAt}`);

                const matchTime = utcToChina(match.scheduledAt);
                if (!matchTime) {
                    logger.debug("跳过：时间转换失败");
                    continue;
                }

                // 判断是否在今日范围
                const isToday = matchTime >= today && matchTime < tomorrow;
                logger.debug(
                    `是否今日赛事: ${isToday ? "是" : "否"} ` +
                    `(赛事时间: ${matchTime.toLocaleString("zh-CN")})`
                );

                if (isToday) {
                    const timeStr = matchTime.toLocaleString("zh-CN", {
                        month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit"
                    }).replace(/\//g, "-");
                    result[league].push({ name: match.name, time: timeStr });
                }
            }

            // 输出最终筛选结果
            logger.log(`LPL今日赛事数量: ${result.LPL.length}`);
            logger.log(`LCK今日赛事数量: ${result.LCK.length}`);

            return result;
        } catch (e) {
            logger.error("筛选赛事失败:", e.message);
            return { LPL: [], LCK: [] };
        }
    };

    // 4. 生成通知内容
    const generateMarkdown = (matchData) => {
        const today = new Date().toLocaleDateString("zh-CN").replace(/\//g, "-");
        let md = `## ⚽ 今日赛程（${today}）\n\n`;

        const regionFlags = { "LCK": "🇰🇷", "LPL": "🇨🇳" };

        for (const [region, games] of Object.entries(matchData)) {
            if (games.length === 0) continue;

            const flag = regionFlags[region] || "";
            md += `### ${flag} ${region} 赛区\n`;
            md += "| 时间（北京时间） | 对阵 |\n|------------------|------|\n";

            games.sort((a, b) => new Date(a.time) - new Date(b.time))
                .forEach(game => {
                    const time = game.time.split(" ")[1];
                    md += `| ${time} | ${game.name} |\n`;
                });

            md += "\n---\n\n";
        }

        if (matchData.LPL.length === 0 && matchData.LCK.length === 0) {
            md += "今日暂无LPL/LCK赛事安排\n";
        }

        return md;
    };

    // 5. 发送消息
    const sendMessage = async (content) => {
        try {
            if (!SEND_KEY) {
                logger.log("未配置SEND_KEY，使用本地通知");
                notify("LOL赛事信息", "", content);
                return;
            }

            const url = `https://sctapi.ftqq.com/${SEND_KEY}.send`;
            await request({
                url,
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `title=LOL赛事信息&desp=${encodeURIComponent(content)}`
            });
            logger.log("消息发送成功");
        } catch (e) {
            logger.error("发送消息出错:", e.message);
            notify("消息发送失败", "", e.message);
        }
    };

    // 主函数
    const main = async () => {
        try {
            logger.log("程序开始运行");
            const matches = await fetchUpcomingMatches();
            const todayMatches = filterTodayMatches(matches);
            const markdownContent = generateMarkdown(todayMatches);
            await sendMessage(markdownContent);
            logger.log("程序运行结束");
        } catch (e) {
            logger.error("主程序出错:", e.message);
            notify("LOL赛事提醒", "运行失败", e.message);
        } finally {
            switch (env) {
                case "Quantumult X":
                case "Loon":
                case "Surge":
                case "Shadowrocket":
                case "Stash":
                    $done();
                    break;
                default:
                    logger.log("程序执行完毕");
            }
        }
    };

    main();
})();
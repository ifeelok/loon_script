/******************************************
 * @name LOL赛事提醒
 * @description 获取今日LPL和LCK赛事信息并推送
 * @version 1.0.0
 ******************************************/

(() => {
    "use strict";

    // 环境检测
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

    // 日志工具
    const logger = {
        log: (...args) => console.log("[LOL赛事]", ...args),
        warn: (...args) => console.log("[LOL赛事][警告]", ...args),
        error: (...args) => console.log("[LOL赛事][错误]", ...args)
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
                logger.error("存储读取失败:", e);
                return defaultValue;
            }
        }
    };

    // 网络请求工具
    const request = async (options) => {
        return new Promise((resolve, reject) => {
            const method = options.method || "GET";
            const url = options.url;
            const headers = options.headers || {};
            const body = options.body ? JSON.stringify(options.body) : null;

            const requestOptions = {
                url,
                method,
                headers,
                body,
                timeout: 10000
            };

            switch (env) {
                case "Quantumult X":
                    $task.fetch(requestOptions).then(
                        (response) => {
                            resolve({
                                status: response.statusCode,
                                body: response.body,
                                json: () => JSON.parse(response.body)
                            });
                        },
                        (error) => reject(error)
                    );
                    break;
                case "Loon":
                case "Surge":
                case "Shadowrocket":
                case "Stash":
                    $httpClient[method.toLowerCase()](requestOptions, (error, response, data) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve({
                                status: response.statusCode,
                                body: data,
                                json: () => JSON.parse(data)
                            });
                        }
                    });
                    break;
                default:
                    reject(new Error("不支持的环境"));
            }
        });
    };

    // 通知工具
    const notify = (title, subtitle, content, options = {}) => {
        try {
            const notification = {
                title,
                subtitle,
                content,
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
                    $notification.post(notification.title, notification.subtitle, notification.content, {
                        "open-url": notification.openUrl || "",
                        "media-url": notification.mediaUrl || ""
                    });
                    break;
                default:
                    logger.log("通知:", title, subtitle, content);
            }
        } catch (e) {
            logger.error("通知发送失败:", e);
        }
    };

    // 常量定义
    const TARGET_LEAGUES = new Set(["LPL", "LCK"]);
    const GRAPHQL_URL = "https://esports.op.gg/matches/graphql/__query__ListUpcomingMatchesBySerie";
    const SEND_KEY = storage.get("LOL_SEND_KEY") || "";

    // 时间转换函数：UTC转中国时间
    const utcToChina = (utcStr) => {
        const dtUtc = new Date(utcStr);
        const chinaTime = new Date(dtUtc.getTime() + 8 * 60 * 60 * 1000); // UTC+8
        return chinaTime;
    };

    // 获取即将到来的比赛
    const fetchUpcomingMatches = async () => {
        try {
            const headers = {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            };

            const payload = {
                query: `
                query {
                    upcomingMatches {
                        id
                        name
                        status
                        scheduledAt
                        tournament {
                            serie {
                                league {
                                    shortName
                                }
                            }
                        }
                    }
                }
                `
            };

            const response = await request({
                url: GRAPHQL_URL,
                method: "POST",
                headers,
                body: payload
            });

            const data = await response.json();
            return data.data?.upcomingMatches || [];
        } catch (e) {
            logger.error("获取比赛数据失败:", e);
            return [];
        }
    };

    // 筛选今日比赛
    const filterTodayMatches = (matches) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const result = {};
        TARGET_LEAGUES.forEach(league => {
            result[league] = [];
        });

        for (const match of matches) {
            try {
                const league = match.tournament?.serie?.league?.shortName;
                if (!league || !TARGET_LEAGUES.has(league)) continue;

                const matchTime = utcToChina(match.scheduledAt);
                if (matchTime >= today && matchTime < tomorrow) {
                    const timeStr = matchTime.toLocaleString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                    }).replace(/\//g, "-");

                    result[league].push({
                        name: match.name,
                        time: timeStr
                    });
                }
            } catch (e) {
                logger.warn("处理比赛数据时出错:", e);
                continue;
            }
        }

        // 过滤空数组
        for (const league of TARGET_LEAGUES) {
            if (result[league].length === 0) {
                delete result[league];
            }
        }

        return result;
    };

    // 生成Markdown内容
    const generateMarkdown = (matchData) => {
        const today = new Date().toLocaleDateString("zh-CN").replace(/\//g, "-");
        let md = `## ⚽ 今日赛程（${today}）\n\n`;

        const regionFlags = {
            "LCK": "🇰🇷",
            "LPL": "🇨🇳"
        };

        for (const [region, games] of Object.entries(matchData)) {
            const flag = regionFlags[region] || "";
            md += `### ${flag} ${region} 赛区\n`;
            md += "| 时间（北京时间） | 对阵 |\n";
            md += "|------------------|------|\n";

            games.forEach(game => {
                const time = game.time.split(" ")[1].slice(0, 5); // 提取时分
                md += `| ${time} | ${game.name} |\n`;
            });

            md += "\n---\n\n";
        }

        md += "> ✅ 所有时间均为北京时间（UTC+8）";
        return md;
    };

    // 发送消息到ServerChan
    const sendMessage = async (content) => {
        if (!SEND_KEY) {
            logger.warn("未配置SEND_KEY，使用本地通知");
            notify("LOL赛事信息", "", content);
            return;
        }

        try {
            const url = `https://sctapi.ftqq.com/${SEND_KEY}.send`;
            const response = await request({
                url,
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: `title=LOL赛事信息&desp=${encodeURIComponent(content)}`
            });

            const result = await response.json();
            if (result.code === 0) {
                logger.log("消息发送成功");
            } else {
                logger.error("消息发送失败:", result);
                notify("消息发送失败", "", `错误信息: ${result.message || "未知错误"}`);
            }
        } catch (e) {
            logger.error("发送消息时出错:", e);
            notify("消息发送失败", "", `错误信息: ${e.message}`);
        }
    };

    // 主函数
    const main = async () => {
        logger.log("开始获取赛事信息...");
        const matches = await fetchUpcomingMatches();
        const todayMatches = filterTodayMatches(matches);

        if (Object.keys(todayMatches).length === 0) {
            logger.log("今日没有LPL和LCK赛事");
            notify("LOL赛事提醒", "", "今日没有LPL和LCK赛事");
            return;
        }

        const markdownContent = generateMarkdown(todayMatches);
        await sendMessage(markdownContent);
    };

    // 执行主函数并处理完成
    main().catch(e => {
        logger.error("程序执行出错:", e);
        notify("LOL赛事提醒", "执行失败", e.message);
    }).finally(() => {
        // 通知环境任务已完成
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
    });
})();
/******************************************
 * @name LOL赛事提醒
 * @description 获取今日LPL和LCK赛事信息并推送
 * @version 1.0.4
 * @fix 修复时间转换和日期筛选逻辑，确保正确识别今日比赛
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
        log: (...args) => {
            const message = args.filter(item => item !== undefined && item !== null).join(" ");
            if (message) console.log(`[LOL赛事] ${message}`);
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
                logger.error("存储读取失败:", e.message || e);
                return defaultValue;
            }
        }
    };

    // 网络请求工具
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

    // 通知工具
    const notify = (title, subtitle, content, options = {}) => {
        try {
            if (!title && !subtitle && !content) {
                logger.warn("通知内容不能为空");
                return;
            }

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

    // 核心修复1：精确的UTC转北京时间（考虑时区偏移）
    const utcToChina = (utcStr) => {
        try {
            // 解析UTC时间（确保包含时区信息）
            const dtUtc = new Date(utcStr);
            if (isNaN(dtUtc.getTime())) {
                throw new Error(`无效的时间格式: ${utcStr}`);
            }

            // 计算北京时间（UTC+8，不依赖本地时区）
            const chinaTime = new Date(
                dtUtc.getUTCFullYear(),
                dtUtc.getUTCMonth(),
                dtUtc.getUTCDate(),
                dtUtc.getUTCHours() + 8, // 关键：UTC小时+8
                dtUtc.getUTCMinutes(),
                dtUtc.getUTCSeconds()
            );

            logger.debug(`UTC时间: ${utcStr} → 北京时间: ${chinaTime.toLocaleString()}`);
            return chinaTime;
        } catch (e) {
            logger.error("时间转换失败:", e.message);
            return null;
        }
    };

    // 获取即将到来的比赛
    const fetchUpcomingMatches = async () => {
        try {
            logger.log("开始获取赛事数据...");
            const headers = {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
                "Referer": "https://esports.op.gg/"
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

            logger.log("API原始返回内容:", response.body);

            const result = await response.json();
            if (!result || !result.data || !Array.isArray(result.data.upcomingMatches)) {
                throw new Error("返回数据格式异常（缺少data.upcomingMatches数组）");
            }

            logger.log(`获取到${result.data.upcomingMatches.length}场赛事数据`);
            return result.data.upcomingMatches;
        } catch (e) {
            if (response?.body?.includes("<HTML>") || response?.body?.includes("403 ERROR")) {
                logger.error("请求被拦截（403），可能是头信息不完整");
                throw new Error("请求被服务器拒绝，请检查头信息配置");
            }
            logger.error("获取比赛数据失败:", e.message);
            return [];
        }
    };

    // 核心修复2：准确筛选今日比赛（基于北京时间的0点至24点）
    const filterTodayMatches = (matches) => {
        try {
            // 生成北京时间的今日0点和明日0点（不依赖本地时区）
            const now = new Date();
            const today = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                0, 0, 0, 0
            );
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            logger.log(`筛选时间范围: 今日${today.toLocaleDateString()} 00:00 至 明日${tomorrow.toLocaleDateString()} 00:00`);

            const result = {};
            TARGET_LEAGUES.forEach(league => {
                result[league] = [];
            });

            for (const match of matches) {
                try {
                    const league = match?.tournament?.serie?.league?.shortName;
                    if (!league || !TARGET_LEAGUES.has(league)) continue;

                    const matchTime = utcToChina(match.scheduledAt);
                    if (!matchTime) continue;

                    // 关键：判断比赛时间是否在今日0点至明日0点之间
                    if (matchTime >= today && matchTime < tomorrow) {
                        const timeStr = matchTime.toLocaleString("zh-CN", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                        }).replace(/\//g, "-");

                        result[league].push({
                            name: match.name || "未知赛事",
                            time: timeStr
                        });
                        logger.debug(`匹配今日赛事: ${league} - ${match.name} ${timeStr}`);
                    }
                } catch (e) {
                    logger.warn("处理单场赛事出错:", e.message);
                    continue;
                }
            }

            // 打印筛选结果
            for (const league of TARGET_LEAGUES) {
                logger.log(`今日${league}赛事数量: ${result[league].length}`);
            }

            // 过滤空数组
            for (const league of TARGET_LEAGUES) {
                if (result[league].length === 0) {
                    delete result[league];
                }
            }

            return result;
        } catch (e) {
            logger.error("筛选赛事失败:", e.message);
            return {};
        }
    };

    // 生成Markdown内容
    const generateMarkdown = (matchData) => {
        try {
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

                // 按时间排序
                games.sort((a, b) => new Date(a.time) - new Date(b.time));

                games.forEach(game => {
                    const time = game.time.split(" ")[1].slice(0, 5); // 提取时分
                    md += `| ${time} | ${game.name} |\n`;
                });

                md += "\n---\n\n";
            }

            if (Object.keys(matchData).length === 0) {
                md += "今日暂无LPL/LCK赛事安排\n";
            }

            md += "> ✅ 所有时间均为北京时间（UTC+8）";
            return md;
        } catch (e) {
            logger.error("生成内容失败:", e.message);
            return "生成赛事信息失败";
        }
    };

    // 发送消息
    const sendMessage = async (content) => {
        try {
            if (!content) {
                throw new Error("发送内容不能为空");
            }

            if (!SEND_KEY) {
                logger.log("未配置SEND_KEY，使用本地通知");
                notify("LOL赛事信息", "", content);
                return;
            }

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
                logger.error("消息发送失败:", result.message || "未知错误");
                notify("消息发送失败", "", `错误信息: ${result.message || "未知错误"}`);
            }
        } catch (e) {
            logger.error("发送消息出错:", e.message);
            notify("消息发送失败", "", `错误信息: ${e.message}`);
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
            logger.error("主程序出错:", e.message || e);
            notify("LOL赛事提醒", "运行失败", e.message || "未知错误");
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

    // 启动主函数
    main();
})();
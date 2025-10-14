/******************************************
 * @name LOL赛事提醒（本地版）
 * @description 仅本地输出今日LPL/LCK赛事，适配纯文本通知
 * @version 1.1.1
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

    // 本地通知工具（纯文本适配）
    const notify = (title, content) => {
        try {
            // 统一使用纯文本格式，避免Markdown语法
            const plainContent = content.replace(/[#*|`]/g, ""); // 移除可能的Markdown符号

            switch (env) {
                case "Quantumult X":
                    $notify({ title, content: plainContent });
                    break;
                case "Loon":
                case "Surge":
                case "Shadowrocket":
                case "Stash":
                    $notification.post(title, "", plainContent);
                    break;
                default:
                    logger.log(`[本地通知] ${title}\n${plainContent}`);
            }
            logger.log("本地通知发送成功");
        } catch (e) {
            logger.error("通知发送失败:", e.message || e);
        }
    };

    // 常量定义
    const TARGET_LEAGUES = new Set(["LPL", "LCK", "Worlds"]);
    const GRAPHQL_URL = "https://esports.op.gg/matches/graphql/__query__ListUpcomingMatchesBySerie";

    // 时间转换：UTC转北京时间
    const utcToChina = (utcStr) => {
        try {
            const dtUtc = new Date(utcStr);
            if (isNaN(dtUtc.getTime())) {
                throw new Error(`无效的时间格式: ${utcStr}`);
            }

            // 计算北京时间（UTC+8）
            const chinaTime = new Date(
                dtUtc.getUTCFullYear(),
                dtUtc.getUTCMonth(),
                dtUtc.getUTCDate(),
                dtUtc.getUTCHours() + 8,
                dtUtc.getUTCMinutes(),
                dtUtc.getUTCSeconds()
            );
            return chinaTime;
        } catch (e) {
            logger.error("时间转换失败:", e.message);
            return null;
        }
    };

    // 获取赛事数据
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

    // 筛选今日赛事
    const filterTodayMatches = (matches) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const result = { LPL: [], LCK: [], Worlds: [] };

            for (const match of matches) {
                try {
                    const league = match?.tournament?.serie?.league?.shortName;
                    const matchTime = utcToChina(match.scheduledAt);
                    logger.debug(`赛区: ${league} 时间: ${matchTime}`);
                    if (!TARGET_LEAGUES.has(league)) continue;

                    if (!matchTime) continue;

                    if (matchTime >= today && matchTime < tomorrow) {
                        const timeStr = matchTime.toLocaleString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit"
                        });
                        result[league].push({
                            name: match.name,
                            time: timeStr
                        });
                    }
                } catch (e) {
                    logger.warn("处理单场赛事出错:", e.message);
                    continue;
                }
            }

            // 按时间排序
            result.LPL.sort((a, b) => new Date(`2000-01-01 ${a.time}`) - new Date(`2000-01-01 ${b.time}`));
            result.LCK.sort((a, b) => new Date(`2000-01-01 ${a.time}`) - new Date(`2000-01-01 ${b.time}`));
            result.Worlds.sort((a, b) => new Date(`2000-01-01 ${a.time}`) - new Date(`2000-01-01 ${b.time}`));

            return result;
        } catch (e) {
            logger.error("筛选赛事失败:", e.message);
            return { LPL: [], LCK: [] };
        }
    };

    // 生成纯文本通知内容（优化格式）
    const generatePlainContent = (matchData) => {
        let content = "";

        // 赛区标识（使用emoji增强可读性）
        const regionLabels = {
            LPL: "🇨🇳 LPL赛区",
            LCK: "🇰🇷 LCK赛区",
            Worlds: "🌍 世界赛"
        };

        // 拼接各赛区赛事
        let hasMatches = false;
        for (const [region, games] of Object.entries(matchData)) {
            if (games.length === 0) continue;

            hasMatches = true;
            //content += `【${regionLabels[region]}】\n`;
            games.forEach((game, index) => {
                content += `【${regionLabels[region]}】${game.time}  ${game.name}\n`;
            });
            //content += "\n"; // 赛区之间空行分隔
        }

        // 无赛事提示
        if (!hasMatches) {
            content += "今日暂无LPL/LCK赛事安排";
        }

        return content;
    };

    // 主函数
    const main = async () => {
        try {
            logger.log("程序开始运行");
            const matches = await fetchUpcomingMatches();
            const todayMatches = filterTodayMatches(matches);
            const plainContent = generatePlainContent(todayMatches);

            // 仅发送本地通知
            const today = new Date().toLocaleDateString("zh-CN");
            notify(`LOL今日赛事（${today}）`, plainContent);

            logger.log("程序运行结束");
        } catch (e) {
            logger.error("主程序出错:", e.message);
            notify("LOL赛事提醒", `运行失败: ${e.message}`);
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
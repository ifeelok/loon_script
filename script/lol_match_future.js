/******************************************
 * @name LOL今日及未来赛事（精准版）
 * @description 仅获取今日及之后的赛事，标题显示比赛日日期
 * @version 1.0.3
 * @feature 排除昨日赛事、标题显示比赛日、全赛区覆盖
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

    // 日志工具
    const logger = {
        log: (...args) => {
            const msg = args.filter(Boolean).join(" ");
            msg && console.log(`[LOL赛事] ${msg}`);
        },
        debug: (...args) => {
            const msg = args.filter(Boolean).join(" ");
            msg && console.log(`[LOL赛事][调试] ${msg}`);
        },
        error: (...args) => {
            const msg = args.filter(Boolean).join(" ");
            msg && console.log(`[LOL赛事][错误] ${msg}`);
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
            const requestOptions = {
                url: options.url,
                method,
                headers: options.headers || {},
                body: options.body ? JSON.stringify(options.body) : null,
                timeout: options.timeout || 15000
            };

            try {
                switch (env) {
                    case "Quantumult X":
                        $task.fetch(requestOptions).then(
                            (res) => {
                                if (res.statusCode < 200 || res.statusCode >= 300) {
                                    reject(new Error(`HTTP错误: ${res.statusCode}`));
                                    return;
                                }
                                resolve({
                                    status: res.statusCode,
                                    body: res.body,
                                    json: () => JSON.parse(res.body)
                                });
                            },
                            (err) => reject(new Error(`请求失败: ${err.message}`))
                        );
                        break;
                    case "Loon":
                    case "Surge":
                    case "Shadowrocket":
                    case "Stash":
                        $httpClient[method.toLowerCase()](requestOptions, (err, res, data) => {
                            if (err) reject(new Error(`请求错误: ${err.message}`));
                            else if (res.statusCode < 200 || res.statusCode >= 300) reject(new Error(`HTTP错误: ${res.statusCode}`));
                            else resolve({ status: res.statusCode, body: data, json: () => JSON.parse(data) });
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

    // 本地通知工具
    const notify = (title, content) => {
        try {
            const plainContent = content.replace(/[#*|`]/g, "");
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
                    logger.log(`[通知] ${title}\n${plainContent}`);
            }
            logger.log("赛事通知发送成功");
        } catch (e) {
            logger.error("通知失败:", e.message);
        }
    };

    // 2. 核心配置与工具函数
    const GRAPHQL_URL = "https://esports.op.gg/matches/graphql/__query__ListUpcomingMatchesBySerie";

    // UTC转北京时间（返回完整日期对象）
    const utcToChina = (utcStr) => {
        try {
            const utcDate = new Date(utcStr);
            if (isNaN(utcDate.getTime())) throw new Error(`无效时间: ${utcStr}`);

            const chinaDate = new Date(
                utcDate.getUTCFullYear(),
                utcDate.getUTCMonth(),
                utcDate.getUTCDate(),
                utcDate.getUTCHours() + 8, // UTC+8
                utcDate.getUTCMinutes()
            );
            return chinaDate;
        } catch (e) {
            logger.error("时间转换失败:", e.message);
            return null;
        }
    };

    // 格式化日期（YYYY-MM-DD，用于标题）
    const formatFullDate = (date) => {
        return date.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).replace(/\//g, "-");
    };

    // 格式化日期（MM-DD，用于内容）
    const formatShortDate = (date) => {
        return date.toLocaleDateString("zh-CN", {
            month: "2-digit",
            day: "2-digit"
        }).replace(/\//g, "-");
    };

    // 格式化时间（HH:MM）
    const formatTime = (date) => {
        return date.toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    // 计算日期与今天的差值（>=0表示今日及之后，<0表示昨日及之前）
    const getDayDiff = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);
        return Math.floor((target - today) / (1000 * 60 * 60 * 24));
    };

    // 3. 赛事数据处理
    const fetchMatches = async () => {
        try {
            logger.log("开始获取全赛区赛事数据...");
            const headers = {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127.0.0.0 Safari/537.36",
                "Referer": "https://esports.op.gg/"
            };

            const payload = {
                query: `query { 
                    upcomingMatches { 
                        id 
                        name 
                        status 
                        scheduledAt 
                        tournament { 
                            serie { 
                                league { shortName } 
                            } 
                        } 
                    } 
                }`
            };

            const res = await request({
                url: GRAPHQL_URL,
                method: "POST",
                headers,
                body: payload
            });
            const data = await res.json();

            if (!data?.data?.upcomingMatches || !Array.isArray(data.data.upcomingMatches)) {
                throw new Error("数据格式异常");
            }

            logger.log(`获取到${data.data.upcomingMatches.length}场赛事原始数据`);
            return data.data.upcomingMatches;
        } catch (e) {
            logger.error("获取赛事失败:", e.message);
            return [];
        }
    };

    // 核心逻辑：仅筛选今日及之后的赛事，取最近的一个比赛日
    const filterFutureMatches = (matches) => {
        try {
            // 1. 预处理：仅保留今日及之后的赛事（排除昨日及更早）
            const futureMatches = [];
            for (const match of matches) {
                try {
                    const league = match?.tournament?.serie?.league?.shortName;
                    const matchTime = utcToChina(match.scheduledAt);
                    if (!league || !matchTime) continue;

                    const dayDiff = getDayDiff(matchTime);
                    if (dayDiff < 0) continue; // 跳过昨日及更早的赛事

                    futureMatches.push({
                        league,
                        name: match.name || "未命名赛事",
                        status: match.status,
                        time: matchTime,
                        fullDateStr: formatFullDate(matchTime), // 完整日期（用于标题）
                        shortDateStr: formatShortDate(matchTime), // 简短日期（用于内容）
                        timeStr: formatTime(matchTime),
                        dayDiff: dayDiff
                    });
                } catch (e) {
                    logger.error(`处理赛事出错: ${e.message}`);
                    continue;
                }
            }

            if (futureMatches.length === 0) {
                return { targetFullDate: null, targetShortDate: null, matches: {} };
            }

            // 2. 按比赛日分组（今日→明日→后天...）
            const dateGroups = new Map();
            futureMatches.forEach(match => {
                if (!dateGroups.has(match.fullDateStr)) {
                    dateGroups.set(match.fullDateStr, {
                        shortDate: match.shortDateStr,
                        dayDiff: match.dayDiff,
                        matches: new Map() // 按赛区分组
                    });
                }
                const dateGroup = dateGroups.get(match.fullDateStr);

                if (!dateGroup.matches.has(match.league)) {
                    dateGroup.matches.set(match.league, []);
                }
                dateGroup.matches.get(match.league).push(match);
            });

            // 3. 取最近的比赛日（优先今日，再明日，依次类推）
            let targetFullDate = null;
            let targetShortDate = null;
            let targetGroup = null;
            let minDayDiff = Infinity;

            dateGroups.forEach((group, fullDate) => {
                if (group.dayDiff < minDayDiff) {
                    minDayDiff = group.dayDiff;
                    targetFullDate = fullDate;
                    targetShortDate = group.shortDate;
                    targetGroup = group;
                }
            });

            // 4. 整理目标比赛日的赛事（按赛区+时间排序）
            const result = {};
            targetGroup.matches.forEach((matches, league) => {
                // 按时间升序排序
                const sortedMatches = matches.sort((a, b) => a.time - b.time);
                // 补充状态文本
                result[league] = sortedMatches.map(match => {
                    const statusText = match.status === "completed" ? "[已结束]" :
                        match.status === "in_progress" ? "[进行中]" : "[未开始]";
                    return {
                        name: `${statusText} ${match.name}`,
                        time: match.timeStr
                    };
                });
            });

            return {
                targetFullDate: targetFullDate, // 完整日期（用于标题）
                targetShortDate: targetShortDate, // 简短日期（用于内容）
                matches: result
            };
        } catch (e) {
            logger.error("筛选未来赛事失败:", e.message);
            return { targetFullDate: null, targetShortDate: null, matches: {} };
        }
    };

    // 4. 生成通知内容
    const generateContent = (shortDate, matchData) => {
        // 无赛事时的提示
        if (!shortDate || Object.keys(matchData).length === 0) {
            return "未查询到今日及之后的任何赛事数据";
        }

        let content = "";

        // 日期描述（今日/明日/具体日期）- 紧凑开头，无单独换行
        const todayShort = formatShortDate(new Date());
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowShort = formatShortDate(tomorrow);

        let dateDesc = "";
        if (shortDate === todayShort) dateDesc = "今日";
        else if (shortDate === tomorrowShort) dateDesc = "明日";
        else dateDesc = shortDate;
        //content += `📅 ${dateDesc}赛事:\n`; // 日期后直接接赛事，无换行

        // 热门赛区emoji标识
        const leagueEmoji = {
            LPL: "🇨🇳",
            LCK: "🇰🇷",
            LCS: "🇺🇸",
            LE: "🇪🇺",
            Worlds: "🌍",
            PCS: "🇭🇰",
            VCS: "🇻🇳"
        };

        // 拼接各赛区赛事（核心紧凑逻辑）
        const allGames = []; // 用数组暂存所有赛事，最后统一拼接（避免多余分隔符）
        Object.entries(matchData).forEach(([league, matches]) => {
            // 跳过非数组/空数组的赛事
            if (!Array.isArray(matches) || matches.length === 0) return;

            const emoji = leagueEmoji[league] || "🏆";
            // 每条赛事直接带赛区标识，取消序号和空行
            matches.forEach((match) => {
                const gameTime = match?.time || "时间未知";
                const gameName = match?.name || "未命名赛事";
                // 格式：【emoji 赛区】时间 赛事名（无换行，用空格分隔）
                allGames.push(`【${emoji} ${league}】${gameTime} ${gameName}`);
            });
        });

        // 拼接所有赛事（用空格分隔，无空行）
        content += allGames.join("\n");

        return content;
    };

    // 5. 主函数
    const main = async () => {
        try {
            logger.log("程序开始运行（今日及未来赛事）");
            const rawMatches = await fetchMatches();
            const { targetFullDate, targetShortDate, matches } = filterFutureMatches(rawMatches);
            const notifyContent = generateContent(targetShortDate, matches);

            // 通知标题：直接用比赛日的完整日期（如“LOL赛事 2025-08-23”）
            const notifyTitle = targetFullDate
                ? `英雄联盟赛事（${targetFullDate}）`
                : "英雄联盟赛事查询结果";

            notify(notifyTitle, notifyContent);
            logger.log("程序运行结束");
        } catch (e) {
            logger.error("主程序异常:", e.message);
            notify("LOL赛事查询失败", `错误原因: ${e.message}`);
        } finally {
            if (["Quantumult X", "Loon", "Surge", "Shadowrocket", "Stash"].includes(env)) {
                $done();
            }
        }
    };

    main();
})();
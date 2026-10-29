// ==UserScript==
// @name         TfL 服务信息
// @author       檀轶步棋
// @version      1.0.0
// @timestamp    2026-10-28 23:00:00
// @license      GNU GPLv3
// @description  展示 api.tfl.gov.uk 提供的服务信息
// @homepageURL  https://github.com/oissevalt/sealdice-plugins
// ==/UserScript==

const EXT_ID = "tfl-service-info";
const EXT_AUTHOR = "檀轶步棋";
const EXT_VERSION = "1.0.0";

const CONFIG_BACKEND_ID = "tfl-service-info:BackendUrl";
const CONFIG_SECRET_ID = "tfl-service-info:Secret";

const DEFAULT_BACKEND = "https://api.tfl.gov.uk";

const Extension = getOrRegisterExtension();

const ServiceAliases: Record<string, string[]> = {
    "bakerloo": ["bak", "bkl", "贝克卢", "贝克卢线"],
    "central": ["cen", "ctl", "中央", "中央线"],
    "circle": ["cir", "环线"],
    "district": ["dis", "dtr", "区域线"],
    "hammersmith-city": ["hsmith", "hc", "hammersmith", "hammersmith&city", "hammersmith & city", "哈默史密斯", "哈默史密斯及城市线"],
    "elizabeth": ["elz", "lizzie", "lizzy", "伊丽莎白", "伊丽莎白线"],
    "jubilee": ["jbl", "jub", "银禧", "银禧线"],
    "metropolitan": ["met", "都市线", "大都会线", "大都会"],
    "northern": ["nor", "ntr", "北线"],
    "piccadilly": ["pic", "pdl", "皮卡迪利", "皮卡迪利线"],
    "victoria": ["vic", "vct", "维多利亚", "维多利亚线"],
    "waterloo-city": ["wat", "wc", "waterloo", "waterloo&city", "waterloo & city", "滑铁卢", "滑铁卢及城市线"],
    "dlr": ["docklands light rail", "docklands lightrail", "dockland light rail", "dockland lightrail", "码头区轻轨"],
    "liberty": ["lib", "lbt", "利伯蒂", "利伯蒂线", "自由线"],
    "lioness": ["lio", "lns", "母狮", "母狮线", "雌狮", "雌狮线", "莱昂尼斯", "莱昂尼斯线"],
    "mildmay": ["mil", "mdm", "mlm", "米尔德梅", "米尔德梅线", "麦尔徳梅", "麦尔德梅线", "迈尔徳梅", "迈尔德梅线"],
    "suffragette": ["suf", "sfg", "srg", "妇政线", "萨弗拉吉特", "萨弗拉吉特线"],
    "weaver": ["wea", "wvr", "织工线", "纺织工线", "韦弗线"],
    "windrush": ["win", "wind", "wdr", "冲风线", "破风线", "温德鲁什", "温德鲁什线"],
    "tram": ["电车"],
};

const ChineseServiceNames: Record<string, string> = {
    "bakerloo": "贝克卢线(Bakerloo)",
    "central": "中央线(Central)",
    "circle": "环线(Circle)",
    "district": "区域线(District)",
    "hammersmith-city": "哈默史密斯及城市线(Hammersmith & City)",
    "elizabeth": "伊丽莎白线(Elizabeth)",
    "jubilee": "银禧线(Jubilee)",
    "metropolitan": "大都会线(Metropolitan)",
    "northern": "北线(Northern)",
    "piccadilly": "皮卡迪利线(Piccadilly)",
    "victoria": "维多利亚线(Victoria)",
    "waterloo-city": "滑铁卢及城市线(Waterloo & City)",
    "dlr": "码头区轻轨(DLR)",
    "liberty": "伦敦地上铁自由线(Liberty)",
    "lioness": "伦敦地上铁雌狮线(Lioness)",
    "mildmay": "伦敦地上铁米尔德梅线(Mildmay)",
    "suffragette": "伦敦地上铁妇政线(Suffragette)",
    "weaver": "伦敦地上铁织工线(Weaver)",
    "windrush": "伦敦地上铁冲风线(Windrush)",
    "tram": "南伦敦电车(Tram)",
};

const SeverityCodes: Record<number, { english: string, chinese: string }> = {
    0: { english: "Special Service", chinese: "特别班列" },
    1: { english: "Closed", chinese: "停运" },
    2: { english: "Suspended", chinese: "暂停服务" },
    3: { english: "Part Suspended", chinese: "部分暂停服务" },
    4: { english: "Planned Closure", chinese: "计划停运" },
    5: { english: "Part Closure", chinese: "部分停运" },
    6: { english: "Severe Delays", chinese: "严重延误" },
    7: { english: "Reduced Service", chinese: "班次减少" },
    8: { english: "Bus Service", chinese: "替代巴士服务" },
    9: { english: "Minor Delays", chinese: "轻微延误" },
    10: { english: "Good Service", chinese: "运行良好" },
    11: { english: "Part Closed", chinese: "部分关闭" },
    12: { english: "Exit Only", chinese: "只出不进" },
    13: { english: "No Step Free Access", chinese: "无障碍通道暂停使用" },
    14: { english: "Change of frequency", chinese: "班列频次调整" },
    15: { english: "Diverted", chinese: "改道运行" },
    16: { english: "Not Running", chinese: "无服务" },
    17: { english: "Issues Reported", chinese: "有异常报告" },
    18: { english: "No Issues", chinese: "无异常" },
    19: { english: "Information", chinese: "有乘客通知" },
    20: { english: "Service Closed", chinese: "已结束运营" },
};

interface LineStatus {
    statusSeverity: number;
    statusSeverityDescription: string;
    reason?: string;
}

interface Line {
    id: string;
    name: string;
    lineStatuses: LineStatus[];
}

const CommandTfl = seal.ext.newCmdItemInfo();
CommandTfl.name = "tfl";
CommandTfl.help = "[.tfl <line-code>] // 查询线路运行情况";

CommandTfl.solve = (context, message, cmdArguments) => {
    const returnInfo = seal.ext.newCmdExecuteResult(true);
    const arg1 = cmdArguments.getArgN(1);

    switch (arg1) {
        case "all": {
            // TODO
            seal.replyToSender(context, message, "功能暂未实现");
            break;
        }
        case "help": {
            returnInfo.showHelp = true;
            break;
        }
        default: {
            // TODO: batch query
            const restArgs = cmdArguments.getRestArgsFrom(1);
            const services = restArgs.split(/[,，、]/)
                .map((id) => normalizeServiceId(id));
            queryServiceInfo(services)
                .then((report) => seal.replyToSender(context, message, report))
                .catch((err) => {
                    console.error(err);
                    seal.replyToSender(context, message, "出现错误，请查看控制台");
                });
            break;
        }
    }

    return returnInfo;
};

Extension.cmdMap["tfl"] = CommandTfl;

function getBackendUrl() {
    const raw = (seal.ext.getStringConfig(Extension, CONFIG_BACKEND_ID) || "").trim();
    // Strip trailing slashes so we never end up with "//Line/..."
    return (raw || DEFAULT_BACKEND).replace(/\/+$/, "");
}

function getSecret() {
    return (seal.ext.getStringConfig(Extension, CONFIG_SECRET_ID) || "").trim();
}

function isOfficialTfl(backendUrl: string) {
    return /^https?:\/\/api\.tfl\.gov\.uk$/i.test(backendUrl);
}

function normalizeServiceId(rawId: string) {
    rawId = rawId.toLocaleLowerCase().trim();
    for (const [id, names] of Object.entries(ServiceAliases)) {
        if (rawId == id || names.includes(rawId)) {
            return id;
        }
    }
    return rawId;
}

async function queryServiceInfo(normalizedServiceIds: string[]) {
    const ids = normalizedServiceIds.map(encodeURIComponent).join(",");
    const backend = getBackendUrl();
    const secret = getSecret();
    const url = `${backend}/Line/${ids}/Status`;

    const headers: Record<string, string> = {};
    let requestUrl = url;
    if (secret) {
        if (isOfficialTfl(backend)) {
            requestUrl += `?app_key=${encodeURIComponent(secret)}`;
        } else {
            headers["x-proxy-secret"] = secret;
        }
    }
    console.log(`Sending request to ${url}`);

    const response = await fetch(requestUrl, { headers });
    // Definition of response:
    // https://api-portal.tfl.gov.uk/api-details#api=Line&operation=Status
    if (!response.ok) {
        let detail = response.statusText;
        try {
            const err = await response.json();
            detail = err.message ?? detail;
        } catch {
            // body wasn't JSON, keep statusText
        }
        throw new Error(`TfL ${response.status}: ${detail}`);
    }
    const lines = (await response.json()) as Line[];
    if (!Array.isArray(lines)) {
        throw Error(`Expected response body as array, got ${JSON.stringify(lines)}`);
    }
    if (lines.length == 0) {
        return `未找到线路：${normalizedServiceIds.join(", ")}`;
    }
    const statusReports: string[] = [];
    for (const line of lines) {
        const displayName = ChineseServiceNames[line.id] || line.name;
        if (line.lineStatuses.length == 1) {
            const status = line.lineStatuses[0];
            if (status.statusSeverity == 10) {
                statusReports.push(`${displayName}：运行良好(Good Service)`);
                continue;
            }
            const statusName = SeverityCodes[status.statusSeverity] || { english: "Unknown", chinese: "未知" };
            if (statusName.english.toLocaleLowerCase() != status.statusSeverityDescription.toLocaleLowerCase()) {
                console.error(`status name = ${statusName.english}, severity desc = ${status.statusSeverityDescription}.TfL what the heck ?`);
            }
            let description = `${displayName}：${statusName.chinese}(${statusName.english})`;
            if (status.reason) {
                description += `\n\n${status.reason}`;
            }
            statusReports.push(description);
            continue;
        }
        const lineStatuses: string[] = [];
        for (const status of line.lineStatuses) {
            const statusName = SeverityCodes[status.statusSeverity] || { english: "Unknown", chinese: "未知" };
            if (statusName.english.toLocaleLowerCase() != status.statusSeverityDescription.toLocaleLowerCase()) {
                console.error(`status name = ${statusName.english}, severity desc = ${status.statusSeverityDescription}.TfL what the heck ?`);
            }
            let description = `• ${statusName.chinese}(${statusName.english})`;
            if (status.reason) {
                description += ` ：${status.reason}`;
            }
            lineStatuses.push(description);
        }
        statusReports.push(`${displayName}：\n${lineStatuses.join("\n")}`);
    }
    return statusReports.join("\n\n");
}

function getOrRegisterExtension() {
    let ext = seal.ext.find(EXT_ID);
    if (!ext) {
        ext = seal.ext.new(EXT_ID, EXT_AUTHOR, EXT_VERSION);
        seal.ext.register(ext);
        seal.ext.registerStringConfig(ext, CONFIG_BACKEND_ID, DEFAULT_BACKEND, "后端地址。默认直连 TfL；使用代理时填写代理地址，如 https://example.com");
        seal.ext.registerStringConfig(ext, CONFIG_SECRET_ID, "", "密钥。直连 TfL 时填写 TfL API 密钥（作为 app_key 发送）；使用代理时填写代理密钥（作为 x-proxy-secret 请求头发送）");
    }
    return ext;
}
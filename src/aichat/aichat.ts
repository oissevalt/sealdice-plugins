// ==UserScript==
// @name         AI Chat
// @author       檀轶步棋
// @version      1.1.0
// @timestamp    2025-12-12 20:45:00
// @license      GNU GPLv3
// @description  基于 OpenAI ChatCompletion 的简单 AI 对话功能。
// @homepageURL  https://github.com/oissevalt
// ==/UserScript==

// Constants

const EXT_NAME = "aichat";
const EXT_VERSION = "1.1.0";
const EXT_AUTHOR = "檀轶步棋";

const CONF_BACKEND_URL_NAME = "AiChat:BackendUrl";
const CONF_APIKEY_NAME = "AiChat:ApiKey";
const CONF_MODEL_NAME = "AiChat:ModelName";
const CONF_TEMPERATURE_NAME = "AiChat:Temperature";
const CONF_SYSTEM_PROMPT_NAME = "AiChat:SystemPrompt";
const CONF_REASON_EFFORT_NAME = "AiChat:ReasonEffort";
const CONF_MAXTOKENS_NAME = "AiChat:MaxTokens";
const CONF_WHITELIST_NAME = "AiChat:Whitelist";
const CONF_DAILY_LIMIT_NAME = "AiChat:DailyLimit";

const STORAGE_QUOTA_KEY = "AiChat:GroupQuota";

const QUOTA_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Types

interface GroupQuotaData {
    [groupId: string]: {
        count: number;
        resetTime: number; // Unix timestamp (ms)
    };
}

// Global variables

const Extension = getOrRegisterExtension();

const ControlCommand = seal.ext.newCmdItemInfo();

ControlCommand.name = "chat";
ControlCommand.help = ".chat <聊天内容>";

ControlCommand.solve = (context, message, argument) => {
    const executionResult = seal.ext.newCmdExecuteResult(true);
    const userMessage = argument.cleanArgs;

    switch (userMessage) {
        case "":
            executionResult.showHelp = true;
            break;
        default:
            const isTrustedUser = context.privilegeLevel >= 70;
            const groupId = context.group.groupId;

            const apiKey = seal.ext.getStringConfig(Extension, CONF_APIKEY_NAME);
            if (!apiKey) {
                seal.replyToSender(context, message, "未配置 Api Key");
                break;
            }

            // Check whitelist (trusted users bypass this)
            if (!isTrustedUser) {
                const whitelist = getWhitelist();
                if (!whitelist.includes(groupId)) {
                    seal.replyToSender(context, message, "本群不在白名单内");
                    break;
                }

                const quotaCheck = checkAndUpdateQuota(groupId);
                if (!quotaCheck.allowed) {
                    seal.replyToSender(context, message, `本群今日调用次数已用完，${quotaCheck.resetInHours} 小时后重置`);
                    break;
                }
            }

            const backendUrl = seal.ext.getStringConfig(Extension, CONF_BACKEND_URL_NAME) || "https://openrouter.ai/api/v1/chat/completions";
            const modelName = seal.ext.getStringConfig(Extension, CONF_MODEL_NAME);
            const systemPrompt = seal.ext.getStringConfig(Extension, CONF_SYSTEM_PROMPT_NAME);
            const reasonEffort = seal.ext.getOptionConfig(Extension, CONF_REASON_EFFORT_NAME);
            const temperature = seal.ext.getFloatConfig(Extension, CONF_TEMPERATURE_NAME);
            const maxTokens = seal.ext.getIntConfig(Extension, CONF_MAXTOKENS_NAME) || 500;

            const requestBody: any = {
                model: modelName,
                max_tokens: maxTokens,
                temperature: Math.max(0, Math.min(1, temperature)),
                messages: [{ role: "user", content: userMessage }],
            };

            if (systemPrompt != "") {
                requestBody.messages = [{ role: "system", content: systemPrompt }, ...requestBody.messages];
            }

            if (reasonEffort != "default") {
                requestBody.reasoning = { effort: reasonEffort };
            }

            fetch(backendUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            }).then(async response => {
                if (!response.ok) {
                    return await Promise.reject([response.status, await response.json()]);
                }
                return await response.json();
            }).then(data => {
                seal.replyToSender(context, message, data.choices[0].message.content);
            }).catch(error => {
                if (!isTrustedUser) {
                    refundQuota(groupId);
                }

                if (Array.isArray(error)) {
                    const [status, data] = error;
                    console.error(`AI Chat: ${status}: ${data.error.message}`);
                } else {
                    console.error(`AI Chat: network error: ${error}`);
                }
                seal.replyToSender(context, message, "回复出现错误，请在骰主终端查看");
            });

            break;
    }

    return executionResult;
}

Extension.cmdMap["chat"] = ControlCommand;

// Helpers

function getOrRegisterExtension(): seal.ExtInfo {
    let ext = seal.ext.find(EXT_NAME);
    if (!ext) {
        ext = seal.ext.new(EXT_NAME, EXT_AUTHOR, EXT_VERSION);
        seal.ext.register(ext);

        seal.ext.registerStringConfig(ext, CONF_BACKEND_URL_NAME, "https://openrouter.ai/api/v1/chat/completions", "后端 URL")
        seal.ext.registerStringConfig(ext, CONF_APIKEY_NAME, "", "API Key");
        seal.ext.registerStringConfig(ext, CONF_MODEL_NAME, "deepseek/deepseek-v3.2", "模型标识符");
        seal.ext.registerStringConfig(ext, CONF_SYSTEM_PROMPT_NAME, "Be a friendly and professional AI assistant.", "System 提示词（人格设定）");
        seal.ext.registerIntConfig(ext, CONF_MAXTOKENS_NAME, 500, "回复 token 长度上限");
        seal.ext.registerFloatConfig(ext, CONF_TEMPERATURE_NAME, 0.7, "Temperature");
        seal.ext.registerOptionConfig(ext, CONF_REASON_EFFORT_NAME, "default", ["default", "minimum", "low", "medium", "high"], "推理强度（如果支持）");
        seal.ext.registerStringConfig(ext, CONF_WHITELIST_NAME, "", "群组白名单（英文逗号分隔的群号）");
        seal.ext.registerIntConfig(ext, CONF_DAILY_LIMIT_NAME, 5, "每群每日调用次数上限");
    }
    return ext;
}

function getWhitelist(): string[] {
    const raw = seal.ext.getStringConfig(Extension, CONF_WHITELIST_NAME);
    return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function getQuotaData(): GroupQuotaData {
    const raw = Extension.storageGet(STORAGE_QUOTA_KEY);
    if (!raw) {
        return {};
    }
    try {
        return JSON.parse(raw) as GroupQuotaData;
    } catch {
        return {};
    }
}

function saveQuotaData(data: GroupQuotaData): void {
    Extension.storageSet(STORAGE_QUOTA_KEY, JSON.stringify(data));
}

function checkAndUpdateQuota(groupId: string): { allowed: boolean; resetInHours?: number } {
    const dailyLimit = seal.ext.getIntConfig(Extension, CONF_DAILY_LIMIT_NAME) || 5;
    const now = Date.now();
    const data = getQuotaData();

    const groupData = data[groupId];

    if (!groupData || now >= groupData.resetTime) {
        data[groupId] = {
            count: 1,
            resetTime: now + QUOTA_RESET_INTERVAL_MS,
        };
        saveQuotaData(data);
        return { allowed: true };
    }

    if (groupData.count >= dailyLimit) {
        const resetInHours = Math.ceil((groupData.resetTime - now) / (60 * 60 * 1000));
        return { allowed: false, resetInHours };
    }

    groupData.count += 1;
    saveQuotaData(data);
    return { allowed: true };
}

function refundQuota(groupId: string): void {
    const data = getQuotaData();
    const groupData = data[groupId];

    if (groupData && groupData.count > 0) {
        groupData.count -= 1;
        saveQuotaData(data);
    }
}
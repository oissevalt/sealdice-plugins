// ==UserScript==
// @name         AI Chat
// @author       檀轶步棋
// @version      1.0.0
// @timestamp    2025-12-12 01:55:00
// @license      MIT
// @description  基于 OpenAI ChatCompletion 的简单 AI 对话功能。
// @homepageURL  https://github.com/oissevalt
// ==/UserScript==

// Constants

const EXT_NAME = "aichat";
const EXT_VERSION = "1.0.0";
const EXT_AUTHOR = "檀轶步棋";

const CONF_BACKEND_URL_NAME = "AiChat:BackendUrl";
const CONF_APIKEY_NAME = "AiChat:ApiKey";
const CONF_MODEL_NAME = "AiChat:ModelName";
const CONF_TEMPERATURE_NAME = "AiChat:Temperature";
const CONF_SYSTEM_PROMPT_NAME = "AiChat:SystemPrompt";
const CONF_REASON_EFFORT_NAME = "AiChat:ReasonEffort";
const CONF_MAXTOKENS_NAME = "AiChat:MaxTokens";

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
            if (context.privilegeLevel < 100) {
                seal.replyToSender(context, message, "AI 聊天目前仅骰主可用，白名单正在开发中");
                break;
            }

            const apiKey = seal.ext.getStringConfig(Extension, CONF_APIKEY_NAME);

            if (!apiKey) {
                seal.replyToSender(context, message, "未配置 Api Key");
                break;
            }

            const backendUrl = seal.ext.getStringConfig(Extension, CONF_BACKEND_URL_NAME) || "https://openrouter.ai/api/v1/chat/completions";
            const modelName = seal.ext.getStringConfig(Extension, CONF_MODEL_NAME) || "meta-llama/llama-3.3-70b-instruct:free";
            const systemPrompt = seal.ext.getStringConfig(Extension, CONF_SYSTEM_PROMPT_NAME);
            const reasonEffort = seal.ext.getOptionConfig(Extension, CONF_REASON_EFFORT_NAME);
            let temperature = seal.ext.getFloatConfig(Extension, CONF_TEMPERATURE_NAME);
            const maxTokens = seal.ext.getIntConfig(Extension, CONF_MAXTOKENS_NAME) || 500;

            if (temperature < 0) {
                temperature = 0;
            } else if (temperature > 1) {
                temperature = 1;
            }

            const requestBody = {
                model: modelName,
                max_tokens: maxTokens,
                temperature: temperature,
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
            }).catch(([status, data]) => {
                console.error(`AI Chat: ${status}: ${data.error.message}`);
                seal.replyToSender(context, message, "回复出现错误，请在骰主终端查看");
            })

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
    }
    return ext;
}

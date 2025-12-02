// ==UserScript==
// @name         EchoBack
// @author       檀轶步棋
// @version      1.0.0
// @timestamp    2025-12-02 02:15:00
// @license      MIT
// @description  Echos a random message after a random delay.
// @homepageURL  https://github.com/oissevalt
// ==/UserScript==

// Constants

const EXT_NAME = "echoback";
const EXT_VERSION = "1.0.0";
const EXT_AUTHOR = "檀轶步棋";

// Global variables

const GlobalState: { [groupId: string]: { active: boolean, content: string, counter: number } } = {};

const Extension = getOrRegisterExtension();

const ControlCommand = seal.ext.newCmdItemInfo();
ControlCommand.name = "echoback";
ControlCommand.help = ".echoback on/off";

ControlCommand.solve = (context, message, argument) => {
    const executionResult = seal.ext.newCmdExecuteResult(true);

    const action = argument.getRestArgsFrom(1).toLowerCase();

    if (["on", "off"].includes(action) && context.privilegeLevel < 50 /* moderator */) {
        seal.replyToSender(context, message, seal.formatTmpl(context, "核心:提示_无权限"));
        return executionResult;
    }

    if (!GlobalState[context.group.groupId]) {
        GlobalState[context.group.groupId] = { active: false, content: "", counter: -1 };
    }

    switch (action) {
        case "on":
            GlobalState[context.group.groupId].active = true;
            GlobalState[context.group.groupId].counter = -1;
            seal.replyToSender(context, message, "EchoBack 已开启");
            break;
        case "off":
            GlobalState[context.group.groupId].active = false;
            GlobalState[context.group.groupId].counter = -1;
            seal.replyToSender(context, message, "EchoBack 已关闭");
            break;
        default:
            executionResult.showHelp = true;
            break;
    }

    return executionResult;
};

Extension.cmdMap["echoback"] = ControlCommand;

Extension.onNotCommandReceived = (context, message) => {
    if (!GlobalState[context.group.groupId]?.active) {
        return;
    }

    if (context.isPrivate || context.group.logOn || message.sender.userId == context.endPoint.userId) {
        return;
    }

    switch (GlobalState[context.group.groupId].counter) {
        case -1:
            if (Math.random() < 0.2) {
                GlobalState[context.group.groupId].content = message.message;
                GlobalState[context.group.groupId].counter = Math.floor(Math.random() * 51) + 15;
                console.log(`EchoBack: Will echo lastly received message in ${GlobalState[context.group.groupId].counter} messages.`);
            }
            break;
        case 0:
            seal.replyToSender(context, message, `${GlobalState[context.group.groupId].content}`);
            GlobalState[context.group.groupId].counter = -1;
            GlobalState[context.group.groupId].content = "";
            break;
        default:
            GlobalState[context.group.groupId].counter -= 1;
            break;
    }
}

// Helpers

function getOrRegisterExtension(): seal.ExtInfo {
  let ext = seal.ext.find(EXT_NAME);
  if (!ext) {
    ext = seal.ext.new(EXT_NAME, EXT_AUTHOR, EXT_VERSION);
    seal.ext.register(ext);
  }
  return ext;
}

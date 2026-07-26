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

const CONF_CHANCE_KEY = "EchoBack:Probability";
const CONF_CHANCE_DEF = 0.15;

// Global variables

const GlobalState: {
  [groupId: string]: { active: boolean; content: string; counter: number };
} = {};

const Extension = getOrRegisterExtension();

const ControlCommand = seal.ext.newCmdItemInfo();

ControlCommand.name = "echoback";
ControlCommand.help = ".echoback on/off";
ControlCommand.disabledInPrivate = true;

ControlCommand.solve = (context, message, argument) => {
  const executionResult = seal.ext.newCmdExecuteResult(true);

  const action = argument.getRestArgsFrom(1).toLowerCase();

  if (
    ["on", "off"].includes(action) &&
    context.privilegeLevel < 50 /* moderator */
  ) {
    seal.replyToSender(
      context,
      message,
      seal.formatTmpl(context, "核心:提示_无权限"),
    );
    return executionResult;
  }

  if (context.isPrivate) {
    seal.replyToSender(
      context,
      message,
      seal.formatTmpl(context, "核心:提示_私聊不可用"),
    );
    return executionResult;
  }

  const groupId = context.group.groupId;

  if (!GlobalState[groupId]) {
    GlobalState[groupId] = {
      active: getExtensionActive(groupId),
      content: "",
      counter: -1,
    };
  }

  switch (action) {
    case "on":
      GlobalState[groupId].active = true;
      GlobalState[groupId].counter = -1;

      setExtensionActive(groupId, true);
      seal.replyToSender(context, message, "EchoBack 已开启");

      break;
    case "off":
      GlobalState[groupId].active = false;
      GlobalState[groupId].counter = -1;

      setExtensionActive(groupId, false);
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
  if (context.isPrivate) {
    return;
  }

  const groupId = context.group.groupId;

  if (!GlobalState[groupId]) {
    GlobalState[groupId] = {
      active: getExtensionActive(groupId),
      content: "",
      counter: -1,
    };
    return;
  }

  if (
    !GlobalState[groupId].active ||
    context.group.logOn ||
    message.sender.userId == context.endPoint.userId
  ) {
    return;
  }

  switch (GlobalState[groupId].counter) {
    case -1:
      if (Math.random() < seal.ext.getFloatConfig(Extension, CONF_CHANCE_KEY)) {
        if (!message.message || hasCqComponent(message.message)) {
          console.log(`EchoBack: Message has a CQ component, skipped.`);
          break;
        }

        GlobalState[groupId].content = message.message;
        GlobalState[groupId].counter = Math.floor(Math.random() * 46) + 20;

        console.log(
          `EchoBack: Will echo lastly received message in ${GlobalState[groupId].counter} messages.`,
        );
      }
      break;
    case 0:
      seal.replyToSender(context, message, `${GlobalState[groupId].content}`);

      GlobalState[groupId].counter = -1;
      GlobalState[groupId].content = "";

      break;
    default:
      if (GlobalState[groupId].counter < 0) {
        GlobalState[groupId].counter = -1;
        break;
      }

      GlobalState[groupId].counter -= 1;

      break;
  }
};

function setExtensionActive(groupId: string, active: boolean): void {
  Extension.storageSet(groupId, JSON.stringify(active));
}

function getExtensionActive(groupId: string): boolean {
  return JSON.parse(Extension.storageGet(groupId) || "false");
}

// Helpers

function getOrRegisterExtension(): seal.ExtInfo {
  let ext = seal.ext.find(EXT_NAME);

  if (!ext) {
    ext = seal.ext.new(EXT_NAME, EXT_AUTHOR, EXT_VERSION);
    seal.ext.register(ext);
    seal.ext.registerFloatConfig(
      ext,
      CONF_CHANCE_KEY,
      CONF_CHANCE_DEF,
      "每次收到消息时，将消息标记为复读的概率(大于等于 1 则必定触发)",
    );
  }

  return ext;
}

function hasCqComponent(message: string): boolean {
  if (message.length < 5) {
    // impossible to contain a CQ component
    return false;
  }

  // This will incorrectly match incomplete structures at the beginning,
  // but we allow this behaviour as precision is not mandatory.
  if (message.startsWith("[CQ:")) {
    return true;
  }

  return /\[CQ:.+\]/.test(message);
}

// ==UserScript==
// @name         DrawChat
// @author       檀轶步棋
// @version      1.0.0
// @timestamp    2025-12-01 18:15:00
// @license      GNU GPLv3
// @description  Draws a random message from chat history.
// @homepageURL  https://github.com/oissevalt
// ==/UserScript==

// Constants

const EXT_NAME = "drawchat";
const EXT_VERSION = "1.0.0";
const EXT_AUTHOR = "檀轶步棋";

const STORAGE_NAMESPACE = "drawchat";

// Global variables

const Extension = getOrRegisterExtension();

const ControlCommand = seal.ext.newCmdItemInfo();

ControlCommand.name = "drawchat";
ControlCommand.help = ".drawchat on/off/clear";

ControlCommand.solve = (context, message, argument) => {
  const executionResult = seal.ext.newCmdExecuteResult(true);

  const action = argument.getRestArgsFrom(1).toLowerCase();

  if (
    ["on", "off", "clear"].includes(action) &&
    context.privilegeLevel < 50 /* moderator */
  ) {
    seal.replyToSender(
      context,
      message,
      seal.formatTmpl(context, "核心:提示_无权限"),
    );
    return executionResult;
  }

  switch (action) {
    case "on":
      toggleGroupActive(true, context.group.groupId);
      seal.replyToSender(context, message, "DrawChat 已开启");
      break;
    case "off":
      toggleGroupActive(false, context.group.groupId);
      seal.replyToSender(context, message, "DrawChat 已关闭");
      break;
    case "clear":
      clearGroupMessage(context.group.groupId);
      seal.replyToSender(context, message, "历史记录已清除");
      break;
    default:
      const drawnMessage = getRandomMessage(context.group.groupId);
      if (drawnMessage) {
        seal.replyToSender(
          context,
          message,
          `随机消息:\n${drawnMessage.speaker}说: ${drawnMessage.content}`,
        );
      } else {
        seal.replyToSender(
          context,
          message,
          "没有可用的消息记录，请先发送消息",
        );
      }
      break;
  }

  return executionResult;
};

Extension.cmdMap["drawchat"] = ControlCommand;

Extension.onNotCommandReceived = (context, message) => {
  if (context.isPrivate || context.group.logOn) {
    return;
  }
  if (message.sender.userId == context.endPoint.userId) {
    return;
  }

  const rand = Math.random();
  if (rand < 0.25) {
    recordMessage(context.player.name, message.message, context.group.groupId);
  }
};

// Business logic

function toggleGroupActive(isActive: boolean, groupId: string) {
  const storage = JSON.parse(
    Extension.storageGet(`${STORAGE_NAMESPACE}_${groupId}`) || "{}",
  );
  storage["active"] = isActive;
  Extension.storageSet(
    `${STORAGE_NAMESPACE}_${groupId}`,
    JSON.stringify(storage),
  );
}

function recordMessage(speakerName: string, content: string, groupId: string) {
  const storage = JSON.parse(
    Extension.storageGet(`${STORAGE_NAMESPACE}_${groupId}`) || "{}",
  );
  if (!storage["messages"]) {
    storage["messages"] = [];
  }
  if (!Object.keys(storage).includes("active")) {
    storage["active"] = false;
  }
  if (!storage["active"]) {
    return;
  }
  if (storage["messages"].length >= 100) {
    storage["messages"].shift();
  }
  storage["messages"].push({
    speaker: speakerName,
    content: content,
  });
  console.log(`DrawChat: Recorded lastly received message.`);
  Extension.storageSet(
    `${STORAGE_NAMESPACE}_${groupId}`,
    JSON.stringify(storage),
  );
}

function clearGroupMessage(groupId: string) {
  const storage = JSON.parse(
    Extension.storageGet(`${STORAGE_NAMESPACE}_${groupId}`) || "{}",
  );
  storage["messages"] = [];
  Extension.storageSet(
    `${STORAGE_NAMESPACE}_${groupId}`,
    JSON.stringify(storage),
  );
}

function getRandomMessage(
  groupId: string,
): { speaker: string; content: string } | null {
  const storage = JSON.parse(
    Extension.storageGet(`${STORAGE_NAMESPACE}_${groupId}`) || "{}",
  );
  const messages = storage["messages"] || [];
  if (messages.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
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

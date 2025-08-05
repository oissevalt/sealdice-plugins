// ==UserScript==
// @name         日志进度定位
// @author       檀轶步棋
// @version      1.0.0
// @timestamp    2025-08-05 13:00
// @license      MIT
// @description  在 .log on 时，定位到上一次 .log end 的位置
// @homepageURL  https://github.com/oissevalt
// ==/UserScript==

// Constants
const EXT_NAME = "lastlog";
const EXT_VER = "1.0.0";
const EXT_AUTHOR = "檀轶步棋";

const REPLY_MSG = "REPLY_MSG";

// Statics
const Extension = getOrRegisterExtension();

Extension.onCommandReceived = (context, message, argument) => {
  if (argument.command != "log" || context.isPrivate) {
    return;
  }
  switch (argument.getArgN(1)) {
    case "on":
      const lastLog = getLogEnd(context.group.groupId);
      if (lastLog == "") {
        return;
      }
      const replyMessage = seal.ext.getStringConfig(Extension, REPLY_MSG);
      seal.replyToSender(context, message, `[CQ:reply,id=${lastLog}] ${replyMessage}`);
    case "off":
      setLogEnd(context.group.groupId, message.rawId);
    default:
      return;
  }
};

// Helpers
function setLogEnd(groupId: string, messageId: string) {
  Extension.storageSet(groupId, JSON.stringify(messageId));
}

function getLogEnd(groupId: string): string {
  return JSON.parse(Extension.storageGet(groupId) || '""');
}

function getOrRegisterExtension(): seal.ExtInfo {
  let ext = seal.ext.find(EXT_NAME);
  if (!ext) {
    ext = seal.ext.new(EXT_NAME, EXT_AUTHOR, EXT_VER);
    seal.ext.register(ext);
    seal.ext.registerStringConfig(
      ext,
      REPLY_MSG,
      "（上一次log end在此处，可能由于消息过于久远而无法定位）",
      "回复上一条记录时的信息"
    );
  }
  return ext;
}

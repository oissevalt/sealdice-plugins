// ==UserScript==
// @name         投票插件
// @author       檀轶步棋
// @version      1.0.1
// @description  发起并统计投票。
// @timestamp    2025-07-20 23:00
// @license      MIT
// @homepageURL  https://github.com/oissevalt
// ==/UserScript==

/*
 1.0.1 版本
 - 完善单主诉求
 - 不再允许对同一选项重复投票
 - 投票结束时一同展示0票选项
 */

// Constants
const EXT_NAME = "vote";
const EXT_VER = "1.0.1";
const EXT_AUTHOR = "檀轶步棋";

// Statics
const Extension = getOrRegisterExtension();
const VoteMap = new Map<string, Vote>();

// Main logic
const commandVote = seal.ext.newCmdItemInfo();
commandVote.name = "vote";
commandVote.help = `用法:
.vote new [名称] [模式] [持续分钟数,不填则无限长] 选项... // 创建投票，模式有s(单选)m(多选)，选项空格隔开
.vote [选项序号...] // 参与投票，若多选则可用多个序号，空格隔开
.vote show // 展示当前投票选项
.vote end // 强行结束当前群组的投票
.vote version // 输出插件信息
.vote help // 输出当前帮助信息
`;
commandVote.disabledInPrivate = true;
commandVote.solve = (context, message, argument) => {
  const executionResult = seal.ext.newCmdExecuteResult(true);
  const subcommand = argument.getArgN(1);

  switch (subcommand) {
    case "new": {
      if (VoteMap.has(context.group.groupId)) {
        seal.replyToSender(context, message, "当前群组有正在进行的投票，请先 .vote end 结束");
        break;
      }
      const voteName = argument.getArgN(2);
      const voteMode = argument.getArgN(3).toLowerCase();
      if (!voteName || !voteMode || !["s", "m"].includes(voteMode)) {
        seal.replyToSender(context, message, "参数错误，请用 .vote help 查看用法");
        break;
      }
      const voteDurationMinutes = parseInt(argument.getArgN(4));
      const isDurationValid = !isNaN(voteDurationMinutes) && voteDurationMinutes > 0;
      const choices = (isDurationValid ? argument.getRestArgsFrom(5) : argument.getRestArgsFrom(4)).split(" ");
      if (choices.length <= 1) {
        seal.replyToSender(context, message, "选项数量不够，至少要两个以上，中间用空格分开");
        break;
      }
      const vote = {
        name: voteName,
        mode: voteMode as "s" | "m",
        choices: choices,
        responses: {},
      };
      VoteMap.set(context.group.groupId, vote);
      seal.replyToSender(
        context,
        message,
        `投票已创建，${vote.mode == "s" ? "单选" : "多选"}，共${vote.choices.length}项，持续时间${
          isDurationValid ? voteDurationMinutes : "infinite"
        }分钟`
      );
      if (!isDurationValid) {
        break;
      }
      setTimeout(() => {
        const vote2 = VoteMap.get(context.group.groupId);
        if (vote2) {
          const sort = sortResponses(vote2);
          const list = sort.map(([choice, count]) => `${choice}: ${count}`).join("\n");
          seal.replyToSender(context, message, `投票《${vote2.name}》已经结束，统计结果如下:\n${list}`);
          VoteMap.delete(context.group.groupId);
        }
      }, voteDurationMinutes * 60 * 1000);
      break;
    }
    case "end": {
      const vote = VoteMap.get(context.group.groupId);
      if (!vote) {
        seal.replyToSender(context, message, "当前群组没有进行的投票");
        break;
      }
      const sort = sortResponses(vote);
      const list = sort.map(([choice, count]) => `${choice}: ${count}`).join("\n");
      seal.replyToSender(context, message, `投票《${vote.name}》已经结束，统计结果如下:\n${list}`);
      VoteMap.delete(context.group.groupId);
      break;
    }
    case "show": {
      const vote = VoteMap.get(context.group.groupId);
      if (!vote) {
        seal.replyToSender(context, message, "当前群组没有进行的投票");
        break;
      }
      const choices = vote.choices.map((choice, index) => `${index + 1}. ${choice}`).join("\n");
      seal.replyToSender(context, message, `当前群组投票(${vote.mode == "s" ? "单选" : "多选"})：\n${choices}`);
      if (Object.keys(vote.responses).length > 0) {
        const sort = sortResponses(vote);
        const list = sort.map(([choice, count]) => `${choice}: ${count}`).join("\n");
        seal.replyToSender(context, message, `目前票数统计结果:\n${list}`);
      }
      break;
    }
    case "version": {
      seal.replyToSender(context, message, `投票插件 by ${EXT_AUTHOR}, ver ${EXT_VER}`);
      break;
    }
    case "help": {
      executionResult.showHelp = true;
      break;
    }
    default: {
      const vote = VoteMap.get(context.group.groupId);
      if (!vote) {
        seal.replyToSender(context, message, "当前群组没有进行的投票");
        break;
      }
      const choices = argument.getRestArgsFrom(1).split(" ");
      if (choices.length == 0) {
        executionResult.showHelp = true;
        break;
      }
      const chosenIndices = [];
      for (const choice of choices) {
        const c = parseInt(choice);
        if (!c || c < 1 || c > vote.choices.length) {
          seal.replyToSender(context, message, `参数'${choice}'不是一个有效的序号，请重选`);
          return executionResult;
        }
        chosenIndices.push(c - 1);
      }
      if (chosenIndices.length > 1 && vote.mode == "s") {
        seal.replyToSender(context, message, "当前投票仅支持单选");
        break;
      }
      if (vote.responses[context.player.userId] && vote.mode == "s") {
        seal.replyToSender(context, message, "当前投票仅支持单选且你已经投过票");
        break;
      }
      if (!areChoicesUnique(chosenIndices)) {
        seal.replyToSender(context, message, "选项中有重复项，请重选");
        break;
      }
      if (!vote.responses[context.player.userId]) {
        vote.responses[context.player.userId] = [];
      }
      if (chosenIndices.some((c) => vote.responses[context.player.userId].includes(c))) {
        seal.replyToSender(context, message, "你已经投给了其中一些选项，本次投票无效");
        break;
      }
      const choiceContents = [];
      for (const index of chosenIndices) {
        vote.responses[context.player.userId].push(index);
        choiceContents.push(vote.choices[index]);
      }
      seal.replyToSender(context, message, `投票已记录，你投给了${choiceContents.join("、")}`);
      break;
    }
  }

  return executionResult;
};

Extension.cmdMap[commandVote.name] = commandVote;

// Types

type Vote = {
  name: string;
  mode: "s" | "m";
  choices: string[];
  responses: { [_: string]: number[] };
};

// Helper functions

function sortResponses(vote: Vote): Array<[choice: string, count: number]> {
  const frequencies = new Map<string, number>();
  vote.choices.forEach((c) => frequencies.set(c, 0));
  for (const choices of Object.values(vote.responses)) {
    for (const index of choices) {
      const choice = vote.choices[index];
      frequencies.set(choice, (frequencies.get(choice) ?? 0) + 1);
    }
  }
  return [...frequencies.entries()].sort(([, a], [, b]) => b - a);
}

function areChoicesUnique(choices: number[]): boolean {
  const seen = new Set<number>();
  for (const choice of choices) {
    if (seen.has(choice)) {
      return false;
    }
    seen.add(choice);
  }
  return true;
}

function getOrRegisterExtension(): seal.ExtInfo {
  let ext = seal.ext.find(EXT_NAME);
  if (!ext) {
    ext = seal.ext.new(EXT_NAME, EXT_AUTHOR, EXT_VER);
    seal.ext.register(ext);
  }
  return ext;
}

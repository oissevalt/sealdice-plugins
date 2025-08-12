// ==UserScript==
// @name         三角机构游戏规则
// @author       败雪、檀轶步棋
// @version      1.0.0
// @timestamp    2025-08-12 20:00
// @license      MIT
// @description  支持三角机构（Triangle Agency）规则，包括 .ta 检定和 .cs 混沌值管理。
// @homepageURL  https://github.com/oissevalt
// ==/UserScript==

// Constants

const EXT_NAME = "triangle-agency";
const EXT_AUTHOR = "败雪、檀轶步棋";
const EXT_VERSION = "1.0.0";

const TA_MAX_EXECTIME_STR = "TriangleAgency:MaxExecTime";
const TA_MAX_EXECTIME = 5;
const TA_EXCESMSG_NAMESPACE_STR = "TriangleAgency:ExcesMsgNamespace";
const TA_CHECKMSG_NAMESPACE_STR = "TriangleAgency:CheckMsgNamespace";
const TA_CHECKPREFIX_STR = "TriangleAgency:CheckPrefix";
const TA_CHECKPREFIX = "{$t玩家}的能力使用已批准……\n";
const TA_SUCCESS_STR = "TriangleAgency:SuccessMsg";
const TA_BIGSUCCESS_STR = "TriangleAgency:BigSuccessMsg";
const TA_FAILURE_STR = "TriangleAgency:FailureMsg";
const TA_SUCCESS = "这一瞬间，现实为你而扭曲。";
const TA_FAILURE = "它冰冷而不可撼动，仿若一座黑色的方尖碑。";
const TA_BIGSUCCESS = "三尖冠——天命昭昭。";
const TA_SUCCESS_SHORT_STR = "TriangleAgency:SuccessShortMsg";
const TA_BIGSUCCESS_SHORT_STR = "TriangleAgency:BigSuccessShortMsg";
const TA_FAILURE_SHORT_STR = "TriangleAgency:FailureShortMsg";
const TA_SUCCESS_SHORT = "成功";
const TA_FAILURE_SHORT = "失败";
const TA_BIGSUCCESS_SHORT = "大成功";
const TA_NAMESPACE_COC = "COC";
const TA_NAMESPACE_DND = "DND";
const TA_NAMESPACE_TA = "TA";
const TA_CUSTOM_EXCESMSG_STR = "TriangleAgency:CustomExcesMsg";
const TA_CUSTOM_EXCESMSG = "检定轮数过多，机构不予支持。";
const TA_CHAOS_VAR_STR = "TriangleAgency:ChaosVar";
const TA_CHAOS_VAR = "$g混沌";

const GAME_TEMPLATE = {
  name: "ta",
  fullName: "三角机构规则",
  authors: ["檀轶步棋"],
  version: "0.1.0",
  updatedTime: "20250812",
  templateVer: "2.0",
  nameTemplate: {
    ta: {
      template: "{$t玩家_RAW}",
      helpText: "自动设置名片",
    },
  },
  attrSettings: {
    top: ["专注", "共情", "仪态", "顽固", "双面", "先机", "敬业", "外向", "精微"],
    sortBy: "name",
    showAs: {},
  },
  setConfig: {
    diceSides: 4,
    keys: ["ta", "triangle-agency"],
    enableTip: "已切换至4面骰，并自动开启ta扩展",
    relatedExt: ["dnd5e", "coc7", "ta"], // 不能乱，dnd 的 st 不兼容所以后导入 coc 的覆盖它
  },
  defaults: {
    幸运: 3,
  },
  alias: {
    专注: ["ATT"],
    共情: ["EMP"],
    仪态: ["存在", "PRE"],
    顽固: ["PER"],
    双面: ["DUP"],
    先机: ["INI"],
    敬业: ["专业", "PRO"],
    外向: ["外放", "DYN"],
    精微: ["SUB"],
  },
};

// Globals

try {
  seal.gameSystem.newTemplate(JSON.stringify(GAME_TEMPLATE));
} catch (e) {
  console.error(`无法装载 TA 规则: ${e}`);
}

const Extension = getOrRegisterExtension();

const CommandTa = seal.ext.newCmdItemInfo();
CommandTa.name = "ta";
CommandTa.help = ".ta <属性> --c // 添加 --c 选项则不修改群组混沌值";
CommandTa.allowDelegate = true;
CommandTa.enableExecuteTimesParse = true;
CommandTa.solve = (context, message, commandArguments) => {
  const executionResult = seal.ext.newCmdExecuteResult(true);

  const repeat = commandArguments.specialExecuteTimes || 1;
  if (repeat > seal.ext.getIntConfig(Extension, TA_MAX_EXECTIME_STR)) {
    const identifier = getExcessiveMessage();
    seal.replyToSender(context, message, seal.formatTmpl(context, identifier));
    return executionResult;
  }

  const attributeName = commandArguments.getArgN(1);
  if (!attributeName) {
    executionResult.showHelp = true;
    return executionResult;
  }
  const targetUser = getTargetUser(context, commandArguments);
  const [attributeValue, exists] = getAttribute(targetUser, attributeName);
  if (!exists) {
    seal.replyToSender(context, message, `解析出错或属性不存在: ${attributeName}`);
    return executionResult;
  }

  const burnout = attributeValue > 0 ? 0 : Math.abs(attributeValue) + 1;
  const results = [];
  let chaosGenerated = 0;
  for (let i = 0; i < repeat; i++) {
    const intermediate = [];
    for (let j = 0; j < 6; j++) {
      const result = Math.floor(Math.random() * 4) + 1;
      intermediate.push(result);
    }
    const threeCountOriginal = intermediate.filter((it) => it == 3).length;
    const threeCountBurned = threeCountOriginal - burnout;
    const markedIntermediate = markResults(intermediate, burnout);
    if (threeCountBurned == 3) {
      const reply = seal.formatTmpl(context, getBigSuccessMessage(repeat > 1));
      results.push(`6D4=${markedIntermediate} ${reply}`);
      chaosGenerated += 0; // always stable
    } else if (threeCountBurned > 0) {
      const reply = seal.formatTmpl(context, getSuccessMessage(repeat > 1));
      results.push(`6D4=${markedIntermediate} ${reply}`);
      chaosGenerated += 6 - threeCountOriginal + burnout;
    } else {
      const reply = seal.formatTmpl(context, getFailureMessage(repeat > 1));
      results.push(`6D4=${markedIntermediate} ${reply}`);
      chaosGenerated += 6 - threeCountOriginal + burnout;
    }
  }

  const kwarg = commandArguments.getKwarg("c");
  if (kwarg) {
    chaosGenerated = 0;
  }

  const variableName = seal.ext.getStringConfig(Extension, TA_CHAOS_VAR_STR);
  if (chaosGenerated != 0) {
    const [chaos, _] = seal.vars.intGet(context, variableName);
    seal.vars.intSet(context, variableName, chaos + chaosGenerated);
  }

  const prefix = seal.format(context, chooseRandomOption(seal.ext.getTemplateConfig(Extension, TA_CHECKPREFIX_STR)));
  const reply = `${prefix}${results.join("\n")}\n（本次检定拥有${burnout}点燃尽，产生${chaosGenerated}点混沌，${
    attributeValue < 0 ? 0 : attributeValue
  }次质保可用）`;
  seal.replyToSender(context, message, reply);

  return executionResult;
};

Extension.cmdMap[CommandTa.name] = CommandTa;

const CommandCs = seal.ext.newCmdItemInfo();
CommandCs.name = "cs";
CommandCs.help = ".cs // 展示群内混沌值\n.cs <加减值> // 增加或消除混沌\n.csst <数值> // 设置混沌值";
CommandCs.solve = (context, message, commandArguments) => {
  const executionResult = seal.ext.newCmdExecuteResult(true);
  commandArguments.chopPrefixToArgsWith("st");

  let subcommand = commandArguments.getArgN(1);
  const isIncrement = subcommand != "st";
  if (!isIncrement) {
    subcommand = commandArguments.getArgN(2);
  }
  const variableName = seal.ext.getStringConfig(Extension, TA_CHAOS_VAR_STR);
  switch (subcommand) {
    case "": {
      const [chaos, _] = seal.vars.intGet(context, variableName);
      seal.replyToSender(context, message, `当前群内混沌指数: ${chaos}`);
      break;
    }
    case "help": {
      executionResult.showHelp = true;
      break;
    }
    default: {
      const raw = commandArguments.getRestArgsFrom(isIncrement ? 1 : 2);
      const delta = parseInt(seal.format(context, `{${raw}}`));
      if (isNaN(delta)) {
        seal.replyToSender(context, message, `解析出错: ${raw}`);
        break;
      }
      const [chaos, _] = seal.vars.intGet(context, variableName);
      let newValue = isIncrement ? chaos + delta : delta;
      seal.vars.intSet(context, variableName, newValue);
      seal.replyToSender(context, message, `当前混沌值: ${chaos} → ${newValue}`);
    }
  }

  return executionResult;
};

Extension.cmdMap[CommandCs.name] = CommandCs;

// Helpers

function markResults(intermediate: number[], burnout: number): string {
  const result = [];
  for (const n of intermediate) {
    if (n == 3) {
      if (burnout > 0) {
        result.push("3x");
        burnout--;
      } else {
        result.push("3");
      }
    } else {
      result.push(`${n}x`);
    }
  }
  if (burnout == 0) {
    return `[${result.join(",")}]`;
  }
  return `[${result.join(",")}] ${"x".repeat(burnout)}`;
}

function getAttribute(context: seal.MsgContext, attribute: string): [number, boolean] {
  const formatted = parseInt(seal.format(context, `{${attribute}}`));
  if (isNaN(formatted)) {
    return [0, false];
  }
  return [formatted, true];
}

function getTargetUser(context: seal.MsgContext, commandArguments: seal.CmdArgs): seal.MsgContext {
  const target = seal.getCtxProxyFirst(context, commandArguments);
  return target ? target : context;
}

function getExcessiveMessage() {
  const namespace = seal.ext.getOptionConfig(Extension, TA_EXCESMSG_NAMESPACE_STR);
  if (namespace != TA_NAMESPACE_TA) {
    return `${namespace}:检定_轮数过多警告`;
  }
  return seal.ext.getStringConfig(Extension, TA_CUSTOM_EXCESMSG_STR);
}

function getSuccessMessage(short: boolean) {
  const namespace = seal.ext.getOptionConfig(Extension, TA_CHECKMSG_NAMESPACE_STR);
  if (namespace != TA_NAMESPACE_TA) {
    return short ? `${namespace}:判定_简短_成功_普通` : `${namespace}:判定_成功_普通`;
  }
  const options = seal.ext.getTemplateConfig(Extension, short ? TA_SUCCESS_SHORT_STR : TA_SUCCESS_STR);
  return chooseRandomOption(options);
}

function getBigSuccessMessage(short: boolean) {
  const namespace = seal.ext.getOptionConfig(Extension, TA_CHECKMSG_NAMESPACE_STR);
  if (namespace != TA_NAMESPACE_TA) {
    return short ? `${namespace}:判定_简短_大成功` : `${namespace}:判定_大成功`;
  }
  const options = seal.ext.getTemplateConfig(Extension, short ? TA_BIGSUCCESS_SHORT_STR : TA_BIGSUCCESS_STR);
  return chooseRandomOption(options);
}

function getFailureMessage(short: boolean) {
  const namespace = seal.ext.getOptionConfig(Extension, TA_CHECKMSG_NAMESPACE_STR);
  if (namespace != TA_NAMESPACE_TA) {
    return short ? `${namespace}:判定_简短_失败` : `${namespace}:判定_失败`;
  }
  const options = seal.ext.getTemplateConfig(Extension, short ? TA_FAILURE_SHORT_STR : TA_FAILURE_STR);
  return chooseRandomOption(options);
}

function chooseRandomOption<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function getOrRegisterExtension(): seal.ExtInfo {
  let ext = seal.ext.find(EXT_NAME);
  if (!ext) {
    ext = seal.ext.new(EXT_NAME, EXT_AUTHOR, EXT_VERSION);
    seal.ext.register(ext);
    seal.ext.registerIntConfig(ext, TA_MAX_EXECTIME_STR, TA_MAX_EXECTIME, "多次检定上限值");
    seal.ext.registerOptionConfig(
      ext,
      TA_EXCESMSG_NAMESPACE_STR,
      TA_NAMESPACE_COC,
      [TA_NAMESPACE_COC, TA_NAMESPACE_DND, TA_NAMESPACE_TA],
      "多轮检定轮数过多时，使用哪个规则系统的警告信息（COC=克苏鲁的呼唤，DND=龙与地下城，TA=三角机构）"
    );
    seal.ext.registerStringConfig(ext, TA_CUSTOM_EXCESMSG_STR, TA_CUSTOM_EXCESMSG, "使用TA轮数过多警告时，展示的信息");
    seal.ext.registerTemplateConfig(ext, TA_SUCCESS_STR, [TA_SUCCESS], "使用TA检定信息时的检定信息 - 成功");
    seal.ext.registerOptionConfig(
      ext,
      TA_CHECKMSG_NAMESPACE_STR,
      TA_NAMESPACE_COC,
      [TA_NAMESPACE_COC, TA_NAMESPACE_TA],
      "检定时，使用哪个系统的成功/失败信息（COC=克苏鲁的呼唤，TA=三角机构）"
    );
    seal.ext.registerTemplateConfig(ext, TA_CHECKPREFIX_STR, [TA_CHECKPREFIX], "技能检定的回复前缀");
    seal.ext.registerTemplateConfig(ext, TA_SUCCESS_STR, [TA_SUCCESS], "使用TA检定信息时的检定信息 - 成功");
    seal.ext.registerTemplateConfig(ext, TA_FAILURE_STR, [TA_FAILURE], "使用TA检定信息时的检定信息 - 失败");
    seal.ext.registerTemplateConfig(ext, TA_BIGSUCCESS_STR, [TA_BIGSUCCESS], "使用TA检定信息时的检定信息 - 大成功");
    seal.ext.registerTemplateConfig(
      ext,
      TA_SUCCESS_SHORT_STR,
      [TA_SUCCESS_SHORT],
      "使用TA检定信息时的检定信息 - 成功简短"
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_FAILURE_SHORT_STR,
      [TA_FAILURE_SHORT],
      "使用TA检定信息时的检定信息 - 失败简短"
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_BIGSUCCESS_SHORT_STR,
      [TA_BIGSUCCESS_SHORT],
      "使用TA检定信息时的检定信息 - 大成功简短"
    );
    seal.ext.registerStringConfig(
      ext,
      TA_CHAOS_VAR_STR,
      TA_CHAOS_VAR,
      "表示群内混沌值的变量，需要带$g前缀。修改后不会自动迁移，需要手动 .cst"
    );
  }
  return ext;
}

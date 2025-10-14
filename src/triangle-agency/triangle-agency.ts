// ==UserScript==
// @name         三角机构游戏规则
// @author       败雪、檀轶步棋
// @version      1.2.0
// @timestamp    2025-08-13 18:00
// @license      MIT
// @description  支持三角机构（Triangle Agency）规则，包括 .ta/tr 检定、.tcs 混沌值管理和 .tfs 现实改写失败管理。本插件将属性值视为可用的质保数量，属性0时有1燃尽，-1时2燃尽，以此类推。
// @homepageURL  https://github.com/oissevalt/sealdice-plugins
// ==/UserScript==

/**
 * 更新日志
 * 1.2.0:
 * - 现在 tcs 和 tfs 收到正值时为添加，收到负值时为减少
 * 1.1.1:
 * - 将 cs 和 fs 重命名为 tcs 和 tfs
 * 1.1.0:
 * - 新增 tr 检定用于现实改写请求
 * - 新增 fs 指令用于管理现实改写失败
 * 1.0.1:
 * - 修复了代骰时用户变量的读取问题
 * - 修复了使用自定义回复时，格式化不正确的问题
 */

// Constants

const EXT_NAME = "triangle-agency";
const EXT_AUTHOR = "败雪、檀轶步棋";
const EXT_VERSION = "1.2.0";

const TA_MAX_EXECTIME_STR = "TriangleAgency:MaxExecTime";
const TA_MAX_EXECTIME = 5;
const TA_EXCESMSG_NAMESPACE_STR = "TriangleAgency:ExcesMsgNamespace";
const TA_CHECKMSG_NAMESPACE_STR = "TriangleAgency:CheckMsgNamespace";
const TA_CHECKPREFIX_STR = "TriangleAgency:CheckPrefix";
const TA_CHECKPREFIX = "{$t玩家}的“{$t属性表达式文本}”能力使用已批准……\n";
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
const TA_RAFAIL_VAR_STR = "TriangleAgency:RaFailVar";
const TA_RAFAIL_VAR = "$g改写失败";

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
  default: {
    专注: 0,
    共情: 0,
    仪态: 0,
    顽固: 0,
    双面: 0,
    先机: 0,
    敬业: 0,
    外向: 0,
    精微: 0,
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
CommandTa.help = `.ta <属性/质保数量> [--c] // 技能检验，添加 --c 选项则不修改群组混沌值
.tr <属性/质保数量> [--c] [--f] // 现实改写检验，--c 参数同，--f 则不占用改写失败次数`;
CommandTa.allowDelegate = true;
CommandTa.enableExecuteTimesParse = true;
CommandTa.solve = (context, message, commandArguments) => {
  const executionResult = seal.ext.newCmdExecuteResult(true);

  const repeat = commandArguments.specialExecuteTimes || 1;
  if (repeat > seal.ext.getIntConfig(Extension, TA_MAX_EXECTIME_STR)) {
    const identifier = getExcessiveMessage();
    seal.replyToSender(context, message, seal.format(context, identifier));
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

  const failureVarName = seal.ext.getStringConfig(Extension, TA_RAFAIL_VAR_STR);
  const chaosVarName = seal.ext.getStringConfig(Extension, TA_CHAOS_VAR_STR);

  const abilityBurnout = attributeValue > 0 ? 0 : Math.abs(attributeValue) + 1;
  const failureBurnout = commandArguments.command != "tr" ? 0 : seal.vars.intGet(context, failureVarName)[0];
  const totalBurnout = abilityBurnout + failureBurnout;

  const results = [];
  let chaosGenerated = 0;
  let failuresGenerated = 0;
  for (let i = 0; i < repeat; i++) {
    const intermediate = [];
    for (let j = 0; j < 6; j++) {
      const result = Math.floor(Math.random() * 4) + 1;
      intermediate.push(result);
    }
    const threeCountOriginal = intermediate.filter((it) => it == 3).length;
    const threeCountBurned = threeCountOriginal - totalBurnout;
    const markedIntermediate = markResults(intermediate, totalBurnout);
    if (threeCountOriginal == 3) {
      const reply = seal.format(targetUser, getBigSuccessMessage(repeat > 1));
      results.push(`6D4=${markedIntermediate} ${reply}`);
      chaosGenerated += 0; // always stable
    } else if (threeCountBurned > 0) {
      const reply = seal.format(targetUser, getSuccessMessage(repeat > 1));
      results.push(`6D4=${markedIntermediate} ${reply}`);
      chaosGenerated += 6 - threeCountBurned;
    } else {
      const reply = seal.format(targetUser, getFailureMessage(repeat > 1));
      results.push(`6D4=${markedIntermediate} ${reply}`);
      chaosGenerated += 6 - threeCountBurned;
      if (commandArguments.command == "tr") {
        failuresGenerated++;
      }
    }
  }

  if (commandArguments.getKwarg("c")) {
    chaosGenerated = 0;
  }

  if (commandArguments.getKwarg("f")) {
    failuresGenerated = 0;
  }

  if (chaosGenerated != 0) {
    const [chaos, _] = seal.vars.intGet(context, chaosVarName);
    seal.vars.intSet(context, chaosVarName, chaos + chaosGenerated);
  }

  if (failuresGenerated != 0) {
    seal.vars.intSet(context, failureVarName, failureBurnout + failuresGenerated);
  }

  seal.vars.strSet(targetUser, "$t属性表达式文本", attributeName);
  const prefix = seal.format(targetUser, chooseRandomOption(seal.ext.getTemplateConfig(Extension, TA_CHECKPREFIX_STR)));
  const suffix =
    commandArguments.command != "tr"
      ? `（本次检定拥有${totalBurnout}点燃尽，产生${chaosGenerated}点混沌，${
          attributeValue < 0 ? 0 : attributeValue
        }次质保可用）`
      : `（本次现实改写拥有${totalBurnout}点燃尽，其中${failureBurnout}点来自前置失败；产生${failuresGenerated}次改写失败和${chaosGenerated}点混沌，${
          attributeValue < 0 ? 0 : attributeValue
        }次质保可用）`;
  const reply = `${prefix}${results.join("\n")}\n${suffix}`;
  seal.replyToSender(context, message, reply);

  return executionResult;
};

Extension.cmdMap["ta"] = CommandTa;
Extension.cmdMap["tr"] = CommandTa;

const CommandCs = seal.ext.newCmdItemInfo();
CommandCs.name = "tcs";
CommandCs.help =
  ".tcs // 展示群内混沌值\n.tcs <数值> // 增加或消除混沌，注意正值为消除，负值为增加!\n.tcst <数值> // 设置混沌值";
CommandCs.solve = (context, message, commandArguments) => {
  const executionResult = seal.ext.newCmdExecuteResult(true);
  commandArguments.chopPrefixToArgsWith("t");

  let subcommand = commandArguments.getArgN(1);
  const isIncrement = subcommand != "t";
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
      const newValue = isIncrement ? chaos - delta : delta; // positive values lead to decrement
      seal.vars.intSet(context, variableName, newValue);
      seal.replyToSender(context, message, `当前混沌值: ${chaos} → ${newValue}`);
      break;
    }
  }

  return executionResult;
};

Extension.cmdMap[CommandCs.name] = CommandCs;

const CommandFs = seal.ext.newCmdItemInfo();
CommandFs.name = "tfs";
CommandFs.help =
  ".tfs // 展示群内现实改写失败数\n.tfs <数值> // 增加或减少现实改写失败数，注意正值为消除，负值为增加!\n.tfst <数值> // 设置现实改写失败数";
CommandFs.solve = (context, message, commandArguments) => {
  const executionResult = seal.ext.newCmdExecuteResult(true);
  commandArguments.chopPrefixToArgsWith("t");

  let subcommand = commandArguments.getArgN(1);
  const isIncrement = subcommand != "t";
  if (!isIncrement) {
    subcommand = commandArguments.getArgN(2);
  }
  const variableName = seal.ext.getStringConfig(Extension, TA_RAFAIL_VAR_STR);
  switch (subcommand) {
    case "": {
      const [failures, _] = seal.vars.intGet(context, variableName);
      seal.replyToSender(context, message, `当前地点现实改写失败次数: ${failures}`);
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
      const [failures, _] = seal.vars.intGet(context, variableName);
      const newValue = isIncrement ? failures - delta : delta; // positive values lead to decrement
      seal.vars.intSet(context, variableName, newValue);
      seal.replyToSender(context, message, `当前地点现实改写失败次数: ${failures} → ${newValue}`);
      break;
    }
  }

  return executionResult;
};

Extension.cmdMap[CommandFs.name] = CommandFs;

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

function getExcessiveMessage(): string {
  const namespace = seal.ext.getOptionConfig(Extension, TA_EXCESMSG_NAMESPACE_STR);
  if (namespace != TA_NAMESPACE_TA) {
    return `{${namespace}:检定_轮数过多警告}`;
  }
  return seal.ext.getStringConfig(Extension, TA_CUSTOM_EXCESMSG_STR);
}

function getSuccessMessage(short: boolean): string {
  const namespace = seal.ext.getOptionConfig(Extension, TA_CHECKMSG_NAMESPACE_STR);
  if (namespace != TA_NAMESPACE_TA) {
    return short ? `{${namespace}:判定_简短_成功_普通}` : `{${namespace}:判定_成功_普通}`;
  }
  const options = seal.ext.getTemplateConfig(Extension, short ? TA_SUCCESS_SHORT_STR : TA_SUCCESS_STR);
  return chooseRandomOption(options);
}

function getBigSuccessMessage(short: boolean): string {
  const namespace = seal.ext.getOptionConfig(Extension, TA_CHECKMSG_NAMESPACE_STR);
  if (namespace != TA_NAMESPACE_TA) {
    return short ? `{${namespace}:判定_简短_大成功}` : `{${namespace}:判定_大成功}`;
  }
  const options = seal.ext.getTemplateConfig(Extension, short ? TA_BIGSUCCESS_SHORT_STR : TA_BIGSUCCESS_STR);
  return chooseRandomOption(options);
}

function getFailureMessage(short: boolean): string {
  const namespace = seal.ext.getOptionConfig(Extension, TA_CHECKMSG_NAMESPACE_STR);
  if (namespace != TA_NAMESPACE_TA) {
    return short ? `{${namespace}:判定_简短_失败}` : `{${namespace}:判定_失败}`;
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
      "表示混沌值的变量，需要带$g前缀。修改后不会自动迁移，需要每个群手动 .cst；仅建议在和其他变量冲突时修改"
    );
    seal.ext.registerStringConfig(
      ext,
      TA_RAFAIL_VAR_STR,
      TA_RAFAIL_VAR,
      "表示现实改写失败次数的变量，需要带$g前缀。修改后不会自动迁移，需要每个群手动 .fst；仅建议在和其他变量冲突时修改"
    );
  }
  return ext;
}

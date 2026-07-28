// ==UserScript==
// @name         三角机构游戏规则
// @author       败雪、檀轶步棋
// @version      3.0.1
// @timestamp    2026-07-29 00:00:00
// @license      MIT
// @description  支持三角机构（Triangle Agency）规则，包括 .ta/tr 检定、.tcs 混沌值管理和 .tfs 现实改写失败管理。
// @homepageURL  https://github.com/oissevalt/sealdice-plugins
// ==/UserScript==

/**
 * 更新日志
 * 3.0.1:
 * - 按常用名重命名资质
 * 3.0.0:
 * - 完全重写检定逻辑
 * - 支持附加检定选项和特殊技能检定
 * 2.1.1:
 * - 修复 set 失效的问题
 * 2.1.0:
 * - 修复燃尽会阻止三重升华的问题
 * - 优化结果标记
 * 2.0.1:
 * - 修复一个显示 bug
 * 2.0.0:
 * - 支持了扩展规则
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
const EXT_VERSION = "3.0.1";

const TA_MAX_EXECTIME_STR = "TriangleAgency:MaxExecTime";
const TA_MAX_EXECTIME = 5;
const TA_EXCESMSG_NAMESPACE_STR = "TriangleAgency:ExcesMsgNamespace";
const TA_CHECKMSG_NAMESPACE_STR = "TriangleAgency:CheckMsgNamespace";
const TA_CHECKPREFIX_STR = "TriangleAgency:CheckPrefix";
const TA_CHECKPREFIX = "{$t玩家}的“{$t属性表达式文本}”能力使用已批准……\n";
const TA_SUCCESS_STR = "TriangleAgency:SuccessMsg";
const TA_BIGSUCCESS_STR = "TriangleAgency:BigSuccessMsg";
const TA_FAILURE_STR = "TriangleAgency:FailureMsg";
const TA_FUMBLE_STR = "TriangleAgency:FumbleMsg";
const TA_SUCCESS = "这一瞬间，现实为你而扭曲。";
const TA_FAILURE = "它冰冷而不可撼动，仿若一座黑色的方尖碑。";
const TA_BIGSUCCESS = "三尖冠——天命昭昭。";
const TA_FUMBLE = "不过是命运的嘲弄——碎了，没了。";
const TA_SUCCESS_SHORT_STR = "TriangleAgency:SuccessShortMsg";
const TA_BIGSUCCESS_SHORT_STR = "TriangleAgency:BigSuccessShortMsg";
const TA_FAILURE_SHORT_STR = "TriangleAgency:FailureShortMsg";
const TA_FUMBLE_SHORT_STR = "TriangleAgency:FumbleShortMsg";
const TA_SUCCESS_SHORT = "成功";
const TA_FAILURE_SHORT = "失败";
const TA_BIGSUCCESS_SHORT = "大成功";
const TA_FUMBLE_SHORT = "大失败";
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
  version: "0.2.1",
  updatedTime: "20260802",
  nameTemplate: {
    ta: {
      template: "{$t玩家_RAW}",
      helpText: "自动设置名片",
    },
  },
  attrSettings: {
    top: [
      "专注",
      "共情",
      "气场",
      "坚毅",
      "欺瞒",
      "主动",
      "专业",
      "活力",
      "诡秘",
    ],
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
    专注: 0,
    共情: 0,
    气场: 0,
    坚毅: 0,
    欺瞒: 0,
    主动: 0,
    专业: 0,
    活力: 0,
    诡秘: 0,
  },
  alias: {
    专注: ["ATT"],
    共情: ["EMP"],
    气场: ["仪态", "存在", "PRE"],
    坚毅: ["顽固", "PER"],
    欺瞒: ["双面", "DUP"],
    主动: ["主动", "INI"],
    专业: ["敬业", "PRO"],
    活力: ["外向", "外放", "DYN"],
    诡秘: ["精微", "SUB"],
  },
};

// Globals

try {
  seal.gameSystem.newTemplate(JSON.stringify(GAME_TEMPLATE));
  console.log(`TA 规则装载完毕`);
} catch (e) {
  console.error(`无法装载 TA 规则: ${e}`);
}

const Extension = getOrRegisterExtension();

// Command declarations

const CommandTa = seal.ext.newCmdItemInfo();
CommandTa.name = "ta";
CommandTa.help = `.ta <能力/质保数量> [--c] [--g] [--s] // 技能检定。--c 不修改群组混沌值，--g 使用 D10，--s 使用 D6
.tr <能力/质保数量> [--c] [--f] [--g] // 现实改写检定。--c 参数同，--f 不记录改写失败，--g 使用 D8
插件按未使用质保的情况结算；如需使用质保，请根据结果手动调整`;
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

  const abilityName = commandArguments.getArgN(1);
  if (!abilityName || abilityName == "help") {
    executionResult.showHelp = true;
    return executionResult;
  }

  const targetUser = getTargetUser(context, commandArguments);
  const [abilityValue, exists] = getAbilityValue(targetUser, abilityName);
  if (!exists) {
    seal.replyToSender(
      context,
      message,
      `解析出错或能力不存在: ${abilityName}`,
    );
    return executionResult;
  }

  const isRealityAlteration = commandArguments.command == "tr";
  const useOptionalDie = !!commandArguments.getKwarg("g");
  const useD10 = !isRealityAlteration && !!commandArguments.getKwarg("s");
  const useSponsorDie = isRealityAlteration && useOptionalDie;
  const useD6 = !isRealityAlteration && useOptionalDie;
  const skipChaosWrite = !!commandArguments.getKwarg("c");
  const skipFailureWrite =
    isRealityAlteration && !!commandArguments.getKwarg("f");

  const warrantyAvailable = Math.max(0, abilityValue);
  const abilityBurnout = abilityValue > 0 ? 0 : Math.abs(abilityValue) + 1;
  const chaosVarName = seal.ext.getStringConfig(Extension, TA_CHAOS_VAR_STR);
  const failureVarName = seal.ext.getStringConfig(Extension, TA_RAFAIL_VAR_STR);
  const startingFailureBurnout = isRealityAlteration
    ? seal.vars.intGet(context, failureVarName)[0]
    : 0;

  seal.vars.strSet(targetUser, "$t属性表达式文本", abilityName);
  const prefix = seal.format(
    targetUser,
    chooseRandomOption(
      seal.ext.getTemplateConfig(Extension, TA_CHECKPREFIX_STR),
    ),
  );

  // G3 has a choice after the dice are known. Both branches are therefore
  // informational, and neither chaos nor rewrite failures are persisted.
  if (useSponsorDie) {
    const results: string[] = [];
    for (let i = 0; i < repeat; i++) {
      const totalBurnout = abilityBurnout + startingFailureBurnout;
      results.push(
        performSponsorCheck(targetUser, totalBurnout, warrantyAvailable),
      );
    }
    seal.replyToSender(context, message, `${prefix}${results.join("\n\n")}`);
    return executionResult;
  }

  const results: string[] = [];
  let chaosGenerated = 0;
  let failuresGenerated = 0;
  let currentFailureBurnout = startingFailureBurnout;
  for (let i = 0; i < repeat; i++) {
    const totalBurnout =
      abilityBurnout + (isRealityAlteration ? currentFailureBurnout : 0);
    const check = useD10
      ? performD10Check(
          targetUser,
          totalBurnout,
          warrantyAvailable,
          useD6,
          repeat > 1,
        )
      : performStandardCheck(
          targetUser,
          totalBurnout,
          warrantyAvailable,
          useD6,
          repeat > 1,
        );

    const lines = [check.text];
    chaosGenerated += check.outcome.chaos;
    if (isRealityAlteration && isFailure(check.outcome)) {
      failuresGenerated++;
      if (!skipFailureWrite) {
        currentFailureBurnout++;
        lines.push("本次现实改写失败，增加 1 次改写失败");
      } else {
        lines.push("本次现实改写失败，未记录改写失败次数");
      }
    }
    results.push(lines.join("\n"));
  }

  if (!skipChaosWrite && chaosGenerated != 0) {
    const chaos = seal.vars.intGet(context, chaosVarName)[0];
    seal.vars.intSet(context, chaosVarName, chaos + chaosGenerated);
  }
  if (
    isRealityAlteration &&
    !skipFailureWrite &&
    currentFailureBurnout != startingFailureBurnout
  ) {
    seal.vars.intSet(context, failureVarName, currentFailureBurnout);
  }

  const notes: string[] = [];
  if (skipChaosWrite && chaosGenerated != 0) {
    notes.push(`以上 ${chaosGenerated} 点混沌未写入群变量`);
  }
  if (skipFailureWrite && failuresGenerated != 0) {
    notes.push(`以上 ${failuresGenerated} 次改写失败未写入群变量`);
  }
  const noteText = notes.length > 0 ? `\n（${notes.join("；")}）` : "";
  seal.replyToSender(
    context,
    message,
    `${prefix}${results.join("\n\n")}${noteText}`,
  );

  return executionResult;
};

Extension.cmdMap["ta"] = CommandTa;
Extension.cmdMap["tr"] = CommandTa;

const CommandCs = seal.ext.newCmdItemInfo();
CommandCs.name = "tcs";
CommandCs.help =
  ".tcs // 展示群内混沌值\n.tcs <数值> // 增加或消除混沌，注意正值为消除，负值为增加!\n.tcst <数值> // 设置混沌值";
CommandCs.solve = (context, message, commandArguments) => {
  return solveCounterCommand(
    context,
    message,
    commandArguments,
    seal.ext.getStringConfig(Extension, TA_CHAOS_VAR_STR),
    "当前群内混沌值",
  );
};

Extension.cmdMap[CommandCs.name] = CommandCs;

const CommandFs = seal.ext.newCmdItemInfo();
CommandFs.name = "tfs";
CommandFs.help =
  ".tfs // 展示群内现实改写失败数\n.tfs <数值> // 增加或减少现实改写失败数，注意正值为消除，负值为增加!\n.tfst <数值> // 设置现实改写失败数";
CommandFs.solve = (context, message, commandArguments) => {
  return solveCounterCommand(
    context,
    message,
    commandArguments,
    seal.ext.getStringConfig(Extension, TA_RAFAIL_VAR_STR),
    "当前地点现实改写失败次数",
  );
};

Extension.cmdMap[CommandFs.name] = CommandFs;

const CommandTra = seal.ext.newCmdItemInfo();
CommandTra.name = "tra";
CommandTra.help =
  ".tra <能力/质保数量> [--c] // 使用 D20 的特殊技能检定。--c 不修改群组混沌值";
CommandTra.allowDelegate = true;
CommandTra.solve = (context, message, commandArguments) => {
  const executionResult = seal.ext.newCmdExecuteResult(true);
  const abilityName = commandArguments.getArgN(1);
  if (!abilityName || abilityName == "help") {
    executionResult.showHelp = true;
    return executionResult;
  }

  const targetUser = getTargetUser(context, commandArguments);
  const [abilityValue, exists] = getAbilityValue(targetUser, abilityName);
  if (!exists) {
    seal.replyToSender(
      context,
      message,
      `解析出错或能力不存在: ${abilityName}`,
    );
    return executionResult;
  }

  const warranty = Math.max(0, abilityValue);
  const roll = rollDie(20);
  const total = roll + warranty;
  let kind: OutcomeKind;
  let chaosGenerated = 0;
  if (total == 3) {
    kind = "bigSuccess";
  } else if (total == 7) {
    kind = "fumble";
    chaosGenerated = 7;
  } else if (total > 10) {
    kind = "success";
  } else {
    kind = "failure";
    chaosGenerated = total;
  }

  const chaosVarName = seal.ext.getStringConfig(Extension, TA_CHAOS_VAR_STR);
  const skipChaosWrite = !!commandArguments.getKwarg("c");
  if (!skipChaosWrite && chaosGenerated != 0) {
    const chaos = seal.vars.intGet(context, chaosVarName)[0];
    seal.vars.intSet(context, chaosVarName, chaos + chaosGenerated);
  }

  seal.vars.strSet(targetUser, "$t属性表达式文本", abilityName);
  const prefix = seal.format(
    targetUser,
    chooseRandomOption(
      seal.ext.getTemplateConfig(Extension, TA_CHECKPREFIX_STR),
    ),
  );
  const lines = [
    `D20=${roll} + ${warranty}=${total}`,
    formatOutcome(targetUser, kind, false),
  ];
  if (chaosGenerated != 0) {
    lines.push(`产生 ${chaosGenerated} 点混沌`);
  }
  lines.push("请手动支付发动所需的 1 点质保");
  if (kind == "fumble") {
    lines.push("请手动清空所选能力剩余的所有质保");
  }
  if (skipChaosWrite && chaosGenerated != 0) {
    lines.push("以上混沌未写入群变量");
  }
  seal.replyToSender(context, message, `${prefix}${lines.join("\n")}`);

  return executionResult;
};

Extension.cmdMap[CommandTra.name] = CommandTra;

// Check logic

type OutcomeKind =
  | "success"
  | "stableSuccess"
  | "bigSuccess"
  | "failure"
  | "fumble";

interface CheckOutcome {
  kind: OutcomeKind;
  chaos: number;
  originalThrees: number;
  finalThrees: number;
  burnoutConsumed: number;
  excessBurnout: number;
}

interface CheckResult {
  text: string;
  outcome: CheckOutcome;
}

function performStandardCheck(
  context: seal.MsgContext,
  burnout: number,
  warrantyAvailable: number,
  addD6: boolean,
  short: boolean,
): CheckResult {
  const d4Results = rollDice(6, 4);
  const d6Result = addD6 ? rollDie(6) : null;
  const extraThrees = d6Result == 3 ? 1 : d6Result == 6 ? 2 : 0;
  const extraChaos =
    d6Result !== null && d6Result != 3 && d6Result != 6 ? 1 : 0;
  const outcome = resolveStandardCheck(
    d4Results,
    extraThrees,
    extraChaos,
    burnout,
  );

  const diceText =
    `6D4=[${d4Results.join(",")}]` +
    (d6Result === null ? "" : ` + D6=${d6Result}`);
  return {
    outcome,
    text: formatCheckDetails(
      context,
      diceText,
      outcome,
      warrantyAvailable,
      short,
    ),
  };
}

function resolveStandardCheck(
  d4Results: number[],
  extraThrees: number,
  extraChaos: number,
  burnout: number,
): CheckOutcome {
  const d4Threes = countThrees(d4Results);
  const originalThrees = d4Threes + extraThrees;

  // An unadjusted set of exactly three 3s ignores burnout and all chaos.
  if (originalThrees == 3) {
    return {
      kind: "bigSuccess",
      chaos: 0,
      originalThrees,
      finalThrees: originalThrees,
      burnoutConsumed: 0,
      excessBurnout: 0,
    };
  }

  const excessBurnout = Math.max(0, burnout - originalThrees);
  const burnoutConsumed =
    burnout >= 0 ? Math.min(burnout, originalThrees) : burnout;
  const finalThrees = originalThrees - burnout;
  let chaos = 6 - d4Threes + extraChaos + excessBurnout;
  let kind: OutcomeKind;

  if (finalThrees == 3) {
    kind = "stableSuccess";
    chaos = 0;
  } else {
    kind = finalThrees > 0 ? "success" : "failure";
  }

  return {
    kind,
    chaos,
    originalThrees,
    finalThrees,
    burnoutConsumed,
    excessBurnout,
  };
}

function performD10Check(
  context: seal.MsgContext,
  burnout: number,
  warrantyAvailable: number,
  addD6: boolean,
  short: boolean,
): CheckResult {
  const d10Result = rollDie(10);
  const d6Result = addD6 ? rollDie(6) : null;
  const extraThrees = d6Result == 3 ? 1 : d6Result == 6 ? 2 : 0;
  const extraChaos =
    d6Result !== null && d6Result != 3 && d6Result != 6 ? 1 : 0;
  const originalThrees = d10Result + extraThrees;
  const excessBurnout = Math.max(0, burnout - originalThrees);
  const burnoutConsumed =
    burnout >= 0 ? Math.min(burnout, originalThrees) : burnout;
  const finalThrees = originalThrees - burnout;
  const kind: OutcomeKind =
    d10Result == 3 || (burnout > 0 && finalThrees == 3) ? "failure" : "success";
  const outcome: CheckOutcome = {
    kind,
    chaos: d10Result + extraChaos + excessBurnout,
    originalThrees,
    finalThrees,
    burnoutConsumed,
    excessBurnout,
  };
  const diceText =
    `D10=${d10Result}` + (d6Result === null ? "" : ` + D6=${d6Result}`);

  return {
    outcome,
    text: formatCheckDetails(
      context,
      diceText,
      outcome,
      warrantyAvailable,
      short,
    ),
  };
}

function performSponsorCheck(
  context: seal.MsgContext,
  burnout: number,
  warrantyAvailable: number,
): string {
  const d4Results = rollDice(6, 4);
  const d8Result = rollDie(8);
  const d4Threes = countThrees(d4Results);
  const sponsoredThrees = d8Result == 3 ? 1 : d8Result == 6 ? 2 : 0;
  const withoutSponsor = resolveStandardCheck(d4Results, 0, 0, burnout);
  const withSponsor =
    sponsoredThrees > 0
      ? resolveStandardCheck(d4Results, sponsoredThrees, 0, burnout)
      : null;

  const lines = [
    `6D4=[${d4Results.join(",")}] + D8=${d8Result}`,
    `原始产生 ${d4Threes} 个 3，赞助骰提供 ${sponsoredThrees} 个 3`,
    "",
  ];
  if (withSponsor !== null) {
    lines.push(
      `采用 ${sponsoredThrees} 个 3 的结果：${formatOutcome(
        context,
        withSponsor.kind,
        true,
      )}，产生 ${withSponsor.chaos} 点混沌`,
    );
  }
  lines.push(
    `不采用的结果：${formatOutcome(
      context,
      withoutSponsor.kind,
      true,
    )}，产生 ${withoutSponsor.chaos} 点混沌`,
  );
  if (warrantyAvailable > 0) {
    lines.push(`有 ${warrantyAvailable} 点质保可用`);
  }
  let manualNotice = "以上混沌值为可能结果，请采用后手动添加";
  if (
    isFailure(withoutSponsor) ||
    (withSponsor !== null && isFailure(withSponsor))
  ) {
    manualNotice += "。若采用的结果失败，请同时手动添加 1 次改写失败";
  }
  lines.push(manualNotice);
  return lines.join("\n");
}

function formatCheckDetails(
  context: seal.MsgContext,
  diceText: string,
  outcome: CheckOutcome,
  warrantyAvailable: number,
  short: boolean,
): string {
  const chaosAndWarranty =
    warrantyAvailable > 0
      ? `产生 ${outcome.chaos} 点混沌，有 ${warrantyAvailable} 点质保可用`
      : `产生 ${outcome.chaos} 点混沌`;
  const lines = [
    diceText,
    `原始产生 ${outcome.originalThrees} 个 3，燃尽消耗 ${outcome.burnoutConsumed} 个`,
    formatOutcome(context, outcome.kind, short),
    chaosAndWarranty,
  ];
  return lines.join("\n");
}

function formatOutcome(
  context: seal.MsgContext,
  kind: OutcomeKind,
  short: boolean,
): string {
  switch (kind) {
    case "bigSuccess":
      return seal.format(context, getBigSuccessMessage(short));
    case "stableSuccess":
      return `稳定性——${seal.format(context, getSuccessMessage(short))}`;
    case "success":
      return seal.format(context, getSuccessMessage(short));
    case "fumble":
      return seal.format(context, getFumbleMessage(short));
    case "failure":
      return seal.format(context, getFailureMessage(short));
  }
}

function isFailure(outcome: CheckOutcome | null): boolean {
  return outcome?.kind == "failure" || outcome?.kind == "fumble";
}

function countThrees(results: number[]): number {
  return results.filter((result) => result == 3).length;
}

function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => rollDie(sides));
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function getAbilityValue(
  context: seal.MsgContext,
  ability: string,
): [number, boolean] {
  if (/^[+-]?\d+$/.test(ability)) {
    return [Number.parseInt(ability, 10), true];
  }
  const formatted = Number.parseInt(seal.format(context, `{${ability}}`), 10);
  if (Number.isNaN(formatted)) {
    return [0, false];
  }
  return [formatted, true];
}

function getTargetUser(
  context: seal.MsgContext,
  commandArguments: seal.CmdArgs,
): seal.MsgContext {
  return seal.getCtxProxyFirst(context, commandArguments) || context;
}

function solveCounterCommand(
  context: seal.MsgContext,
  message: seal.Message,
  commandArguments: seal.CmdArgs,
  variableName: string,
  label: string,
): seal.CmdExecuteResult {
  const executionResult = seal.ext.newCmdExecuteResult(true);
  commandArguments.chopPrefixToArgsWith("t", "set");

  let subcommand = commandArguments.getArgN(1);
  const isAdjustment = subcommand != "t" && subcommand != "set";
  if (!isAdjustment) {
    subcommand = commandArguments.getArgN(2);
  }

  if (!subcommand) {
    const value = seal.vars.intGet(context, variableName)[0];
    seal.replyToSender(context, message, `${label}: ${value}`);
    return executionResult;
  }
  if (subcommand == "help") {
    executionResult.showHelp = true;
    return executionResult;
  }

  const raw = commandArguments.getRestArgsFrom(isAdjustment ? 1 : 2);
  const delta = Number.parseInt(seal.format(context, `{${raw}}`), 10);
  if (Number.isNaN(delta)) {
    seal.replyToSender(context, message, `解析出错: ${raw}`);
    return executionResult;
  }

  const oldValue = seal.vars.intGet(context, variableName)[0];
  // Positive adjustment values remove points; negative values add them.
  // Deliberately do not clamp rewrite failures: negative burnout is supported.
  const newValue = isAdjustment ? oldValue - delta : delta;
  seal.vars.intSet(context, variableName, newValue);
  seal.replyToSender(context, message, `${label}: ${oldValue} → ${newValue}`);
  return executionResult;
}

// Config and message helpers

function getExcessiveMessage(): string {
  const namespace = seal.ext.getOptionConfig(
    Extension,
    TA_EXCESMSG_NAMESPACE_STR,
  );
  if (namespace != TA_NAMESPACE_TA) {
    return `{${namespace}:检定_轮数过多警告}`;
  }
  return seal.ext.getStringConfig(Extension, TA_CUSTOM_EXCESMSG_STR);
}

function getSuccessMessage(short: boolean): string {
  const namespace = seal.ext.getOptionConfig(
    Extension,
    TA_CHECKMSG_NAMESPACE_STR,
  );
  if (namespace != TA_NAMESPACE_TA) {
    return short
      ? `{${namespace}:判定_简短_成功_普通}`
      : `{${namespace}:判定_成功_普通}`;
  }
  const options = seal.ext.getTemplateConfig(
    Extension,
    short ? TA_SUCCESS_SHORT_STR : TA_SUCCESS_STR,
  );
  return chooseRandomOption(options);
}

function getBigSuccessMessage(short: boolean): string {
  const namespace = seal.ext.getOptionConfig(
    Extension,
    TA_CHECKMSG_NAMESPACE_STR,
  );
  if (namespace != TA_NAMESPACE_TA) {
    return short
      ? `{${namespace}:判定_简短_大成功}`
      : `{${namespace}:判定_大成功}`;
  }
  const options = seal.ext.getTemplateConfig(
    Extension,
    short ? TA_BIGSUCCESS_SHORT_STR : TA_BIGSUCCESS_STR,
  );
  return chooseRandomOption(options);
}

function getFailureMessage(short: boolean): string {
  const namespace = seal.ext.getOptionConfig(
    Extension,
    TA_CHECKMSG_NAMESPACE_STR,
  );
  if (namespace != TA_NAMESPACE_TA) {
    return short ? `{${namespace}:判定_简短_失败}` : `{${namespace}:判定_失败}`;
  }
  const options = seal.ext.getTemplateConfig(
    Extension,
    short ? TA_FAILURE_SHORT_STR : TA_FAILURE_STR,
  );
  return chooseRandomOption(options);
}

function getFumbleMessage(short: boolean): string {
  const namespace = seal.ext.getOptionConfig(
    Extension,
    TA_CHECKMSG_NAMESPACE_STR,
  );
  if (namespace != TA_NAMESPACE_TA) {
    return short
      ? `{${namespace}:判定_简短_大失败}`
      : `{${namespace}:判定_大失败}`;
  }
  const options = seal.ext.getTemplateConfig(
    Extension,
    short ? TA_FUMBLE_SHORT_STR : TA_FUMBLE_STR,
  );
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
    seal.ext.registerIntConfig(
      ext,
      TA_MAX_EXECTIME_STR,
      TA_MAX_EXECTIME,
      "多次检定上限值",
    );
    seal.ext.registerOptionConfig(
      ext,
      TA_EXCESMSG_NAMESPACE_STR,
      TA_NAMESPACE_COC,
      [TA_NAMESPACE_COC, TA_NAMESPACE_DND, TA_NAMESPACE_TA],
      "多轮检定轮数过多时，使用哪个规则系统的警告信息（COC=克苏鲁的呼唤，DND=龙与地下城，TA=三角机构）",
    );
    seal.ext.registerStringConfig(
      ext,
      TA_CUSTOM_EXCESMSG_STR,
      TA_CUSTOM_EXCESMSG,
      "使用TA轮数过多警告时，展示的信息",
    );
    seal.ext.registerOptionConfig(
      ext,
      TA_CHECKMSG_NAMESPACE_STR,
      TA_NAMESPACE_COC,
      [TA_NAMESPACE_COC, TA_NAMESPACE_TA],
      "检定时，使用哪个系统的成功/失败信息（COC=克苏鲁的呼唤，TA=三角机构）",
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_CHECKPREFIX_STR,
      [TA_CHECKPREFIX],
      "技能检定的回复前缀",
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_SUCCESS_STR,
      [TA_SUCCESS],
      "使用TA检定信息时的检定信息 - 成功",
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_FAILURE_STR,
      [TA_FAILURE],
      "使用TA检定信息时的检定信息 - 失败",
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_BIGSUCCESS_STR,
      [TA_BIGSUCCESS],
      "使用TA检定信息时的检定信息 - 大成功",
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_FUMBLE_STR,
      [TA_FUMBLE],
      "使用TA检定信息时的检定信息 - 大失败",
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_SUCCESS_SHORT_STR,
      [TA_SUCCESS_SHORT],
      "使用TA检定信息时的检定信息 - 成功简短",
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_FAILURE_SHORT_STR,
      [TA_FAILURE_SHORT],
      "使用TA检定信息时的检定信息 - 失败简短",
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_BIGSUCCESS_SHORT_STR,
      [TA_BIGSUCCESS_SHORT],
      "使用TA检定信息时的检定信息 - 大成功简短",
    );
    seal.ext.registerTemplateConfig(
      ext,
      TA_FUMBLE_SHORT_STR,
      [TA_FUMBLE_SHORT],
      "使用TA检定信息时的检定信息 - 大失败简短",
    );
    seal.ext.registerStringConfig(
      ext,
      TA_CHAOS_VAR_STR,
      TA_CHAOS_VAR,
      "表示混沌值的变量，需要带$g前缀。修改后不会自动迁移，需要每个群手动 .cst；仅建议在和其他变量冲突时修改",
    );
    seal.ext.registerStringConfig(
      ext,
      TA_RAFAIL_VAR_STR,
      TA_RAFAIL_VAR,
      "表示现实改写失败次数的变量，需要带$g前缀。修改后不会自动迁移，需要每个群手动 .fst；仅建议在和其他变量冲突时修改",
    );
  }
  return ext;
}

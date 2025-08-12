// ==UserScript==
// @name           霍格沃茨 TRPG 规则
// @author         檀轶步棋
// @version        0.2.0
// @description    霍格沃兹规则，测试中
// @timestamp      1702549002
// @diceRequireVer 1.4.0
// @license        MIT
// ==/UserScript==

const Template = {
    "name": "hogwarts",
    "fullName": "霍格沃兹规则",
    "authors": ["檀轶步棋"],
    "version": "0.2.0",
    "updatedTime": "20231214",
    "templateVer": "2.0",
    "nameTemplate": {
        "hogwarts": {
            "template": "{$t玩家_RAW} EXP{经验值}/4 幸运{幸运}",
            "helpText": "自动设置名片",
        },
    },
    "attrSettings": {
        "top": ["英勇", "狡诈", "聪颖", "忠诚", "魔法"],
        "sortBy": "name",
        "showAs": {
            "经验值": "{经验值}/4",
        },
    },
    "setConfig": {
        "diceSides": 6,
        "keys": ["hogwarts", "hp"],
        "enableTip": "已切换至6面骰，并自动开启hp扩展",
        "relatedExt": ["dnd5e", "coc7", "hogwarts"], // 不能乱，dnd 的 st 不兼容所以后导入 coc 的覆盖它
    },
    "defaults": {
        "幸运": 3,
    },
    "alias": {
        "英勇": ["勇气", "BRV"],
        "狡诈": ["狡猾", "CUN"],
        "聪颖": ["智力", "INT"],
        "忠诚": ["LOY"],
        "魔法": ["魔力", "魔法值", "MP"],
        "幸运": ["运气", "LUK"],
        "经验值": ["经验", "EXP"],
    },
};
try {
    seal.gameSystem.newTemplate(JSON.stringify(Template));
}
catch (e) {
    console.error(`无法装载 Hogwarts 规则: ${e}`);
}
let ext = seal.ext.find("hogwarts");
if (!ext) {
    ext = seal.ext.new("hogwarts", "檀轶步棋", "0.2.0");
    seal.ext.register(ext);
}
const cmdHp = seal.ext.newCmdItemInfo();
cmdHp.name = "hp";
cmdHp.help = "霍格沃茨:\n" +
    "[hp gen <数量，默认为 1>] 制卡\n" +
    "[hpc <属性/加值>] 行动检定\n" +
    "[hp en <属性>] 花费 4 点经验值，属性获得 1 点增长";
cmdHp.solve = (ctx, msg, argv) => {
    argv.chopPrefixToArgsWith("gen", "help", "c", "en");
    const ret = seal.ext.newCmdExecuteResult(true);
    const playerName = seal.format(ctx, "{$t玩家}");
    const subCmd = argv.getArgN(1);
    switch (subCmd) {
        case "gen": {
            let quantity = Number(argv.getArgN(2)) || 1;
            if (quantity > 5) {
                quantity = 5;
            }
            const chars = genChar(quantity);
            const splitter = seal.formatTmpl(ctx, "COC:制卡_分隔符");
            seal.replyToSender(ctx, msg, `${playerName}的霍格沃茨制卡结果:\n` + chars.join(splitter));
            break;
        }
        case "c": {
            const expr = argv.getRestArgsFrom(2);
            const [attrResult, attrInter] = computeAttr(ctx, msg, expr); // Number(seal.format(ctx, `{${expr}}`));
            const [baseResult, baseInter] = compute2d6(ctx);
            const result = baseResult + attrResult;
            let reply = `${playerName}的"${expr}"检定结果:\n` +
                `${baseInter}${attrInter != "" ? " + (" + attrInter + ")" : ""} = ${result}/6` +
                `${getSuccessReply(ctx, result)}`;
            if (result < 7) {
                const exp = seal.vars.intGet(ctx, "经验值")[0];
                seal.vars.intSet(ctx, "经验值", exp + 1);
                reply += `\n（因为出点小于等于 6，获得一点经验。当前经验值：${exp + 1}/4）`;
            }
            seal.replyToSender(ctx, msg, reply);
            break;
        }
        case "en": {
            const attrName = argv.getArgN(2);
            const exp = seal.vars.intGet(ctx, "经验值")[0];
            if (exp < 4) {
                seal.replyToSender(ctx, msg, `当前角色${playerName}经验小于 4，无法成长!`);
                break;
            }
            const [attr, exist] = seal.vars.intGet(ctx, attrName);
            if (!exist) {
                seal.replyToSender(ctx, msg, `当前角色${playerName}不存在"${attrName}"属性，请先录入!`);
                break;
            }
            seal.vars.intSet(ctx, attrName, attr + 1);
            seal.vars.intSet(ctx, "经验值", exp - 4);
            seal.replyToSender(ctx, msg, `${playerName}的"${attrName}"得到了成长：${attr} → ${attr + 1} (花费 4 点经验)`);
            break;
        }
        default:
        case "help": {
            ret.showHelp = true;
            break;
        }
    }
    return ret;
};
ext.cmdMap["hp"] = cmdHp;
function getSuccessReply(ctx, result) {
    if (result > 9) {
        return seal.formatTmpl(ctx, "COC:判定_大成功");
    }
    else if (result > 6) {
        return seal.formatTmpl(ctx, "COC:判定_成功_普通");
    }
    else {
        return seal.formatTmpl(ctx, "COC:判定_大失败");
    }
}
function computeAttr(ctx, msg, expr) {
    if (expr == "") {
        return [0, ""];
    }
    const attrRegex = /[^+\-*/^><0-9]+/gm;
    const evaluated = expr.replace(attrRegex, (match) => {
        const attr = seal.vars.intGet(ctx, match)[0];
        return `${attr}`;
    });
    const detailed = expr.replace(attrRegex, (match) => {
        const attr = seal.vars.intGet(ctx, match)[0];
        return `${match}[${attr}]`;
    });
    const value = seal.format(ctx, `{${evaluated}}`);
    return [Number(value), detailed];
}
function compute2d6(ctx) {
    const a = Number(seal.format(ctx, "{d6}"));
    const b = Number(seal.format(ctx, "{d6}"));
    return [a + b, `${a + b}[2d6=${a},${b}]`];
}
function genChar(quantity) {
    const shuffle = () => {
        let mods = [-1, 0, 1, 1, 2];
        for (let i = mods.length - 1; i > 0; i--) {
            const r = Math.floor(Math.random() * (i + 1));
            [mods[i], mods[r]] = [mods[r], mods[i]];
        }
        return mods;
    };
    let chars = [];
    for (let i = 0; i < quantity; i++) {
        const mod = shuffle();
        chars.push(`英勇: ${mod[0]} 狡诈: ${mod[1]} 聪颖: ${mod[2]}\n` +
            `忠诚: ${mod[3]} 魔法: ${mod[4]} 幸运: 3`);
    }
    return chars;
}

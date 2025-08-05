// ==UserScript==
// @name         Eval
// @author       檀轶步棋
// @version      1.1.0
// @timestamp    2025-08-04 16:30
// @license      MIT
// @description  To evaluate JavaScript from commands for debugging.
// @homepageURL  https://github.com/oissevalt
// ==/UserScript==

// Constants

const EXT_NAME = "team";
const EXT_VERSION = "1.1.0";
const EXT_AUTHOR = "檀轶步棋";

// Global variables

const Extension = getOrRegisterExtension();

const CommandEval = seal.ext.newCmdItemInfo();
CommandEval.name = "eval";
CommandEval.help = ".eval <JavaScript>";
CommandEval.solve = (context, message, argument) => {
  const executionResult = seal.ext.newCmdExecuteResult(true);
  if (context.privilegeLevel < 100 /* bot owner */) {
    seal.replyToSender(context, message, "You must have Owner privileges to use eval.");
    return executionResult;
  }
  const result = eval(argument.getRestArgsFrom(1));
  if (result) {
    seal.replyToSender(context, message, `${result}`); // stringify
  }
  return executionResult;
};

Extension.cmdMap["eval"] = CommandEval;

// Helpers

function getOrRegisterExtension(): seal.ExtInfo {
  let ext = seal.ext.find(EXT_NAME);
  if (!ext) {
    ext = seal.ext.new(EXT_NAME, EXT_AUTHOR, EXT_VERSION);
    seal.ext.register(ext);
  }
  return ext;
}

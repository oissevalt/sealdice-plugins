// ==UserScript==
// @name         数据统计插件
// @author       檀轶步棋
// @version      1.0.0
// @timestamp    2025-10-19 19:00
// @license      MIT
// @description  对数据进行简单统计学分析
// @homepageURL  https://github.com/oissevalt
// ==/UserScript==

// Constants
const EXT_NAME = "statcal";
const EXT_VER = "1.0.0";
const EXT_AUTHOR = "檀轶步棋";

// Statics
const Extension = getOrRegisterExtension();

const Command = seal.ext.newCmdItemInfo();

Command.name = "统计";
Command.help = ".统计 1,2,3... // 统计样本的均值，方差等，样本之间英文逗号隔开不要加空格";

Command.solve = (context, message, commandArguments) => {
  const commandExecutionResult = seal.ext.newCmdExecuteResult(true);

  const argument1 = commandArguments.getArgN(1);

  if (!argument1 || argument1 == "help") {
    commandExecutionResult.showHelp = true;
    return commandExecutionResult;
  }

  const rawSamples = commandArguments.cleanArgs
    .split(" ")
    .flatMap((item) => item.split(","))
    .filter((item) => item != ""); // length will not be zero since we've made sure arg1 is non-empty
  const [faultyIndex, samples] = convertSamples(rawSamples);

  if (faultyIndex >= 0 || samples == undefined) {
    seal.replyToSender(context, message, `样本 ${rawSamples[faultyIndex]} 无效(必须为数字且不能为Infinity)`);
    return commandExecutionResult;
  }

  const sum = calculateSum(samples);
  const mean = calculateMean(samples, sum);
  const median = calculateMedian(samples);
  const populationVariance = calculateVarianceN(samples, mean);
  const range = calculateRange(samples);

  const results: string[] = [];
  results.push(`总和: ${sum}`);
  results.push(`平均数: ${mean.toFixed(2)}`);
  results.push(`中位数: ${median.toFixed(2)}`);
  results.push(`总体方差: ${populationVariance.toFixed(2)}`);

  if (samples.length == 1) {
    results.push("样本方差: 未定义");
  } else {
    const sampleVariance = calculateVarianceN_1(samples, mean);
    results.push(`样本方差: ${sampleVariance.toFixed(2)}`);
  }

  results.push(`极差: ${range}`);

  seal.replyToSender(context, message, `样本总数 ${samples.length}，统计如下:\n${results.join("\n")}`);

  return commandExecutionResult;
};

Extension.cmdMap["统计"] = Command;

// Business Logic
function calculateSum(samples: number[]) {
  return samples.reduce((acc, item) => acc + item, 0);
}

function calculateMean(samples: number[], sum: number) {
  return sum / samples.length;
}

function calculateVarianceN(samples: number[], mean: number) {
  return samples.map((i) => Math.pow(i - mean, 2)).reduce((acc, item) => acc + item, 0) / samples.length;
}

function calculateVarianceN_1(samples: number[], mean: number) {
  return samples.map((i) => Math.pow(i - mean, 2)).reduce((acc, item) => acc + item, 0) / (samples.length - 1);
}

function calculateMedian(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);

  if (sorted.length % 2 == 0) {
    const a = sorted.length / 2 - 1;
    return (sorted[a] + sorted[a + 1]) / 2;
  }

  const a = (sorted.length + 1) / 2 - 1;
  return sorted[a];
}

function calculateRange(samples: number[]) {
  return Math.max(...samples) - Math.min(...samples);
}

// Helpers
function convertSamples(samples: string[]): [number, number[]?] {
  const conversionResult: number[] = [];

  for (let index = 0; index < samples.length; index++) {
    const n = parseFloat(samples[index]);
    if (!isFinite(n)) {
      // also catches NaN
      return [index, undefined];
    }
    conversionResult.push(n);
  }

  return [-1, conversionResult];
}

function getOrRegisterExtension(): seal.ExtInfo {
  let ext = seal.ext.find(EXT_NAME);

  if (!ext) {
    ext = seal.ext.new(EXT_NAME, EXT_AUTHOR, EXT_VER);
    seal.ext.register(ext);
  }

  return ext;
}

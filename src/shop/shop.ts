// ==UserScript==
// @name         商店系统
// @author       檀轶步棋
// @version      1.1.1
// @timestamp    2025-07-16 17:00
// @license      MIT
// @description  指令有：上架、下架、购买、出售、丢弃、展示
// @homepageURL  https://github.com/oissevalt
// ==/UserScript==

/* 
   1.1.1 更新日志
   - 修复购买商品不会从商店中正确移除商品的bug。
   1.1.0 更新日志
   - 使用现代的 JavaScript 函数重写，修改部分实现，没有对外功能更改。
*/

// Constants
const EXT_NAME = "shop";
const EXT_VER = "1.1.1";
const EXT_AUTHOR = "檀轶步棋";

const USER_INITIAL_MONEY = 50;

const ERR_SHOP_NOITM = 1;
const ERR_SHOP_QUANT = 2;
const ERR_USER_MONEY = 3;
const ERR_USER_NOITM = 4;
const ERR_USER_QUANT = 5;

// Statics
const Extension = getOrRegisterExtension();
const ErrnoMap = [
  "无错误",
  "商店中无此商品",
  "商店中此商品数量不足",
  "用户余额不足",
  "背包中没有此商品",
  "背包中此商品数量不足",
];

// Main logic

const commandSupply = seal.ext.newCmdItemInfo();
commandSupply.name = "supply";
commandSupply.help = ".上架 <名称> <单价(正整数)> <数量(大于0，默认为1)> //向商店添加商品，仅限骰主使用";
commandSupply.solve = (context, message, argument) => {
  if (argument.getArgN(1) == "help") {
    const ret = seal.ext.newCmdExecuteResult(true);
    ret.showHelp = true;
    return ret;
  }
  if (context.privilegeLevel < 100) {
    seal.replyToSender(context, message, seal.formatTmpl(context, "核心:提示_无权限"));
    return seal.ext.newCmdExecuteResult(true);
  }
  const name = argument.getArgN(1);
  const price = parseInt(argument.getArgN(2));
  const quantity = parseInt(argument.getArgN(3)) || 1;
  if (!name || isNaN(price) || price < 0 || !quantity || quantity <= 0) {
    seal.replyToSender(context, message, `参数错误。用法：${commandSupply.help}`);
    return seal.ext.newCmdExecuteResult(true);
  }
  const shop = new Shop();
  shop.saveAfter(() => shop.addItem({ name, price, quantity }));
  seal.replyToSender(context, message, `已向商店添${quantity}个${name}，单价为${price}`);
  return seal.ext.newCmdExecuteResult(true);
};
Extension.cmdMap["上架"] = commandSupply;

const commandDelist = seal.ext.newCmdItemInfo();
commandDelist.name = "delist";
commandDelist.help = ".下架 <名称> <数量(大于0，默认为1)> //从商店中下架物品，仅限骰主使用";
commandDelist.solve = (ctx, msg, args) => {
  if (args.getArgN(1) === "help") {
    const ret = seal.ext.newCmdExecuteResult(true);
    ret.showHelp = true;
    return ret;
  }
  if (ctx.privilegeLevel < 100) {
    seal.replyToSender(ctx, msg, seal.formatTmpl(ctx, "核心:提示_无权限"));
    return seal.ext.newCmdExecuteResult(true);
  }
  const name = args.getArgN(1);
  const quantity = parseInt(args.getArgN(2)) || 1;
  if (!name || quantity <= 0) {
    seal.replyToSender(ctx, msg, `参数错误。用法：${commandDelist.help}`);
    return seal.ext.newCmdExecuteResult(true);
  }
  const shop = new Shop();
  if (shop.saveAfter(() => shop.removeItem(name, quantity))) {
    seal.replyToSender(ctx, msg, "成功下架该商品");
  } else {
    seal.replyToSender(ctx, msg, "并没有所说的商品，无事发生");
  }
  return seal.ext.newCmdExecuteResult(true);
};
Extension.cmdMap["下架"] = commandDelist;

const commandSell = seal.ext.newCmdItemInfo();
commandSell.name = "sell";
commandSell.help = ".出售 <名称> <数量(大于0，默认为1)> //从背包中出售商品到商店";
commandSell.solve = (ctx, msg, args) => {
  if (args.getArgN(1) === "help") {
    const ret = seal.ext.newCmdExecuteResult(true);
    ret.showHelp = true;
    return ret;
  }
  const name = args.getArgN(1);
  const quantity = parseInt(args.getArgN(2)) || 1;
  if (!name || !quantity || quantity <= 0) {
    seal.replyToSender(ctx, msg, "参数错误。用法：.出售 <名称> <数量(大于0，默认为1)>");
    return seal.ext.newCmdExecuteResult(true);
  }
  const shop = new Shop();
  const backpack = new Backpack(ctx);
  const { errno, price } = backpack.sell(shop, name, quantity);
  if (errno != 0) {
    seal.replyToSender(ctx, msg, `无法出售: ${ErrnoMap[errno]}`);
  } else {
    seal.replyToSender(ctx, msg, `以${price}的价格出售成功，用户余额${backpack.getMoney()}`);
  }
  return seal.ext.newCmdExecuteResult(true);
};
Extension.cmdMap["出售"] = commandSell;

const commandBuy = seal.ext.newCmdItemInfo();
commandBuy.name = "buy";
commandBuy.help = ".购买 <名称> <数量(大于0，默认为1)> //从商店中购买物品";
commandBuy.solve = (ctx, msg, args) => {
  if (args.getArgN(1) === "help") {
    const ret = seal.ext.newCmdExecuteResult(true);
    ret.showHelp = true;
    return ret;
  }
  const name = args.getArgN(1);
  const quantity = parseInt(args.getArgN(2)) || 1;
  if (!name || !quantity || quantity <= 0) {
    seal.replyToSender(ctx, msg, `参数错误。用法：${commandBuy.help}`);
    return seal.ext.newCmdExecuteResult(true);
  }
  let backpack = new Backpack(ctx);
  let errno = backpack.buy(new Shop(), name, quantity);
  if (errno != 0) {
    seal.replyToSender(ctx, msg, `交易时发生错误：${ErrnoMap[errno]}`);
  } else {
    seal.replyToSender(ctx, msg, `购买成功！\n${name}x${quantity}已经放入你的背包。\n账户余额: ${backpack.getMoney()}`);
  }
  return seal.ext.newCmdExecuteResult(true);
};
Extension.cmdMap["购买"] = commandBuy;

const commandDiscard = seal.ext.newCmdItemInfo();
commandDiscard.name = "discard";
commandDiscard.help = ".丢弃 <名称> <数量(大于0，默认为全部)> //从背包中丢弃物品，谨慎使用";
commandDiscard.solve = (ctx, msg, args) => {
  if (args.getArgN(1) === "help") {
    const ret = seal.ext.newCmdExecuteResult(true);
    ret.showHelp = true;
    return ret;
  }
  const name = args.getArgN(1);
  const quantity = parseInt(args.getArgN(2)) || Infinity;
  if (!name || !quantity || quantity <= 0) {
    seal.replyToSender(ctx, msg, `参数错误。用法：${commandDiscard.help}`);
    return seal.ext.newCmdExecuteResult(true);
  }
  let backpack = new Backpack(ctx);
  if (backpack.saveAfter(() => backpack.removeItem(name, quantity))) {
    seal.replyToSender(ctx, msg, `执行成功`);
  } else {
    seal.replyToSender(ctx, msg, `背包内无该物品，无事发生`);
  }
  return seal.ext.newCmdExecuteResult(true);
};
Extension.cmdMap["丢弃"] = commandDiscard;

const commandShow = seal.ext.newCmdItemInfo();
commandShow.name = "show";
commandShow.help = ".展示 商店/背包(不填默认为背包) //展示商店或背包中的货物。";
commandShow.solve = (ctx, msg, args) => {
  if (args.getArgN(1) === "help") {
    const ret = seal.ext.newCmdExecuteResult(true);
    ret.showHelp = true;
    return ret;
  }
  const name = args.getArgN(1) || "背包";
  if (name !== "背包" && name !== "商店") {
    seal.replyToSender(ctx, msg, "参数错误。用法：.展示 商店/背包(不填默认为背包)");
    return seal.ext.newCmdExecuteResult(true);
  } else if (name === "背包") {
    const backpack = new Backpack(ctx);
    let items = backpack.listItems();
    seal.replyToSender(ctx, msg, `${msg.sender.nickname}的背包（余额 ${backpack.getMoney()}）:\n${items}`);
  } else {
    let shop = new Shop();
    let goods = shop.listGoods();
    seal.replyToSender(ctx, msg, `商店货架：\n${goods}`);
  }
  return seal.ext.newCmdExecuteResult(true);
};
Extension.cmdMap["展示"] = commandShow;

// Types
type ShopItem = {
  name: string;
  quantity: number;
  price: number;
};

type BackpackItem = {
  name: string;
  quantity: number;
};

class Shop {
  private goods: ShopItem[];
  private isDirty: boolean;

  constructor() {
    this.goods = JSON.parse(Extension.storageGet("shop") || "[]");
    this.isDirty = true;
  }

  saveAfter<T extends () => any>(func: T): ReturnType<T> {
    const returnValue = func();
    this.save();
    return returnValue;
  }

  getItem(name: string): ShopItem | undefined {
    return this.goods.find((i) => i.name == name);
  }

  addItem(item: ShopItem) {
    const itemInShop = this.getItem(item.name);
    if (!itemInShop) {
      this.goods.push(item);
    } else {
      itemInShop.quantity += item.quantity;
    }
    this.isDirty = true;
  }

  removeItem(name: string, quantity: number = 1): boolean {
    const itemInShopIndex = this.goods.findIndex((i) => i.name == name);
    if (itemInShopIndex < 0) {
      return false;
    }
    const itemInShop = this.goods[itemInShopIndex];
    if (quantity < 0 || itemInShop.quantity - quantity <= 0) {
      this.goods.splice(itemInShopIndex, 1);
    } else {
      itemInShop.quantity -= quantity;
    }
    this.isDirty = true;
    return true;
  }

  listGoods(): string {
    if (this.goods.length == 0) {
      return "空空如也";
    }
    let arr: string[] = [];
    this.goods.forEach((i) => arr.push(`${i.name}  数量${i.quantity}  单价${i.price}`));
    return arr.join("\n");
  }

  private save() {
    if (this.isDirty) {
      Extension.storageSet("shop", JSON.stringify(this.goods));
      this.isDirty = false;
    }
  }
}

class Backpack {
  private context: seal.MsgContext;
  private userid: string;
  private items: BackpackItem[];
  private money: number;
  private isDirty: boolean;

  constructor(ctx: seal.MsgContext) {
    let itemAll = JSON.parse(Extension.storageGet("backpacks") || "{}");
    this.userid = ctx.player.userId;
    this.context = ctx;
    if (itemAll[this.userid]) {
      this.items = itemAll[this.userid]["backpack"];
      this.money = itemAll[this.userid]["money"];
    } else {
      this.items = [];
      this.money = USER_INITIAL_MONEY;
    }
    this.isDirty = true;
  }

  getMoney(): number {
    return this.money;
  }

  saveAfter<T extends () => any>(func: T): ReturnType<T> {
    const returnValue = func();
    this.save();
    return returnValue;
  }

  getItem(name: string): BackpackItem | undefined {
    return this.items.find((i) => i.name == name);
  }

  addItem(item: BackpackItem) {
    const itemInBackpack = this.items.find((i) => i.name == item.name);
    if (!itemInBackpack) {
      this.items.push(item);
    } else {
      itemInBackpack.quantity += item.quantity;
    }
    this.isDirty = true;
  }

  removeItem(name: string, quantity: number = 1): boolean {
    const itemInBackpackIndex = this.items.findIndex((i) => i.name == name);
    if (itemInBackpackIndex < 0) {
      return false;
    }
    const itemInBackpack = this.items[itemInBackpackIndex];
    if (quantity < 0 || itemInBackpack.quantity - quantity <= 0) {
      this.items.splice(itemInBackpackIndex, 1);
    } else {
      itemInBackpack.quantity -= quantity;
    }
    this.isDirty = true;
    return true;
  }

  buy(shop: Shop, name: string, quantity: number = 1): number {
    const itemInShop = shop.getItem(name);
    if (!itemInShop) {
      return ERR_SHOP_NOITM;
    } else if (itemInShop.quantity < quantity) {
      return ERR_SHOP_QUANT;
    } else if (this.money < itemInShop.price * quantity) {
      return ERR_USER_MONEY;
    }
    this.saveAfter(() => {
      this.money -= itemInShop.price * quantity;
      this.addItem({ name: itemInShop.name, quantity });
    });
    shop.saveAfter(() => shop.removeItem(itemInShop.name, quantity));
    return 0;
  }

  sell(shop: Shop, name: string, quantity: number = 1): { errno: number; price: number } {
    const itemInBackpack = this.getItem(name);
    if (!itemInBackpack) {
      return { errno: ERR_USER_NOITM, price: 0 };
    } else if (itemInBackpack.quantity < quantity) {
      return { errno: ERR_USER_QUANT, price: 0 };
    }
    const itemInShop = shop.getItem(name);
    const price = itemInShop?.price ?? Math.floor(Math.random() * 10) + 1;
    this.saveAfter(() => {
      this.money += price * quantity;
      this.removeItem(name, quantity);
    });
    shop.saveAfter(() => shop.addItem({ name, quantity, price }));
    return { errno: 0, price };
  }

  listItems(): string {
    if (this.items.length == 0) {
      return "空空如也";
    }
    let arr: string[] = [];
    this.items.forEach((i) => arr.push(`${i.name}  数量${i.quantity}`));
    return arr.join("\n");
  }

  private save() {
    if (!this.isDirty) {
      return;
    }
    let itemAll = JSON.parse(Extension.storageGet("backpacks") || "{}");
    if (!itemAll[this.userid]) {
      itemAll[this.userid] = {};
    }
    itemAll[this.userid]["backpack"] = this.items;
    itemAll[this.userid]["money"] = this.money;
    seal.vars.intSet(this.context, "$m金钱", this.money);
    Extension.storageSet("backpacks", JSON.stringify(itemAll));
    this.isDirty = false;
  }
}

// Helper functions
function getOrRegisterExtension(): seal.ExtInfo {
  let ext = seal.ext.find(EXT_NAME);
  if (!ext) {
    ext = seal.ext.new(EXT_NAME, EXT_AUTHOR, EXT_VER);
    seal.ext.register(ext);
  }
  return ext;
}

/**
 * 敏感词过滤（2026-10-08）
 *
 * 为什么有这个东西：公安联网备案的《安全评估报告》要求交互式网站具备
 * "违法有害信息的自动发现与处置"能力，不能只靠人工巡查。
 *
 * 策略：命中即替换成等长的 *（不改动原文长度，前端看不出被截断），
 * 并把"过滤了一次"记进 audit_logs —— 这样处置过程有记录可查。
 *
 * 词表只收**明确违法**的类别（赌博 / 色情 / 毒品 / 诈骗与非法金融 /
 * 违禁物品 / 暴恐），正常讨论用语不进词表，避免误伤同学聊天。
 */

const WORDS: string[] = [
  // 赌博
  '赌博', '博彩', '六合彩', '时时彩', '赌球', '赌场', '百家乐', '德州扑克', '下注',
  // 色情低俗
  '色情', '黄片', '裸聊', '约炮', '一夜情', '卖淫', '嫖娼', '援交', '成人影片',
  // 毒品
  '冰毒', '海洛因', '摇头丸', '氯胺酮', '吸毒', '贩毒', '制毒', '大麻',
  // 诈骗与非法金融
  '刷单', '刷钻', '代开发票', '办假证', '洗钱', '电信诈骗', '钓鱼网站', '高利贷', '非法集资',
  // 违禁物品
  '枪支', '弹药', '仿真枪', '炸药', '雷管', '管制刀具', '迷药', '窃听器', '作弊器', '木马病毒',
  // 暴恐与极端
  '恐怖袭击', '爆炸物', '极端主义', '煽动颠覆',
  // 其他违法
  '私服', '游戏外挂', '代考', '替考', '人肉搜索', '买卖个人信息',
];

const PATTERN = new RegExp(WORDS.join('|'), 'g');

export type FilterResult = {
  /** 过滤后的文本（没命中就是原文） */
  text: string;
  /** 是否命中过敏感词 */
  hit: boolean;
  /** 命中了哪些词（只用于写审计日志，不外发） */
  words: string[];
};

/** 过滤敏感词：命中替换为等长 * */
export function filterSensitive(input: string): FilterResult {
  if (!input) return { text: input, hit: false, words: [] };
  const words: string[] = [];
  const text = input.replace(PATTERN, (match) => {
    words.push(match);
    return '*'.repeat(match.length);
  });
  return { text, hit: words.length > 0, words: [...new Set(words)] };
}

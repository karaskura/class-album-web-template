/** 举报原因（前后端共用；放在这里是因为 route.ts 不允许导出额外的东西） */
export const REPORT_REASONS = [
  '违法违规信息',
  '色情低俗',
  '垃圾广告',
  '侵权盗版',
  '其他',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

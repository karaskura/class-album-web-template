/**
 * 花边（维护者 2026-10-05 追加）：给窗框 / 面板套一圈装饰边。
 * 四个边条用可平铺的 svg 平铺，四个角用花饰，可选加一枚蝴蝶结。
 * 绝对定位 + pointer-events:none，纯粹是装饰，不挡点击。
 */
export default function LaceFrame({ withBow = false }: { withBow?: boolean }) {
  return (
    <span className="lace" aria-hidden>
      <i className="lace-top" />
      <i className="lace-bottom" />
      <i className="lace-left" />
      <i className="lace-right" />
      <i className="lace-corner lace-tl" />
      <i className="lace-corner lace-tr" />
      <i className="lace-corner lace-br" />
      <i className="lace-corner lace-bl" />
      {withBow && <i className="lace-bow" />}
    </span>
  );
}

/**
 * 头像：有上传过就显示图片，没有就用名字首字 + 主题色。
 *
 * 注意：这里收的是**已经拼好的 URL**，不是存储 key。
 * 因为 Nav / CommentSection 是客户端组件，不能 import lib/storage
 * （那个模块依赖 node:crypto，会被打进浏览器包）。
 * 所以由服务端组件调 mediaUrl(key) 之后再把 URL 传进来。
 */
export default function Avatar({
  name,
  src,
  size = 'md',
  className = '',
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClass = size === 'sm' ? ' avatar-sm' : size === 'lg' ? ' avatar-lg' : '';

  if (src) {
    return (
      <span className={`avatar avatar-img${sizeClass} ${className}`.trim()}>
        <img src={src} alt={name} loading="lazy" decoding="async" />
      </span>
    );
  }

  return (
    <span className={`avatar${sizeClass} ${className}`.trim()} aria-label={name}>
      {name.slice(0, 1) || '?'}
    </span>
  );
}

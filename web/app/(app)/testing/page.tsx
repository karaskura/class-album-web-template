export const metadata = { title: '测试中' };

/**
 * 「测试中」栏目：维护者 2026-10-31 要求把这一栏的文字**全部删掉**，只留位置。
 * 所以这里渲染一个空容器，不要再往里加标题、说明或占位文案。
 */
export default function TestingPage() {
  return <div className="page-head" aria-hidden="true" />;
}

import type { ReactNode } from "react";

/** 需要主动提交的导航动作统一用 POST；浏览器预加载页面不会执行表单。 */
export function PostActionForm({ action, buttonClassName, children }: {
  action: string;
  buttonClassName: string;
  children: ReactNode;
}) {
  return <form action={action} method="post">
    <button className={buttonClassName} type="submit">{children}</button>
  </form>;
}

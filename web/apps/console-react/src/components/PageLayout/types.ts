
/** 页面头部配置 */
export interface PageHeaderConfig {
  /** 标题文字或自定义节点 */
  title: React.ReactNode;
  /** 描述文字或自定义节点 */
  description?: React.ReactNode;
  /** 图标配置 */
  icon?: {
    src: string;
    bgColor?: string;
    className?: string;
  };
  /** 返回按钮 */
  back?: boolean;
  /** 返回按钮点击回调 */
  onBack?: () => void;
  /** 标题前缀 */
  titlePrefix?: React.ReactNode;
  /** 标题后缀 */
  titleSuffix?: React.ReactNode;
  /** 中间区域（如 Tabs） */
  center?: React.ReactNode;
  /** 右侧操作区 */
  right?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

/** Tab 配置 */
export interface TabConfig {
  key: string;
  label: string;
  children: React.ReactNode;
  /** 是否显示（用于权限控制） */
  visible?: boolean;
}

/** Tabs 布局 Props */
export interface PageLayoutTabsProps {
  /** 页面头部配置 */
  header?: PageHeaderConfig | string;
  /** Tab 配置列表 */
  tabs: TabConfig[];
  /** 当前激活的 tab */
  activeKey?: string;
  /** Tab 切换回调 */
  onTabChange?: (key: string) => void;
  /** 是否同步 URL query，默认 true */
  syncUrl?: boolean;
  /** URL query 参数名，默认 'tab' */
  urlParamName?: string;
  /** 自定义类名 */
  className?: string;
  /** Tabs 自定义样式 */
  tabsClassName?: string;
  /** 底部操作栏 */
  footer?: React.ReactNode;
  /** 是否为嵌套模式（无外层容器），默认 false */
  embedded?: boolean;
}

/** 内容布局 Props */
export interface PageLayoutContentProps {
  /** 页面头部配置 */
  header: PageHeaderConfig | string;
  /** 筛选栏内容 */
  filterBar?: React.ReactNode;
  /** 内容 */
  children: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 头部自定义类名，默认 'mb-5' */
  headerClassName?: string;
  /** 内容区自定义类名 */
  contentClassName?: string;
  /** 底部操作栏 */
  footer?: React.ReactNode;
  /** 是否允许滚动，默认 true */
  scrollable?: boolean;
}


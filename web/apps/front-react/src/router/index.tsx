import { lazy, Suspense, useEffect, useMemo } from "react";
import {
  createBrowserRouter,
  createHashRouter,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  useEnterpriseStore,
  useIsSoftStyle,
} from "@/stores/modules/enterprise";
import { useNavigationStore } from "@/stores/modules/navigation";
import { useUserStore } from "@/stores/modules/user";
import {
  includeKm,
  NAVIGATION_TYPE,
  NAVIGATION_TARGET,
} from "@/constants/navigation";
import { handleChunkLoadError } from "@km/shared-utils";
import { InitGuard } from "@/components/InitGuard";
import { checkVersion } from "@/utils/version";
import { VERSION_MODULE } from "@/constants/enterprise";

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

// Helper to create lazy component with Suspense
function lazyWithSuspense<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
) {
  const LazyComponent = lazy(() => importFn().catch((error) => {
    if (handleChunkLoadError(error)) {
      // 返回一个永远 pending 的 Promise，阻止后续渲染
      return new Promise(() => {}) as Promise<{ default: T }>;
    }
    throw error;
  }));
  return function SuspenseWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Lazy load views
const Layout = lazyWithSuspense(() =>
  import("@/views/layout").then((m) => ({ default: m.Layout })),
);
const IndexView = lazyWithSuspense(() =>
  import("@/views/index/index").then((m) => ({ default: m.IndexView })),
);
const WorkAiChatView = lazyWithSuspense(() =>
  import("@/views/index/work-ai-chat").then((m) => ({
    default: m.WorkAiChatView,
  })),
);
const KnowledgeChatView = lazyWithSuspense(() =>
  import("@/views/knowledge/chat").then((m) => ({
    default: m.KnowledgeChatView,
  })),
);
// 使用 shared-business 组件
const ChatView = lazyWithSuspense(() =>
  import("@/views/chat/index").then((m) => ({ default: m.default })),
);
const AgentView = lazyWithSuspense(() =>
  import("@/views/agent").then((m) => ({ default: m.AgentPage })),
);
const AgentCreateView = lazyWithSuspense(() =>
  import("@/views/agent/create").then((m) => ({ default: m.AgentCreate })),
);
const AgentCreateV2View = lazyWithSuspense(() =>
  import("@/views/agent/create-v2").then((m) => ({ default: m.AgentCreateV2 })),
);
const PromptView = lazyWithSuspense(() =>
  import("@/views/prompt/prompt").then((m) => ({ default: m.PromptView })),
);
const PromptDetailView = lazyWithSuspense(() =>
  import("@/views/prompt/detail").then((m) => ({
    default: m.PromptDetailView,
  })),
);
const ToolkitView = lazyWithSuspense(() =>
  import("@/views/toolkit").then((m) => ({ default: m.ToolkitView })),
);
const SkillsView = lazyWithSuspense(() =>
  import("@/views/skills").then((m) => ({ default: m.default })),
);
const SkillDetailView = lazyWithSuspense(() =>
  import("@/views/skills/components/Detail").then((m) => ({ default: m.default })),
);
const KnowledgeView = lazyWithSuspense(() =>
  import("@/views/knowledge").then((m) => ({ default: m.KnowledgeView })),
);
const SpaceLayout = lazyWithSuspense(() =>
  import("@/views/space/layout").then((m) => ({ default: m.SpaceLayout })),
);
const SpaceView = lazyWithSuspense(() =>
  import("@/views/space").then((m) => ({ default: m.SpaceView })),
);
const MineView2 = lazyWithSuspense(() =>
  import("@/views/mine2").then((m) => ({ default: m.MineView2 })),
);
const ProfileView = lazyWithSuspense(() =>
  import("@/views/profile").then((m) => ({ default: m.ProfileView })),
);
const OrderView = lazyWithSuspense(() =>
  import("@/views/order").then((m) => ({ default: m.OrderView })),
);
const ShareChatView = lazyWithSuspense(() =>
  import("@/views/share/chat").then((m) => ({ default: m.ShareChatView })),
);
const ShareFileView = lazyWithSuspense(() =>
  import("@/views/share/file").then((m) => ({ default: m.ShareFileView })),
);
const GuideView = lazyWithSuspense(() =>
  import("@/views/guide").then((m) => ({ default: m.GuideView })),
);
const SvgListView = lazyWithSuspense(() =>
  import("@/views/svglist").then((m) => ({ default: m.SvgListView })),
);
const Error500View = lazyWithSuspense(() =>
  import("@/views/exception/500").then((m) => ({ default: m.Error500View })),
);
const SsoLoginView = lazyWithSuspense(() =>
  import("@/views/index/apilogin").then((m) => ({ default: m.SsoLoginView })),
);
const WebView = lazyWithSuspense(() =>
  import("@/views/custom/iframe").then((m) => ({ default: m.WebView })),
);
const CustomView = lazyWithSuspense(() =>
  import("@/views/custom").then((m) => ({ default: m.CustomView })),
);

// Library views
const LibraryMainView = lazyWithSuspense(() =>
  import("@/views/library/main").then((m) => ({ default: m.LibraryMainView })),
);
const LibraryHomeView = lazyWithSuspense(() =>
  import("@/views/library/main/home").then((m) => ({
    default: m.LibraryHomeView,
  })),
);
const LibraryFileLayout = lazyWithSuspense(() =>
  import("@/views/library/main/file/layout").then((m) => ({
    default: m.LibraryFileLayout,
  })),
);
const LibraryFileView = lazyWithSuspense(() =>
  import("@/views/library/main/file").then((m) => ({
    default: m.LibraryFileView,
  })),
);
const LibraryFileSourceEdit = lazyWithSuspense(() =>
  import("@/views/library/main/file/source-edit").then((m) => ({
    default: m.default,
  })),
);
const LibraryFileChunks = lazyWithSuspense(() =>
  import("@/views/library/main/file/chunks.v2").then((m) => ({
    default: m.default,
  })),
);
const LibraryFileChunksEdit = lazyWithSuspense(() =>
  import("@/views/library/main/file/chunks-edit").then((m) => ({
    default: m.default,
  })),
);
const LibraryFolderView = lazyWithSuspense(() =>
  import("@/views/library/main/folder").then((m) => ({
    default: m.LibraryFolderView,
  })),
);
const LibraryRecallView = lazyWithSuspense(() =>
  import("@/views/library/main/recall").then((m) => ({
    default: m.LibraryRecallView,
  })),
);
const LibraryGraphView = lazyWithSuspense(() =>
  import("@/views/library/main/graph").then((m) => ({
    default: m.LibraryGraphView,
  })),
);
const LibrarySettingLayout = lazyWithSuspense(() =>
  import("@/views/library/setting").then((m) => ({
    default: m.LibrarySettingLayout,
  })),
);
const LibrarySettingInfo = lazyWithSuspense(() =>
  import("@/views/library/setting/info").then((m) => ({
    default: m.default,
  })),
);
const LibrarySettingApi = lazyWithSuspense(() =>
  import("@/views/library/setting/api").then((m) => ({
    default: m.LibraryApiSettingsView,
  })),
);
const LibrarySettingPermission = lazyWithSuspense(() =>
  import("@/views/library/setting/permission").then((m) => ({
    default: m.LibraryPermissionSettingsView,
  })),
);
const LibrarySettingRecycle = lazyWithSuspense(() =>
  import("@/views/library/setting/recycle").then((m) => ({
    default: m.LibraryRecycleSettingsView,
  })),
);
const LibrarySettingChunk = lazyWithSuspense(() =>
  import("@/views/library/setting/chunk").then((m) => ({
    default: m.LibraryChunkSettingsView,
  })),
);
const LibrarySettingDocument = lazyWithSuspense(() =>
  import("@/views/library/setting/document-setting").then((m) => ({
    default: m.LibraryDocumentSettingsView,
  })),
);
const LibrarySettingEmbedded = lazyWithSuspense(() =>
  import("@/views/library/setting/embedded").then((m) => ({
    default: m.LibraryEmbeddedSettingsView,
  })),
);

// Auth guard component
function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Route guard for checking permissions
function PermissionGuard({
  children,
  auth,
}: {
  children: React.ReactNode;
  auth?: boolean;
}) {
  const token = localStorage.getItem("access_token");
  const needsLogin = auth && !token;

  // Dispatch login modal event in useEffect to avoid setState during render
  useEffect(() => {
    if (needsLogin) {
      window.dispatchEvent(new CustomEvent("open-login-modal"));
    }
  }, [needsLogin]);

  if (needsLogin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function useVisibleNavigations() {
  const isSoftStyle = useIsSoftStyle();
  const navigations = useNavigationStore((state) => state.navigations);
  const userStore = useUserStore();

  return useMemo(() => {
    return navigations
      .filter((item) => +item.status)
      .filter((item) =>
        item.jump_path === "/knowledge" ? userStore.info.is_internal : true,
      )
      .filter((item) =>
        ((isSoftStyle && item.jump_path === "/index") || item.jump_path === "/skills") ? checkVersion(VERSION_MODULE.WORKBENCH) : true,
      )
      .filter((item) => item.jump_path !== "/___placeholder");
  }, [isSoftStyle, navigations, userStore.info.is_internal]);
}

function RootRedirect() {
  const visibleNavigations = useVisibleNavigations();
  const firstNav = visibleNavigations[0];

  if (!firstNav) {
    return <Navigate to="/index" replace />;
  }

  return <Navigate to={firstNav.jump_path} replace />;
}

// Dynamic component for index
function IndexComponent() {
  const isSoftStyle = useIsSoftStyle();

  if (isSoftStyle) {
    return <WorkAiChatView />;
  }
  return <IndexView />;
}

// Dynamic component for knowledge route
function KnowledgeComponent() {
  const isSoftStyle = useIsSoftStyle();
  return isSoftStyle ? <KnowledgeChatView /> : <KnowledgeView />;
}

// Dynamic component for knowledge space route
function KnowledgeSpaceComponent() {
  const isSoftStyle = useIsSoftStyle();
  return isSoftStyle ? <SpaceView /> : <KnowledgeView />;
}

// Dynamic custom page handler
function DynamicCustomPage() {
  const location = useLocation();
  const navigations = useNavigationStore((state) => state.navigations);
  const pathname = location.pathname;

  // 查找匹配的自定义导航
  const customNav = navigations.find((item) => {
    if (item.menu_path === pathname || item.jump_path === pathname) {
      return (
        item.type === NAVIGATION_TYPE.CUSTOM ||
        (item.type === NAVIGATION_TYPE.EXTERNAL &&
          item.target === NAVIGATION_TARGET.SELF)
      );
    }
    return false;
  });

  if (!customNav) {
    return <Navigate to="/" replace />;
  }

  // 如果是外部链接且 target 为 SELF，使用 WebView
  const isExternal =
    customNav.type === NAVIGATION_TYPE.EXTERNAL &&
    customNav.target === NAVIGATION_TARGET.SELF;

  if (isExternal) {
    return <WebView jumpPath={customNav.jump_path} />;
  }

  return <CustomView title={customNav.name} />;
}

// Check if current path is a custom navigation
function isCustomNavigationPath(
  pathname: string,
  navigations: Navigation.State[],
): boolean {
  return navigations.some((item) => {
    if (item.menu_path === pathname || item.jump_path === pathname) {
      return (
        item.type === NAVIGATION_TYPE.CUSTOM ||
        (item.type === NAVIGATION_TYPE.EXTERNAL &&
          item.target === NAVIGATION_TARGET.SELF)
      );
    }
    return false;
  });
}

// Build routes
const buildRoutes = () => {
  const routes = [
    {
      element: <InitGuard><Outlet /></InitGuard>,
      children: [
        {
          path: "/",
          element: <Layout />,
          children: [
            {
              index: true,
              element: <RootRedirect />,
            },
            {
              path: "index",
              element: <IndexComponent />,
            },
            {
              path: "index/apilogin",
              element: <SsoLoginView />,
            },
            {
              path: "chat",
              element: <ChatView />,
            },
                        {
              path: "agent",
              element: <AgentView />,
              handle: { banner: true },
            },
            {
              path: "agent/create",
              element: <AgentCreateView />,
            },
            {
              path: "agent/create-v2",
              element: <AgentCreateV2View />,
            },
            {
              path: "toolkit",
              element: <ToolkitView />,
              handle: { banner: true },
            },
            {
              path: "skills",
              element: <SkillsView />,
              handle: { banner: true },
            },
            {
              path: "skill-detail",
              element: <SkillDetailView />,
              handle: { banner: true },
            },
            {
              path: "prompt",
              element: <PromptView />,
              handle: { banner: true },
            },
            {
              path: "prompt/:prompt_id",
              element: <PromptDetailView />,
            },
            ...(includeKm
              ? [
                  {
                    path: "knowledge",
                    element: (
                      <PermissionGuard auth>
                        <KnowledgeComponent />
                      </PermissionGuard>
                    ),
                    handle: { banner: true },
                    children: [
                      {
                        path: ":space_id",
                        element: <KnowledgeSpaceComponent />,
                        handle: { banner: true },
                      },
                    ],
                  },
                ]
              : []),
            {
              path: "order",
              element: (
                <PermissionGuard auth>
                  <OrderView />
                </PermissionGuard>
              ),
            },
            {
              path: "mine",
              element: (
                <PermissionGuard auth>
                  <MineView2 />
                </PermissionGuard>
              ),
            },
            {
              path: "profile",
              element: (
                <PermissionGuard auth>
                  <ProfileView />
                </PermissionGuard>
              ),
            },
            {
              path: "webview",
              element: <WebView />,
            },
            // Dynamic custom page route - must be before the catch-all route
            {
              path: ":customPath",
              element: <DynamicCustomPage />,
            },
          ],
        },
        ...(includeKm
          ? [
              {
                path: "/library/:id",
                element: (
                  <PermissionGuard auth>
                    <Outlet />
                  </PermissionGuard>
                ),
                children: [
                  {
                    path: "",
                    element: <LibraryMainView />,
                    children: [
                      { index: true, element: <LibraryHomeView /> },
                      { path: "chat", element: <KnowledgeChatView /> },
                      {
                        path: "file/:fid",
                        element: <LibraryFileLayout />,
                        children: [
                          { index: true, element: <LibraryFileView /> },
                          {
                            path: "source-edit",
                            element: <LibraryFileSourceEdit />,
                          },
                          { path: "chunks", element: <LibraryFileChunks /> },
                        ],
                      },
                      {
                        path: "file/:fid/chunks-edit",
                        element: <LibraryFileChunksEdit />,
                      },
                      { path: "folder/:fid", element: <LibraryFolderView /> },
                      { path: "recall", element: <LibraryRecallView /> },
                      { path: "graph", element: <LibraryGraphView /> },
                    ],
                  },
                  {
                    path: "setting",
                    element: <LibrarySettingLayout />,
                    children: [
                      { index: true, element: <Navigate to="info" replace /> },
                      { path: "info", element: <LibrarySettingInfo /> },
                      { path: "permission", element: <LibrarySettingPermission /> },
                      { path: "api", element: <LibrarySettingApi /> },
                      { path: "recycle", element: <LibrarySettingRecycle /> },
                      { path: "chunk", element: <LibrarySettingChunk /> },
                      {
                        path: "document-setting",
                        element: <LibrarySettingDocument />,
                      },
                      { path: "embedded", element: <LibrarySettingEmbedded /> },
                    ],
                  },
                ],
              },
            ]
          : []),
        {
          path: "/share/chat",
          element: <ShareChatView />,
        },
        {
          path: "/share/file/:id",
          element: (
            <PermissionGuard auth>
              <ShareFileView />
            </PermissionGuard>
          ),
        },
        {
          path: "/guide",
          element: <GuideView />,
        },
        {
          path: "/svglist",
          element: <SvgListView />,
        },
        {
          path: "/500",
          element: <Error500View />,
        },
        {
          path: "*",
          element: <Navigate to="/" replace />,
        },
      ],
    },
  ];

  return routes;
};

// Determine router type based on environment
const isOpLocalEnv = import.meta.env.VITE_PLATFORM === "op-local";
const isPrivatePremEnv = import.meta.env.VITE_PRIVATE_PREM === "true";
const useHashRouter = isOpLocalEnv || isPrivatePremEnv;

export const isHashRouter = useHashRouter;
export const isHistoryRouter = !useHashRouter;

/**
 * 获取当前路由路径（兼容 HashRouter 和 BrowserRouter）
 *
 * ⚠️ 重要：在非 React 组件中（如 store、utils）必须使用此函数
 * 在 React 组件中应使用 useLocation().pathname
 *
 * @returns 当前路由路径，如 "/library/123/file/456"
 */
export function getCurrentPathname(): string {
  if (useHashRouter) {
    // HashRouter: hash 格式为 "#/path"，需要去掉 "#"
    const hash = window.location.hash;
    return hash ? hash.slice(1) || "/" : "/";
  }
  // BrowserRouter: pathname 直接是路径
  return window.location.pathname || "/";
}

/**
 * 检查当前路径是否包含指定路径段（兼容 HashRouter 和 BrowserRouter）
 *
 * ⚠️ 重要：在非 React 组件中（如 store、utils）必须使用此函数
 * 在 React 组件中应使用 useLocation().pathname
 *
 * @param pathSegment - 要检查的路径段，如 "/chat"
 * @returns 是否包含该路径段
 */
export function pathIncludes(pathSegment: string): boolean {
  return getCurrentPathname().includes(pathSegment);
}

/**
 * 获取完整的基础路径（用于构建静态资源 URL，兼容两种路由模式）
 *
 * 在 HashRouter 模式下，pathname 是基础路径（如 "/app/" 或 "/"）
 * 在 BrowserRouter 模式下，pathname 是完整路由路径
 *
 * @returns 基础路径，如 "/app" 或 "/"
 */
export function getBasePath(): string {
  if (useHashRouter) {
    // HashRouter: pathname 是基础路径，hash 包含路由
    return window.location.pathname.replace(/\/$/, "") || "";
  }
  // BrowserRouter: pathname 就是路由路径
  return "";
}

// Create router
export const router = useHashRouter
  ? createHashRouter(buildRoutes())
  : createBrowserRouter(buildRoutes());

// Setup router function
export async function setupRouter() {
  // Load enterprise info before routing
  const enterpriseStore = useEnterpriseStore.getState();
  await enterpriseStore.loadInfo();
  await enterpriseStore.loadSaasInfo();

  // Load navigation
  const navigationStore = useNavigationStore.getState();
  await navigationStore.fetchNavigations();
}

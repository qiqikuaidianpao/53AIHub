import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { IAgentApi, IConversationApi, IUploadApi, IWorkflowApi } from "../adapters/types";

export interface PluginConfig {
  type: string;
  title?: string;
  features?: {
    showRagStats?: boolean;
    showFileUpload?: boolean;
    showConversationList?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PluginAdapters {
  conversationApi: IConversationApi;
  agentApi: IAgentApi;
  uploadApi?: IUploadApi;
  workflowApi?: IWorkflowApi;
  [key: string]: unknown;
}

export interface PluginContextValue {
  config: PluginConfig;
  adapters: PluginAdapters;
  isLoggedIn: boolean;
}

const PluginContext = createContext<PluginContextValue | null>(null);

export interface ChatProviderProps {
  config: PluginConfig;
  adapters: PluginAdapters;
  children: ReactNode;
}

export function ChatProvider({ config, adapters, children }: ChatProviderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setIsLoggedIn(!!token && token.length > 0);
  }, []);

  const value: PluginContextValue = {
    config,
    adapters,
    isLoggedIn,
  };

  return (
    <PluginContext.Provider value={value}>
      {children}
    </PluginContext.Provider>
  );
}

export function usePluginContext(): PluginContextValue {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error("usePluginContext must be used within a ChatProvider");
  }
  return context;
}

export function usePluginConfig(): PluginConfig {
  return usePluginContext().config;
}

export function usePluginAdapters(): PluginAdapters {
  return usePluginContext().adapters;
}

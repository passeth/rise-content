import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface ProductInfo {
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  features?: string[];
  targetAudience?: string;
  [key: string]: unknown;
}

interface AgentContext {
  mainCopy?: string;
  tagline?: string;
  usp?: string[];
  designMood?: string;
  toneAndManner?: string;
  tone?: string;
  keywords?: string[];
  copyDirection?: string;
  [key: string]: unknown;
}

interface Blueprint {
  sections?: unknown[];
  layout?: string;
  [key: string]: unknown;
}

interface Project {
  id: string;
  name: string;
  brandId: string;
  status: string;
  productInfo: ProductInfo;
  agentContext: AgentContext;
  blueprint: Blueprint;
}

interface ProjectListItem {
  id: string;
  name: string;
  brandId: string;
  status: string;
  updatedAt?: string;
}

interface ProjectStoreState {
  currentProject: Project | null;
  projects: ProjectListItem[];

  setCurrentProject: (project: Project) => void;
  updateProductInfo: (info: Partial<ProductInfo>) => void;
  updateAgentContext: (context: Partial<AgentContext>) => void;
  updateBlueprint: (blueprint: Partial<Blueprint>) => void;
  setProjects: (list: ProjectListItem[]) => void;
  clearCurrentProject: () => void;
}

export const useProjectStore = create<ProjectStoreState>()(
  immer((set) => ({
    currentProject: null,
    projects: [],

    setCurrentProject: (project) =>
      set((state) => {
        state.currentProject = project;
      }),

    updateProductInfo: (info) =>
      set((state) => {
        if (state.currentProject) {
          Object.assign(state.currentProject.productInfo, info);
        }
      }),

    updateAgentContext: (context) =>
      set((state) => {
        if (state.currentProject) {
          Object.assign(state.currentProject.agentContext, context);
        }
      }),

    updateBlueprint: (blueprint) =>
      set((state) => {
        if (state.currentProject) {
          Object.assign(state.currentProject.blueprint, blueprint);
        }
      }),

    setProjects: (list) =>
      set((state) => {
        state.projects = list;
      }),

    clearCurrentProject: () =>
      set((state) => {
        state.currentProject = null;
      }),
  }))
);

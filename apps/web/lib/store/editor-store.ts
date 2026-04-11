import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  CanvasSection,
  EditorState,
  TextSlotInstance,
  ImageSlotInstance,
} from "@/lib/types/editor";

interface EditorActions {
  // Section actions
  addSection: (section: CanvasSection) => void;
  removeSection: (id: string) => void;
  updateSection: (id: string, partial: Partial<CanvasSection>) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;

  // Selection actions
  selectSection: (id: string) => void;
  selectSlot: (sectionId: string, slotId: string) => void;
  clearSelection: () => void;

  // Slot content actions
  updateTextSlot: (sectionId: string, slotId: string, content: string) => void;
  updateImageSlot: (
    sectionId: string,
    slotId: string,
    imageUrl: string,
    imageId: string
  ) => void;

  // Editor state actions
  setZoom: (level: number) => void;
  setDirty: (isDirty: boolean) => void;
  resetEditor: () => void;
  loadSections: (sections: CanvasSection[]) => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
}

interface EditorStoreState extends EditorState, EditorActions {
  previousStates: EditorState[];
  futureStates: EditorState[];
}

const initialEditorState: EditorState = {
  projectId: "",
  sections: [],
  selectedSectionId: undefined,
  selectedSlotId: undefined,
  zoom: 1,
  isDirty: false,
};

function snapshotState(state: EditorStoreState): EditorState {
  return {
    projectId: state.projectId,
    sections: state.sections,
    selectedSectionId: state.selectedSectionId,
    selectedSlotId: state.selectedSlotId,
    zoom: state.zoom,
    isDirty: state.isDirty,
  };
}

export const useEditorStore = create<EditorStoreState>()(
  immer((set) => ({
    ...initialEditorState,
    previousStates: [],
    futureStates: [],

    addSection: (section) =>
      set((state) => {
        state.previousStates.push(snapshotState(state));
        state.futureStates = [];
        state.sections.push(section);
        state.isDirty = true;
      }),

    removeSection: (id) =>
      set((state) => {
        state.previousStates.push(snapshotState(state));
        state.futureStates = [];
        state.sections = state.sections.filter((s: CanvasSection) => s.id !== id);
        if (state.selectedSectionId === id) {
          state.selectedSectionId = undefined;
          state.selectedSlotId = undefined;
        }
        state.isDirty = true;
      }),

    updateSection: (id, partial) =>
      set((state) => {
        state.previousStates.push(snapshotState(state));
        state.futureStates = [];
        const idx = state.sections.findIndex((s: CanvasSection) => s.id === id);
        if (idx !== -1) {
          Object.assign(state.sections[idx], partial);
        }
        state.isDirty = true;
      }),

    reorderSections: (fromIndex, toIndex) =>
      set((state) => {
        state.previousStates.push(snapshotState(state));
        state.futureStates = [];
        const [removed] = state.sections.splice(fromIndex, 1);
        state.sections.splice(toIndex, 0, removed);
        state.isDirty = true;
      }),

    selectSection: (id) =>
      set((state) => {
        state.selectedSectionId = id;
        state.selectedSlotId = undefined;
      }),

    selectSlot: (sectionId, slotId) =>
      set((state) => {
        state.selectedSectionId = sectionId;
        state.selectedSlotId = slotId;
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedSectionId = undefined;
        state.selectedSlotId = undefined;
      }),

    updateTextSlot: (sectionId, slotId, content) =>
      set((state) => {
        state.previousStates.push(snapshotState(state));
        state.futureStates = [];
        const section = state.sections.find((s: CanvasSection) => s.id === sectionId);
        if (section) {
          const slot = section.textSlots.find((t: TextSlotInstance) => t.id === slotId);
          if (slot) {
            slot.content = content;
          }
        }
        state.isDirty = true;
      }),

    updateImageSlot: (sectionId, slotId, imageUrl, imageId) =>
      set((state) => {
        state.previousStates.push(snapshotState(state));
        state.futureStates = [];
        const section = state.sections.find((s: CanvasSection) => s.id === sectionId);
        if (section) {
          const slot = section.imageSlots.find((i: ImageSlotInstance) => i.id === slotId);
          if (slot) {
            slot.imageUrl = imageUrl;
            slot.selectedImageId = imageId;
          }
        }
        state.isDirty = true;
      }),

    setZoom: (level) =>
      set((state) => {
        state.zoom = level;
      }),

    setDirty: (isDirty) =>
      set((state) => {
        state.isDirty = isDirty;
      }),

    resetEditor: () =>
      set((state) => {
        Object.assign(state, initialEditorState);
        state.previousStates = [];
        state.futureStates = [];
      }),

    loadSections: (sections) =>
      set((state) => {
        state.sections = sections;
        state.isDirty = false;
        state.previousStates = [];
        state.futureStates = [];
      }),

    undo: () =>
      set((state) => {
        const prev = state.previousStates.pop();
        if (prev) {
          state.futureStates.push(snapshotState(state));
          Object.assign(state, prev);
        }
      }),

    redo: () =>
      set((state) => {
        const next = state.futureStates.pop();
        if (next) {
          state.previousStates.push(snapshotState(state));
          Object.assign(state, next);
        }
      }),
  }))
);

import { useEffect, useMemo, useReducer } from "react";
import { buildEditorAssetIndex } from "./assets";
import { buildOledCommands, generateEditorCode } from "./codegen";
import { cloneDocument, createEmptyDocument, DEFAULT_CODEGEN_SETTINGS } from "./document";
import type {
  CodegenSettings,
  EditorDocument,
  EditorState,
  GeneratedCodeResult,
  HistoryEntry,
  HistoryEditorAction,
  SelectionState,
  ToolId,
} from "./types";

type EditorReducerAction =
  | { type: "tool/set"; tool: ToolId }
  | { type: "selection/set"; selection: SelectionState }
  | { type: "hover/set"; id: string | null }
  | { type: "viewport/set"; patch: Partial<EditorState["viewport"]> }
  | { type: "document/set"; document: EditorDocument }
  | { type: "screen/set"; patch: Partial<EditorDocument["screen"]> }
  | { type: "asset/select"; assetId?: string }
  | { type: "ui/image-panel"; open: boolean }
  | { type: "ui/right-mouse-mode"; value: EditorState["ui"]["rightMouseMode"] }
  | { type: "ui/code-settings"; patch: Partial<CodegenSettings> }
  | { type: "history/push"; entry: HistoryEntry; selection?: SelectionState }
  | { type: "history/undo" }
  | { type: "history/redo" };

export interface UseOledEditorStateArgs {
  initialDocument?: EditorDocument;
  onDocumentChange?: (document: EditorDocument) => void;
  onCodeChange?: (result: GeneratedCodeResult) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function useOledEditorState({
  initialDocument,
  onDocumentChange,
  onCodeChange,
  onDirtyChange,
}: UseOledEditorStateArgs = {}) {
  const [state, dispatch] = useReducer(
    editorReducer,
    initialDocument,
    createInitialState,
  );

  const assetIndex = useMemo(
    () => buildEditorAssetIndex(state.document.assetsById),
    [state.document.assetsById],
  );
  const commands = useMemo(
    () => buildOledCommands(state.document),
    [state.document],
  );
  const generatedCode = useMemo(
    () => generateEditorCode(state.document, state.ui.codeSettings),
    [state.document, state.ui.codeSettings],
  );
  const selectedObjects = useMemo(
    () =>
      state.selection.selectedIds
        .map((id) => state.document.objectsById[id])
        .filter(Boolean),
    [state.document.objectsById, state.selection.selectedIds],
  );

  useEffect(() => {
    onDocumentChange?.(state.document);
  }, [onDocumentChange, state.document]);

  useEffect(() => {
    onCodeChange?.(generatedCode);
  }, [generatedCode, onCodeChange]);

  useEffect(() => {
    onDirtyChange?.(state.history.past.length > 0);
  }, [onDirtyChange, state.history.past.length]);

  return {
    state,
    assetIndex,
    commands,
    generatedCode,
    selectedObjects,
    setTool(tool: ToolId) {
      dispatch({ type: "tool/set", tool });
    },
    setSelection(selection: SelectionState) {
      dispatch({ type: "selection/set", selection });
    },
    setHoveredId(id: string | null) {
      dispatch({ type: "hover/set", id });
    },
    setViewport(patch: Partial<EditorState["viewport"]>) {
      dispatch({ type: "viewport/set", patch });
    },
    setDocument(document: EditorDocument) {
      dispatch({ type: "document/set", document });
    },
    commitDocument(
      label: string,
      previousDocument: EditorDocument,
      nextDocument: EditorDocument,
      selection?: SelectionState,
    ) {
      if (sameDocument(previousDocument, nextDocument)) {
        return;
      }

      const entry: HistoryEntry = {
        label,
        forward: [{ type: "document/replace", document: cloneDocument(nextDocument) }],
        inverse: [{ type: "document/replace", document: cloneDocument(previousDocument) }],
        timestamp: Date.now(),
      };

      dispatch({ type: "history/push", entry, selection });
    },
    undo() {
      dispatch({ type: "history/undo" });
    },
    redo() {
      dispatch({ type: "history/redo" });
    },
    setImagePanelOpen(open: boolean) {
      dispatch({ type: "ui/image-panel", open });
    },
    selectAsset(assetId?: string) {
      dispatch({ type: "asset/select", assetId });
    },
    setRightMouseMode(value: EditorState["ui"]["rightMouseMode"]) {
      dispatch({ type: "ui/right-mouse-mode", value });
    },
    updateCodeSettings(patch: Partial<CodegenSettings>) {
      dispatch({ type: "ui/code-settings", patch });
    },
    updateScreen(patch: Partial<EditorDocument["screen"]>) {
      dispatch({ type: "screen/set", patch });
    },
  };
}

function createInitialState(initialDocument?: EditorDocument): EditorState {
  return {
    document: cloneDocument(initialDocument ?? createEmptyDocument()),
    selection: { selectedIds: [] },
    activeTool: "select",
    hoveredId: null,
    viewport: {
      zoom: 6,
      panX: 0,
      panY: 0,
    },
    history: {
      past: [],
      future: [],
      stagedForward: [],
      stagedInverse: [],
    },
    ui: {
      rightMouseMode: "none",
      imagePanelOpen: false,
      selectedAssetId: undefined,
      codeSettings: DEFAULT_CODEGEN_SETTINGS,
    },
  };
}

function editorReducer(state: EditorState, action: EditorReducerAction): EditorState {
  switch (action.type) {
    case "tool/set":
      return {
        ...state,
        activeTool: action.tool,
      };
    case "selection/set":
      return {
        ...state,
        selection: action.selection,
      };
    case "hover/set":
      return {
        ...state,
        hoveredId: action.id,
      };
    case "viewport/set":
      return {
        ...state,
        viewport: {
          ...state.viewport,
          ...action.patch,
        },
      };
    case "document/set":
      return {
        ...state,
        document: cloneDocument(action.document),
      };
    case "screen/set":
      return {
        ...state,
        document: {
          ...state.document,
          screen: {
            ...state.document.screen,
            ...action.patch,
          },
        },
      };
    case "asset/select":
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedAssetId: action.assetId,
        },
      };
    case "ui/image-panel":
      return {
        ...state,
        ui: {
          ...state.ui,
          imagePanelOpen: action.open,
        },
      };
    case "ui/right-mouse-mode":
      return {
        ...state,
        ui: {
          ...state.ui,
          rightMouseMode: action.value,
        },
      };
    case "ui/code-settings":
      return {
        ...state,
        ui: {
          ...state.ui,
          codeSettings: {
            ...state.ui.codeSettings,
            ...action.patch,
          },
        },
      };
    case "history/push":
      return {
        ...state,
        document: applyHistoryAction(state.document, action.entry.forward[0]),
        selection: action.selection ?? state.selection,
        history: {
          ...state.history,
          past: [...state.history.past, action.entry],
          future: [],
        },
      };
    case "history/undo": {
      const previous = state.history.past[state.history.past.length - 1];

      if (!previous) {
        return state;
      }

      return {
        ...state,
        document: applyHistoryAction(state.document, previous.inverse[0]),
        history: {
          ...state.history,
          past: state.history.past.slice(0, -1),
          future: [previous, ...state.history.future],
        },
      };
    }
    case "history/redo": {
      const [next, ...rest] = state.history.future;

      if (!next) {
        return state;
      }

      return {
        ...state,
        document: applyHistoryAction(state.document, next.forward[0]),
        history: {
          ...state.history,
          past: [...state.history.past, next],
          future: rest,
        },
      };
    }
  }
}

function applyHistoryAction(document: EditorDocument, action: HistoryEditorAction) {
  if (action.type === "document/replace") {
    return cloneDocument(action.document);
  }

  return document;
}

function sameDocument(left: EditorDocument, right: EditorDocument) {
  return JSON.stringify(left) === JSON.stringify(right);
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildOledCommands } from "../features/oledEditor/codegen";
import { cloneDocument } from "../features/oledEditor/document";
import type { EditorDocument } from "../features/oledEditor/types";
import type { OledCommand } from "../screens";

const STORAGE_KEY = "saved-oled-screens-v1";

interface PersistedSavedOledScreen {
  id: string;
  title: string;
  document: EditorDocument;
  createdAt: number;
  updatedAt: number;
}

export interface SavedOledScreen extends PersistedSavedOledScreen {
  commands: OledCommand[];
}

interface SaveScreenArgs {
  id?: string;
  document: EditorDocument;
}

interface SavedOledScreensContextValue {
  savedScreens: SavedOledScreen[];
  saveScreen: (args: SaveScreenArgs) => string;
  deleteScreen: (id: string) => void;
  getScreen: (id: string) => SavedOledScreen | undefined;
}

const SavedOledScreensContext = createContext<
  SavedOledScreensContextValue | undefined
>(undefined);

export function SavedOledScreensProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [persistedScreens, setPersistedScreens] = useState<
    PersistedSavedOledScreen[]
  >(() => loadPersistedScreens());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(persistedScreens),
    );
  }, [persistedScreens]);

  const savedScreens = useMemo(
    () =>
      [...persistedScreens]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map((screen) => ({
          ...screen,
          document: cloneDocument(screen.document),
          commands: buildOledCommands(screen.document),
        })),
    [persistedScreens],
  );

  const value = useMemo<SavedOledScreensContextValue>(
    () => ({
      savedScreens,
      saveScreen({ id, document }) {
        const timestamp = Date.now();
        const title = document.screen.title.trim() || "Pantalla sin titulo";
        const nextId = id ?? createSavedScreenId();

        setPersistedScreens((current) => {
          const existing = current.find((screen) => screen.id === nextId);
          const nextEntry: PersistedSavedOledScreen = {
            id: nextId,
            title,
            document: cloneDocument(document),
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp,
          };

          if (existing) {
            return current.map((screen) =>
              screen.id === nextId ? nextEntry : screen,
            );
          }

          return [nextEntry, ...current];
        });

        return nextId;
      },
      deleteScreen(id) {
        setPersistedScreens((current) =>
          current.filter((screen) => screen.id !== id),
        );
      },
      getScreen(id) {
        return savedScreens.find((screen) => screen.id === id);
      },
    }),
    [savedScreens],
  );

  return (
    <SavedOledScreensContext.Provider value={value}>
      {children}
    </SavedOledScreensContext.Provider>
  );
}

export function useSavedOledScreens() {
  const context = useContext(SavedOledScreensContext);

  if (!context) {
    throw new Error(
      "useSavedOledScreens debe usarse dentro de SavedOledScreensProvider",
    );
  }

  return context;
}

function loadPersistedScreens(): PersistedSavedOledScreen[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isPersistedSavedOledScreen)
      .map((screen) => ({
        ...screen,
        document: cloneDocument(screen.document),
      }));
  } catch {
    return [];
  }
}

function createSavedScreenId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `saved-screen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isPersistedSavedOledScreen(
  value: unknown,
): value is PersistedSavedOledScreen {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedSavedOledScreen>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number" &&
    Boolean(candidate.document)
  );
}

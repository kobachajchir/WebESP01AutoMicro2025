import {
 useEffect,
 useMemo,
 useRef,
 useState,
 type ChangeEvent,
 type MouseEvent as ReactMouseEvent,
 type PointerEvent as ReactPointerEvent,
 type ReactElement,
 type ReactNode,
} from "react";
import { SSD1306_HEIGHT, SSD1306_WIDTH } from "../../screens";
import OledBitmapText from "../../components/OledBitmapText";
import Modal from "../../components/modal";
import { listEditorAssets, OLED_FONT_PRESETS } from "./assets";
import {
 cloneDocument,
 createBitmapObject,
 createCircle,
 createLine,
 createImageObject,
 createPolygon,
 createRectangle,
 createText,
 createTriangle,
 createUploadedAsset,
 insertObject,
 moveObjectDown,
 moveObjectUp,
 registerAsset,
 removeObjects,
 replaceObject,
 bitmapBytesToPixels,
} from "./document";
import {
 centerObjectAt,
 clamp,
 findLineEndpointHandle,
 findResizeHandle,
 findVertexHandle,
 getObjectBounds,
 getResizeHandles,
 getSelectionBounds,
 hitTestObject,
 normalizeRect,
 resizeBounds,
 resizeBitmapFromBounds,
 resizeCircleFromBounds,
 resizeObjectFromBounds,
 snapLine,
 translateObject,
 updateLineEndpoint,
 updateVertexPoint,
 type HandlePosition,
} from "./geometry";
import { useOledEditorState } from "./useOledEditorState";
import type {
 BitmapObject,
 CanvasObject,
 EditorDocument,
 GeneratedCodeResult,
 ImageAsset,
 ImageObject,
 Point,
 SelectionState,
 ToolId,
} from "./types";

const OLED_STAGE_BG = "#020617";
const OLED_STAGE_WHITE = "#e6fffb";
const GRID_COLOR = "rgba(148, 163, 184, 0.12)";

type DraftShape =
 | { tool: "rectangle"; start: Point; current: Point }
 | { tool: "circle"; start: Point; current: Point }
 | { tool: "line"; start: Point; current: Point; snapped: boolean }
 | { tool: "triangle"; points: Point[]; current: Point | null }
 | { tool: "polygon"; points: Point[]; current: Point | null }
 | { tool: "marquee"; start: Point; current: Point };

type InteractionSession =
 | {
 kind: "move";
 beforeDocument: EditorDocument;
 selectedIds: string[];
 start: Point;
 }
 | {
 kind: "resize";
 beforeDocument: EditorDocument;
 objectId: string;
 handle: HandlePosition;
 start: Point;
 bounds: ReturnType<typeof getObjectBounds>;
 }
 | {
 kind: "line-endpoint";
 beforeDocument: EditorDocument;
 objectId: string;
 endpoint: 0 | 1;
 }
 | {
 kind: "vertex";
 beforeDocument: EditorDocument;
 objectId: string;
 index: number;
 }
 | {
 kind: "paint";
 beforeDocument: EditorDocument;
 objectId: string;
 lastPoint: Point;
 erase: boolean;
 }
 | null;

export interface LopakaLikeEditorProps {
 initialDocument?: EditorDocument;
 readOnly?: boolean;
 activeView?: "visualization" | "code";
 onDocumentChange?: (document: EditorDocument) => void;
 onCodeChange?: (result: GeneratedCodeResult) => void;
 onDirtyChange?: (dirty: boolean) => void;
 onSaveDocument?: (document: EditorDocument) => void;
 onClearDocument?: () => void;
}

const TOOL_DEFINITIONS: ReadonlyArray<{
 id: ToolId;
 label: string;
 icon: (props: EditorIconProps) => ReactElement;
}> = [
 { id: "select", label: "Seleccion", icon: CursorSelectIcon },
 { id: "rectangle", label: "Rectangulo", icon: RectangleToolIcon },
 { id: "circle", label: "Circulo", icon: CircleToolIcon },
 { id: "line", label: "Linea", icon: LineToolIcon },
 { id: "triangle", label: "Triangulo", icon: TriangleToolIcon },
 { id: "polygon", label: "Poligono", icon: PolygonToolIcon },
 { id: "text", label: "Texto", icon: TextToolIcon },
 { id: "image", label: "Imagen", icon: ImageToolIcon },
 { id: "paint", label: "Pincel", icon: PaintBrushToolIcon },
];

interface EditorIconProps {
 className?: string;
}

export function LopakaLikeEditor({
 initialDocument,
 readOnly = false,
 activeView = "visualization",
 onDocumentChange,
 onCodeChange,
 onDirtyChange,
 onSaveDocument,
 onClearDocument,
}: LopakaLikeEditorProps) {
 const editor = useOledEditorState({
 initialDocument,
 onDocumentChange,
 onCodeChange,
 onDirtyChange,
 });
 const rootRef = useRef<HTMLDivElement | null>(null);
 const stageRef = useRef<HTMLDivElement | null>(null);
 const rasterCanvasRef = useRef<HTMLCanvasElement | null>(null);
 const fileInputRef = useRef<HTMLInputElement | null>(null);
 const codePanelRef = useRef<HTMLDivElement | null>(null);

 const [draftShape, setDraftShape] = useState<DraftShape | null>(null);
 const interactionRef = useRef<InteractionSession>(null);
 const [codeCopied, setCodeCopied] = useState(false);

 const assetList = useMemo(
 () => listEditorAssets(editor.state.document.assetsById),
 [editor.state.document.assetsById],
 );
 const selectedAsset = editor.state.ui.selectedAssetId
 ? editor.assetIndex[editor.state.ui.selectedAssetId]
 : undefined;
 const selectedObject =
 editor.state.selection.selectedIds.length === 1
 ? editor.state.document.objectsById[editor.state.selection.selectedIds[0]]
 : null;
 const selectionBounds = useMemo(
 () => getSelectionBounds(editor.selectedObjects),
 [editor.selectedObjects],
 );

 useEffect(() => {
 drawRasterObjects(rasterCanvasRef.current, editor.state.document, editor.assetIndex);
 }, [editor.assetIndex, editor.state.document]);

 useEffect(() => {
 const listener = (event: KeyboardEvent) => {
 const activeElement = document.activeElement;
 const withinEditor = rootRef.current?.contains(activeElement ?? null);
 const editingText = isEditableElement(activeElement);

 if (!withinEditor) {
 return;
 }

 if (editingText) {
 return;
 }

 const isMeta = event.ctrlKey || event.metaKey;

 if (isMeta && event.key.toLowerCase() === "z") {
 event.preventDefault();
 if (event.shiftKey) {
 editor.redo();
 } else {
 editor.undo();
 }
 return;
 }

 if (isMeta && event.key.toLowerCase() === "y") {
 event.preventDefault();
 editor.redo();
 return;
 }

 if (event.key === "Escape") {
 event.preventDefault();
 if (draftShape?.tool === "polygon" && draftShape.points.length >= 3) {
 finalizePolygonDraft(draftShape.points);
 } else {
 setDraftShape(null);
 }
 interactionRef.current = null;
 editor.setTool("select");
 editor.setSelection({ selectedIds: editor.state.selection.selectedIds });
 return;
 }

 if (
 (event.key === "Delete" || event.key === "Backspace") &&
 editor.state.selection.selectedIds.length > 0
 ) {
 event.preventDefault();
 const before = cloneDocument(editor.state.document);
 const next = removeObjects(
 editor.state.document,
 editor.state.selection.selectedIds,
 );
 editor.commitDocument("delete selection", before, next, {
 selectedIds: [],
 });
 return;
 }

 if (draftShape?.tool === "polygon" && event.key === "Enter") {
 event.preventDefault();
 if (draftShape.points.length >= 3) {
 finalizePolygonDraft(draftShape.points);
 }
 return;
 }

 if (selectedObject && isArrowKey(event.key)) {
 event.preventDefault();
 const delta = event.shiftKey ? 5 : 1;
 const before = cloneDocument(editor.state.document);
 const next = cloneDocument(editor.state.document);
 const moved = translateObject(
 selectedObject,
 event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0,
 event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0,
 );
 next.objectsById[selectedObject.id] = moved;
 editor.commitDocument("nudge object", before, next);
 }
 };

 window.addEventListener("keydown", listener);
 return () => window.removeEventListener("keydown", listener);
 }, [
 draftShape,
 editor,
 editor.state.document,
 editor.state.selection.selectedIds,
 selectedObject,
 ]);

 useEffect(() => {
 if (!codeCopied) {
 return;
 }

 const timer = window.setTimeout(() => setCodeCopied(false), 1800);
 return () => window.clearTimeout(timer);
 }, [codeCopied]);

 function focusEditor() {
 rootRef.current?.focus();
 }

 function getCanvasPointFromPointer(event: ReactPointerEvent<HTMLDivElement>): Point {
 const rect = stageRef.current?.getBoundingClientRect();

 if (!rect) {
 return { x: 0, y: 0 };
 }

 return {
 x: clamp(
 Math.floor((event.clientX - rect.left) / editor.state.viewport.zoom),
 0,
 SSD1306_WIDTH - 1,
 ),
 y: clamp(
 Math.floor((event.clientY - rect.top) / editor.state.viewport.zoom),
 0,
 SSD1306_HEIGHT - 1,
 ),
 };
 }

 function findTopObjectAtPoint(point: Point) {
 for (let index = editor.state.document.zOrder.length - 1; index >= 0; index -= 1) {
 const object = editor.state.document.objectsById[editor.state.document.zOrder[index]];
 if (object && hitTestObject(object, point)) {
 return object;
 }
 }

 return null;
 }

 function handleStagePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
 focusEditor();

 if (readOnly) {
 return;
 }

 const point = getCanvasPointFromPointer(event);
 const stage = event.currentTarget;
 stage.setPointerCapture(event.pointerId);

 if (editor.state.activeTool === "select") {
 handleSelectionPointerDown(event, point);
 return;
 }

 if (editor.state.activeTool === "text") {
 const before = cloneDocument(editor.state.document);
 const textObject = createText(editor.state.document, point);
 const next = insertObject(editor.state.document, textObject);
 editor.commitDocument("insert text", before, next, {
 selectedIds: [textObject.id],
 });
 editor.setTool("select");
 return;
 }

 if (editor.state.activeTool === "image") {
 if (!selectedAsset) {
 editor.setImagePanelOpen(true);
 return;
 }

 const before = cloneDocument(editor.state.document);
 const positioned = centerObjectAt(point, selectedAsset.width, selectedAsset.height);
 const imageObject = createImageObject(editor.state.document, selectedAsset, positioned);
 const next = insertObject(editor.state.document, imageObject);
 editor.commitDocument("insert bitmap asset", before, next, {
 selectedIds: [imageObject.id],
 });
 editor.setTool("select");
 return;
 }

 if (editor.state.activeTool === "rectangle") {
 setDraftShape({ tool: "rectangle", start: point, current: point });
 return;
 }

 if (editor.state.activeTool === "circle") {
 setDraftShape({ tool: "circle", start: point, current: point });
 return;
 }

 if (editor.state.activeTool === "line") {
 setDraftShape({
 tool: "line",
 start: point,
 current: point,
 snapped: event.shiftKey,
 });
 return;
 }

 if (editor.state.activeTool === "triangle") {
 if (!draftShape || draftShape.tool !== "triangle") {
 setDraftShape({ tool: "triangle", points: [point], current: point });
 return;
 }

 const nextPoints = [...draftShape.points, point];
 if (nextPoints.length === 3) {
 finalizeTriangleDraft(nextPoints as [Point, Point, Point]);
 return;
 }

 setDraftShape({ tool: "triangle", points: nextPoints, current: point });
 return;
 }

 if (editor.state.activeTool === "polygon") {
 if (!draftShape || draftShape.tool !== "polygon") {
 setDraftShape({ tool: "polygon", points: [point], current: point });
 return;
 }

 setDraftShape({
 tool: "polygon",
 points: [...draftShape.points, point],
 current: point,
 });
 return;
 }

 if (editor.state.activeTool === "paint") {
 const before = cloneDocument(editor.state.document);
 const { bitmap, document: preparedDocument } = ensurePaintLayer();
 const firstStrokeDoc = applyPaintStroke(
 preparedDocument,
 bitmap.id,
 point,
 point,
 event.button === 2,
 );
 editor.setDocument(firstStrokeDoc);
 interactionRef.current = {
 kind: "paint",
 beforeDocument: before,
 objectId: bitmap.id,
 lastPoint: point,
 erase: event.button === 2,
 };
 }
 }

 function handleSelectionPointerDown(
 event: ReactPointerEvent<HTMLDivElement>,
 point: Point,
 ) {
 const currentSelection = editor.state.selection.selectedIds
 .map((id) => editor.state.document.objectsById[id])
 .filter(Boolean);
 const single = currentSelection.length === 1 ? currentSelection[0] : null;

 if (single?.kind === "line") {
 const endpoint = findLineEndpointHandle(single, point);

 if (endpoint !== null) {
 interactionRef.current = {
 kind: "line-endpoint",
 beforeDocument: cloneDocument(editor.state.document),
 objectId: single.id,
 endpoint,
 };
 editor.setSelection({
 selectedIds: [single.id],
 vertexEdit: { objectId: single.id, kind: "line", activeVertex: endpoint },
 });
 return;
 }
 }

 if (single?.kind === "triangle" || single?.kind === "polygon") {
 const handle = findVertexHandle(single.points, point);
 if (handle !== null) {
 interactionRef.current = {
 kind: "vertex",
 beforeDocument: cloneDocument(editor.state.document),
 objectId: single.id,
 index: handle,
 };
 editor.setSelection({
 selectedIds: [single.id],
 vertexEdit:
 single.kind === "triangle"
 ? {
 objectId: single.id,
 kind: "triangle",
 activeVertex: handle as 0 | 1 | 2,
 }
 : {
 objectId: single.id,
 kind: "polygon",
 activeVertex: handle,
 },
 });
 return;
 }
 }

 if (
 selectionBounds &&
 editor.state.selection.selectedIds.length === 1 &&
 single &&
 (single.kind === "rectangle" ||
 single.kind === "circle" ||
 single.kind === "image" ||
 single.kind === "bitmap")
 ) {
 const resizeHandle = findResizeHandle(selectionBounds, point);

 if (resizeHandle) {
 interactionRef.current = {
 kind: "resize",
 beforeDocument: cloneDocument(editor.state.document),
 objectId: single.id,
 handle: resizeHandle,
 start: point,
 bounds: getObjectBounds(single),
 };
 return;
 }
 }

 const hitObject = findTopObjectAtPoint(point);

 if (hitObject) {
 const nextSelectedIds =
 event.shiftKey && !editor.state.selection.selectedIds.includes(hitObject.id)
 ? [...editor.state.selection.selectedIds, hitObject.id]
 : [hitObject.id];

 const nextSelection: SelectionState = { selectedIds: nextSelectedIds };
 editor.setSelection(nextSelection);

 if (!hitObject.locked) {
 interactionRef.current = {
 kind: "move",
 beforeDocument: cloneDocument(editor.state.document),
 selectedIds: nextSelectedIds,
 start: point,
 };
 }
 return;
 }

 setDraftShape({
 tool: "marquee",
 start: point,
 current: point,
 });
 editor.setSelection({ selectedIds: [] });
 }

 function handleStagePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
 const point = getCanvasPointFromPointer(event);

 if (draftShape) {
 if (draftShape.tool === "triangle" || draftShape.tool === "polygon") {
 setDraftShape({ ...draftShape, current: point });
 } else if (draftShape.tool === "line") {
 setDraftShape({
 ...draftShape,
 current: snapLine(draftShape.start, point, event.shiftKey),
 snapped: event.shiftKey,
 });
 } else {
 setDraftShape({ ...draftShape, current: point });
 }
 }

 const session = interactionRef.current;

 if (!session) {
 editor.setHoveredId(findTopObjectAtPoint(point)?.id ?? null);
 return;
 }

 if (session.kind === "move") {
 const dx = point.x - session.start.x;
 const dy = point.y - session.start.y;
 const next = cloneDocument(session.beforeDocument);
 session.selectedIds.forEach((id) => {
 const current = next.objectsById[id];
 if (current) {
 next.objectsById[id] = translateObject(current, dx, dy);
 }
 });
 editor.setDocument(next);
 return;
 }

 if (session.kind === "resize") {
 const current = editor.state.document.objectsById[session.objectId];
 if (!current) {
 return;
 }
 const dx = point.x - session.start.x;
 const dy = point.y - session.start.y;
 const nextBounds = resizeBounds(session.bounds, session.handle, dx, dy);
 const nextDocument = cloneDocument(session.beforeDocument);
 const nextObject = nextDocument.objectsById[session.objectId];

 if (!nextObject) {
 return;
 }

 if (nextObject.kind === "circle") {
 nextDocument.objectsById[nextObject.id] = resizeCircleFromBounds(nextObject, nextBounds);
 } else if (nextObject.kind === "bitmap") {
 nextDocument.objectsById[nextObject.id] = resizeBitmapFromBounds(nextObject, nextBounds);
 } else if (
 nextObject.kind === "rectangle" ||
 nextObject.kind === "image" ||
 nextObject.kind === "text"
 ) {
 nextDocument.objectsById[nextObject.id] = resizeObjectFromBounds(nextObject, nextBounds);
 }

 editor.setDocument(nextDocument);
 return;
 }

 if (session.kind === "line-endpoint") {
 const next = cloneDocument(editor.state.document);
 const current = next.objectsById[session.objectId];

 if (current?.kind === "line") {
 next.objectsById[current.id] = updateLineEndpoint(current, session.endpoint, point);
 editor.setDocument(next);
 }
 return;
 }

 if (session.kind === "vertex") {
 const next = cloneDocument(editor.state.document);
 const current = next.objectsById[session.objectId];

 if (current?.kind === "triangle" || current?.kind === "polygon") {
 next.objectsById[current.id] = updateVertexPoint(current, session.index, point);
 editor.setDocument(next);
 }
 return;
 }

 if (session.kind === "paint") {
 const next = applyPaintStroke(
 editor.state.document,
 session.objectId,
 session.lastPoint,
 point,
 session.erase,
 );
 interactionRef.current = {
 ...session,
 lastPoint: point,
 };
 editor.setDocument(next);
 }
 }

 function handleStagePointerUp() {
 const session = interactionRef.current;
 interactionRef.current = null;

 if (draftShape?.tool === "rectangle") {
 const bounds = normalizeRect(draftShape.start, draftShape.current);
 const before = cloneDocument(editor.state.document);
 const nextObject = createRectangle(editor.state.document, bounds);
 const next = insertObject(editor.state.document, nextObject);
 editor.commitDocument("create rectangle", before, next, {
 selectedIds: [nextObject.id],
 });
 setDraftShape(null);
 editor.setTool("select");
 return;
 }

 if (draftShape?.tool === "circle") {
 const bounds = normalizeRect(draftShape.start, draftShape.current);
 const before = cloneDocument(editor.state.document);
 const nextObject = createCircle(
 editor.state.document,
 {
 x: Math.round(bounds.x + bounds.width / 2),
 y: Math.round(bounds.y + bounds.height / 2),
 },
 Math.max(1, Math.round(Math.max(bounds.width, bounds.height) / 2)),
 );
 const next = insertObject(editor.state.document, nextObject);
 editor.commitDocument("create circle", before, next, {
 selectedIds: [nextObject.id],
 });
 setDraftShape(null);
 editor.setTool("select");
 return;
 }

 if (draftShape?.tool === "line") {
 const before = cloneDocument(editor.state.document);
 const nextObject = createLine(
 editor.state.document,
 draftShape.start,
 draftShape.current,
 );
 const next = insertObject(editor.state.document, nextObject);
 editor.commitDocument("create line", before, next, {
 selectedIds: [nextObject.id],
 });
 setDraftShape(null);
 editor.setTool("select");
 return;
 }

 if (draftShape?.tool === "marquee") {
 const bounds = normalizeRect(draftShape.start, draftShape.current);
 const selectedIds = editor.state.document.zOrder.filter((id) => {
 const object = editor.state.document.objectsById[id];
 return object ? rectsOverlap(bounds, getObjectBounds(object)) : false;
 });
 editor.setSelection({ selectedIds });
 setDraftShape(null);
 return;
 }

 if (session?.kind === "move") {
 editor.commitDocument("move selection", session.beforeDocument, editor.state.document);
 return;
 }

 if (session?.kind === "resize") {
 editor.commitDocument("resize object", session.beforeDocument, editor.state.document);
 return;
 }

 if (session?.kind === "line-endpoint") {
 editor.commitDocument("edit line", session.beforeDocument, editor.state.document, {
 selectedIds: [session.objectId],
 vertexEdit: { objectId: session.objectId, kind: "line", activeVertex: session.endpoint },
 });
 return;
 }

 if (session?.kind === "vertex") {
 const object = editor.state.document.objectsById[session.objectId];
 editor.commitDocument("edit vertices", session.beforeDocument, editor.state.document, {
 selectedIds: [session.objectId],
 vertexEdit:
 object?.kind === "triangle"
 ? {
 objectId: session.objectId,
 kind: "triangle",
 activeVertex: session.index as 0 | 1 | 2,
 }
 : {
 objectId: session.objectId,
 kind: "polygon",
 activeVertex: session.index,
 },
 });
 return;
 }

 if (session?.kind === "paint") {
 editor.commitDocument("paint bitmap", session.beforeDocument, editor.state.document, {
 selectedIds: [session.objectId],
 });
 }
 }

 function handleStageDoubleClick() {
 if (draftShape?.tool === "polygon" && draftShape.points.length >= 3) {
 finalizePolygonDraft(draftShape.points);
 }
 }

 function handleStageContextMenu(event: React.MouseEvent<HTMLDivElement>) {
 event.preventDefault();

 if (readOnly) {
 return;
 }

 const point = getCanvasPointFromPointer(
 event as unknown as ReactPointerEvent<HTMLDivElement>,
 );
 const selected = selectedObject;

 if (selected?.kind === "polygon") {
 const vertex = findVertexHandle(selected.points, point);
 if (vertex !== null && selected.points.length > 3) {
 const before = cloneDocument(editor.state.document);
 const next = cloneDocument(editor.state.document);
 next.objectsById[selected.id] = {
 ...selected,
 points: selected.points.filter((_, index) => index !== vertex),
 };
 editor.commitDocument("remove polygon vertex", before, next, {
 selectedIds: [selected.id],
 });
 }
 }
 }

 function ensurePaintLayer() {
 if (selectedObject?.kind === "bitmap") {
 return {
 bitmap: selectedObject,
 document: editor.state.document,
 };
 }

 const existing = editor.state.document.zOrder
 .map((id) => editor.state.document.objectsById[id])
 .find((object): object is BitmapObject => object?.kind === "bitmap");

 if (existing) {
 editor.setSelection({ selectedIds: [existing.id] });
 return {
 bitmap: existing,
 document: editor.state.document,
 };
 }

 const bitmap = createBitmapObject(editor.state.document, { x: 0, y: 0 });
 const next = insertObject(editor.state.document, bitmap);
 editor.setSelection({ selectedIds: [bitmap.id] });
 return {
 bitmap,
 document: next,
 };
 }

 function finalizeTriangleDraft(points: [Point, Point, Point]) {
 const before = cloneDocument(editor.state.document);
 const triangle = createTriangle(editor.state.document, points);
 const next = insertObject(editor.state.document, triangle);
 editor.commitDocument("create triangle", before, next, {
 selectedIds: [triangle.id],
 });
 setDraftShape(null);
 editor.setTool("select");
 }

 function finalizePolygonDraft(points: Point[]) {
 const before = cloneDocument(editor.state.document);
 const polygon = createPolygon(editor.state.document, points);
 const next = insertObject(editor.state.document, polygon);
 editor.commitDocument("create polygon", before, next, {
 selectedIds: [polygon.id],
 });
 setDraftShape(null);
 editor.setTool("select");
 }

 async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
 const file = event.target.files?.[0];

 if (!file) {
 return;
 }

 const raster = await decodeImageFile(file);
 const asset = createUploadedAsset(raster.name, raster.width, raster.height, raster.bytes);
 const before = cloneDocument(editor.state.document);
 const next = registerAsset(editor.state.document, asset);
 editor.commitDocument("register upload asset", before, next);
 editor.selectAsset(asset.id);
 editor.setImagePanelOpen(true);
 event.target.value = "";
 }

 async function copyGeneratedCode() {
 try {
 await navigator.clipboard.writeText(editor.generatedCode.text);
 setCodeCopied(true);
 } catch {
 // ignore
 }
 }

 function handleSaveDocument() {
 onSaveDocument?.(cloneDocument(editor.state.document));
 }

 function handleClearDocument() {
 onClearDocument?.();
 }

 function updateSingleObject(nextObject: CanvasObject, label = "update object") {
 const before = cloneDocument(editor.state.document);
 const next = replaceObject(editor.state.document, nextObject);
 editor.commitDocument(label, before, next, {
 selectedIds: [nextObject.id],
 });
 }

 return (
 <div ref={rootRef} tabIndex={0} className="flex flex-col gap-4 outline-none">
 <div
 className={
 activeView === "visualization"
 ? "grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]"
 : "hidden"
 }
 >
 <aside className="app-panel-strong flex flex-col gap-4 p-4">
 <div>
 <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 Screen
 </div>
 <input
 className="app-input mt-2 w-full px-3 py-2 text-sm"
 value={editor.state.document.screen.title}
 onChange={(event) =>
 editor.updateScreen({
 title: event.target.value,
 })
 }
 disabled={readOnly}
 />
 <p className="mt-2 text-xs text-[var(--ui-muted)]">
 OLED {editor.state.document.screen.width}x{editor.state.document.screen.height} en una sola screen.
 </p>
 </div>

 <div>
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 Layers
 </div>
 <div className="flex flex-col gap-2">
 {editor.state.document.zOrder.length === 0 ? (
 <div className="rounded-md border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/40 p-3 text-sm text-[var(--ui-muted)]">
 Todavia no hay objetos en el canvas.
 </div>
 ) : null}
 {[...editor.state.document.zOrder].reverse().map((id) => {
 const object = editor.state.document.objectsById[id];
 if (!object) return null;
 const selected = editor.state.selection.selectedIds.includes(id);

 return (
 <div
 key={id}
 className="rounded-md border px-3 py-2"
 style={{
 borderColor: selected ? "var(--ui-accent)" : "rgba(255,255,255,0.1)",
 background: selected ? "rgba(34,211,238,0.08)" : "rgba(2,6,23,0.28)",
 }}
 >
 <button
 type="button"
 className="flex w-full items-start justify-between gap-2 text-left"
 onClick={() => editor.setSelection({ selectedIds: [id] })}
 >
 <div>
 <div className="font-semibold text-[var(--ui-text)]">{object.name}</div>
 <div className="text-xs uppercase text-[var(--ui-muted)]">{object.kind}</div>
 </div>
 <div className="flex gap-1">
 <LayerActionIconButton
 label={object.hidden ? "Mostrar capa" : "Ocultar capa"}
 onClick={(event) => {
 event.stopPropagation();
 updateSingleObject(
 { ...object, hidden: !object.hidden },
 "toggle hidden",
 );
 }}
 icon={
 object.hidden ? <EyeClosedIcon className="h-4 w-4" /> : <EyeOpenIcon className="h-4 w-4" />
 }
 />
 <LayerActionIconButton
 label={object.locked ? "Desbloquear capa" : "Bloquear capa"}
 onClick={(event) => {
 event.stopPropagation();
 updateSingleObject(
 { ...object, locked: !object.locked },
 "toggle lock",
 );
 }}
 icon={
 object.locked ? <LockClosedIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />
 }
 />
 </div>
 </button>
 <div className="mt-2 flex gap-2">
 <LayerActionIconButton
 label="Subir capa"
 onClick={() => {
 const before = cloneDocument(editor.state.document);
 const next = moveObjectUp(editor.state.document, id);
 editor.commitDocument("bring forward", before, next, {
 selectedIds: [id],
 });
 }}
 icon={<ChevronUpIcon className="h-4 w-4" />}
 />
 <LayerActionIconButton
 label="Bajar capa"
 onClick={() => {
 const before = cloneDocument(editor.state.document);
 const next = moveObjectDown(editor.state.document, id);
 editor.commitDocument("send backward", before, next, {
 selectedIds: [id],
 });
 }}
 icon={<ChevronDownIcon className="h-4 w-4" />}
 />
 </div>
 </div>
 );
 })}
 </div>
 </div>

 <div>
 <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 Libreria draft
 </div>
 <div className="rounded-md border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/35 p-3">
 <p className="text-sm text-[var(--ui-muted)]">
 {selectedAsset
 ? `Asset activo: ${selectedAsset.label}`
 : "Selecciona un asset compartido o sube uno propio."}
 </p>
 <div className="mt-3 flex flex-wrap gap-2">
 <button
 type="button"
 className="app-button px-3 py-2 text-sm font-semibold"
 onClick={() => editor.setImagePanelOpen(true)}
 >
 Abrir libreria
 </button>
 <button
 type="button"
 className="app-button--ghost px-3 py-2 text-sm font-semibold"
 onClick={() => fileInputRef.current?.click()}
 >
 Subir bitmap
 </button>
 </div>
 </div>
 <input
 ref={fileInputRef}
 hidden
 type="file"
 accept=".png,.bmp,image/png,image/bmp,image/*"
 onChange={handleUploadChange}
 />
 </div>
 </aside>

 <div className="flex min-w-0 flex-col gap-4">
 <div className="app-panel-strong flex flex-wrap items-center gap-2 p-3">
 {TOOL_DEFINITIONS.map(({ id, label, icon: Icon }) => (
 <ToolbarIconButton
 key={id}
 label={label}
 active={editor.state.activeTool === id}
 onClick={() => editor.setTool(id)}
 >
 <Icon className="h-5 w-5" />
 </ToolbarIconButton>
 ))}

 <div className="ml-auto flex items-center gap-2">
 <div className="flex items-center gap-2 rounded-full border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/35 px-2 py-1">
 <ToolbarIconButton
 label="Alejar"
 onClick={() =>
 editor.setViewport({
 zoom: clamp(editor.state.viewport.zoom - 1, 3, 12),
 })
 }
 >
 <ZoomOutIcon className="h-5 w-5" />
 </ToolbarIconButton>
 <div className="min-w-10 text-center text-xs font-black uppercase tracking-[0.18em] text-[var(--ui-text)]">
 {editor.state.viewport.zoom}x
 </div>
 <ToolbarIconButton
 label="Acercar"
 onClick={() =>
 editor.setViewport({
 zoom: clamp(editor.state.viewport.zoom + 1, 3, 12),
 })
 }
 >
 <ZoomInIcon className="h-5 w-5" />
 </ToolbarIconButton>
 </div>
 <ToolbarIconButton label="Undo" onClick={editor.undo}>
 <UndoIcon className="h-5 w-5" />
 </ToolbarIconButton>
 <ToolbarIconButton label="Redo" onClick={editor.redo}>
 <RedoIcon className="h-5 w-5" />
 </ToolbarIconButton>
 <ToolbarIconButton
 label="Guardar pantalla"
 onClick={handleSaveDocument}
 disabled={!onSaveDocument}
 >
 <SaveIcon className="h-5 w-5" />
 </ToolbarIconButton>
 <ToolbarIconButton
 label="Limpiar o desasociar"
 onClick={handleClearDocument}
 disabled={!onClearDocument}
 >
 <ClearIcon className="h-5 w-5" />
 </ToolbarIconButton>
 </div>
 </div>

 <div className="app-panel-strong flex flex-col gap-4 p-4">
 <div className="flex items-center justify-between gap-3">
 <div>
 <h2 className="text-xl font-black text-[var(--ui-text)]">Canvas</h2>
 </div>
 <div className="rounded-full border border-[var(--ui-ring)] bg-[var(--ui-panel)] px-3 py-1 text-xs font-semibold uppercase text-[var(--ui-muted)]">
 {getToolLabel(editor.state.activeTool)}
 </div>
 </div>

 <div className="overflow-auto rounded-md border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/60 p-4">
 <div
 ref={stageRef}
 className="relative mx-auto rounded-md border border-cyan-300/20 bg-[var(--ui-bg-0)] shadow-[0_0_0_1px_rgba(34,211,238,0.08)]"
 style={{
 width: SSD1306_WIDTH * editor.state.viewport.zoom,
 height: SSD1306_HEIGHT * editor.state.viewport.zoom,
 }}
 onPointerDown={handleStagePointerDown}
 onPointerMove={handleStagePointerMove}
 onPointerUp={handleStagePointerUp}
 onDoubleClick={handleStageDoubleClick}
 onContextMenu={handleStageContextMenu}
 aria-label="canvas"
 >
 <canvas
 ref={rasterCanvasRef}
 width={SSD1306_WIDTH}
 height={SSD1306_HEIGHT}
 className="absolute inset-0 h-full w-full"
 style={{ imageRendering: "pixelated" }}
 />
 <svg
 viewBox={`0 0 ${SSD1306_WIDTH} ${SSD1306_HEIGHT}`}
 className="absolute inset-0 h-full w-full"
 shapeRendering="crispEdges"
 >
 <defs>
 <pattern id="oled-grid" width="1" height="1" patternUnits="userSpaceOnUse">
 <path d="M 1 0 L 0 0 0 1" fill="none" stroke={GRID_COLOR} strokeWidth="0.02" />
 </pattern>
 </defs>

 <rect x={0} y={0} width={SSD1306_WIDTH} height={SSD1306_HEIGHT} fill="url(#oled-grid)" />

 {editor.state.document.zOrder.map((id) => {
 const object = editor.state.document.objectsById[id];
 if (!object || object.hidden) return null;

 return renderVectorObject(object);
 })}

 {renderDraftShape(draftShape)}
 {selectionBounds ? renderSelectionOverlay(selectionBounds, selectedObject) : null}
 </svg>
 </div>
 </div>
 </div>
 </div>

 <aside className="app-panel-strong flex flex-col gap-4 p-4">
 <div>
 <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 Inspector
 </div>
 <p className="mt-2 text-sm text-[var(--ui-muted)]">
 {selectedObject
 ? `Editando ${selectedObject.name} (${selectedObject.kind}).`
 : "Selecciona un objeto o usa una herramienta para empezar."}
 </p>
 </div>

 {selectedObject ? (
 <ObjectInspector
 object={selectedObject}
 onRename={(name) => updateSingleObject({ ...selectedObject, name }, "rename object")}
 onDelete={() => {
 const before = cloneDocument(editor.state.document);
 const next = removeObjects(editor.state.document, [selectedObject.id]);
 editor.commitDocument("delete object", before, next, { selectedIds: [] });
 }}
 onToggleLocked={() =>
 updateSingleObject(
 { ...selectedObject, locked: !selectedObject.locked },
 "toggle lock",
 )
 }
 onToggleHidden={() =>
 updateSingleObject(
 { ...selectedObject, hidden: !selectedObject.hidden },
 "toggle hidden",
 )
 }
 onPatch={(nextObject, label) => updateSingleObject(nextObject, label)}
 onAssetChange={(assetId) => {
 if (selectedObject.kind === "image") {
 const asset = editor.assetIndex[assetId];
 if (!asset) {
 return;
 }
 updateSingleObject(
 {
 ...selectedObject,
 assetId: asset.id,
 bitOrder: asset.bitOrder,
 width: asset.width,
 height: asset.height,
 },
 "change image asset",
 );
 }
 }}
 assetList={assetList}
 />
 ) : (
 null
 )}

 </aside>
 </div>

 <div
 className={
 activeView === "code"
 ? "app-panel-strong flex flex-col gap-4 p-4"
 : "hidden"
 }
 >
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <h3 className="text-xl font-black text-[var(--ui-text)]">Codigo</h3>
 <p className="text-sm text-[var(--ui-muted)]">
 El bloque generado se recalcula con cada cambio y mantiene lineMap por objeto seleccionado.
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 className="rounded-md border border-[var(--ui-ring)] px-3 py-2 text-sm text-[var(--ui-text)]"
 onClick={copyGeneratedCode}
 >
 {codeCopied ? "Copiado" : "Copiar"}
 </button>
 <button
 type="button"
 className="rounded-md border border-[var(--ui-ring)] px-3 py-2 text-sm text-[var(--ui-text)]"
 onClick={() =>
 editor.updateCodeSettings({
 mode:
 editor.state.ui.codeSettings.mode === "uner-commands"
 ? "json-ir"
 : "uner-commands",
 })
 }
 >
 {editor.state.ui.codeSettings.mode === "uner-commands"
 ? "Ver JSON IR"
 : "Ver UNER commands"}
 </button>
 </div>
 </div>

 <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
 <div className="flex flex-col gap-3">
 {(
 [
 ["wrapperFunction", "Wrapper function"],
 ["includeComments", "Comentarios por layer"],
 ["declareImages", "Declarar bitmaps locales"],
 ["declareVariables", "Declarar variables de pantalla"],
 ["clearDisplay", "Limpiar display al inicio"],
 ] as Array<[keyof typeof editor.state.ui.codeSettings, string]>
 ).map(([key, label]) => (
 <label
 key={key}
 className="flex items-center justify-between rounded-md border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/35 px-3 py-2 text-sm text-[var(--ui-text)]"
 >
 <span>{label}</span>
 <input
 type="checkbox"
 checked={Boolean(editor.state.ui.codeSettings[key])}
 onChange={(event) =>
 editor.updateCodeSettings({
 [key]: event.target.checked,
 } as never)
 }
 />
 </label>
 ))}

 <label className="text-sm font-semibold text-[var(--ui-text)]">
 Insertar antes
 <textarea
 className="app-input mt-2 min-h-28 w-full px-3 py-2 text-sm"
 value={editor.state.ui.codeSettings.prefix}
 onChange={(event) =>
 editor.updateCodeSettings({ prefix: event.target.value })
 }
 />
 </label>

 <label className="text-sm font-semibold text-[var(--ui-text)]">
 Insertar despues
 <textarea
 className="app-input mt-2 min-h-28 w-full px-3 py-2 text-sm"
 value={editor.state.ui.codeSettings.suffix}
 onChange={(event) =>
 editor.updateCodeSettings({ suffix: event.target.value })
 }
 />
 </label>
 </div>

 <div
 ref={codePanelRef}
 className="overflow-auto rounded-md border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/55 p-4"
 >
 <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-[var(--ui-text)]">
 {editor.generatedCode.text.split("\n").map((line, index) => {
 const selectedIds = editor.state.selection.selectedIds;
 const highlighted = selectedIds.some((id) => {
 const range = editor.generatedCode.lineMap[id];
 return range ? index + 1 >= range.startLine && index + 1 <= range.endLine : false;
 });

 return (
 <div
 key={`${index}-${line}`}
 style={{
 background: highlighted ? "rgba(34, 211, 238, 0.12)" : "transparent",
 }}
 >
 <span className="mr-4 inline-block w-8 select-none text-right text-[var(--ui-subtle)]">
 {index + 1}
 </span>
 <span>{line}</span>
 </div>
 );
 })}
 </pre>
 </div>
 </div>
 </div>

 <Modal
 isOpen={editor.state.ui.imagePanelOpen}
 onClose={() => editor.setImagePanelOpen(false)}
 closeOnOverlayClick={true}
 >
 <div className="flex flex-col gap-4">
 <div>
 <div className="app-kicker mb-3">Assets</div>
 <h2 className="text-2xl font-black text-[var(--ui-text)]">Libreria draft</h2>
 <p className="mt-2 text-sm text-[var(--ui-muted)]">
 Bitmaps compartidos del firmware y uploads locales listos para insertar como capas de imagen.
 </p>
 </div>

 <div className="grid max-h-[60vh] gap-3 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
 {assetList.map((asset) => {
 const selected = editor.state.ui.selectedAssetId === asset.id;

 return (
 <button
 key={asset.id}
 type="button"
 className="rounded-md border p-3 text-left transition"
 style={{
 borderColor: selected ? "var(--ui-accent)" : "rgba(255,255,255,0.1)",
 background: selected ? "rgba(34,211,238,0.08)" : "rgba(2,6,23,0.28)",
 }}
 onClick={() => editor.selectAsset(asset.id)}
 >
 <div className="mb-3 flex items-center justify-between gap-2">
 <div>
 <div className="font-semibold text-[var(--ui-text)]">{asset.label}</div>
 <div className="text-xs uppercase text-[var(--ui-muted)]">
 {asset.category}
 </div>
 </div>
 <div className="text-xs text-[var(--ui-muted)]">
 {asset.width}x{asset.height}
 </div>
 </div>

 <div className="flex items-center justify-center rounded-md border border-[var(--ui-ring)] bg-[var(--ui-bg-0)]/60 p-3">
 <BitmapMiniPreview
 width={asset.width}
 height={asset.height}
 pixels={bitmapBytesToPixels(asset.bytes, asset.width, asset.height, asset.bitOrder)}
 />
 </div>
 </button>
 );
 })}
 </div>

 <div className="flex flex-wrap gap-3">
 <button
 type="button"
 className="app-button px-4 py-2 text-sm font-semibold"
 onClick={() => {
 editor.setImagePanelOpen(false);
 editor.setTool("image");
 }}
 >
 Usar con Image tool
 </button>
 <button
 type="button"
 className="app-button--ghost px-4 py-2 text-sm font-semibold"
 onClick={() => fileInputRef.current?.click()}
 >
 Subir otro bitmap
 </button>
 </div>
 </div>
 </Modal>
 </div>
 );

 function renderVectorObject(object: CanvasObject) {
 const fill = monoToPaint("fill" in object ? object.fill : null);
 const stroke = monoToPaint("stroke" in object ? object.stroke : null);

 switch (object.kind) {
 case "rectangle":
 return (
 <rect
 key={object.id}
 x={object.x}
 y={object.y}
 width={object.width}
 height={object.height}
 fill={fill ?? "transparent"}
 stroke={stroke ?? "transparent"}
 strokeWidth={object.strokeWidth}
 />
 );
 case "circle":
 return (
 <circle
 key={object.id}
 cx={object.cx}
 cy={object.cy}
 r={object.radius}
 fill={fill ?? "transparent"}
 stroke={stroke ?? "transparent"}
 strokeWidth={object.strokeWidth}
 />
 );
 case "line":
 return (
 <line
 key={object.id}
 x1={object.x1}
 y1={object.y1}
 x2={object.x2}
 y2={object.y2}
 stroke={monoToPaint(object.stroke) ?? OLED_STAGE_WHITE}
 strokeWidth={object.strokeWidth}
 />
 );
 case "triangle":
 return (
 <polygon
 key={object.id}
 points={object.points.map((point) => `${point.x},${point.y}`).join(" ")}
 fill={fill ?? "transparent"}
 stroke={stroke ?? "transparent"}
 strokeWidth={object.strokeWidth}
 />
 );
 case "polygon":
 return (
 <polygon
 key={object.id}
 points={object.points.map((point) => `${point.x},${point.y}`).join(" ")}
 fill={fill ?? "transparent"}
 stroke={stroke ?? "transparent"}
 strokeWidth={object.strokeWidth}
 />
 );
 case "text":
 return (
 <OledBitmapText
 key={object.id}
 x={object.x}
 y={object.y}
 text={object.text}
 font={object.font}
 align={object.align}
 fill={monoToPaint(object.fill) ?? OLED_STAGE_WHITE}
 />
 );
 case "image":
 case "bitmap":
 return null;
 }
 }

 function renderDraftShape(shape: DraftShape | null) {
 if (!shape) {
 return null;
 }

 if (shape.tool === "rectangle" || shape.tool === "marquee") {
 const bounds = normalizeRect(shape.start, shape.current);
 return (
 <rect
 x={bounds.x}
 y={bounds.y}
 width={bounds.width}
 height={bounds.height}
 fill={shape.tool === "marquee" ? "rgba(34,211,238,0.12)" : "rgba(34,211,238,0.08)"}
 stroke="#22d3ee"
 strokeDasharray="1 1"
 strokeWidth={0.6}
 />
 );
 }

 if (shape.tool === "circle") {
 const bounds = normalizeRect(shape.start, shape.current);
 return (
 <circle
 cx={bounds.x + bounds.width / 2}
 cy={bounds.y + bounds.height / 2}
 r={Math.max(bounds.width, bounds.height) / 2}
 fill="rgba(34,211,238,0.08)"
 stroke="#22d3ee"
 strokeDasharray="1 1"
 strokeWidth={0.6}
 />
 );
 }

 if (shape.tool === "line") {
 return (
 <line
 x1={shape.start.x}
 y1={shape.start.y}
 x2={shape.current.x}
 y2={shape.current.y}
 stroke="#22d3ee"
 strokeDasharray="1 1"
 strokeWidth={0.7}
 />
 );
 }

 if (shape.tool === "triangle" || shape.tool === "polygon") {
 const points = shape.current ? [...shape.points, shape.current] : shape.points;
 return (
 <polyline
 points={points.map((point) => `${point.x},${point.y}`).join(" ")}
 fill="none"
 stroke="#22d3ee"
 strokeDasharray="1 1"
 strokeWidth={0.7}
 />
 );
 }

 return null;
 }

 function renderSelectionOverlay(
 bounds: ReturnType<typeof getSelectionBounds>,
 object: CanvasObject | null,
 ) {
 if (!bounds) {
 return null;
 }

 const handles = getResizeHandles(bounds);

 return (
 <>
 <rect
 x={bounds.x}
 y={bounds.y}
 width={bounds.width}
 height={bounds.height}
 fill="none"
 stroke="#22d3ee"
 strokeDasharray="1 1"
 strokeWidth={0.6}
 />
 {object?.kind === "triangle" || object?.kind === "polygon" ? (
 object.points.map((point, index) => (
 <circle
 key={`${object.id}-vertex-${index}`}
 cx={point.x}
 cy={point.y}
 r={1.5}
 fill="#22d3ee"
 stroke="white"
 strokeWidth={0.25}
 />
 ))
 ) : object?.kind === "line" ? (
 <>
 <circle cx={object.x1} cy={object.y1} r={1.5} fill="#22d3ee" stroke="white" strokeWidth={0.25} />
 <circle cx={object.x2} cy={object.y2} r={1.5} fill="#22d3ee" stroke="white" strokeWidth={0.25} />
 </>
 ) : editor.state.selection.selectedIds.length === 1 ? (
 Object.entries(handles).map(([key, value]) => (
 <rect
 key={key}
 x={value.x - 1}
 y={value.y - 1}
 width={2}
 height={2}
 fill="#22d3ee"
 stroke="white"
 strokeWidth={0.2}
 />
 ))
 ) : null}
 </>
 );
 }
}

function ObjectInspector({
 object,
 onRename,
 onDelete,
 onToggleLocked,
 onToggleHidden,
 onPatch,
 onAssetChange,
 assetList,
}: {
 object: CanvasObject;
 onRename: (name: string) => void;
 onDelete: () => void;
 onToggleLocked: () => void;
 onToggleHidden: () => void;
 onPatch: (object: CanvasObject, label: string) => void;
 onAssetChange: (assetId: string) => void;
 assetList: ReturnType<typeof listEditorAssets>;
}) {
 return (
 <div className="flex flex-col gap-3">
 <label className="text-sm font-semibold text-[var(--ui-text)]">
 Nombre
 <input
 className="app-input mt-2 w-full px-3 py-2 text-sm"
 value={object.name}
 onChange={(event) => onRename(event.target.value)}
 />
 </label>

 <div className="grid gap-2 sm:grid-cols-2">
 <button
 type="button"
 className="rounded-md border border-[var(--ui-ring)] px-3 py-2 text-sm text-[var(--ui-text)]"
 onClick={onToggleLocked}
 >
 {object.locked ? "Unlock" : "Lock"}
 </button>
 <button
 type="button"
 className="rounded-md border border-[var(--ui-ring)] px-3 py-2 text-sm text-[var(--ui-text)]"
 onClick={onToggleHidden}
 >
 {object.hidden ? "Mostrar" : "Ocultar"}
 </button>
 </div>

 {renderInspectorFields(object, onPatch, onAssetChange, assetList)}

 <button
 type="button"
 className="app-button--ghost border-rose-300/20 text-rose-100 px-4 py-2 text-sm font-semibold"
 onClick={onDelete}
 >
 Eliminar layer
 </button>
 </div>
 );
}

function renderInspectorFields(
 object: CanvasObject,
 onPatch: (object: CanvasObject, label: string) => void,
 onAssetChange: (assetId: string) => void,
 assetList: ReturnType<typeof listEditorAssets>,
) {
 switch (object.kind) {
 case "rectangle":
 return (
 <>
 <BoundsFields
 x={object.x}
 y={object.y}
 width={object.width}
 height={object.height}
 onChange={(next) => onPatch({ ...object, ...next }, "update rectangle")}
 />
 <MonoColorFields
 fill={object.fill}
 stroke={object.stroke}
 onFillChange={(fill) => onPatch({ ...object, fill }, "update rectangle fill")}
 onStrokeChange={(stroke) => onPatch({ ...object, stroke }, "update rectangle stroke")}
 />
 </>
 );
 case "circle":
 return (
 <div className="grid gap-3 sm:grid-cols-2">
 <NumberField label="CX" value={object.cx} onChange={(cx) => onPatch({ ...object, cx }, "update circle")} />
 <NumberField label="CY" value={object.cy} onChange={(cy) => onPatch({ ...object, cy }, "update circle")} />
 <NumberField label="R" value={object.radius} onChange={(radius) => onPatch({ ...object, radius }, "update circle")} />
 <MonoSelect
 label="Stroke"
 value={object.stroke}
 onChange={(stroke) => onPatch({ ...object, stroke }, "update circle stroke")}
 />
 <MonoSelect
 label="Fill"
 value={object.fill}
 onChange={(fill) => onPatch({ ...object, fill }, "update circle fill")}
 />
 </div>
 );
 case "line":
 return (
 <div className="grid gap-3 sm:grid-cols-2">
 <NumberField label="X1" value={object.x1} onChange={(x1) => onPatch({ ...object, x1 }, "update line")} />
 <NumberField label="Y1" value={object.y1} onChange={(y1) => onPatch({ ...object, y1 }, "update line")} />
 <NumberField label="X2" value={object.x2} onChange={(x2) => onPatch({ ...object, x2 }, "update line")} />
 <NumberField label="Y2" value={object.y2} onChange={(y2) => onPatch({ ...object, y2 }, "update line")} />
 <MonoSelect
 label="Stroke"
 value={object.stroke}
 onChange={(stroke) =>
 onPatch({ ...object, stroke: stroke ?? "white" }, "update line stroke")
 }
 />
 </div>
 );
 case "triangle":
 case "polygon":
 return (
 <div className="flex flex-col gap-3">
 {object.points.map((point, index) => (
 <div key={`${object.id}-${index}`} className="grid gap-3 sm:grid-cols-2">
 <NumberField
 label={`P${index + 1} X`}
 value={point.x}
 onChange={(x) => {
 const points = object.points.map((value, currentIndex) =>
 currentIndex === index ? { ...value, x } : value,
 );
 if (object.kind === "triangle") {
 onPatch(
 { ...object, points: points as [Point, Point, Point] },
 "update triangle point",
 );
 return;
 }
 onPatch({ ...object, points }, "update polygon point");
 }}
 />
 <NumberField
 label={`P${index + 1} Y`}
 value={point.y}
 onChange={(y) => {
 const points = object.points.map((value, currentIndex) =>
 currentIndex === index ? { ...value, y } : value,
 );
 if (object.kind === "triangle") {
 onPatch(
 { ...object, points: points as [Point, Point, Point] },
 "update triangle point",
 );
 return;
 }
 onPatch({ ...object, points }, "update polygon point");
 }}
 />
 </div>
 ))}
 <MonoColorFields
 fill={object.fill}
 stroke={object.stroke}
 onFillChange={(fill) => onPatch({ ...object, fill }, "update polygon fill")}
 onStrokeChange={(stroke) => onPatch({ ...object, stroke }, "update polygon stroke")}
 />
 </div>
 );
 case "text":
 return (
 <div className="flex flex-col gap-3">
 <div className="grid gap-3 sm:grid-cols-2">
 <NumberField label="X" value={object.x} onChange={(x) => onPatch({ ...object, x }, "update text")} />
 <NumberField label="Y" value={object.y} onChange={(y) => onPatch({ ...object, y }, "update text")} />
 </div>
 <label className="text-sm font-semibold text-[var(--ui-text)]">
 Texto
 <textarea
 className="app-input mt-2 min-h-24 w-full px-3 py-2 text-sm"
 value={object.text}
 onChange={(event) => onPatch({ ...object, text: event.target.value }, "update text")}
 />
 </label>
 <label className="text-sm font-semibold text-[var(--ui-text)]">
 Font
 <select
 className="app-input mt-2 w-full px-3 py-2 text-sm"
 value={object.font}
 onChange={(event) =>
 onPatch(
 { ...object, font: event.target.value as typeof object.font },
 "update font",
 )
 }
 >
 {OLED_FONT_PRESETS.map((font) => (
 <option key={font.id} value={font.id}>
 {font.label}
 </option>
 ))}
 </select>
 </label>
 <MonoSelect
 label="Color"
 value={object.fill}
 onChange={(fill) => onPatch({ ...object, fill: fill ?? "white" }, "update text color")}
 />
 </div>
 );
 case "image":
 return (
 <div className="flex flex-col gap-3">
 <BoundsFields
 x={object.x}
 y={object.y}
 width={object.width}
 height={object.height}
 onChange={(next) => onPatch({ ...object, ...next }, "update image")}
 />
 <label className="text-sm font-semibold text-[var(--ui-text)]">
 Asset
 <select
 className="app-input mt-2 w-full px-3 py-2 text-sm"
 value={object.assetId}
 onChange={(event) => onAssetChange(event.target.value)}
 >
 {assetList.map((asset) => (
 <option key={asset.id} value={asset.id}>
 {asset.label}
 </option>
 ))}
 </select>
 </label>
 </div>
 );
 case "bitmap":
 return (
 <div className="flex flex-col gap-3">
 <BoundsFields
 x={object.x}
 y={object.y}
 width={object.width}
 height={object.height}
 onChange={(next) => onPatch({ ...object, ...next }, "update bitmap")}
 />
 <button
 type="button"
 className="rounded-md border border-[var(--ui-ring)] px-3 py-2 text-sm text-[var(--ui-text)]"
 onClick={() =>
 onPatch(
 {
 ...object,
 pixelData: object.pixelData.map(() => 0),
 },
 "clear bitmap",
 )
 }
 >
 Limpiar pixels
 </button>
 </div>
 );
 }
}

function getToolLabel(tool: ToolId) {
 return TOOL_DEFINITIONS.find((entry) => entry.id === tool)?.label ?? tool;
}

function ToolbarIconButton({
 label,
 active = false,
 disabled = false,
 onClick,
 children,
}: {
 label: string;
 active?: boolean;
 disabled?: boolean;
 onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
 children: ReactNode;
}) {
 return (
 <button
 type="button"
 aria-label={label}
 title={label}
 disabled={disabled}
 onClick={onClick}
 className="flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
 style={
 active
 ? {
 borderColor: "var(--ui-accent)",
 background: "var(--ui-accent)",
 color: "var(--ui-action-hover-ink)",
 boxShadow: "0 0 0 1px rgba(34,211,238,0.35) inset",
 }
 : {
 borderColor: "rgba(255,255,255,0.1)",
 background: "rgba(2,6,23,0.35)",
 color: "rgb(226 232 240)",
 }
 }
 >
 {children}
 </button>
 );
}

function LayerActionIconButton({
 label,
 icon,
 onClick,
 disabled = false,
}: {
 label: string;
 icon: ReactNode;
 onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
 disabled?: boolean;
}) {
 return (
 <button
 type="button"
 aria-label={label}
 title={label}
 disabled={disabled}
 onClick={onClick}
 className="flex h-8 w-8 items-center justify-center rounded-md border transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
 style={{
 borderColor: "rgba(255,255,255,0.1)",
 background: "rgba(2,6,23,0.32)",
 color: "rgb(203 213 225)",
 }}
 >
 {icon}
 </button>
 );
}

function IconBase({
 className,
 children,
 viewBox = "0 0 24 24",
 fill = "none",
}: {
 className?: string;
 children: ReactNode;
 viewBox?: string;
 fill?: string;
}) {
 return (
 <svg
 xmlns="http://www.w3.org/2000/svg"
 viewBox={viewBox}
 fill={fill}
 stroke="currentColor"
 strokeWidth="1.8"
 strokeLinecap="round"
 strokeLinejoin="round"
 className={className}
 aria-hidden="true"
 >
 {children}
 </svg>
 );
}

function isEditableElement(element: Element | null) {
 if (!(element instanceof HTMLElement)) {
 return false;
 }

 return (
 element instanceof HTMLInputElement ||
 element instanceof HTMLTextAreaElement ||
 element instanceof HTMLSelectElement ||
 element.isContentEditable
 );
}

function CursorSelectIcon({ className }: EditorIconProps) {
 return (
 <svg
 xmlns="http://www.w3.org/2000/svg"
 viewBox="0 0 24 24"
 className={className}
 aria-hidden="true"
 >
 <path
 d="M5 3l11 9h-5l2.8 8-2.3.8L8.8 13H5V3z"
 fill="currentColor"
 />
 <rect
 x="15.5"
 y="14.5"
 width="4"
 height="4"
 rx="0.8"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 />
 </svg>
 );
}

function RectangleToolIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <rect x="4" y="6" width="16" height="12" rx="1.5" />
 </IconBase>
 );
}

function CircleToolIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <circle cx="12" cy="12" r="7" />
 </IconBase>
 );
}

function LineToolIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M5 18L19 6" />
 <circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none" />
 <circle cx="19" cy="6" r="1.2" fill="currentColor" stroke="none" />
 </IconBase>
 );
}

function TriangleToolIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M12 5l7 13H5z" />
 </IconBase>
 );
}

function PolygonToolIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M8 5h8l4 7-4 7H8l-4-7z" />
 </IconBase>
 );
}

function TextToolIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M5 6h14" />
 <path d="M12 6v12" />
 <path d="M8 18h8" />
 </IconBase>
 );
}

function ImageToolIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <rect x="4" y="5" width="16" height="14" rx="1.5" />
 <circle cx="9" cy="10" r="1.5" />
 <path d="M6 17l4-4 3 3 3-5 2 6" />
 </IconBase>
 );
}

function PaintBrushToolIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M14.5 4.5l5 5" />
 <path d="M12.5 6.5l5 5" />
 <path d="M4 20c2.7 0 4.5-1 4.5-3.6 0-1.2.8-2.2 1.9-2.7l3.3-3.3-4.1-4.1-3.3 3.3C5.8 10.7 4.8 11.5 3.6 11.5 1 11.5 0 13.3 0 16" />
 </IconBase>
 );
}

function EyeOpenIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M2 12s3.5-5 10-5 10 5 10 5-3.5 5-10 5-10-5-10-5z" />
 <circle cx="12" cy="12" r="2.8" />
 </IconBase>
 );
}

function EyeClosedIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M3 3l18 18" />
 <path d="M10.6 6.3A12.9 12.9 0 0112 6c6.5 0 10 6 10 6a17 17 0 01-4.1 4.5" />
 <path d="M6.4 6.9C3.7 8.5 2 12 2 12s3.5 6 10 6c1.3 0 2.5-.2 3.6-.6" />
 </IconBase>
 );
}

function LockClosedIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <rect x="6" y="11" width="12" height="9" rx="2" />
 <path d="M8.5 11V8.5a3.5 3.5 0 117 0V11" />
 </IconBase>
 );
}

function LockOpenIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <rect x="6" y="11" width="12" height="9" rx="2" />
 <path d="M15.5 11V8.5a3.5 3.5 0 00-6.7-1.5" />
 </IconBase>
 );
}

function ChevronUpIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M6 14l6-6 6 6" />
 </IconBase>
 );
}

function ChevronDownIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M6 10l6 6 6-6" />
 </IconBase>
 );
}

function ZoomInIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <circle cx="11" cy="11" r="6" />
 <path d="M11 8v6" />
 <path d="M8 11h6" />
 <path d="M20 20l-4.2-4.2" />
 </IconBase>
 );
}

function ZoomOutIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <circle cx="11" cy="11" r="6" />
 <path d="M8 11h6" />
 <path d="M20 20l-4.2-4.2" />
 </IconBase>
 );
}

function UndoIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M9 7H5v4" />
 <path d="M5 11a7 7 0 017-7h6" />
 </IconBase>
 );
}

function RedoIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M15 7h4v4" />
 <path d="M19 11a7 7 0 00-7-7H6" />
 </IconBase>
 );
}

function SaveIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M6 4h10l3 3v13H5V5a1 1 0 011-1z" />
 <path d="M8 4v5h8V4" />
 <path d="M9 20v-6h6v6" />
 </IconBase>
 );
}

function ClearIcon({ className }: EditorIconProps) {
 return (
 <IconBase className={className}>
 <path d="M6 6l12 12" />
 <path d="M18 6L6 18" />
 </IconBase>
 );
}

function BoundsFields({
 x,
 y,
 width,
 height,
 onChange,
}: {
 x: number;
 y: number;
 width: number;
 height: number;
 onChange: (patch: { x: number; y: number; width: number; height: number }) => void;
}) {
 return (
 <div className="grid gap-3 sm:grid-cols-2">
 <NumberField label="X" value={x} onChange={(next) => onChange({ x: next, y, width, height })} />
 <NumberField label="Y" value={y} onChange={(next) => onChange({ x, y: next, width, height })} />
 <NumberField label="W" value={width} onChange={(next) => onChange({ x, y, width: next, height })} />
 <NumberField label="H" value={height} onChange={(next) => onChange({ x, y, width, height: next })} />
 </div>
 );
}

function MonoColorFields({
 fill,
 stroke,
 onFillChange,
 onStrokeChange,
}: {
 fill: "white" | "black" | null;
 stroke: "white" | "black" | null;
 onFillChange: (value: "white" | "black" | null) => void;
 onStrokeChange: (value: "white" | "black" | null) => void;
}) {
 return (
 <div className="grid gap-3 sm:grid-cols-2">
 <MonoSelect label="Fill" value={fill} onChange={onFillChange} allowNull />
 <MonoSelect label="Stroke" value={stroke} onChange={onStrokeChange} allowNull />
 </div>
 );
}

function MonoSelect({
 label,
 value,
 onChange,
 allowNull = false,
}: {
 label: string;
 value: "white" | "black" | null;
 onChange: (value: "white" | "black" | null) => void;
 allowNull?: boolean;
}) {
 return (
 <label className="text-sm font-semibold text-[var(--ui-text)]">
 {label}
 <select
 className="app-input mt-2 w-full px-3 py-2 text-sm"
 value={value ?? "none"}
 onChange={(event) => {
 const next = event.target.value;
 onChange(next === "none" ? null : (next as "white" | "black"));
 }}
 >
 {allowNull ? <option value="none">None</option> : null}
 <option value="white">White</option>
 <option value="black">Black</option>
 </select>
 </label>
 );
}

function NumberField({
 label,
 value,
 onChange,
}: {
 label: string;
 value: number;
 onChange: (value: number) => void;
}) {
 return (
 <label className="text-sm font-semibold text-[var(--ui-text)]">
 {label}
 <input
 type="number"
 className="app-input mt-2 w-full px-3 py-2 text-sm"
 value={value}
 onChange={(event) => onChange(Number(event.target.value))}
 />
 </label>
 );
}

function BitmapMiniPreview({
 width,
 height,
 pixels,
}: {
 width: number;
 height: number;
 pixels: number[];
}) {
 const scale = Math.max(1, Math.floor(96 / Math.max(width, height)));

 return (
 <svg
 viewBox={`0 0 ${width} ${height}`}
 width={width * scale}
 height={height * scale}
 shapeRendering="crispEdges"
 >
 <rect x={0} y={0} width={width} height={height} fill={OLED_STAGE_BG} />
 {pixels.map((pixel, index) => {
 if (!pixel) {
 return null;
 }
 return (
 <rect
 key={index}
 x={index % width}
 y={Math.floor(index / width)}
 width={1}
 height={1}
 fill={OLED_STAGE_WHITE}
 />
 );
 })}
 </svg>
 );
}

function drawRasterObjects(
 canvas: HTMLCanvasElement | null,
 document: EditorDocument,
 assetIndex: Record<string, ImageAsset>,
) {
 if (!canvas) {
 return;
 }

 const context = canvas.getContext("2d");

 if (!context) {
 return;
 }

 context.clearRect(0, 0, canvas.width, canvas.height);
 context.fillStyle = OLED_STAGE_BG;
 context.fillRect(0, 0, canvas.width, canvas.height);
 context.imageSmoothingEnabled = false;

 document.zOrder.forEach((id) => {
 const object = document.objectsById[id];
 if (!object || object.hidden) {
 return;
 }

 if (object.kind === "image") {
 const asset = assetIndex[object.assetId];
 if (!asset) {
 return;
 }
 drawPackedBitmap(context, asset.bytes, asset.width, asset.height, object, asset.bitOrder);
 }

 if (object.kind === "bitmap") {
 drawPixels(context, object);
 }
 });
}

function drawPackedBitmap(
 context: CanvasRenderingContext2D,
 bytes: readonly number[],
 sourceWidth: number,
 sourceHeight: number,
 object: ImageObject,
 bitOrder: ImageAsset["bitOrder"],
) {
 const pixels = bitmapBytesToPixels(bytes, sourceWidth, sourceHeight, bitOrder);
 const scaleX = object.width / sourceWidth;
 const scaleY = object.height / sourceHeight;

 for (let y = 0; y < sourceHeight; y += 1) {
 for (let x = 0; x < sourceWidth; x += 1) {
 if (!pixels[y * sourceWidth + x]) {
 continue;
 }

 context.fillStyle = OLED_STAGE_WHITE;
 context.fillRect(
 object.x + x * scaleX,
 object.y + y * scaleY,
 Math.max(1, scaleX),
 Math.max(1, scaleY),
 );
 }
 }
}

function drawPixels(
 context: CanvasRenderingContext2D,
 object: BitmapObject,
) {
 for (let y = 0; y < object.height; y += 1) {
 for (let x = 0; x < object.width; x += 1) {
 if (!object.pixelData[y * object.width + x]) {
 continue;
 }

 context.fillStyle = OLED_STAGE_WHITE;
 context.fillRect(object.x + x, object.y + y, 1, 1);
 }
 }
}

function monoToPaint(color: "white" | "black" | null) {
 if (color === "white") {
 return OLED_STAGE_WHITE;
 }
 if (color === "black") {
 return OLED_STAGE_BG;
 }
 return null;
}

function rectsOverlap(left: ReturnType<typeof normalizeRect>, right: ReturnType<typeof getObjectBounds>) {
 return (
 left.x < right.x + right.width &&
 left.x + left.width > right.x &&
 left.y < right.y + right.height &&
 left.y + left.height > right.y
 );
}

function isArrowKey(key: string) {
 return key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";
}

function applyPaintStroke(
 document: EditorDocument,
 objectId: string,
 from: Point,
 to: Point,
 erase: boolean,
) {
 const next = cloneDocument(document);
 const bitmap = next.objectsById[objectId];

 if (!bitmap || bitmap.kind !== "bitmap") {
 return document;
 }

 const pixels = [...bitmap.pixelData];
 const points = linePoints(from, to);

 points.forEach((point) => {
 const localX = clamp(point.x - bitmap.x, 0, bitmap.width - 1);
 const localY = clamp(point.y - bitmap.y, 0, bitmap.height - 1);
 pixels[localY * bitmap.width + localX] = erase ? 0 : 1;
 });

 next.objectsById[objectId] = {
 ...bitmap,
 pixelData: pixels,
 };

 return next;
}

function linePoints(start: Point, end: Point) {
 const points: Point[] = [];
 const dx = Math.abs(end.x - start.x);
 const dy = -Math.abs(end.y - start.y);
 const sx = start.x < end.x ? 1 : -1;
 const sy = start.y < end.y ? 1 : -1;
 let error = dx + dy;
 let x = start.x;
 let y = start.y;

 while (true) {
 points.push({ x, y });
 if (x === end.x && y === end.y) {
 break;
 }
 const error2 = error * 2;
 if (error2 >= dy) {
 error += dy;
 x += sx;
 }
 if (error2 <= dx) {
 error += dx;
 y += sy;
 }
 }

 return points;
}

async function decodeImageFile(file: File) {
 const bitmap = await createImageBitmap(file);
 const maxWidth = Math.min(SSD1306_WIDTH, bitmap.width);
 const maxHeight = Math.min(SSD1306_HEIGHT, bitmap.height);
 const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
 const width = Math.max(1, Math.round(bitmap.width * scale));
 const height = Math.max(1, Math.round(bitmap.height * scale));

 const canvas = document.createElement("canvas");
 canvas.width = width;
 canvas.height = height;
 const context = canvas.getContext("2d");

 if (!context) {
 return {
 name: file.name.replace(/\.[^.]+$/, ""),
 width: 1,
 height: 1,
 bytes: [0x00],
 };
 }

 context.imageSmoothingEnabled = false;
 context.drawImage(bitmap, 0, 0, width, height);
 const data = context.getImageData(0, 0, width, height).data;
 const bytesPerRow = Math.ceil(width / 8);
 const bytes = Array.from({ length: bytesPerRow * height }, () => 0);

 for (let y = 0; y < height; y += 1) {
 for (let x = 0; x < width; x += 1) {
 const offset = (y * width + x) * 4;
 const brightness =
 data[offset] * 0.2126 +
 data[offset + 1] * 0.7152 +
 data[offset + 2] * 0.0722;
 const alpha = data[offset + 3];
 const enabled = alpha > 0 && brightness >= 127;

 if (enabled) {
 bytes[y * bytesPerRow + (x >> 3)] |= 1 << (x & 7);
 }
 }
 }

 return {
 name: file.name.replace(/\.[^.]+$/, ""),
 width,
 height,
 bytes,
 };
}

export default LopakaLikeEditor;

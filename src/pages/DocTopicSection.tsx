import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import DocsFirmwareSelector from "../features/docs/DocsFirmwareSelector";
import {
 DOC_FIRMWARE_PROFILES,
 DOC_TOPICS,
 docsTargetSearch,
 docsTopicHref,
 getDocFirmwareTarget,
 getDocTopic,
 type DocFirmwareTarget,
 type DocMediaItem,
} from "../features/docs/docsContent";
import { renderDocTopicIcon } from "../features/docs/docsCatalog";

export default function DocTopicSection() {
 const navigate = useNavigate();
 const { topicSlug } = useParams();
 const [searchParams, setSearchParams] = useSearchParams();
 const topic = getDocTopic(topicSlug);
 const activeTarget = getDocFirmwareTarget(searchParams.get("firmware"));
 const profile = DOC_FIRMWARE_PROFILES[activeTarget];

 if (!topic) {
 return <Navigate to={`/docs${docsTargetSearch(activeTarget)}`} replace />;
 }

 const variant = topic.variants[activeTarget];
 const relatedTopics = DOC_TOPICS.filter(
 (entry) => entry.slug !== topic.slug,
 ).slice(0, 4);

 function handleTargetChange(nextTarget: DocFirmwareTarget) {
 const nextSearchParams = new URLSearchParams(searchParams);
 nextSearchParams.set("firmware", nextTarget);
 setSearchParams(nextSearchParams, { replace: true });
 }

 return (
 <section className="docs-dashboard-shell min-h-screen w-full text-[var(--ui-text)]">
 <div className="docs-dashboard-frame mx-auto flex w-full max-w-[2400px] flex-col gap-6 p-6">
 <PageHeader
 className="app-page-header home-page-header"
 titleOverride={`Docs · ${topic.title}`}
 />

 <div className="relative pt-7">
 <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
 <div className="pointer-events-auto">
 <DocsFirmwareSelector
 activeTarget={activeTarget}
 onChange={handleTargetChange}
 />
 </div>
 </div>

 <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
 <div className="docs-hero-card app-panel-strong px-6 pb-6 pt-14">
 <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
 <div className="flex items-start gap-4">
 <div className="docs-topic-icon-card">
 {renderDocTopicIcon(topic.slug, "size-14 md:size-16")}
 </div>
 <div>
 <div className="app-kicker mb-3">
 {topic.kicker} · {profile.label}
 </div>
 <h2 className="text-3xl font-black tracking-tight text-[var(--ui-text)] md:text-4xl">
 {topic.title}
 </h2>
 <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--ui-muted)] md:text-base">
 {variant.summary}
 </p>
 </div>
 </div>

 <div className="flex flex-wrap gap-3">
 <button
 type="button"
 onClick={() =>
 navigate(`/docs${docsTargetSearch(activeTarget)}`, {
 viewTransition: true,
 })
 }
 className="app-button px-4 py-2 text-sm font-semibold"
 >
 Volver a Docs
 </button>
 <button
 type="button"
 onClick={() =>
 navigate("/protocol", { viewTransition: true })
 }
 className="app-button--ghost px-4 py-2 text-sm font-semibold"
 >
 Ir a UNER Studio
 </button>
 </div>
 </div>

 <div className="docs-scope-card mt-6">
 <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 Alcance de esta versión
 </div>
 <p className="mt-3 text-sm leading-6 text-[var(--ui-muted)] md:text-base">
 {variant.scope}
 </p>
 </div>
 </div>

 <aside className="docs-related-card app-panel px-5 pb-5 pt-14">
 <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 Mismos documentos · {profile.label}
 </div>
 <div className="mt-4 flex flex-col gap-3">
 {relatedTopics.map((related) => (
 <button
 key={related.slug}
 type="button"
 onClick={() =>
 navigate(docsTopicHref(related.slug, activeTarget), {
 viewTransition: true,
 })
 }
 className="docs-related-button px-4 py-3 text-left"
 >
 <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 {related.kicker}
 </div>
 <div className="mt-2 text-base font-bold text-[var(--ui-text)]">
 {related.title}
 </div>
 <p className="mt-2 text-sm leading-5 text-[var(--ui-muted)]">
 {related.variants[activeTarget].summary}
 </p>
 </button>
 ))}
 </div>
 </aside>
 </div>
 </div>

 <section className="docs-content-card app-panel p-5 md:p-6">
 <div className="app-kicker mb-3">Interconexión entre módulos</div>
 <h3 className="text-2xl font-black text-[var(--ui-text)] md:text-3xl">
 Recorrido de punta a punta
 </h3>
 <p className="mt-3 max-w-5xl text-sm leading-6 text-[var(--ui-muted)]">
 Las flechas representan transferencia de estado o una llamada entre
 capas. La referencia inferior identifica dónde verificar cada paso.
 </p>
 <ol className="docs-flow-grid mt-6">
 {variant.flow.map((step, index) => (
 <li key={`${step.title}-${step.reference}`} className="docs-flow-step">
 <div className="docs-flow-step__index">{index + 1}</div>
 <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 {step.layer}
 </div>
 <h4 className="mt-2 text-lg font-black text-[var(--ui-text)]">
 {step.title}
 </h4>
 <p className="mt-2 text-sm leading-5 text-[var(--ui-muted)]">
 {step.detail}
 </p>
 <code className="docs-inline-path mt-4 block">{step.reference}</code>
 </li>
 ))}
 </ol>
 </section>

 <div className="grid gap-4 lg:grid-cols-2">
 {variant.sections.map((section, index) => (
 <article
 key={section.title}
 className="docs-content-card app-panel p-5"
 >
 <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 Capítulo {String(index + 1).padStart(2, "0")}
 </div>
 <h3 className="mt-3 text-2xl font-black text-[var(--ui-text)]">
 {section.title}
 </h3>
 <p className="mt-3 text-sm leading-6 text-[var(--ui-muted)] md:text-base">
 {section.body}
 </p>
 <ul className="mt-4 flex flex-col gap-3 text-sm text-[var(--ui-muted)]">
 {section.bullets.map((bullet) => (
 <li key={bullet} className="docs-bullet-card px-4 py-3">
 {bullet}
 </li>
 ))}
 </ul>
 </article>
 ))}
 </div>

 <section className="docs-content-card app-panel p-5 md:p-6">
 <div className="app-kicker mb-3">Imágenes, diagramas y fotos</div>
 <h3 className="text-2xl font-black text-[var(--ui-text)] md:text-3xl">
 Evidencia visual
 </h3>
 <p className="mt-3 max-w-5xl text-sm leading-6 text-[var(--ui-muted)]">
 Esta biblioteca separa lo que ya puede abrirse en vivo de las
 capturas o fotografías que todavía deben producirse. Una evidencia
 planificada no se presenta como si ya existiera.
 </p>
 <div className="docs-media-grid mt-6">
 {variant.media.map((item) => (
 <MediaCard
 key={`${item.kind}-${item.title}`}
 item={item}
 onOpen={(href) => navigate(href, { viewTransition: true })}
 />
 ))}
 </div>
 </section>

 <section className="docs-content-card app-panel p-5 md:p-6">
 <div className="app-kicker mb-3">Trazabilidad</div>
 <h3 className="text-2xl font-black text-[var(--ui-text)] md:text-3xl">
 Fuentes que sostienen esta documentación
 </h3>
 <div className="docs-reference-grid mt-6">
 {variant.references.map((reference) => (
 <article key={reference.path} className="docs-reference-card">
 <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
 {reference.label}
 </div>
 <code className="docs-inline-path mt-3 block">
 {reference.path}
 </code>
 <p className="mt-3 text-sm leading-5 text-[var(--ui-muted)]">
 {reference.note}
 </p>
 </article>
 ))}
 </div>
 </section>
 </div>
 </section>
 );
}

function MediaCard({
 item,
 onOpen,
}: {
 item: DocMediaItem;
 onOpen: (href: string) => void;
}) {
 return (
 <article className="docs-media-card">
 {item.imageSrc ? (
 <img
 className="docs-media-card__image"
 src={item.imageSrc}
 alt={item.title}
 loading="lazy"
 />
 ) : (
 <div className="docs-media-card__placeholder" aria-hidden="true">
 <span>{mediaKindLabel(item.kind)}</span>
 </div>
 )}
 <div className="flex flex-1 flex-col p-4">
 <div className="flex items-center justify-between gap-3">
 <span className="docs-media-kind">{mediaKindLabel(item.kind)}</span>
 <span className={`docs-media-status docs-media-status--${item.status}`}>
 {item.status}
 </span>
 </div>
 <h4 className="mt-3 text-lg font-black text-[var(--ui-text)]">{item.title}</h4>
 <p className="mt-2 flex-1 text-sm leading-5 text-[var(--ui-muted)]">
 {item.caption}
 </p>
 {item.href ? (
 <button
 type="button"
 className="app-button mt-4 px-4 py-2 text-sm font-semibold"
 onClick={() => onOpen(item.href!)}
 >
 Abrir evidencia viva
 </button>
 ) : null}
 </div>
 </article>
 );
}

function mediaKindLabel(kind: DocMediaItem["kind"]) {
 if (kind === "captura") {
 return "Captura";
 }
 if (kind === "diagrama") {
 return "Diagrama";
 }
 return "Foto";
}

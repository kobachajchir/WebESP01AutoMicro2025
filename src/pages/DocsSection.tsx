import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import DocsFirmwareSelector from "../features/docs/DocsFirmwareSelector";
import {
  DOC_FIRMWARE_PROFILES,
  DOC_TOPICS,
  docsTopicHref,
  getDocFirmwareTarget,
  type DocFirmwareTarget,
} from "../features/docs/docsContent";
import { renderDocTopicIcon } from "../features/docs/docsCatalog";

export default function DocsSection() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTarget = getDocFirmwareTarget(searchParams.get("firmware"));
  const profile = DOC_FIRMWARE_PROFILES[activeTarget];

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
          titleOverride={`Docs · ${profile.label}`}
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

          <div className="docs-hero-card app-panel-strong px-6 pb-6 pt-14">
            <div className="app-kicker mb-3">{profile.eyebrow}</div>
            <h2 className="text-3xl font-black tracking-tight text-[var(--ui-text)] md:text-4xl">
              {profile.title}
            </h2>
            <p className="mt-3 max-w-5xl text-sm leading-6 text-[var(--ui-muted)] md:text-base">
              {profile.description}
            </p>

            <dl className="docs-profile-grid mt-6">
              <ProfileFact label="Fuente de autoridad" value={profile.authority} />
              <ProfileFact label="Recorrido principal" value={profile.transport} />
              <ProfileFact label="Qué documentamos" value={profile.output} />
            </dl>
          </div>
        </div>

        <div className="docs-topic-grid">
          {DOC_TOPICS.map((topic, index) => {
            const variant = topic.variants[activeTarget];

            return (
              <button
                key={topic.slug}
                type="button"
                className="docs-topic-card group"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() =>
                  navigate(docsTopicHref(topic.slug, activeTarget), {
                    viewTransition: true,
                  })
                }
                aria-label={`Abrir documentación ${profile.label} de ${topic.title}`}
              >
                <div className="flex h-full w-full flex-col items-center justify-center px-6 py-8 text-center text-[var(--ui-text)]">
                  <div className="transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95">
                    {renderDocTopicIcon(topic.slug, "size-24 md:size-32")}
                  </div>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]">
                    {topic.kicker} · {profile.label}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold uppercase">
                    {topic.title}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--ui-muted)]">
                    {variant.summary}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
                    <span>{variant.sections.length} capítulos</span>
                    <span aria-hidden="true">·</span>
                    <span>{variant.flow.length} módulos</span>
                    <span aria-hidden="true">·</span>
                    <span>{variant.media.length} evidencias</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
 return (
 <div className="docs-profile-fact">
 <dt>{label}</dt>
 <dd>{value}</dd>
 </div>
 );
}

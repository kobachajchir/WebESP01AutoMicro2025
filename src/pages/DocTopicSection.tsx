import { Navigate, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import {
  DOC_TOPICS,
  getDocTopic,
  renderDocTopicIcon,
} from "../features/docs/docsCatalog";

export default function DocTopicSection() {
  const navigate = useNavigate();
  const { topicSlug } = useParams();
  const topic = getDocTopic(topicSlug);

  if (!topic) {
    return <Navigate to="/docs" replace />;
  }

  const relatedTopics = DOC_TOPICS.filter((entry) => entry.slug !== topic.slug).slice(
    0,
    4,
  );

  return (
    <section className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6">
        <PageHeader titleOverride={`Docs - ${topic.title}`} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.4)] backdrop-blur">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 text-cyan-200">
                  {renderDocTopicIcon(topic.slug, "size-14 md:size-16")}
                </div>
                <div>
                  <div className="app-kicker mb-3">{topic.kicker}</div>
                  <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                    {topic.title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                    {topic.summary}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/docs", { viewTransition: true })}
                  className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/55 hover:bg-cyan-400/20"
                >
                  Volver a Docs
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/protocol", { viewTransition: true })}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/10"
                >
                  Ir a UNER Studio
                </button>
              </div>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5 shadow-[0_24px_60px_rgba(2,6,23,0.38)] backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Temas relacionados
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {relatedTopics.map((related) => (
                <button
                  key={related.slug}
                  type="button"
                  onClick={() =>
                    navigate(`/docs/${related.slug}`, { viewTransition: true })
                  }
                  className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-left transition hover:border-cyan-300/35 hover:bg-slate-900/80"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {related.kicker}
                  </div>
                  <div className="mt-2 text-base font-bold text-white">
                    {related.title}
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {related.summary}
                  </p>
                </button>
              ))}
            </div>
          </aside>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {topic.sections.map((section) => (
            <article
              key={section.title}
              className="rounded-[24px] border border-white/10 bg-slate-950/35 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.34)] backdrop-blur"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Documentacion
              </div>
              <h3 className="mt-3 text-2xl font-black text-white">
                {section.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
                {section.body}
              </p>
              <ul className="mt-4 flex flex-col gap-3 text-sm text-slate-300">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

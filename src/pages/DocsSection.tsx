import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import {
  DOC_TOPICS,
  renderDocTopicIcon,
  type DocTopicSlug,
} from "../features/docs/docsCatalog";

export default function DocsSection() {
  const navigate = useNavigate();
  const [hoveredTopic, setHoveredTopic] = useState<DocTopicSlug | null>(null);
  const [accentBorder30, setAccentBorder30] = useState("rgba(34,211,238,0.3)");

  useEffect(() => {
    try {
      const raw =
        getComputedStyle(document.documentElement).getPropertyValue(
          "--ui-accent",
        ) || "#22d3ee";
      const hex = raw.trim();
      const match = hex.match(/^#?([0-9a-fA-F]{6})$/);

      if (match) {
        const value = match[1];
        const red = parseInt(value.slice(0, 2), 16);
        const green = parseInt(value.slice(2, 4), 16);
        const blue = parseInt(value.slice(4, 6), 16);
        setAccentBorder30(`rgba(${red}, ${green}, ${blue}, 0.3)`);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <section className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6">
        <PageHeader titleOverride="Docs" />

        <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.4)] backdrop-blur">
          <div className="app-kicker mb-3">Project docs</div>
          <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Documentacion central del desarrollo
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 md:text-base">
            Este espacio concentra la referencia viva del proyecto. Cada bloque
            resume lo que ya construimos, como se integra con el resto del
            sistema y que puntos conviene dejar anotados para seguir iterando
            sin perder contexto.
          </p>
        </div>

        <div className="flex flex-wrap gap-6">
          {DOC_TOPICS.map((topic) => (
            <button
              key={topic.slug}
              type="button"
              className="group relative min-h-[16rem] w-full rounded-2xl text-slate-900 transition-all duration-300 md:w-[calc(50%-0.75rem)] xl:w-[calc(33.333%-1rem)]"
              style={cardStyle(hoveredTopic === topic.slug, accentBorder30)}
              onClick={() =>
                navigate(`/docs/${topic.slug}`, { viewTransition: true })
              }
              onMouseEnter={() => setHoveredTopic(topic.slug)}
              onMouseLeave={() => setHoveredTopic(null)}
              aria-label={`Abrir documentacion de ${topic.title}`}
            >
              <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-transparent px-6 py-8 text-center text-slate-100 transition-all duration-300">
                {renderDocTopicIcon(
                  topic.slug,
                  "size-24 md:size-32 transition-transform duration-300 group-hover:scale-105",
                )}
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  {topic.kicker}
                </p>
                <p className="mt-1 text-2xl font-extrabold uppercase">
                  {topic.title}
                </p>
                <p className="mt-3 text-sm text-slate-300">{topic.summary}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function cardStyle(active: boolean, accentBorder30: string): CSSProperties {
  return active
    ? {
        borderColor: "white",
        color: "white",
        borderStyle: "solid",
        borderWidth: "2px",
      }
    : {
        borderColor: accentBorder30,
        borderStyle: "solid",
        borderWidth: "2px",
      };
}

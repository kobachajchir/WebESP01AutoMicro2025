import type { ReactNode } from "react";
import {
  COMMAND_GROUPS,
  NODE_NAMES,
} from "../catalog";
import { bytesToHex, h2, hx } from "../utils";
import { Panel } from "../ui";
import type { BuilderData, CommandDefinition } from "../types";

type SegmentTone = "cyan" | "emerald" | "amber" | "violet" | "rose" | "sky" | "slate";

interface FrameVisualizationShowcaseProps {
  builderData: BuilderData | null;
  builderError: string;
  commandKey: string;
  currentCommand?: CommandDefinition;
}

export function FrameVisualizationShowcase({
  builderData,
  builderError,
  commandKey,
  currentCommand,
}: FrameVisualizationShowcaseProps) {
  const commandGroupLabel =
    COMMAND_GROUPS.find((group) => group.commands.includes(commandKey))?.label ??
    "Sin grupo";

  if (!builderData) {
    return (
      <Panel title="Frame - visualizacion">
        <div className="protocol-frame-card protocol-frame-card--empty">
          <div className="app-kicker mb-3">UNER v2</div>
          <h3 className="text-lg font-black uppercase tracking-tight text-white md:text-xl">
            Packet format
          </h3>

          {builderError ? (
            <div className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-200">
              {builderError}
            </div>
          ) : null}
        </div>
      </Panel>
    );
  }

  const source = (builderData.route >> 4) & 0x0f;
  const destination = builderData.route & 0x0f;
  const payloadHex = builderData.payload.length
    ? bytesToHex(builderData.payload)
    : "sin payload";

  return (
    <Panel title="Frame - visualizacion">
      <div className="protocol-frame-card">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_34%,transparent_70%,rgba(255,255,255,0.04))]" />
        <div className="pointer-events-none absolute -left-24 top-8 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-6 h-44 w-44 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-4">
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-white md:text-xl">
                Packet format
              </h3>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatChip
                label="cmd"
                value={`${hx(builderData.cmd)} ${currentCommand?.name ?? ""}`.trim()}
              />
              <StatChip label="grupo" value={commandGroupLabel} />
              <StatChip label="src" value={`${hx(source)} ${nodeLabel(source)}`} />
              <StatChip
                label="dst"
                value={`${hx(destination)} ${nodeLabel(destination)}`}
              />
              <StatChip label="route" value={hx(builderData.route)} />
              <StatChip label="total" value={`${builderData.frame.length} bytes`} />
              <StatChip label="chk" value={hx(builderData.chk)} />
            </div>
          </div>

          <div className="rounded-[18px] border border-white/10 bg-slate-950/30 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max items-end gap-2">
                <FrameSegment
                  label="Header"
                  tone="cyan"
                  tooltipTitle="HEADER"
                  tooltipBody='Firma fija "UNER". Siempre ocupa 4 bytes y marca el inicio del paquete.'
                >
                  <SegmentBlock tone="cyan" className="min-w-[9.5rem]">
                    <div className="font-mono text-[1.05rem] font-semibold tracking-[0.08em] text-cyan-50 md:text-[1.15rem]">
                      55 4E 45 52
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100/80">
                      4 bytes fijos
                    </div>
                  </SegmentBlock>
                </FrameSegment>

                <FrameSegment
                  label="Len"
                  tone="emerald"
                  tooltipTitle="LEN"
                  tooltipBody={`Longitud del payload en bytes. Para este frame vale ${builderData.len}.`}
                >
                  <SegmentBlock tone="emerald" className="min-w-[4.4rem]">
                    <div className="font-mono text-[1.05rem] font-semibold tracking-[0.08em] text-emerald-50 md:text-[1.15rem]">
                      {h2(builderData.len)}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-emerald-100/80">
                      {builderData.len} {builderData.len === 1 ? "byte" : "bytes"}
                    </div>
                  </SegmentBlock>
                </FrameSegment>

                <FrameSegment
                  label="Token / Ver"
                  tone="amber"
                  tooltipTitle="TOKEN / VERSION"
                  tooltipBody="UNER v2 usa el token fijo 0x3A y la version fija 0x02."
                >
                  <div className="flex gap-2">
                    <SegmentBlock tone="amber" className="min-w-[4.4rem]">
                      <div className="font-mono text-[1.05rem] font-semibold tracking-[0.08em] text-amber-50 md:text-[1.15rem]">
                        3A
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-amber-100/80">
                        token
                      </div>
                    </SegmentBlock>
                    <SegmentBlock tone="amber" className="min-w-[4.4rem]">
                      <div className="font-mono text-[1.05rem] font-semibold tracking-[0.08em] text-amber-50 md:text-[1.15rem]">
                        02
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-amber-100/80">
                        version
                      </div>
                    </SegmentBlock>
                  </div>
                </FrameSegment>

                <FrameSegment
                  label="Route"
                  tone="violet"
                  tooltipTitle="ROUTE"
                  tooltipBody={`Nibble alto = ${nodeLabel(source)}. Nibble bajo = ${nodeLabel(destination)}.`}
                >
                  <SegmentBlock tone="violet" className="min-w-[6.2rem]">
                    <div className="font-mono text-[1.05rem] font-semibold tracking-[0.08em] text-violet-50 md:text-[1.15rem]">
                      {h2(builderData.route)}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-violet-100/80">
                      {nodeLabel(source)} -&gt; {nodeLabel(destination)}
                    </div>
                  </SegmentBlock>
                </FrameSegment>

                <FrameSegment
                  label="Cmd"
                  tone="rose"
                  tooltipTitle="CMD"
                  tooltipBody={currentCommand?.desc ?? "Operacion concreta del protocolo para este frame."}
                >
                  <SegmentBlock tone="rose" className="min-w-[6.2rem]">
                    <div className="font-mono text-[1.05rem] font-semibold tracking-[0.08em] text-rose-50 md:text-[1.15rem]">
                      {h2(builderData.cmd)}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-rose-100/80">
                      {currentCommand?.name ?? "comando"}
                    </div>
                  </SegmentBlock>
                </FrameSegment>

                <FrameSegment
                  label="Payload"
                  tone="sky"
                  tooltipTitle="PAYLOAD"
                  tooltipBody={
                    builderData.payload.length
                      ? `Payload actual (${builderData.payload.length} bytes): ${payloadHex}.`
                      : "El CMD actual no necesita payload adicional."
                  }
                >
                  <SegmentBlock tone="sky" className="min-w-[10rem] max-w-[20rem]">
                    <div className="font-mono text-[0.95rem] font-semibold tracking-[0.08em] text-sky-50 md:text-[1.05rem]">
                      {payloadHex}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-sky-100/80">
                      {builderData.payload.length
                        ? `${builderData.payload.length} bytes de datos`
                        : "sin payload"}
                    </div>
                  </SegmentBlock>
                </FrameSegment>

                <FrameSegment
                  label="Chk"
                  tone="slate"
                  tooltipTitle="CHECKSUM"
                  tooltipBody={`XOR final calculado sobre todo el frame previo. Valor actual: ${hx(builderData.chk)}.`}
                >
                  <SegmentBlock tone="slate" className="min-w-[4.4rem]">
                    <div className="font-mono text-[1.05rem] font-semibold tracking-[0.08em] text-slate-50 md:text-[1.15rem]">
                      {h2(builderData.chk)}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-100/80">
                      xor
                    </div>
                  </SegmentBlock>
                </FrameSegment>
              </div>
            </div>
          </div>

          {builderError ? (
            <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-200">
              {builderError}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function nodeLabel(node: number) {
  return NODE_NAMES[node] ?? `0x${node.toString(16).toUpperCase()}`;
}

function toneClasses(tone: SegmentTone) {
  switch (tone) {
    case "emerald":
      return {
        label: "text-emerald-200",
        block:
          "border-emerald-300/40 bg-emerald-500/16 shadow-[0_0_0_1px_rgba(74,222,128,0.14),0_18px_50px_rgba(34,197,94,0.14)]",
        pill: "border-emerald-300/35 bg-emerald-500/12 text-emerald-100",
      };
    case "amber":
      return {
        label: "text-amber-200",
        block:
          "border-amber-300/45 bg-amber-500/14 shadow-[0_0_0_1px_rgba(251,191,36,0.16),0_18px_50px_rgba(245,158,11,0.14)]",
        pill: "border-amber-300/35 bg-amber-500/12 text-amber-100",
      };
    case "violet":
      return {
        label: "text-violet-200",
        block:
          "border-violet-300/45 bg-violet-500/16 shadow-[0_0_0_1px_rgba(196,181,253,0.16),0_18px_50px_rgba(168,85,247,0.16)]",
        pill: "border-violet-300/35 bg-violet-500/12 text-violet-100",
      };
    case "rose":
      return {
        label: "text-rose-200",
        block:
          "border-rose-300/45 bg-rose-500/16 shadow-[0_0_0_1px_rgba(253,164,175,0.16),0_18px_50px_rgba(244,63,94,0.15)]",
        pill: "border-rose-300/35 bg-rose-500/12 text-rose-100",
      };
    case "sky":
      return {
        label: "text-sky-200",
        block:
          "border-sky-300/45 bg-sky-500/16 shadow-[0_0_0_1px_rgba(125,211,252,0.16),0_18px_50px_rgba(14,165,233,0.15)]",
        pill: "border-sky-300/35 bg-sky-500/12 text-sky-100",
      };
    case "slate":
      return {
        label: "text-slate-200",
        block:
          "border-slate-300/35 bg-slate-400/12 shadow-[0_0_0_1px_rgba(148,163,184,0.14),0_18px_50px_rgba(100,116,139,0.12)]",
        pill: "border-slate-300/30 bg-slate-400/10 text-slate-100",
      };
    case "cyan":
    default:
      return {
        label: "text-cyan-200",
        block:
          "border-cyan-300/45 bg-cyan-500/16 shadow-[0_0_0_1px_rgba(103,232,249,0.16),0_18px_50px_rgba(34,211,238,0.15)]",
        pill: "border-cyan-300/35 bg-cyan-500/12 text-cyan-100",
      };
  }
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/45 px-2.5 py-1.5 text-[11px] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <span className="font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      <span className="font-mono text-slate-100">{value}</span>
    </div>
  );
}

function FrameSegment({
  label,
  tone,
  tooltipTitle,
  tooltipBody,
  children,
}: {
  label: string;
  tone: SegmentTone;
  tooltipTitle: string;
  tooltipBody: string;
  children: ReactNode;
}) {
  const toneClass = toneClasses(tone);

  return (
    <button
      type="button"
      className="group relative flex shrink-0 cursor-help flex-col items-center gap-2 rounded-[18px] bg-transparent p-0 text-left"
    >
      <div className={`text-[10px] font-black uppercase tracking-[0.12em] ${toneClass.label}`}>
        {label}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-72 -translate-x-1/2 -translate-y-full pb-3 text-left group-hover:block group-focus:block">
        <div className="rounded-2xl border border-white/10 bg-slate-950/92 p-3 shadow-[0_20px_60px_rgba(2,6,23,0.46)] backdrop-blur">
          <div className={`text-xs font-bold uppercase tracking-[0.2em] ${toneClass.label}`}>
            {tooltipTitle}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-200">{tooltipBody}</p>
        </div>
      </div>
      {children}
    </button>
  );
}

function SegmentBlock({
  tone,
  className = "",
  children,
}: {
  tone: SegmentTone;
  className?: string;
  children: ReactNode;
}) {
  const toneClass = toneClasses(tone);

  return (
    <div
      className={`rounded-[14px] border px-3 py-2.5 text-center transition-transform duration-300 group-hover:-translate-y-0.5 ${toneClass.block} ${className}`}
    >
      {children}
    </div>
  );
}

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import logoDashboard from "../assets/LogoDashboard.webp";
import { useEspWifiStatus } from "../contexts/EspWifiStatusContext";
import useUser from "../contexts/UserContext";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  formatF4BootHandoff,
  formatF4ExtensionProfile,
  formatF4PackedVersion,
  parseBootReportData,
  type F4BootReport,
} from "../protocol/f4Payloads";
import { ESP_COMMANDS, WS_API_VERSION } from "../protocol/wsApi";
import { OLED_BITMAP_ASSETS } from "../screens/bitmapAssets";

type FirmwareInfo = {
  name: string;
  version: string;
  target: string;
};

type BuildInfo = {
  date: string;
  time: string;
  profile: string;
  compiler: string;
  arduinoCore?: string;
  sdk?: string;
};

type EspRuntimeInfo = {
  freeHeap: string;
  maxFreeBlock: string;
  heapFragmentation: string;
};

type EspDeviceInfo = {
  firmware: FirmwareInfo;
  build: BuildInfo;
  runtime: EspRuntimeInfo;
};

type LoadState = "idle" | "loading" | "success" | "partial" | "error";

const REPOSITORIES = [
  {
    title: "Firmware F4",
    detail: "STM32F411CEU6, OLED y lógica del vehículo",
    slug: "ProyectoAutoMicro2026_F411CEU6",
    url: "https://github.com/kobachajchir/ProyectoAutoMicro2026_F411CEU6",
    qrReady: true,
  },
  {
    title: "Firmware ESP01",
    detail: "Puente WebSocket, WiFi y transporte UNER",
    slug: "FirmESP01MicroArduino2025",
    url: "https://github.com/kobachajchir/FirmESP01MicroArduino2025",
    qrReady: false,
  },
  {
    title: "Aplicación Web",
    detail: "Dashboard embebido y herramientas de diagnóstico",
    slug: "WebESP01AutoMicro2025",
    url: "https://github.com/kobachajchir/WebESP01AutoMicro2025",
    qrReady: false,
  },
] as const;

const QR_PATH = buildQrPath();

export default function AboutProjectPanel() {
  const { connected, hello, request, subscribeEvent } = useWebSocket();
  const { refresh: refreshEspStatus } = useEspWifiStatus();
  const { remotePinAuthenticated } = useUser();
  const [expanded, setExpanded] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [message, setMessage] = useState(
    "Expandí la ficha para consultar firmware, compilación y runtime.",
  );
  const [f4Firmware, setF4Firmware] = useState<FirmwareInfo | null>(null);
  const [f4Build, setF4Build] = useState<BuildInfo | null>(null);
  const [bootReport, setBootReport] = useState<F4BootReport | null>(null);
  const [espInfo, setEspInfo] = useState<EspDeviceInfo | null>(null);

  const loadDeviceInfo = useCallback(async () => {
    if (!connected) {
      setLoadState("error");
      setMessage("No hay enlace WebSocket con el ESP para actualizar los datos.");
      return;
    }

    setLoadState("loading");
    setMessage("Consultando ESP01 y Firmware F4...");

    const espResult = await Promise.allSettled([
      refreshEspStatus().then((status) => {
        if (!status) {
          throw new Error("El ESP no devolvio su estado local.");
        }
        return status.raw;
      }),
    ]);
    const f4Results = remotePinAuthenticated
      ? await Promise.allSettled([
          request<Record<string, unknown>>(
            ESP_COMMANDS.GET_FIRMWARE,
            {},
            { timeoutMs: 4_000 },
          ),
          request<Record<string, unknown>>(
            ESP_COMMANDS.GET_BUILD,
            {},
            { timeoutMs: 4_000 },
          ),
          request<Record<string, unknown>>(
            ESP_COMMANDS.GET_BOOT_REPORT,
            {},
            { timeoutMs: 4_000 },
          ),
        ])
      : [];

    let updated = 0;
    let failed = 0;
    if (espResult[0]?.status === "fulfilled") {
      setEspInfo(readEspDeviceInfo(espResult[0].value));
      updated += 1;
    } else {
      failed += 1;
    }
    if (remotePinAuthenticated) {
      if (f4Results[0]?.status === "fulfilled") {
        setF4Firmware(readFirmwareInfo(f4Results[0].value));
        updated += 1;
      } else {
        failed += 1;
      }
      if (f4Results[1]?.status === "fulfilled") {
        setF4Build(readBuildInfo(f4Results[1].value));
        updated += 1;
      } else {
        failed += 1;
      }
      if (f4Results[2]?.status === "fulfilled") {
        setBootReport(parseBootReportData(f4Results[2].value));
        updated += 1;
      } else {
        failed += 1;
      }
    }

    if (!remotePinAuthenticated) {
      setLoadState(updated > 0 ? "partial" : "error");
      setMessage(
        updated > 0
          ? "ESP01 y Web actualizados. La F4 requiere una sesión PIN activa."
          : "No se pudieron consultar los datos del ESP01.",
      );
      return;
    }
    setLoadState(failed === 0 ? "success" : updated > 0 ? "partial" : "error");
    setMessage(
      failed === 0
        ? "Datos actualizados desde la F4 y el ESP01."
        : updated > 0
          ? "Se actualizaron algunos datos; una de las consultas no respondió."
          : "No se pudieron actualizar los datos del sistema.",
    );
  }, [connected, refreshEspStatus, remotePinAuthenticated, request]);

  useEffect(() => {
    if (expanded) void loadDeviceInfo();
  }, [expanded, loadDeviceInfo]);

  useEffect(() => {
    const applyReport = ({ data }: { data: unknown }) => {
      try {
        setBootReport(parseBootReportData(data));
      } catch {
        // Un schema futuro no debe borrar el ultimo reporte valido.
      }
    };
    const offBootReport = subscribeEvent("bootReport", applyReport);
    const offGeneric = subscribeEvent("stm.event", (event) => {
      const data = event.data;
      if (
        typeof data === "object" &&
        data !== null &&
        !Array.isArray(data) &&
        (data as Record<string, unknown>).cmd === 0x9f
      ) {
        applyReport(event);
      }
    });
    return () => {
      offBootReport();
      offGeneric();
    };
  }, [subscribeEvent]);

  return (
    <section className="about-project-card">
      <button
        type="button"
        className="about-project-card__summary"
        aria-expanded={expanded}
        aria-controls="about-project-details"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="about-project-card__logo-shell">
          <img src={logoDashboard} alt="Auto Microcontroladores" />
        </span>
        <span className="about-project-card__heading">
          <span className="app-kicker">Proyecto integrado</span>
          <strong>Auto Microcontroladores</strong>
          <small>Web, ESP8266 y STM32F411CEU6</small>
        </span>
        <span className={`about-project-card__status about-project-card__status--${connected ? "online" : "offline"}`}>
          {connected ? "Sistema disponible" : "Sin enlace"}
        </span>
        <AboutChevron open={expanded} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id="about-project-details"
            className="about-project-card__details overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
          <div className={`about-project-feedback about-project-feedback--${loadState}`}>
            <span>{message}</span>
            <button
              type="button"
              className="app-button--ghost px-3 py-2 text-xs font-bold"
              disabled={loadState === "loading"}
              onClick={() => void loadDeviceInfo()}
            >
              {loadState === "loading" ? "Consultando..." : "Actualizar datos"}
            </button>
          </div>

          <div className="about-build-grid">
            <AboutDataCard title="Controlador F4" eyebrow="Firmware y build">
              <AboutDataSection title="GET_FIRMWARE_INFO · 0x68" />
              <AboutDataRow label="Nombre" value={f4Firmware?.name ?? "--"} />
              <AboutDataRow label="Versión" value={f4Firmware?.version ?? "--"} />
              <AboutDataRow label="Target" value={f4Firmware?.target ?? "--"} />
              <AboutDataSection title="GET_BUILD_INFO · 0x69" />
              <AboutDataRow label="Fecha" value={formatBuildDate(f4Build)} />
              <AboutDataRow label="Perfil de build" value={f4Build?.profile ?? "--"} />
              <AboutDataRow label="Compilador" value={f4Build?.compiler ?? "--"} />
              <AboutDataSection title="GET_BOOT_REPORT / 0x6F / evento 0x9F" />
              <AboutDataRow
                label="Perfil de arranque"
                value={bootReport ? formatF4ExtensionProfile(bootReport.extensionProfileId) : "--"}
              />
              <AboutDataRow
                label="Mailbox"
                value={bootReport ? (bootReport.mailboxValid ? "Valido" : "No disponible") : "--"}
              />
              <AboutDataRow
                label="Handoff"
                value={bootReport?.mailboxValid ? formatF4BootHandoff(bootReport.handoff) : "--"}
              />
              <AboutDataRow
                label="Bootloader"
                value={bootReport?.mailboxValid ? formatF4PackedVersion(bootReport.bootloaderVersion) : "--"}
              />
              <AboutDataRow
                label="Aplicacion validada"
                value={bootReport?.mailboxValid ? formatValidationFlags(bootReport.appValidationFlags) : "--"}
              />
              <AboutDataRow
                label="Imagen"
                value={bootReport?.mailboxValid ? formatBytes(bootReport.appSize) : "--"}
              />
              <AboutDataRow
                label="CRC32"
                value={bootReport?.mailboxValid ? formatHex32(bootReport.appCrc32) : "--"}
              />
            </AboutDataCard>

            <AboutDataCard title="Puente ESP01" eyebrow="Firmware y build local">
              <AboutDataSection title="Firmware ESP8266" />
              <AboutDataRow label="Nombre" value={espInfo?.firmware.name ?? "--"} />
              <AboutDataRow label="Versión" value={espInfo?.firmware.version ?? hello?.espVersion ?? "--"} />
              <AboutDataRow label="Target" value={espInfo?.firmware.target ?? "--"} />
              <AboutDataSection title="Compilación ESP01" />
              <AboutDataRow label="Fecha" value={formatBuildDate(espInfo?.build)} />
              <AboutDataRow label="Perfil" value={espInfo?.build.profile ?? "--"} />
              <AboutDataRow label="Core" value={espInfo?.build.arduinoCore ?? "--"} />
              <AboutDataRow label="SDK" value={espInfo?.build.sdk ?? "--"} />
            </AboutDataCard>

            <AboutDataCard title="Runtime y Web" eyebrow="Aplicación embebida">
              <AboutDataSection title="Runtime ESP01" />
              <AboutDataRow label="Heap libre" value={espInfo?.runtime.freeHeap ?? "--"} />
              <AboutDataRow label="Bloque máx." value={espInfo?.runtime.maxFreeBlock ?? "--"} />
              <AboutDataRow label="Fragmentación" value={espInfo?.runtime.heapFragmentation ?? "--"} />
              <AboutDataSection title="Aplicación Web" />
              <AboutDataRow label="WebSocket" value={`API v${WS_API_VERSION}`} />
              <AboutDataRow label="Build" value={import.meta.env.MODE} />
              <AboutDataRow label="Host" value={window.location.host || "dev server"} />
              <AboutDataRow label="Modelo 3D" value={hello?.backend?.modelAssets === false ? "No disponible" : "Disponible"} />
            </AboutDataCard>
          </div>

          <div className="about-media-grid" aria-label="Imágenes del proyecto">
            <AboutPhotoPlaceholder title="Foto del vehículo" />
            <AboutPhotoPlaceholder title="Foto de la electrónica" />
            <AboutPhotoPlaceholder title="Foto del sistema integrado" />
          </div>

          <div className="about-repositories-grid" aria-label="Repositorios del proyecto">
            {REPOSITORIES.map((repository) => (
              <a
                key={repository.url}
                className="about-repository-card"
                href={repository.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="about-repository-card__copy">
                  <strong>{repository.title}</strong>
                  <small>{repository.detail}</small>
                  <code>{repository.slug}</code>
                  <span className="about-repository-card__link">
                    Abrir repositorio <RepositoryArrow />
                  </span>
                </span>
                {repository.qrReady ? (
                  <RepositoryQr title={repository.title} />
                ) : (
                  <RepositoryQrPlaceholder title={repository.title} />
                )}
              </a>
            ))}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function AboutDataCard({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <article className="about-data-card">
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      <dl>{children}</dl>
    </article>
  );
}

function AboutDataSection({ title }: { title: string }) {
  return <div className="about-data-section">{title}</div>;
}

function AboutDataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}

function AboutPhotoPlaceholder({ title }: { title: string }) {
  return (
    <div className="about-photo-placeholder" role="img" aria-label={`${title}, imagen pendiente`}>
      <PhotoIcon />
      <span className="about-media-title">{title}</span>
      <small>Placeholder · imagen pendiente</small>
    </div>
  );
}

function RepositoryQr({ title }: { title: string }) {
  return (
    <svg className="about-repository-qr" viewBox="-4 -4 72 72" role="img" aria-label={`Código QR de ${title}`} shapeRendering="crispEdges">
      <rect x="-4" y="-4" width="72" height="72" rx="2" fill="#ffffff" />
      <path d={QR_PATH} fill="#020617" />
    </svg>
  );
}

function RepositoryQrPlaceholder({ title }: { title: string }) {
  return (
    <span className="about-repository-qr-placeholder" role="img" aria-label={`Espacio reservado para el QR de ${title}`}>
      <QrPlaceholderIcon />
      <small>QR pendiente</small>
    </span>
  );
}

function AboutChevron({ open }: { open: boolean }) {
  return (
    <svg className={`about-project-chevron ${open ? "about-project-chevron--open" : ""}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m5 17 4.5-4 3.2 2.6 2.8-2.4L19 17" />
    </svg>
  );
}

function QrPlaceholderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 14h2v2h-2zM18 14h2v6h-6v-2h4zM12 12h2v2h-2z" />
    </svg>
  );
}

function RepositoryArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

function readFirmwareInfo(data: Record<string, unknown>): FirmwareInfo {
  assertOkStatus(data, "firmware");
  return {
    name: readText(data.name),
    version: readText(data.version),
    target: readText(data.target),
  };
}

function readBuildInfo(data: Record<string, unknown>): BuildInfo {
  assertOkStatus(data, "build");
  return {
    date: readText(data.date),
    time: readText(data.time),
    profile: readText(data.profile),
    compiler: readText(data.compiler),
  };
}

function readEspDeviceInfo(data: Record<string, unknown>): EspDeviceInfo {
  const firmware = readRecord(data.firmware);
  const build = readRecord(data.build);
  const runtime = readRecord(data.runtime);
  return {
    firmware: {
      name: readText(firmware.name),
      version: readText(firmware.version),
      target: readText(firmware.target),
    },
    build: {
      date: readText(build.date),
      time: readText(build.time),
      profile: readText(build.profile),
      compiler: readText(build.compiler),
      arduinoCore: readText(build.arduinoCore),
      sdk: readText(build.sdk),
    },
    runtime: {
      freeHeap: formatBytes(runtime.freeHeap),
      maxFreeBlock: formatBytes(runtime.maxFreeBlock),
      heapFragmentation: formatPercent(runtime.heapFragmentation),
    },
  };
}

function formatValidationFlags(flags: number): string {
  const normalized = flags & 0x1f;
  return normalized === 0x1f ? "Completa (0x1F)" : `Parcial (${formatHexByte(normalized)})`;
}

function formatHexByte(value: number): string {
  return `0x${(value & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
}

function formatHex32(value: number): string {
  return `0x${(value >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function formatBuildDate(build: BuildInfo | null | undefined): string {
  return build ? `${build.date} ${build.time}`.trim() : "--";
}

function formatBytes(value: unknown): string {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? `${Math.max(0, Math.round(number)).toLocaleString("es-AR")} B` : "--";
}

function formatPercent(value: unknown): string {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? `${Math.max(0, Math.round(number))}%` : "--";
}

function assertOkStatus(data: Record<string, unknown>, label: string) {
  if (typeof data.status === "number" && data.status !== 0) {
    throw new Error(`La F4 rechazó la consulta de ${label} (status ${data.status}).`);
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readText(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "--";
}

function buildQrPath(): string {
  const bytes = OLED_BITMAP_ASSETS.QRCode_Github_bits?.bytes ?? [];
  const commands: string[] = [];
  for (let y = 0; y < 64; y += 1) {
    let runStart = -1;
    for (let x = 0; x <= 64; x += 1) {
      const set = x < 64
        ? ((bytes[y * 8 + Math.floor(x / 8)] ?? 0) & (1 << (7 - (x % 8)))) !== 0
        : false;
      if (set && runStart < 0) runStart = x;
      if (!set && runStart >= 0) {
        commands.push(`M${runStart} ${y}h${x - runStart}v1H${runStart}z`);
        runStart = -1;
      }
    }
  }
  return commands.join("");
}

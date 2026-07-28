export type DocFirmwareTarget = "web" | "f4";

export type DocTopicSlug =
  | "motors"
  | "oled"
  | "mpu"
  | "ir"
  | "menu-system"
  | "render-3d"
  | "pcb";

export interface DocTopicSection {
  title: string;
  body: string;
  bullets: string[];
}

export interface DocFlowStep {
  layer: string;
  title: string;
  detail: string;
  reference: string;
}

export interface DocMediaItem {
  kind: "captura" | "diagrama" | "foto";
  title: string;
  caption: string;
  status: "disponible" | "planificada";
  href?: string;
  imageSrc?: string;
}

export interface DocReference {
  label: string;
  path: string;
  note: string;
}

export interface DocTopicVariant {
  summary: string;
  scope: string;
  sections: DocTopicSection[];
  flow: DocFlowStep[];
  media: DocMediaItem[];
  references: DocReference[];
}

export interface DocTopic {
  slug: DocTopicSlug;
  title: string;
  kicker: string;
  variants: Record<DocFirmwareTarget, DocTopicVariant>;
}

export interface DocFirmwareProfile {
  id: DocFirmwareTarget;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  authority: string;
  transport: string;
  output: string;
}

export const DOC_FIRMWARE_PROFILES: Record<
  DocFirmwareTarget,
  DocFirmwareProfile
> = {
  web: {
    id: "web",
    label: "Firmware Web",
    eyebrow: "Cliente, bridge y experiencia remota",
    title: "Documentación del Firmware Web",
    description:
      "Explica cada subsistema desde la interfaz React: qué ve el operador, qué estado mantiene el navegador, qué mensaje sale por WebSocket y cómo se interpreta la respuesta del bridge ESP/F4.",
    authority: "WebESP01AutoMicro2025",
    transport: "React → WebSocket → ESP bridge",
    output: "Pantallas, estados, comandos y evidencia de operación",
  },
  f4: {
    id: "f4",
    label: "Firmware F4",
    eyebrow: "Runtime embebido y autoridad física",
    title: "Documentación del Firmware F4",
    description:
      "Explica los mismos temas desde la STM32F411: tareas, drivers, handlers UNER, pantalla OLED, sensores, actuadores y reglas que convierten un comando remoto en estado físico verificable.",
    authority: "FirmwareF4",
    transport: "UNER v2 → dispatcher → aplicación/driver",
    output: "Estado local, eventos, telemetría y actuación física",
  },
};

const webVisual = (
  liveTitle: string,
  href: string,
  diagramTitle: string,
  photoTitle: string,
): DocMediaItem[] => [
  {
    kind: "captura",
    title: liveTitle,
    caption:
      "Acceso vivo a la pantalla que sirve como evidencia funcional y fuente para futuras capturas versionadas.",
    status: "disponible",
    href,
  },
  {
    kind: "diagrama",
    title: diagramTitle,
    caption:
      "Diagrama a mantener junto al contrato cuando cambien mensajes, estados o dependencias entre módulos.",
    status: "planificada",
  },
  {
    kind: "foto",
    title: photoTitle,
    caption:
      "Serie fotográfica del montaje real, conectores y condición de prueba. Debe incluir fecha, revisión y pie de foto.",
    status: "planificada",
  },
];

const f4Visual = (
  diagramTitle: string,
  photoTitle: string,
  evidenceTitle: string,
): DocMediaItem[] => [
  {
    kind: "diagrama",
    title: diagramTitle,
    caption:
      "Mapa técnico del recorrido dentro del firmware, desde el transporte hasta el módulo que posee el estado.",
    status: "planificada",
  },
  {
    kind: "foto",
    title: photoTitle,
    caption:
      "Fotografía del hardware real con revisión de placa, pines relevantes, orientación y condiciones de alimentación.",
    status: "planificada",
  },
  {
    kind: "captura",
    title: evidenceTitle,
    caption:
      "Captura de consola, OLED o instrumento de medición usada para vincular la implementación con una prueba reproducible.",
    status: "planificada",
  },
];

export const DOC_TOPICS: DocTopic[] = [
  {
    slug: "motors",
    title: "Motores",
    kicker: "Control",
    variants: {
      web: {
        summary:
          "Editor temporal de maniobras, validación local y simulación 3D de las pistas izquierda, derecha o dual.",
        scope:
          "Esta versión documenta lo que hoy puede demostrar la web y separa explícitamente la simulación del envío físico: ControlSection modela rampas, constantes, curvas, pivotes y detenciones, pero la capacidad de ejecución física permanece deshabilitada.",
        sections: [
          {
            title: "Modelo de operación",
            body:
              "El operador compone una línea de tiempo por motor o una pista dual. Cada bloque conserva duración, velocidad y parámetros propios; la selección global alimenta el inspector y la reproducción local actualiza progreso y pose simulada.",
            bullets: [
              "Los bloques disponibles son rampa, velocidad constante, curva, pivote y stop.",
              "La vista valida combinaciones antes de reproducir y distingue errores de advertencias.",
              "CarModeContext aporta el modo real del auto para impedir presentar una prueba como válida fuera del modo correspondiente.",
            ],
          },
          {
            title: "Límite de integración actual",
            body:
              "La pantalla conoce la conexión WebSocket y el modo del vehículo, pero PHYSICAL_EXECUTION_CAPABILITY está en false. Por eso la documentación no debe afirmar que una secuencia llega hoy a los puentes H: la salida verificable es la simulación local.",
            bullets: [
              "No existe todavía un serializador definitivo de timeline a payload de movimiento.",
              "El botón de transporte debe seguir comunicando simulación hasta habilitar el contrato físico.",
              "La futura activación necesita ACK, stop de emergencia y estado final reportado por F4.",
            ],
          },
          {
            title: "Criterio de aceptación",
            body:
              "Una prueba web queda documentada con la secuencia usada, resultado de validación, pose final simulada y versión de la interfaz. Una prueba física futura deberá sumar frame exacto, modo del auto, respuesta F4 y video/foto del banco.",
            bullets: [
              "Guardar captura de ambas pistas y del inspector.",
              "Registrar duración total, velocidades máximas y cada discontinuidad stop.",
              "No mezclar evidencia simulada con evidencia de motores energizados.",
            ],
          },
        ],
        flow: [
          { layer: "UI", title: "ControlSection", detail: "Compone y valida bloques por pista.", reference: "src/pages/ControlSection.tsx" },
          { layer: "Estado", title: "CarModeContext", detail: "Consulta y conserva el modo reportado por el auto.", reference: "src/contexts/CarModeContext.tsx" },
          { layer: "Transporte", title: "WebSocketContext", detail: "Expone conexión y será la salida del contrato físico.", reference: "src/contexts/WebSocketContext.tsx" },
          { layer: "Salida actual", title: "Simulación 3D", detail: "Integra la secuencia en una pose local sin energizar hardware.", reference: "src/pages/ControlSection.tsx" },
        ],
        media: webVisual("Abrir Control de Motores", "/control", "Timeline → payload → ACK", "Banco de motores y ruedas"),
        references: [
          { label: "Pantalla", path: "src/pages/ControlSection.tsx", note: "Editor, validación, playback y simulación." },
          { label: "Bloques", path: "src/components/MotorBlock.tsx", note: "Representación visual de cada maniobra." },
          { label: "Tipos", path: "src/types/MotorTypes.ts", note: "Contrato de bloques, pistas y direcciones." },
        ],
      },
      f4: {
        summary:
          "Autoridad física de dirección, PWM, frenado y seguridad, conectada al dispatcher UNER y al modo del vehículo.",
        scope:
          "La versión F4 debe explicar el camino que termina en GPIO/timers y distinguir comandos de movimiento, control autónomo, modo test y parada segura. El firmware local es la autoridad: la web sólo solicita acciones.",
        sections: [
          {
            title: "Propiedad del estado",
            body:
              "motor_control concentra la actuación final y app_tasks coordina el runtime. Cualquier comando remoto tiene que validarse contra modo, permisos y límites antes de modificar dirección o duty cycle.",
            bullets: [
              "La F4 conserva el estado efectivo aunque el cliente WebSocket se desconecte.",
              "Los cambios físicos deben poder observarse mediante snapshot/evento, no sólo mediante ACK de recepción.",
              "Stop y reset se documentan como transiciones de seguridad, no como un bloque visual más.",
            ],
          },
          {
            title: "Entrada UNER",
            body:
              "uner_app valida destino, longitud, transporte y checksum antes de despachar. Los comandos locales responden por el transporte de origen; los destinados a otro nodo se enrutan sin ejecutar lógica F4.",
            bullets: [
              "UART1_ESP identifica al cliente Web/ESP y USB_CDC al cliente Qt.",
              "Un transporte no autorizado recibe NACK con status unsupported_transport.",
              "GET_CONTROL_SNAPSHOT es la evidencia recomendada para correlacionar orden, estado y diagnóstico.",
            ],
          },
          {
            title: "Prueba física reproducible",
            body:
              "Cada ensayo debe identificar firmware/build, fuente de alimentación, vehículo elevado o apoyado, sentido esperado, PWM aplicado y reacción ante stop o pérdida de enlace.",
            bullets: [
              "Fotografiar cableado, orientación y revisión del driver.",
              "Medir respuesta izquierda/derecha por separado antes del modo dual.",
              "Adjuntar frame de entrada, respuesta y snapshot posterior.",
            ],
          },
        ],
        flow: [
          { layer: "Transporte", title: "UART1 / USB CDC", detail: "Entrega bytes al parser UNER común.", reference: "FirmwareF4/Core/Src/uner_app.c" },
          { layer: "Aplicación", title: "UNER_App_ExecuteCommand", detail: "Valida y deriva al handler permitido.", reference: "FirmwareF4/Core/Src/uner_app.c" },
          { layer: "Runtime", title: "app_tasks", detail: "Coordina modo y actualización periódica del auto.", reference: "FirmwareF4/Core/Src/app_tasks.c" },
          { layer: "Hardware", title: "motor_control", detail: "Aplica dirección y PWM a la etapa de potencia.", reference: "FirmwareF4/Core/Src/motor_control.c" },
        ],
        media: f4Visual("UNER → validación → motor_control", "Puente H, motores y alimentación", "PWM, dirección y stop medidos"),
        references: [
          { label: "Driver", path: "FirmwareF4/Core/Src/motor_control.c", note: "Actuación física y estado de motores." },
          { label: "Tareas", path: "FirmwareF4/Core/Src/app_tasks.c", note: "Orquestación del runtime." },
          { label: "Contrato", path: "FirmwareF4/Docs/f4_esp_web_protocol.md", note: "Transportes, routing y snapshots." },
        ],
      },
    },
  },
  {
    slug: "oled",
    title: "OLED",
    kicker: "Pantallas",
    variants: {
      web: {
        summary:
          "OLED Studio, documentos 128×64 persistidos, generación de comandos y visor remoto de la pantalla F4.",
        scope:
          "La web tiene dos circuitos relacionados: creación de pantallas en OLED Studio y reproducción del estado real publicado por F4 en el stream global. Ambos convergen en comandos de dibujo, pero no poseen la misma fuente de verdad.",
        sections: [
          { title: "Documento editable", body: "LopakaLikeEditor mantiene un EditorDocument con pantalla, capas, geometría, texto y assets. Al guardar, SavedOledScreensContext clona el documento, lo persiste localmente y regenera su lista de OledCommand.", bullets: ["La galería se guarda bajo saved-oled-screens-v1 en localStorage.", "Editar una pantalla existente conserva su identidad y createdAt.", "El preview se genera desde comandos, no desde una captura raster opaca."] },
          { title: "Pantalla real remota", body: "ScreenContext pide stm.screen.getCurrent, consume screen.current/screen.changed y normaliza screenCode, source, selección y datos variables. screenRenderRegistry elige el builder correcto para representar la OLED F4.", bullets: ["screenCode es la identidad estable; selectedIndex sólo ajusta el cursor.", "Los eventos raw 0x95/0x96 y los envelopes JSON convergen en el mismo modelo.", "ScreenStreamWorkspace agrega controles remotos, auth y pantallas guardadas."] },
          { title: "Reglas de documentación visual", body: "Cada pantalla debe tener código hexadecimal, nombre funcional, fuente, builder, ejemplo de datos y captura 128×64. Las pantallas dinámicas requieren además estados vacío, nominal y error.", bullets: ["No usar sólo una foto: conservar también el comando reproducible.", "Versionar assets bitmap y fuente junto al builder que los consume.", "Indicar si la vista es diseño Web, réplica F4 o estado recibido en vivo."] },
        ],
        flow: [
          { layer: "Edición", title: "LopakaLikeEditor", detail: "Modifica el EditorDocument 128×64.", reference: "src/features/oledEditor/LopakaLikeEditor.tsx" },
          { layer: "Código", title: "buildOledCommands", detail: "Convierte capas en comandos reproducibles.", reference: "src/features/oledEditor/codegen.ts" },
          { layer: "Persistencia", title: "SavedOledScreensContext", detail: "Guarda documentos y comandos derivados.", reference: "src/contexts/SavedOledScreensContext.tsx" },
          { layer: "Runtime", title: "ScreenContext + registry", detail: "Resuelve la pantalla reportada por F4.", reference: "src/screens/screenRenderRegistry.ts" },
        ],
        media: webVisual("Abrir OLED Studio", "/protocol?studio=oled", "Documento → comandos → preview", "OLED SSD1306 montada en el auto"),
        references: [
          { label: "Workspace", path: "src/features/oledEditor/OledStudioWorkspace.tsx", note: "Galería, carga y editor." },
          { label: "Registro", path: "src/screens/screenRenderRegistry.ts", note: "screenCode a builder web." },
          { label: "Inventario", path: "src/screens/SCREEN_INVENTORY.md", note: "Cobertura de pantallas conocidas." },
        ],
      },
      f4: {
        summary:
          "Render SSD1306, wrappers de pantalla, códigos estables, navegación local y publicación del estado remoto.",
        scope:
          "La F4 posee la pantalla física y decide qué se renderiza. El sistema documental debe seguir la cadena desde una transición de aplicación hasta el framebuffer enviado por I2C, incluyendo la notificación remota del screenCode.",
        sections: [
          { title: "Pipeline de render", body: "La lógica de aplicación selecciona un wrapper o menú; oled_utils compone primitivas y bitmaps; ssd1306 mantiene el buffer y actualiza el panel por I2C. La documentación separa decisión de pantalla, composición y driver.", bullets: ["screenWrappers encapsula pantallas funcionales y notificaciones.", "oled_utils reutiliza fuentes, iconos y gráficos sin mezclar lógica de sensores.", "ssd1306 es la última capa y no debe decidir navegación."] },
          { title: "Identidad y sincronización", body: "screen_codes define IDs estables. Cuando cambia pantalla o selección, uner_app publica 0x95/0x96 para que Web y Qt repliquen el estado sin inferirlo.", bullets: ["El payload de pantalla incluye screen_code little-endian y source.", "La selección añade índice y cantidad de ítems.", "Un control remoto debe validar que el screenCode enviado coincida con el actual."] },
          { title: "Evidencia por pantalla", body: "Cada ficha F4 debe incluir función render, screenCode, fuente que la abre, entradas dinámicas, timeout si es transitoria y foto de la OLED real comparada con el preview Web.", bullets: ["Capturar brillo/contraste en condiciones repetibles.", "Marcar truncamientos y límites de la fuente bitmap.", "Registrar frecuencia I2C y política aplicada cuando afecte al MPU."] },
        ],
        flow: [
          { layer: "Estado", title: "Aplicación / menú", detail: "Selecciona pantalla y datos de entrada.", reference: "FirmwareF4/Core/Src/menusystem.c" },
          { layer: "Vista", title: "screenWrappers", detail: "Expone renderizadores por caso funcional.", reference: "FirmwareF4/Core/Src/screenWrappers.c" },
          { layer: "Dibujo", title: "oled_utils", detail: "Compone texto, iconos, barras y menús.", reference: "FirmwareF4/Core/Src/oled_utils.c" },
          { layer: "Hardware", title: "ssd1306", detail: "Envía framebuffer por el bus I2C.", reference: "FirmwareF4/Core/Src/ssd1306.c" },
        ],
        media: f4Visual("Estado → wrapper → framebuffer", "OLED física y conexión I2C", "Comparativa OLED real / preview Web"),
        references: [
          { label: "Wrappers", path: "FirmwareF4/Core/Src/screenWrappers.c", note: "Pantallas funcionales." },
          { label: "Dibujo", path: "FirmwareF4/Core/Src/oled_utils.c", note: "Primitivas y layouts OLED." },
          { label: "Códigos", path: "FirmwareF4/Core/Inc/screen_codes.h", note: "Identidad estable de pantallas." },
        ],
      },
    },
  },
  {
    slug: "mpu",
    title: "MPU",
    kicker: "Sensado",
    variants: {
      web: {
        summary: "Control del stream MPU, decodificación de Euler y una única fuente de estado para panel, gráfica y escena 3D.",
        scope: "EstadoSection arma frames UNER v2, los encapsula como stmPacket, reconstruye tramas parciales y demultiplexa ACK y eventos 0x90. La interfaz también ofrece emulación, cero, freeze y separación entre pose recibida y pose renderizada.",
        sections: [
          { title: "Sesión de telemetría", body: "La UI inicia o actualiza el stream con 0x61, lo detiene con 0x62 y controla pending/ACK/timeout. El periodo web se normaliza antes de serializar little-endian.", bullets: ["El parser incremental conserva fragmentos entre mensajes WebSocket.", "packetsReceived, lastSeq, flags y último frame permiten diagnosticar la sesión.", "Cambiar a emulación o perder el enlace debe cerrar el estado de stream real."] },
          { title: "Transformación de datos", body: "El snapshot se convierte a un modelo MpuSnapshot y de allí a Euler. zeroOffset se resta sin alterar la muestra original; renderLink y freezePose deciden si la escena sigue o conserva una pose.", bullets: ["Panel numérico, tendencia y modelo comparten el mismo Euler efectivo.", "La orientación 3D usa yaw, pitch y roll con un orden explícito.", "sampleDtUs y secuencia ayudan a distinguir movimiento real de pérdida de paquetes."] },
          { title: "Nota de contrato", body: "Web, ESP y F4 comparten el snapshot de 42 bytes con nueve float32, clamp 20..1000 ms y flags estables. El yaw es magnético relativo cuando AK8963 es válido.", bullets: ["No ocultar diferencias de ejes detrás de una visualización que parece moverse.", "Capturar frame hex y longitud junto a toda prueba.", "Panel, gráfico y modelo usan la misma referencia puesta a cero."] },
        ],
        flow: [
          { layer: "Control", title: "EstadoSection", detail: "Inicia, actualiza o detiene la sesión MPU.", reference: "src/pages/EstadoSection.tsx" },
          { layer: "Frame", title: "UnerFrameV2", detail: "Construye y parsea tramas con ruta y checksum.", reference: "src/api/UnerFrameV2.ts" },
          { layer: "Bridge", title: "WebSocketContext", detail: "Transporta stmPacket.payload.data.", reference: "src/contexts/WebSocketContext.tsx" },
          { layer: "Visual", title: "MpuIrScene3D", detail: "Consume Euler efectivo y controles de cámara.", reference: "src/components/MpuIrScene3D.tsx" },
        ],
        media: webVisual("Abrir MPU + IR", "/statics", "0x61/0x90 → Euler → escena", "Orientación fusionada del MPU9250"),
        references: [
          { label: "Pantalla", path: "src/pages/EstadoSection.tsx", note: "Sesión, decoder y estado Euler." },
          { label: "Contrato Web", path: "docs/telemetry-session-protocol.md", note: "Layout y modos de captura." },
          { label: "Frames", path: "src/api/UnerFrameV2.ts", note: "Builder y parser incremental." },
        ],
      },
      f4: {
        summary: "Muestreo MPU9250 + AK8963, fusión 9DoF, snapshot local, publicación UNER y coordinación del bus I2C con OLED.",
        scope: "La F4 muestrea el sensor según su runtime; el period_ms del stream regula publicación, no adquisición. La documentación debe separar driver, snapshot, servicio periódico y política del I2C manager.",
        sections: [
          { title: "Adquisición y autoridad", body: "mpu9250 posee la lectura, calibración y fusión. app_tasks inicializa y actualiza el subsistema; uner_app sólo toma un snapshot consistente y lo serializa para el solicitante.", bullets: ["Un stream no debe reinicializar el sensor.", "NO_VALID_SAMPLE se reporta en vez de inventar ceros válidos.", "El bit magValid distingue yaw magnético de una muestra sin referencia AK8963."] },
          { title: "Publicación multitransporte", body: "SET_MPU_STREAM asocia actividad, periodo, transport_id y nodo destino. UNER_App_ServiceMpuStream publica 0x90 al requester por UART1_ESP o USB_CDC.", bullets: ["Cerrar DTR detiene streams USB asociados.", "Web y Qt comparten comando pero usan nodos de origen distintos.", "La respuesta vuelve por el mismo transporte que originó la orden."] },
          { title: "I2C y pruebas", body: "OLED y MPU comparten I2C; SET/GET_I2C_POLICY permite priorizar uno u otro sin confundir política de bus con frecuencia de stream.", bullets: ["Documentar tasa de muestreo real y tasa de publicación por separado.", "Probar quietud, giro controlado, calibración y error de sensor.", "Adjuntar orientación XYZ sobre una foto del montaje."] },
        ],
        flow: [
          { layer: "Hardware", title: "MPU9250 + AK8963", detail: "Produce muestras 9DoF y estado de calibración.", reference: "FirmwareF4/Core/Src/mpu9250.c" },
          { layer: "Orquestación", title: "app_tasks", detail: "Actualiza el subsistema dentro del runtime.", reference: "FirmwareF4/Core/Src/app_tasks.c" },
          { layer: "Snapshot", title: "UNER_App_BuildMpuSnapshotPayload", detail: "Serializa una muestra coherente.", reference: "FirmwareF4/Core/Src/uner_app.c" },
          { layer: "Evento", title: "MPU_STREAM 0x90", detail: "Publica al nodo y transporte solicitante.", reference: "FirmwareF4/Docs/f4_esp_web_protocol.md" },
        ],
        media: f4Visual("MPU9250 → fusión 9DoF → 0x90", "Orientación XYZ y norte magnético", "Captura de stream y prueba de interferencia"),
        references: [
          { label: "Driver", path: "FirmwareF4/Core/Src/mpu9250.c", note: "Adquisición, magnetómetro y fusión." },
          { label: "Dispatcher", path: "FirmwareF4/Core/Src/uner_app.c", note: "Handlers y servicio de stream." },
          { label: "Contrato", path: "FirmwareF4/Docs/f4_esp_web_protocol.md", note: "Payload y transportes permitidos." },
        ],
      },
    },
  },
  {
    slug: "ir",
    title: "IR",
    kicker: "Sensores",
    variants: {
      web: {
        summary: "Ocho canales IR, stream 0x91, separación MPU/IR y visualización conjunta de línea y obstáculos.",
        scope: "La misma pantalla sensora mantiene estado, periodo y emulación independientes para IR. También TrackFollowerSection reutiliza el snapshot para proyectar pista y obstáculos, por lo que el decoder es un contrato compartido.",
        sections: [
          { title: "Contrato visible", body: "La UI arma 0x6B/0x6C, acepta snapshot 0x6A y decodifica 56 bytes de 0x91 en raw, norm, patrón de línea, alineación, confianza y error lateral.", bullets: ["El periodo se limita a 20..1000 ms.", "Los ocho canales conservan un orden fijo por pin y función.", "MPU e IR pueden convivir porque se demultiplexan por cmd_id."] },
          { title: "Dos consumidores", body: "EstadoSection representa barras, sensores de piso y obstáculos alrededor del auto. TrackFollowerSection integra observaciones válidas en un mapa 3D y cuenta gaps o pérdidas de línea.", bullets: ["Ambas pantallas deben usar el mismo IR_SENSOR_ORDER.", "La emulación se marca como fuente distinta de la telemetría real.", "La confianza mínima evita convertir ruido en geometría de pista."] },
          { title: "Evidencia y calibración", body: "La documentación visual necesita una foto cenital con la posición de cada sensor, tabla blanco/negro por condición de luces y capturas para línea centrada, desviada, ancha y perdida.", bullets: ["Guardar raw y norm; no conservar sólo la barra renderizada.", "Indicar sensibilidad visual y umbral usado por la escena.", "Registrar luz ambiente, altura y superficie durante la prueba."] },
        ],
        flow: [
          { layer: "Sesión", title: "EstadoSection / TrackFollower", detail: "Solicitan y consumen el stream IR.", reference: "src/pages/EstadoSection.tsx" },
          { layer: "Contrato", title: "decodeIrSnapshot", detail: "Convierte 56 bytes al modelo compartido.", reference: "src/api/UnerFrameV2.ts" },
          { layer: "Estado", title: "IrSnapshot", detail: "Separa raw, normalizado y geometría de línea.", reference: "src/api/UnerFrameV2.ts" },
          { layer: "Salida", title: "Escena / mapa", detail: "Representa proximidad, piso y recorrido.", reference: "src/pages/TrackFollowerSection.tsx" },
        ],
        media: webVisual("Abrir MPU + IR", "/statics", "0x91 → decoder → dos pantallas", "Ubicación de los 8 TCRT5000"),
        references: [
          { label: "Contrato", path: "docs/ir-session-protocol.md", note: "Payload, orden, runtime vigente y frontera para cambiar el transporte web." },
          { label: "Calibracion y localizacion", path: "docs/ir-object-calibration-and-localization.md", note: "Banco de muestras, perfil versionado, simulacion y estimacion de objetos." },
          { label: "Decoder", path: "src/api/UnerFrameV2.ts", note: "Modelo compartido de 56 bytes." },
          { label: "Mapa", path: "src/pages/TrackFollowerSection.tsx", note: "Consumidor de línea y obstáculos." },
        ],
      },
      f4: {
        summary: "ADC1 DMA, semántica TCRT5000, normalización por polaridad, seguimiento de línea y stream IR independiente.",
        scope: "La F4 mantiene ADC por DMA desde APP_Init; activar telemetría no enciende ni apaga el conversor. tcrt5000 transforma el buffer físico en semántica de línea/objetos y uner_app publica la última muestra disponible.",
        sections: [
          { title: "Orden físico", body: "El buffer ADC de ocho posiciones es parte del contrato. Tres sensores de línea usan pull-up y cinco sensores de objeto pull-down; la normalización invierte sólo los canales que corresponde.", bullets: ["Cambiar ranks ADC obliga a actualizar enum, tablas y documentación.", "TCRT5000 no configura ADC, DMA ni GPIO.", "Luces_IR se lee como estado y no se controla desde SET_IR_STREAM."] },
          { title: "Interpretación", body: "tcrt5000 ofrece raw por ID, valor normalizado, perfiles de umbral y TCRT5000_RouteSample para alinear pista. oled_utils y UNER consumen esa semántica sin duplicar polaridades.", bullets: ["Perfiles distintos cubren luces IR encendidas o apagadas.", "line_pattern codifica izquierda, centro y derecha.", "Alineación y error lateral deben permanecer coherentes entre OLED, Web y control."] },
          { title: "Servicio de stream", body: "UNER_App_ServiceIrStream conserva active, transport_id, dst_node, periodo, secuencia y próximo vencimiento. 0x6A toma snapshot puntual; 0x6B/0x6C gobiernan sólo publicación.", bullets: ["IR 0x91 y MPU 0x90 tienen estados independientes.", "El periodo permitido es 20..1000 ms.", "Cerrar el transporte debe limpiar su stream para evitar tráfico huérfano."] },
        ],
        flow: [
          { layer: "Muestreo", title: "ADC1 + DMA", detail: "Actualiza sensor_raw_data de forma circular.", reference: "FirmwareF4/Core/Src/app_tasks.c" },
          { layer: "Semántica", title: "tcrt5000", detail: "Aplica orden, polaridad, umbrales y alineación.", reference: "FirmwareF4/Core/Src/tcrt5000.c" },
          { layer: "Aplicación", title: "Control / OLED", detail: "Consume lectura interpretada localmente.", reference: "FirmwareF4/Core/Src/oled_utils.c" },
          { layer: "Telemetría", title: "IR_STREAM 0x91", detail: "Publica snapshot al requester remoto.", reference: "FirmwareF4/Core/Src/uner_app.c" },
        ],
        media: f4Visual("ADC DMA → TCRT5000 → 0x91", "Mapa de pines y sensores bajo el chasis", "Matriz raw/norm sobre superficies reales"),
        references: [
          { label: "Librería", path: "FirmwareF4/Core/Src/tcrt5000.c", note: "Orden y normalización." },
          { label: "Guía", path: "FirmwareF4/Docs/tcrt5000.md", note: "Pines, perfiles y API." },
          { label: "Stream", path: "FirmwareF4/Core/Src/uner_app.c", note: "Snapshot y publicación 0x91." },
        ],
      },
    },
  },
  {
    slug: "menu-system",
    title: "Menu System",
    kicker: "UX",
    variants: {
      web: {
        summary: "Rutas protegidas, encabezado contextual, selectores segmentados, modales globales y réplica navegable de la UI F4.",
        scope: "La documentación Web distingue navegación de la aplicación, selección interna de herramientas y navegación remota del OLED. RootLayout y App resuelven rutas; PageHeader concentra accesos; los providers sostienen estado transversal.",
        sections: [
          { title: "Navegación principal", body: "App define rutas protegidas para dashboard, WiFi, sensores, control, pista, UNER Studio, Docs y editor. PageHeader deriva título y acciones según pathname y permite transiciones visuales.", bullets: ["Docs y UNER Studio se enlazan de forma contextual.", "Protocol/OLED y Firmware Web/F4 son selectores internos, no nuevas páginas aisladas.", "La URL conserva el selector para que un enlace compartido abra la misma perspectiva."] },
          { title: "Estado transversal", body: "Los providers se anidan desde WebSocket hacia auth, protocolo, modo del auto, pantalla, OLED guardadas y modales. Esta jerarquía permite que una solicitud WiFi o de pantalla aparezca aunque el usuario esté en otra ruta.", bullets: ["WebSocketContext es la base de mensajes JSON y bytes.", "ScreenContext y CarModeContext derivan estado de la F4.", "Los modales globales no deben duplicar listeners por página."] },
          { title: "Réplica remota", body: "ScreenStreamWorkspace traduce screenCode a un builder web y envía inputs remotos con el screenCode actual. La confirmación llega por screen.changed/current; un ACK de transporte no basta.", bullets: ["PIN y grant mantienen una máquina de estados visible.", "Cambios de selección usan 0x96 para sincronizar cursor y cantidad.", "Toda acción remota debe exponer pendiente, éxito confirmado y error."] },
        ],
        flow: [
          { layer: "Router", title: "App", detail: "Selecciona página y protección de acceso.", reference: "src/App.tsx" },
          { layer: "Shell", title: "RootLayout + PageHeader", detail: "Compone encabezado y acciones globales.", reference: "src/components/PageHeader.tsx" },
          { layer: "Contextos", title: "Providers", detail: "Comparten enlace, pantalla, modo y persistencia.", reference: "src/main.tsx" },
          { layer: "Remoto", title: "ScreenStreamWorkspace", detail: "Opera y refleja la navegación OLED de F4.", reference: "src/components/ScreenStreamWorkspace.tsx" },
        ],
        media: webVisual("Abrir Dashboard", "/home", "Ruta → provider → módulo", "Flujo remoto junto al encoder físico"),
        references: [
          { label: "Router", path: "src/App.tsx", note: "Mapa de rutas protegidas." },
          { label: "Providers", path: "src/main.tsx", note: "Jerarquía de estado compartido." },
          { label: "Header", path: "src/components/PageHeader.tsx", note: "Acciones contextuales." },
        ],
      },
      f4: {
        summary: "Definición de menús, navegación por encoder/botones, wrappers, permisos y sincronización con clientes remotos.",
        scope: "La F4 controla la navegación local. menu_definition declara opciones y destinos; menusystem mantiene selección/página; screenWrappers renderiza; screen_lock y eventos UNER coordinan permisos y observadores remotos.",
        sections: [
          { title: "Definición y estado", body: "menu_definition describe ítems y destinos sin mezclarlos con el dibujo. menusystem aplica rotación, click, regreso, paginado y transición de pantalla.", bullets: ["La disponibilidad puede depender de capabilities del backend ESP.", "Si WEB cambia a AT, pantallas que requieren REMOTE_UI deben cerrarse.", "screenCode identifica destino; índice identifica posición dentro del menú."] },
          { title: "Entradas locales y remotas", body: "Encoder y botones físicos generan eventos locales. Los comandos 0x53..0x58 permiten equivalentes remotos, pero incluyen screenCode para rechazar acciones sobre una pantalla que ya cambió.", bullets: ["Validar pantalla evita clicks tardíos o fuera de contexto.", "La respuesta ACK informa recepción; 0x95/0x96 confirma el nuevo estado.", "USB CDC y WEB pueden compartir el flujo cuando el comando admite ambos transportes."] },
          { title: "Permisos", body: "screen_lock modela ingreso, espera, denegación, timeout y bloqueo. F4 valida PIN y screenCode dentro de una única operación scope 1.", bullets: ["Esperar la response final de F4 antes de cerrar el modal.", "No enviar un segundo grant legacy.", "Documentar cada estado de error con screenCode y recuperación posible."] },
        ],
        flow: [
          { layer: "Catálogo", title: "menu_definition", detail: "Declara ítems, capacidades y destinos.", reference: "FirmwareF4/Core/Src/menu_definition.c" },
          { layer: "Máquina", title: "menusystem", detail: "Procesa input, selección, página y back.", reference: "FirmwareF4/Core/Src/menusystem.c" },
          { layer: "Seguridad", title: "screen_lock", detail: "Controla permisos y transiciones protegidas.", reference: "FirmwareF4/Core/Src/screen_lock.c" },
          { layer: "Sincronización", title: "Eventos 0x95/0x96", detail: "Publican pantalla y selección a Web/Qt.", reference: "FirmwareF4/Core/Src/uner_app.c" },
        ],
        media: f4Visual("Entrada → menú → wrapper → evento", "Encoder, botones y OLED", "Secuencia completa de permiso"),
        references: [
          { label: "Definición", path: "FirmwareF4/Core/Src/menu_definition.c", note: "Catálogo de menús." },
          { label: "Motor", path: "FirmwareF4/Core/Src/menusystem.c", note: "Navegación y selección." },
          { label: "Bloqueo", path: "FirmwareF4/Core/Src/screen_lock.c", note: "Permisos y PIN." },
        ],
      },
    },
  },
  {
    slug: "render-3d",
    title: "Render 3D",
    kicker: "Visualización",
    variants: {
      web: {
        summary: "Escenas Three.js para orientación, sensores, pista y simulación de movimiento usando modelos GLB comprimidos.",
        scope: "La visualización 3D no es una fuente de verdad: proyecta estado de telemetría o simulación. Cada escena debe documentar entradas, transformaciones, cámara, límites y fallback de carga.",
        sections: [
          { title: "Assets y carga", body: "Los modelos viven en public/models y se cargan con GLTFLoader; DRACOLoader resuelve la compresión desde public/draco. Suspense y estados de error protegen la interfaz mientras llega el asset.", bullets: ["Registrar nombre, tamaño y revisión del GLB.", "Mantener decoder Draco junto al build offline.", "No cambiar escala u orientación sin anotar la transformación base."] },
          { title: "Escenas consumidoras", body: "MpuIrScene3D representa Euler, rayos IR, piso y helpers; ControlSection integra una pose simulada; TrackFollowerSection proyecta puntos de línea y obstáculos.", bullets: ["Cada escena declara si su fuente es real o emulada.", "Cámaras top, iso, chase u orbit responden a objetivos distintos.", "Freeze, grid y origen son herramientas de diagnóstico, no datos del sensor."] },
          { title: "Validación visual", body: "Una captura útil combina pose conocida, valores numéricos y cámara identificada. Para verificar orientación se necesitan casos cero, +90° por eje y retorno al origen.", bullets: ["Comparar la escena con una foto física del auto.", "Registrar FPS y degradación en dispositivos modestos.", "Mantener un fallback textual si el modelo no carga."] },
        ],
        flow: [
          { layer: "Dato", title: "Telemetría / simulador", detail: "Produce Euler, pose, línea u obstáculos.", reference: "src/pages/EstadoSection.tsx" },
          { layer: "Adaptador", title: "Estado de escena", detail: "Normaliza unidades y decide fuente activa.", reference: "src/components/MpuIrScene3D.tsx" },
          { layer: "Asset", title: "GLTF + Draco", detail: "Carga geometría optimizada desde public.", reference: "public/models/auto_micro.glb" },
          { layer: "Vista", title: "Canvas / cámaras", detail: "Renderiza y permite inspección controlada.", reference: "src/components/CameraRig.tsx" },
        ],
        media: webVisual("Abrir Seguidor de pista", "/seguidor-pista", "Dato → transformación → escena", "Auto real en la misma pose de referencia"),
        references: [
          { label: "Hub", path: "src/components/MpuIrScene3D.tsx", note: "Escena combinada MPU/IR." },
          { label: "Modelo", path: "public/models/auto_micro.glb", note: "Asset principal." },
          { label: "Cámara", path: "src/components/CameraRig.tsx", note: "Seguimiento y presets." },
        ],
      },
      f4: {
        summary: "Datos y convenciones que F4 debe publicar para que una escena remota represente el vehículo sin inventar estado.",
        scope: "F4 no renderiza Three.js. Su responsabilidad documental es definir marcos de referencia, unidades, temporalidad, validez y secuencia de los datos que la Web convierte en una escena.",
        sections: [
          { title: "Contrato espacial", body: "Documentar ejes físicos del chasis, orientación del MPU, signo de giro, origen de distancia y orden de sensores. Sin esa convención, un modelo visualmente atractivo puede estar técnicamente invertido.", bullets: ["Relacionar X/Y/Z del sensor con frente/izquierda/arriba del auto.", "Distinguir grados, milideg, g, mg, dps y mdps.", "Definir qué pose corresponde al cero después de calibrar."] },
          { title: "Temporalidad y validez", body: "sample_seq, tick, sample_dt y flags permiten decidir si actualizar, interpolar o marcar dato obsoleto. F4 debe publicar estado de error en vez de repetir silenciosamente una muestra inválida.", bullets: ["Secuencias detectan pérdida o reordenamiento.", "El periodo de publicación no equivale al periodo de adquisición.", "Desconexión o stop debe congelar con estado explícito, no aparentar tiempo real."] },
          { title: "Correlación física", body: "La documentación conjunta debe emparejar un snapshot F4 con foto/video del auto y captura de la escena. Así se verifican signo, escala, orientación y ubicación de obstáculos.", bullets: ["Usar poses y distancias medidas.", "Anotar build F4 y versión del modelo 3D.", "Conservar payload bruto para poder reproducir el render."] },
        ],
        flow: [
          { layer: "Sensor", title: "MPU / TCRT5000", detail: "Produce estado físico con unidades propias.", reference: "FirmwareF4/Core/Src/mpu6050.c" },
          { layer: "Snapshot", title: "uner_app", detail: "Empaqueta secuencia, tiempo, flags y valores.", reference: "FirmwareF4/Core/Src/uner_app.c" },
          { layer: "Transporte", title: "UNER v2", detail: "Entrega una muestra verificable a Web/Qt.", reference: "FirmwareF4/Docs/f4_esp_web_protocol.md" },
          { layer: "Consumidor", title: "Render Web", detail: "Aplica convenciones sin alterar la fuente física.", reference: "WebESP01AutoMicro2025/src/components/MpuIrScene3D.tsx" },
        ],
        media: f4Visual("Marco físico → snapshot → render", "Ejes dibujados sobre el chasis", "Payload y pose real sincronizados"),
        references: [
          { label: "MPU", path: "FirmwareF4/Core/Src/mpu6050.c", note: "Origen de orientación y movimiento." },
          { label: "IR", path: "FirmwareF4/Core/Src/tcrt5000.c", note: "Origen espacial de línea y objetos." },
          { label: "Contrato", path: "FirmwareF4/Docs/f4_esp_web_protocol.md", note: "Unidades y payloads publicados." },
        ],
      },
    },
  },
  {
    slug: "pcb",
    title: "PCB",
    kicker: "Electrónica",
    variants: {
      web: {
        summary: "Vista documental del hardware desde sus consecuencias en la UI, el bridge, los estados y las pruebas remotas.",
        scope: "La Web no posee el esquemático, pero necesita conocer qué nodo, conector o sensor hay detrás de cada dato. Esta versión convierte el mapa de placa en información operativa: disponibilidad, diagnóstico y evidencia.",
        sections: [
          { title: "Mapa funcional para la UI", body: "Cada bloque físico se asocia a una pantalla y a un contrato: ESP con WebSocket/WiFi, F4 con UNER, MPU con Euler, TCRT5000 con IR, OLED con screenCode y motores con control.", bullets: ["Mostrar nodo propietario y transporte de cada dato.", "Relacionar conectores con síntomas visibles de desconexión.", "No exponer credenciales, PINs ni información sensible en capturas."] },
          { title: "Diagnóstico remoto", body: "Los estados de conexión, capabilities, flags de sensor y snapshots permiten orientar una revisión antes de medir la placa. La documentación debe aclarar hasta dónde llega esa inferencia.", bullets: ["Un ACK prueba transporte, no necesariamente actuación física.", "NO_VALID_SAMPLE diferencia sensor sin dato de valor cero.", "Fotos y mediciones siguen siendo necesarias para alimentación y señal."] },
          { title: "Paquete de evidencia", body: "Por revisión se requiere vista superior/inferior, conectores etiquetados, montaje en chasis, versión de firmware y una matriz que conecte señal física con pantalla/command ID.", bullets: ["Usar pies de foto con revisión y fecha.", "Ocultar claves o identificadores privados.", "Mantener la foto histórica cuando una nueva revisión cambie pinout."] },
        ],
        flow: [
          { layer: "Hardware", title: "PCB y periféricos", detail: "Generan señales, estado y actuación.", reference: "FirmwareF4" },
          { layer: "Firmware", title: "F4 / ESP", detail: "Convierten hardware en contratos remotos.", reference: "docs/web-esp-stm-readiness.md" },
          { layer: "Bridge", title: "WebSocket + UNER", detail: "Transportan estado y comandos.", reference: "src/contexts/WebSocketContext.tsx" },
          { layer: "Operador", title: "Pantallas Web", detail: "Presentan diagnóstico con límites explícitos.", reference: "src/pages/Home.tsx" },
        ],
        media: webVisual("Abrir Dashboard", "/home", "Bloque físico → contrato → pantalla", "PCB superior, inferior y montada"),
        references: [
          { label: "Readiness", path: "docs/web-esp-stm-readiness.md", note: "Cruce Web/ESP/STM." },
          { label: "Bridge", path: "docs/uner-websocket-events.md", note: "Envelope y frames." },
          { label: "Dashboard", path: "src/pages/Home.tsx", note: "Resumen operativo visible." },
        ],
      },
      f4: {
        summary: "Mapa de placa desde el microcontrolador: alimentación, buses, pines, periféricos y consecuencias de cada revisión sobre drivers y CubeMX.",
        scope: "La documentación F4 de PCB debe ser la referencia entre esquemático y software. Cada señal relevante se enlaza a inicialización HAL, driver consumidor, restricciones eléctricas y prueba de banco.",
        sections: [
          { title: "Bloques y buses", body: "La ficha de placa separa alimentación, MCU, ESP/UART, USB CDC, I2C OLED/MPU, ADC DMA TCRT5000, GPIO de luces y timers/puentes de motor.", bullets: ["Indicar tensión, dirección de señal y pull-up/pull-down.", "Marcar recursos compartidos como I2C y sus políticas.", "Relacionar cada periférico con el archivo de inicialización CubeMX."] },
          { title: "Pinout como contrato", body: "Los ranks ADC y pines de sensores determinan el orden del payload IR; UART1 define el bridge ESP; USB CDC abre el transporte PC_QT. Un cambio de placa puede romper contratos de alto nivel aunque compile.", bullets: ["Versionar pinout con la revisión de PCB.", "Actualizar enums/tablas si cambia el orden ADC.", "Verificar startup, linker y target antes de portar configuración."] },
          { title: "Revisión y fabricación", body: "Cada revisión debe incluir esquemático, layout, BOM, cambios, puntos de test, erratas, fotos y resultados eléctricos. Las modificaciones manuales se anotan sobre la unidad concreta.", bullets: ["Fotografiar jumpers, cortes o retrabajos.", "Medir rails y señales críticas antes de conectar actuadores.", "Vincular el build F4 validado con la revisión física probada."] },
        ],
        flow: [
          { layer: "Diseño", title: "Esquemático / PCB", detail: "Define conectividad y recursos físicos.", reference: "ProyectoAutoMicro2026_F411CEU6.ioc" },
          { layer: "Configuración", title: "CubeMX / HAL MSP", detail: "Asigna clocks, GPIO, DMA y periféricos.", reference: "FirmwareF4/Core/Src/stm32f4xx_hal_msp.c" },
          { layer: "Drivers", title: "MPU, OLED, IR, motores", detail: "Consumen los recursos de la placa.", reference: "FirmwareF4/Core/Src" },
          { layer: "Aplicación", title: "app_tasks + UNER", detail: "Expone comportamiento y diagnóstico verificable.", reference: "FirmwareF4/Core/Src/app_tasks.c" },
        ],
        media: f4Visual("PCB → HAL → driver → aplicación", "Placa superior/inferior con pinout", "Osciloscopio y puntos de test"),
        references: [
          { label: "Configuración", path: "FirmwareF4/ProyectoAutoMicro2026_F411CEU6.ioc", note: "Periféricos y pines F411." },
          { label: "MSP", path: "FirmwareF4/Core/Src/stm32f4xx_hal_msp.c", note: "Inicialización de bajo nivel." },
          { label: "Contrato", path: "FirmwareF4/Docs/f4_esp_web_protocol.md", note: "Relación física con transportes y nodos." },
        ],
      },
    },
  },
];

export function getDocTopic(slug?: string) {
  return DOC_TOPICS.find((topic) => topic.slug === slug);
}

export function getDocFirmwareTarget(value: string | null | undefined): DocFirmwareTarget {
  return value === "f4" ? "f4" : "web";
}

export function docsTargetSearch(target: DocFirmwareTarget): string {
  return `?firmware=${target}`;
}

export function docsTopicHref(slug: DocTopicSlug, target: DocFirmwareTarget): string {
  return `/docs/${slug}${docsTargetSearch(target)}`;
}

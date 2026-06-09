import type { ReactNode } from "react";

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

export interface DocTopic {
  slug: DocTopicSlug;
  title: string;
  kicker: string;
  summary: string;
  sections: DocTopicSection[];
}

export const DOC_TOPICS: DocTopic[] = [
  {
    slug: "motors",
    title: "Motores",
    kicker: "Control",
    summary:
      "Documentacion del control de traccion, comandos enviados y validaciones del flujo de motores.",
    sections: [
      {
        title: "Objetivo",
        body:
          "Esta documentacion concentra como gobernamos el movimiento del auto desde la web, que estados exponemos y que decisiones de interfaz ayudan a operar el sistema con rapidez.",
        bullets: [
          "Control manual de avance, retroceso y giro.",
          "Estados visibles para confirmar respuesta del sistema.",
          "Mapa de acciones para pruebas de banco y demostraciones.",
        ],
      },
      {
        title: "Piezas involucradas",
        body:
          "El modulo de motores cruza la pantalla de control, el protocolo UNER para las ordenes y la logica del firmware que interpreta los comandos sobre el hardware.",
        bullets: [
          "Vista web de Control de Motores.",
          "Frames UNER asociados al movimiento.",
          "Firmware STM32 y capa de actuacion final.",
        ],
      },
      {
        title: "Checklist de desarrollo",
        body:
          "Cada cambio nuevo deberia dejar registrada la accion agregada, el frame esperado y el resultado observado en pruebas con el auto o en banco.",
        bullets: [
          "Anotar comando, payload y checksum si aplica.",
          "Registrar limites, tiempos y bloqueos de seguridad.",
          "Guardar capturas o notas de comportamiento real.",
        ],
      },
    ],
  },
  {
    slug: "oled",
    title: "OLED",
    kicker: "Pantallas",
    summary:
      "Flujo del OLED Studio, assets monocromos, guardado de pantallas y representacion fiel al firmware.",
    sections: [
      {
        title: "Pipeline visual",
        body:
          "La documentacion del OLED describe como se disena una pantalla, como se guarda en contexto y como se reutiliza despues en previews y envios al auto.",
        bullets: [
          "Editor estilo Lopaka de 128x64.",
          "Previsualizacion compartida entre editor y stream OLED.",
          "Pantallas guardadas para recarga y reenvio.",
        ],
      },
      {
        title: "Assets y texto",
        body:
          "El objetivo es que la representacion web sea lo mas cercana posible a la salida real del display, incluyendo iconos y texto bitmap.",
        bullets: [
          "Biblioteca draft de bitmaps del proyecto.",
          "Render de texto usando la fuente real del firmware.",
          "Capas y herramientas visuales para mover o ajustar elementos.",
        ],
      },
      {
        title: "Pendientes naturales",
        body:
          "A medida que el estudio OLED madure, esta seccion deberia registrar nuevos formatos, comandos de envio reales y convenciones para organizar assets.",
        bullets: [
          "Definir empaquetado final de pantallas hacia el auto.",
          "Catalogar pantallas por feature y version.",
          "Agregar notas de limitaciones del display fisico.",
        ],
      },
    ],
  },
  {
    slug: "mpu",
    title: "MPU",
    kicker: "Sensado",
    summary:
      "Lecturas del acelerometro y giroscopio, visualizacion en la web y notas para calibracion.",
    sections: [
      {
        title: "Que cubre",
        body:
          "La documentacion del MPU reune las lecturas crudas, la interpretacion que hacemos en la interfaz y las condiciones de prueba para asegurar datos utiles.",
        bullets: [
          "Ejes y magnitudes relevantes.",
          "Frecuencia de refresco esperada.",
          "Conversores o filtros aplicados si existen.",
        ],
      },
      {
        title: "Interfaz y lectura",
        body:
          "El panel debe dejar claro que valores vemos, con que estabilidad llegan y en que situaciones sirven para depurar movimiento o postura del vehiculo.",
        bullets: [
          "Estados visibles en la pantalla de MPU + IR.",
          "Indicadores para datos validos e invalidos.",
          "Contexto de uso durante pruebas del auto.",
        ],
      },
      {
        title: "Calibracion y pruebas",
        body:
          "Cada ajuste o compensacion del sensor deberia quedar explicado aca junto con el procedimiento usado para verificarlo.",
        bullets: [
          "Condicion inicial del equipo.",
          "Pasos de calibracion o cero.",
          "Resultados medidos despues del ajuste.",
        ],
      },
    ],
  },
  {
    slug: "ir",
    title: "IR",
    kicker: "Sensores",
    summary:
      "Documentacion del subsistema infrarrojo, criterios de lectura y referencia para depurar deteccion.",
    sections: [
      {
        title: "Rol en el sistema",
        body:
          "El bloque IR deberia explicar que detecta, para que escenarios lo usamos y como se exponen esas senales en la aplicacion web.",
        bullets: [
          "Lectura de presencia o bordes segun el montaje.",
          "Visualizacion en tiempo real dentro de la app.",
          "Relaciones con estados de conduccion o seguridad.",
        ],
      },
      {
        title: "Flujo de integracion",
        body:
          "Las notas tecnicas tienen que unir hardware, firmware y front para que podamos seguir una lectura desde el sensor hasta el componente visual.",
        bullets: [
          "Origen de la lectura en el microcontrolador.",
          "Payload o estructura que llega a la web.",
          "Representacion final para el usuario.",
        ],
      },
      {
        title: "Casos de prueba",
        body:
          "Conviene mantener una lista corta de escenarios de prueba para comparar comportamiento despues de cada cambio de codigo o electronica.",
        bullets: [
          "Sensor libre, obstruido y con ruido.",
          "Respuesta ante cambios rapidos.",
          "Notas de sensibilidad y distancia util.",
        ],
      },
    ],
  },
  {
    slug: "menu-system",
    title: "Menu System",
    kicker: "UX",
    summary:
      "Arquitectura de navegacion, modales, selectores y reglas visuales para sostener una experiencia coherente.",
    sections: [
      {
        title: "Arquitectura",
        body:
          "Esta documentacion sirve para capturar como se organiza la app, que patrones de navegacion repetimos y por que ciertas decisiones mejoran la operacion diaria.",
        bullets: [
          "Paginas principales y relaciones entre ellas.",
          "Barras de accion, headers y accesos rapidos.",
          "Selectores segmentados y modales compartidos.",
        ],
      },
      {
        title: "Lenguaje visual",
        body:
          "Aca conviene registrar el estilo que queremos preservar: cards grandes, iconografia clara, contraste alto y feedback visual consistente.",
        bullets: [
          "Tarjetas del dashboard como patron base.",
          "Uso de outlines, hover y fondos translucidos.",
          "Componentes reutilizables entre estudios y paneles.",
        ],
      },
      {
        title: "Buenas practicas",
        body:
          "Cuando sumemos nuevas herramientas o estudios, este espacio tiene que ayudarnos a mantener la interfaz alineada con lo que ya funciona.",
        bullets: [
          "No duplicar navegacion innecesaria.",
          "Priorizar acciones frecuentes en primer plano.",
          "Documentar decisiones de UX junto con screenshots si hace falta.",
        ],
      },
    ],
  },
  {
    slug: "render-3d",
    title: "Render 3D",
    kicker: "Visualizacion",
    summary:
      "Espacio para la documentacion del modelo 3D, su integracion con la app y los datos que lo alimentan.",
    sections: [
      {
        title: "Alcance",
        body:
          "El render 3D debe documentar que representa, que informacion consume y como acompana el resto del sistema para mostrar estado o contexto.",
        bullets: [
          "Modelos o escenas disponibles.",
          "Datos de entrada que alteran la visualizacion.",
          "Objetivo de uso en demo, debug o monitoreo.",
        ],
      },
      {
        title: "Integracion",
        body:
          "Conviene dejar trazado como se conecta el render con el front, que librerias se usan y que limites de performance tenemos.",
        bullets: [
          "Componente o escena principal.",
          "Eventos o estados compartidos con otras pantallas.",
          "Consideraciones de rendimiento y fallback.",
        ],
      },
      {
        title: "Evolucion",
        body:
          "Como es un area que puede crecer mucho, esta pagina deberia servir para registrar hitos, escenas nuevas y decisiones de representacion.",
        bullets: [
          "Versionado de assets 3D.",
          "Cambios en camaras, materiales o interaccion.",
          "Pendientes antes de una integracion completa.",
        ],
      },
    ],
  },
  {
    slug: "pcb",
    title: "PCB",
    kicker: "Electronica",
    summary:
      "Lugar para documentar la placa, sus bloques funcionales, conectores y decisiones de ruteo o montaje.",
    sections: [
      {
        title: "Mapa de placa",
        body:
          "La documentacion PCB deberia resumir rapidamente que bloques tenemos, como se relacionan y donde se conectan con el resto del sistema.",
        bullets: [
          "Secciones de alimentacion, control y perifericos.",
          "Conectores importantes y su pinout.",
          "Relacion con sensores, display y actuadores.",
        ],
      },
      {
        title: "Checklist de revision",
        body:
          "Cada iteracion de la placa necesita una lista simple de verificacion para evitar olvidar cambios que impactan hardware y software.",
        bullets: [
          "Version y fecha del diseno.",
          "Cambios respecto a la revision anterior.",
          "Puntos de prueba y limitaciones conocidas.",
        ],
      },
      {
        title: "Archivos y fabricacion",
        body:
          "Tambien es util dejar claro donde viven los archivos fuente y que informacion hace falta para fabricar o montar la placa.",
        bullets: [
          "Esquematicos, layout y exportaciones.",
          "BOM y notas de ensamblado.",
          "Observaciones de soldadura o ajustes manuales.",
        ],
      },
    ],
  },
];

export function getDocTopic(slug?: string) {
  return DOC_TOPICS.find((topic) => topic.slug === slug);
}

export function renderDocTopicIcon(
  slug: DocTopicSlug,
  className = "size-24 md:size-32 transition-transform duration-300",
): ReactNode {
  switch (slug) {
    case "motors":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M7.5 4.5A4.5 4.5 0 0 0 3 9v6a1.5 1.5 0 0 0 1.5 1.5h2.379l1.5 2.25a.75.75 0 0 0 1.246-.832L8.4 16.5h7.2l-1.225 1.418a.75.75 0 0 0 1.136.98L17.121 16.5H19.5A1.5 1.5 0 0 0 21 15V9a4.5 4.5 0 0 0-4.5-4.5h-9Zm-1.125 4.125a1.125 1.125 0 1 1 0 2.25 1.125 1.125 0 0 1 0-2.25Zm11.25 0a1.125 1.125 0 1 1 0 2.25 1.125 1.125 0 0 1 0-2.25Z" />
        </svg>
      );
    case "oled":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M3.75 5.25A2.25 2.25 0 0 1 6 3h12a2.25 2.25 0 0 1 2.25 2.25v9A2.25 2.25 0 0 1 18 16.5H6a2.25 2.25 0 0 1-2.25-2.25v-9Zm1.5 0a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 .75.75v9A.75.75 0 0 1 18 15H6a.75.75 0 0 1-.75-.75v-9Z" />
          <path d="M7.5 18a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Zm1.5-10.5a.75.75 0 0 0-.75.75v3.75a.75.75 0 0 0 1.28.53l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06l-1.72-1.72 1.72-1.72a.75.75 0 0 0-1.06-1.06L11.25 9.19 9.53 7.47A.75.75 0 0 0 9 7.25Z" />
        </svg>
      );
    case "mpu":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path
            fillRule="evenodd"
            d="M6.75 3A3.75 3.75 0 0 0 3 6.75v10.5A3.75 3.75 0 0 0 6.75 21h10.5A3.75 3.75 0 0 0 21 17.25V6.75A3.75 3.75 0 0 0 17.25 3H6.75Zm3 4.5a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Zm4.5 1.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "ir":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M12 5.25c-4.836 0-8.58 2.65-10.4 6.162a1.25 1.25 0 0 0 0 1.176C3.42 16.1 7.164 18.75 12 18.75s8.58-2.65 10.4-6.162a1.25 1.25 0 0 0 0-1.176C20.58 7.9 16.836 5.25 12 5.25Zm0 9a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z" />
        </svg>
      );
    case "menu-system":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M4.5 5.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1-.75-.75Zm0 6a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1-.75-.75Zm0 6a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1-.75-.75Z" />
        </svg>
      );
    case "render-3d":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path
            fillRule="evenodd"
            d="M11.48 2.537a1.5 1.5 0 0 1 1.04 0l7.5 2.625A1.5 1.5 0 0 1 21 6.582v10.836a1.5 1.5 0 0 1-.98 1.42l-7.5 2.625a1.5 1.5 0 0 1-1.04 0l-7.5-2.625A1.5 1.5 0 0 1 3 17.418V6.582a1.5 1.5 0 0 1 .98-1.42l7.5-2.625ZM12 4.04 5.25 6.402 12 8.764l6.75-2.362L12 4.039Zm-7.5 3.954v8.895l6.75 2.362V10.356L4.5 7.994Zm8.25 11.257 6.75-2.362V7.994l-6.75 2.362v8.895Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "pcb":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M6 3.75A2.25 2.25 0 0 0 3.75 6v1.5a.75.75 0 0 0 1.5 0V6A.75.75 0 0 1 6 5.25h1.5a.75.75 0 0 0 0-1.5H6Zm10.5 0a.75.75 0 0 0 0 1.5H18a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 0 1.5 0V6A2.25 2.25 0 0 0 18 3.75h-1.5Zm-9 4.5A2.25 2.25 0 0 0 5.25 10.5v3A2.25 2.25 0 0 0 7.5 15.75h9A2.25 2.25 0 0 0 18.75 13.5v-3A2.25 2.25 0 0 0 16.5 8.25h-9Zm-3 8.25a.75.75 0 0 0-.75.75V18A2.25 2.25 0 0 0 6 20.25h1.5a.75.75 0 0 0 0-1.5H6a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 0-.75-.75Zm15 0a.75.75 0 0 0-.75.75V18a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 0 0 1.5H18A2.25 2.25 0 0 0 20.25 18v-1.5a.75.75 0 0 0-.75-.75Z" />
        </svg>
      );
  }
}

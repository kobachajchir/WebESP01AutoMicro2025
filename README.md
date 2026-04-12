# Web ESP01 Auto Micro 2025

## Reinicios desde la configuracion principal

La configuracion de la pagina principal emite paquetes WebSocket JSON a la ESP. La web no manda bytes binarios crudos; cuando el destino logico es la STM, el mensaje viaja como `stmPacket` con los bytes en `payload.data`:

- `Reiniciar ESP`: envia `{"type":"stmPacket","payload":{"action":"resetEsp","cmd":"CMD_REBOOT_ESP","data":[85,78,69,82,0,58,2,33,22,3]}}`.
  - `CMD_REBOOT_ESP = 0x16`, ruta `0x21` (`src=0x02`, `dst=0x01`).
  - Frame UNER equivalente: `55 4E 45 52 00 3A 02 21 16 03`.
  - Es normal perder el enlace WebSocket si el firmware termina reiniciando la ESP.

- `Reiniciar STM32`: envia `{"type":"stmPacket","payload":{"action":"resetMcu","cmd":"CMD_RESET_MCU","data":[85,78,69,82,0,58,2,33,25,12]}}`.
  - `CMD_RESET_MCU = 0x19`, ruta `0x21` (`src=0x02`, `dst=0x01`).
  - Frame UNER equivalente: `55 4E 45 52 00 3A 02 21 19 0C`.
  - Es normal perder comunicacion mientras la STM32 reinicia.

Mas detalle: [docs/uner-websocket-events.md](docs/uner-websocket-events.md).

## Comandos ESP pendientes de firmware

La web usa dos comandos UNER nuevos para preferencias persistidas en NVS:

- `CMD.APP_PIN_CONFIG = 0x60`
  - Validar PIN actual: payload `[0x01, pin_ascii_4]`.
  - Cambiar PIN: payload `[0x02, pin_actual_ascii_4, pin_nuevo_ascii_4]`.
  - ACK esperado: respuesta con el mismo `CMD.APP_PIN_CONFIG` y payload `[action, code]`.

- `CMD.APP_THEME_CONFIG = 0x61`
  - Guardar tema: payload `[base_r, base_g, base_b, accent_r, accent_g, accent_b]`.
  - ACK esperado: respuesta con el mismo `CMD.APP_THEME_CONFIG` y payload `[code]`.

Codigos de ACK usados por la web: `0 = OK`, `1 = INVALID_PIN`, `2 = ARG`, `3 = SAVE_FAIL`, `4 = BUSY`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

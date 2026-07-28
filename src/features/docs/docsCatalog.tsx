import type { ReactNode } from "react";
import type { DocTopicSlug } from "./docsContent";

export type { DocTopicSlug } from "./docsContent";
export {
  DOC_FIRMWARE_PROFILES,
  DOC_TOPICS,
  docsTargetSearch,
  docsTopicHref,
  getDocFirmwareTarget,
  getDocTopic,
} from "./docsContent";

export function renderDocTopicIcon(
  slug: DocTopicSlug,
  className = "size-24 md:size-32 transition-transform duration-300",
): ReactNode {
  switch (slug) {
    case "motors":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M7.5 4.5A4.5 4.5 0 0 0 3 9v6a1.5 1.5 0 0 0 1.5 1.5h2.379l1.5 2.25a.75.75 0 0 0 1.246-.832L8.4 16.5h7.2l-1.225 1.418a.75.75 0 0 0 1.136.98L17.121 16.5H19.5A1.5 1.5 0 0 0 21 15V9a4.5 4.5 0 0 0-4.5-4.5h-9Zm-1.125 4.125a1.125 1.125 0 1 1 0 2.25 1.125 1.125 0 0 1 0-2.25Zm11.25 0a1.125 1.125 0 1 1 0 2.25 1.125 1.125 0 0 1 0-2.25Z" />
        </svg>
      );
    case "oled":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M3.75 5.25A2.25 2.25 0 0 1 6 3h12a2.25 2.25 0 0 1 2.25 2.25v9A2.25 2.25 0 0 1 18 16.5H6a2.25 2.25 0 0 1-2.25-2.25v-9Zm1.5 0a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 .75.75v9A.75.75 0 0 1 18 15H6a.75.75 0 0 1-.75-.75v-9Z" />
          <path d="M7.5 18a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Zm1.5-10.5a.75.75 0 0 0-.75.75v3.75a.75.75 0 0 0 1.28.53l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06l-1.72-1.72 1.72-1.72a.75.75 0 0 0-1.06-1.06L11.25 9.19 9.53 7.47A.75.75 0 0 0 9 7.25Z" />
        </svg>
      );
    case "mpu":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path fillRule="evenodd" d="M6.75 3A3.75 3.75 0 0 0 3 6.75v10.5A3.75 3.75 0 0 0 6.75 21h10.5A3.75 3.75 0 0 0 21 17.25V6.75A3.75 3.75 0 0 0 17.25 3H6.75Zm3 4.5a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Zm4.5 1.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
        </svg>
      );
    case "ir":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 5.25c-4.836 0-8.58 2.65-10.4 6.162a1.25 1.25 0 0 0 0 1.176C3.42 16.1 7.164 18.75 12 18.75s8.58-2.65 10.4-6.162a1.25 1.25 0 0 0 0-1.176C20.58 7.9 16.836 5.25 12 5.25Zm0 9a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z" />
        </svg>
      );
    case "menu-system":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M4.5 5.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1-.75-.75Zm0 6a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1-.75-.75Zm0 6a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1-.75-.75Z" />
        </svg>
      );
    case "render-3d":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path fillRule="evenodd" d="M11.48 2.537a1.5 1.5 0 0 1 1.04 0l7.5 2.625A1.5 1.5 0 0 1 21 6.582v10.836a1.5 1.5 0 0 1-.98 1.42l-7.5 2.625a1.5 1.5 0 0 1-1.04 0l-7.5-2.625A1.5 1.5 0 0 1 3 17.418V6.582a1.5 1.5 0 0 1 .98-1.42l7.5-2.625ZM12 4.04 5.25 6.402 12 8.764l6.75-2.362L12 4.039Zm-7.5 3.954v8.895l6.75 2.362V10.356L4.5 7.994Zm8.25 11.257 6.75-2.362V7.994l-6.75 2.362v8.895Z" clipRule="evenodd" />
        </svg>
      );
    case "pcb":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M6 3.75A2.25 2.25 0 0 0 3.75 6v1.5a.75.75 0 0 0 1.5 0V6A.75.75 0 0 1 6 5.25h1.5a.75.75 0 0 0 0-1.5H6Zm10.5 0a.75.75 0 0 0 0 1.5H18a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 0 1.5 0V6A2.25 2.25 0 0 0 18 3.75h-1.5Zm-9 4.5A2.25 2.25 0 0 0 5.25 10.5v3A2.25 2.25 0 0 0 7.5 15.75h9A2.25 2.25 0 0 0 18.75 13.5v-3A2.25 2.25 0 0 0 16.5 8.25h-9Zm-3 8.25a.75.75 0 0 0-.75.75V18A2.25 2.25 0 0 0 6 20.25h1.5a.75.75 0 0 0 0-1.5H6a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 0-.75-.75Zm15 0a.75.75 0 0 0-.75.75V18a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 0 0 1.5H18A2.25 2.25 0 0 0 20.25 18v-1.5a.75.75 0 0 0-.75-.75Z" />
        </svg>
      );
  }
}

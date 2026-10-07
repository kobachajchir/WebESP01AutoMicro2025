type MotionIconName = "balance" | "stop" | "refresh" | "move" | "test";

export default function MotionControlIcon({ name }: { name: MotionIconName }) {
  return <svg viewBox="0 0 24 24" className="motion-control-icon" aria-hidden="true"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === "balance" && <path d="M12 3v15M5 7h14M8 21h8M6 7l-3 7h6L6 7ZM18 7l-3 7h6l-3-7Z" />}
    {name === "stop" && <rect x="5" y="5" width="14" height="14" rx="1.5" fill="currentColor" stroke="none" />}
    {name === "refresh" && <path d="M20 10a8 8 0 0 0-14-4L3 9m0-5v5h5M4 14a8 8 0 0 0 14 4l3-3m0 5v-5h-5" />}
    {name === "move" && <path d="M12 3v18m-5-5 5 5 5-5M7 8l5-5 5 5" />}
    {name === "test" && <><circle cx="12" cy="12" r="7" /><path d="m10 8 6 4-6 4V8Z" /></>}
  </svg>;
}

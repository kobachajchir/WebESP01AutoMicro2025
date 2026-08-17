export default function ConnectingScreen() {
 return (
 <div
 className="app-shell flex flex-col h-screen w-full items-center justify-center gap-3 p-6 relative
 bg-[var(--ui-bg-0)] text-[var(--ui-text)]
 selection:bg-cyan-500/30"
 >
 <div
 role="status"
 className="inline-block size-24 rounded-full border-4 border-current border-r-transparent
 animate-spin motion-reduce:animate-none text-cyan-400"
 />
 <h1
 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight
 bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-400 to-fuchsia-400
 bg-[length:200%_100%] motion-safe:animate-[gradient-move_6s_linear_infinite] drop-shadow-sm"
 >
 Conectando al servidor de la ESP01...
 </h1>
 </div>
 )
}

import { useState, useEffect } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="relative z-[120] pointer-events-auto touch-manipulation select-none w-11 h-11 flex items-center justify-center rounded-none border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95 transition-all cursor-pointer shrink-0 [-webkit-tap-highlight-color:transparent]"
      aria-label="Toggle theme"
    >
      <i className={`fas ${dark ? "fa-sun" : "fa-moon"} text-sm`} />
    </button>
  );
}

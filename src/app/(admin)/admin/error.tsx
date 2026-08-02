"use client";

import { useEffect } from "react";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error("Admin page render failed", error);
  }, [error]);

  return (
    <main className="admin-load-state" role="alert">
      <h1>Админ-панель временно недоступна</h1>
      <p>Обновите раздел через несколько секунд. Ваши данные не изменены.</p>
      <button onClick={reset} type="button">
        Повторить
      </button>
    </main>
  );
}

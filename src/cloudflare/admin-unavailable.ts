type WorkerFetch<Env, Context> = (
  request: Request,
  env: Env,
  context: Context,
) => Promise<Response> | Response;

function isAdminDocumentRequest(request: Request) {
  const { pathname } = new URL(request.url);
  const acceptsHtml = request.headers.get("accept")?.includes("text/html") ?? false;

  return (pathname === "/admin" || pathname.startsWith("/admin/")) && acceptsHtml;
}

export function createAdminUnavailableResponse() {
  return new Response(
    `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Админ-панель временно недоступна</title>
</head>
<body>
  <main>
    <h1>Админ-панель временно недоступна</h1>
    <p>Обновите страницу через несколько секунд. Ваши данные не изменены.</p>
    <p><a href="/admin">Повторить</a></p>
  </main>
</body>
</html>`,
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        "Content-Type": "text/html; charset=UTF-8",
        "Referrer-Policy": "no-referrer",
        "Retry-After": "5",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
      status: 503,
    },
  );
}

export async function handleCloudflareRequest<Env, Context>(
  fetchHandler: WorkerFetch<Env, Context>,
  request: Request,
  env: Env,
  context: Context,
) {
  const isAdminDocument = isAdminDocumentRequest(request);

  try {
    const response = await fetchHandler(request, env, context);

    if (isAdminDocument && response.status >= 500) {
      return createAdminUnavailableResponse();
    }

    return response;
  } catch (error) {
    if (isAdminDocument) {
      return createAdminUnavailableResponse();
    }

    throw error;
  }
}

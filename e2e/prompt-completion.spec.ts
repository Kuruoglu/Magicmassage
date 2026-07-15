import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

const persistentProjectName = "prompt-persistence-chromium";
const supabaseSaveMessage = "Изменение сохранено в Supabase.";
const calendarHourHeight = 72;
const calendarStartHour = 0;

function configuredValue(name: string) {
  const value = process.env[name]?.trim();

  return value || undefined;
}

async function openPersistentAdmin(page: Page, testInfo: TestInfo, requiredSection: string) {
  if (testInfo.project.name !== persistentProjectName) {
    test.skip(
      true,
      "This public/admin persistence scenario requires the real-auth Playwright project; the demo server intentionally has no Supabase writes.",
    );
  }

  const email = configuredValue("E2E_ADMIN_EMAIL");
  const password = configuredValue("E2E_ADMIN_PASSWORD");
  const publicUrl = configuredValue("NEXT_PUBLIC_SUPABASE_URL");
  const publicKey = configuredValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = configuredValue("SUPABASE_SECRET_KEY");

  if (!email || !password || !publicUrl || !publicKey || !secretKey) {
    test.skip(
      true,
      "Configure the public Supabase pair, SUPABASE_SECRET_KEY, and dedicated E2E admin credentials to run persistent public/admin scenarios.",
    );
  }

  await page.goto("/admin", { waitUntil: "networkidle" });

  if (/\/admin\/login$/.test(page.url())) {
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await Promise.all([
      page.waitForURL(/\/admin(?:\?.*)?$/),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
  }

  const navigation = page.getByRole("navigation", { name: "Admin sections" });
  await expect(navigation).toBeVisible();

  if (await navigation.getByRole("link", { exact: true, name: requiredSection }).count() === 0) {
    test.skip(
      true,
      `The dedicated E2E admin user needs access to the ${requiredSection} section for this persistent scenario.`,
    );
  }
}

async function clickDialogBackdrop(dialog: Locator, page: Page) {
  const backdrop = dialog.locator("..");
  const [backdropBox, dialogBox] = await Promise.all([backdrop.boundingBox(), dialog.boundingBox()]);

  expect(backdropBox).not.toBeNull();
  expect(dialogBox).not.toBeNull();

  const leftGap = dialogBox!.x - backdropBox!.x;
  const x = leftGap > 8 ? backdropBox!.x + 4 : backdropBox!.x + backdropBox!.width - 4;
  const y = backdropBox!.y + Math.min(40, backdropBox!.height / 2);

  await page.mouse.click(x, y);
}

async function dragAppointmentTo(
  source: Locator,
  target: Locator,
  hour: number,
  minute = 0,
  beforeDrop?: () => Promise<void>,
) {
  const [sourceBox, targetBox] = await Promise.all([source.boundingBox(), target.boundingBox()]);

  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  const targetY = ((hour - calendarStartHour) + minute / 60) * calendarHourHeight;
  const grabOffsetY = Math.min(calendarHourHeight / 2, sourceBox!.height / 2);
  const sourceX = sourceBox!.x + sourceBox!.width / 2;
  const sourceY = sourceBox!.y + grabOffsetY;
  const clientX = targetBox!.x + Math.max(8, targetBox!.width / 2);
  const clientY = targetBox!.y + targetY + grabOffsetY;
  const dataTransfer = await source.evaluateHandle(() => new DataTransfer());

  try {
    await source.dispatchEvent("dragstart", { clientX: sourceX, clientY: sourceY, dataTransfer });
    await target.dispatchEvent("dragover", { clientX, clientY, dataTransfer });
    await beforeDrop?.();
    await target.dispatchEvent("drop", { clientX, clientY, dataTransfer });
  } finally {
    await dataTransfer.dispose();
  }
}

async function resizeAppointmentBy(page: Page, appointment: Locator, deltaMinutes: number) {
  const handle = appointment.getByRole("button", {
    name: "Изменить длительность перетаскиванием вверх или вниз",
  });
  await handle.scrollIntoViewIfNeeded();

  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();

  const x = handleBox!.x + handleBox!.width / 2;
  const y = handleBox!.y + handleBox!.height / 2;
  const pixelDelta = (deltaMinutes / 60) * calendarHourHeight;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + pixelDelta, { steps: 4 });
  await page.mouse.up();
}

async function waitForSupabaseSave(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: supabaseSaveMessage })).toBeVisible();
}

async function setClassicServiceStatus(page: Page, status: "Опубликована" | "Скрыта") {
  await page.goto("/admin?section=services&service=classic-massage", { waitUntil: "networkidle" });

  const details = page.getByRole("dialog", { name: "Детали услуги" });
  const serviceHeading = details.getByRole("heading", { level: 2 });
  await expect(serviceHeading).toBeVisible();
  const serviceName = (await serviceHeading.textContent())?.trim();
  expect(serviceName).toBeTruthy();
  await details.getByRole("button", { name: "Редактировать" }).click();

  const editor = page.getByRole("dialog", { name: /^Редактировать:/ });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("Название")).toHaveValue(serviceName!);
  const previousStatus = (await editor.getByLabel("Статус").inputValue()) as "Опубликована" | "Скрыта";
  await editor.getByLabel("Статус").selectOption(status);
  await editor.getByRole("button", { name: "Сохранить услугу" }).click();
  await expect(editor).toHaveCount(0);
  await waitForSupabaseSave(page);

  return previousStatus;
}

async function setGiftCertificatesEnabled(page: Page, enabled: boolean) {
  await page.goto("/admin?section=settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Настройки админки" });
  const toggle = dialog.getByLabel("Показывать подарочные сертификаты на публичном сайте");
  const previousValue = await toggle.isChecked();

  if (previousValue !== enabled) {
    await toggle.setChecked(enabled);
  }

  await dialog.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(dialog).toHaveCount(0);
  await waitForSupabaseSave(page);

  return previousValue;
}

async function fillBlogCore(editor: Locator, input: {
  category?: string;
  content: string;
  locale?: "bg" | "ru" | "ua" | "en";
  slug: string;
  title: string;
}) {
  await editor.getByLabel("Заголовок", { exact: true }).fill(input.title);
  await editor.getByLabel("Slug").fill(input.slug);
  await editor.getByLabel("Категория").fill(input.category ?? "Советы");
  await editor.getByLabel("Автор").fill("Natali");

  if (input.locale) {
    await editor.getByLabel("Язык").selectOption(input.locale);
  }

  await editor.getByRole("textbox", { name: "Текст статьи" }).fill(input.content);
}

test("1. opens the client drawer and closes it from the backdrop", async ({ page }) => {
  await page.goto("/admin?section=clients", { waitUntil: "networkidle" });
  await page.getByRole("table").getByRole("link", { name: "Olena K." }).click();

  const drawer = page.getByRole("dialog", { name: "Карточка клиента" });
  await expect(drawer.getByRole("heading", { name: "Olena K." })).toBeVisible();

  await clickDialogBackdrop(drawer, page);

  await expect(drawer).toHaveCount(0);
});

test("2. keeps the client drawer open after a click inside it", async ({ page }) => {
  await page.goto("/admin?section=clients", { waitUntil: "networkidle" });
  await page.getByRole("table").getByRole("link", { name: "Olena K." }).click();

  const drawer = page.getByRole("dialog", { name: "Карточка клиента" });
  await drawer.getByRole("heading", { name: "Контактные данные" }).click();

  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Olena K." })).toBeVisible();
});

test("3. omits the operational queue from the dashboard", async ({ page }) => {
  await page.goto("/admin", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Операционная очередь" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Создать запись/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Открыть календарь" })).toBeVisible();
});

test("4. creates a client after opening the note disclosure @persistent", async ({ page }, testInfo) => {
  const isPersistent = testInfo.project.name === persistentProjectName;
  const suffix = isPersistent ? String(Date.now()).slice(-7) : "demo";
  const phoneSuffix = isPersistent ? suffix : "7000014";
  const clientName = `Playwright Note Client ${suffix}`;
  const note = "Заметка открыта отдельной кнопкой перед созданием клиента.";

  if (isPersistent) {
    await openPersistentAdmin(page, testInfo, "Клиенты");
  }
  await page.goto("/admin?section=clients", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Добавить клиента" }).click();

  const form = page.getByRole("dialog", { name: "Новый клиент" });
  await form.getByLabel("Имя").fill(clientName);
  await form.getByRole("textbox", { exact: true, name: "Телефон" }).fill(`+359 88 ${phoneSuffix}`);
  await expect(form.getByLabel("Заметка клиента")).toHaveCount(0);

  await form.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(form.getByLabel("Заметка клиента")).toBeFocused();
  await form.getByLabel("Заметка клиента").fill(note);
  await form.getByRole("button", { name: "Сохранить клиента" }).click();

  const card = page.getByRole("dialog", { name: "Карточка клиента" });
  await expect(form).toHaveCount(0);
  await expect(card.getByRole("heading", { name: clientName })).toBeVisible();
  await expect(card.getByText(note, { exact: true }).last()).toBeVisible();

  if (isPersistent) {
    await waitForSupabaseSave(page);
    await page.reload({ waitUntil: "networkidle" });
    const persistedClientLink = page.getByRole("table").getByRole("link", { name: clientName });
    await expect(persistedClientLink).toBeVisible();
    await persistedClientLink.click();

    const persistedCard = page.getByRole("dialog", { name: "Карточка клиента" });
    await expect(persistedCard.getByRole("heading", { name: clientName })).toBeVisible();
    await expect(persistedCard.getByText(note, { exact: true }).last()).toBeVisible();
  }
});

test("5. adds a post-visit comment without replacing the client note", async ({ page }) => {
  const comment = "После визита клиентка отметила, что давление было комфортным.";
  const originalClientNote = "Предпочитает вечерние слоты и сильное давление, перед визитом уточнить шею и плечи.";

  await page.goto(
    "/admin?section=calendar&date=2026-07-08&client=client-359873334411&appointment=demo-3",
    { waitUntil: "networkidle" },
  );

  const details = page.getByRole("dialog", { name: "Детали выбранной записи" });
  await details.getByLabel("Комментарий после визита").fill(comment);
  await details.getByRole("button", { name: "Сохранить комментарий" }).click();

  await expect(details.getByLabel("Комментарий после визита")).toHaveValue(comment);
  await expect(details.getByText(/^Обновлено /)).toBeVisible();
  await details.getByRole("link", { name: "Открыть клиента" }).click();

  const card = page.getByRole("dialog", { name: "Карточка клиента" });
  await expect(card.getByText(originalClientNote, { exact: true }).last()).toBeVisible();
  await expect(card.getByText(comment, { exact: true }).last()).toBeVisible();
});

test("6. keeps the full time grid visible for an empty calendar day", async ({ page }) => {
  await page.goto("/admin?section=calendar", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Месяц" }).click();
  await page.getByRole("button", { name: /^7 июля, 0 записей/ }).click();

  const schedule = page.getByLabel("Расписание 7 июля");
  const scheduleBox = await schedule.boundingBox();

  await expect(page.getByRole("heading", { name: "7 июля" })).toBeVisible();
  await expect(schedule).toBeVisible();
  await expect(schedule.getByRole("listitem")).toHaveCount(0);
  await expect(schedule.locator(".admin-calendar-hour-lines > span")).toHaveCount(49);
  expect(scheduleBox).not.toBeNull();
  expect(scheduleBox!.height).toBeGreaterThan(1_700);
});

test("7. drags a day-view appointment to a different time", async ({ page }) => {
  await page.goto("/admin?section=calendar&date=2026-07-06", { waitUntil: "networkidle" });

  const schedule = page.getByLabel("Расписание 6 июля");
  const appointment = schedule.getByRole("listitem").filter({ hasText: "Анна Петрова" });

  await dragAppointmentTo(appointment, schedule, 14);

  await expect(schedule.getByRole("button", { name: /14:00.*Анна Петрова/ })).toBeVisible();
  await expect(schedule.getByRole("button", { name: /10:00.*Анна Петрова/ })).toHaveCount(0);
});

test("7a. allows an appointment to end when the next appointment begins", async ({ page }) => {
  await page.goto("/admin?section=calendar&date=2026-07-06", { waitUntil: "networkidle" });

  const schedule = page.getByLabel("Расписание 6 июля");
  const appointment = schedule.getByRole("listitem").filter({ hasText: "Анна Петрова" });

  await dragAppointmentTo(appointment, schedule, 11, 30, async () => {
    const preview = schedule.locator(".admin-timed-appointment.is-drag-preview");
    await expect(preview).toContainText("11:30");
    await expect(preview).toContainText("Анна Петрова");
  });

  await expect(page.getByRole("region", { name: "Изменение пересекается с другой записью" })).toHaveCount(0);
  await expect(schedule.getByRole("button", { name: /11:30.*Анна Петрова/ })).toBeVisible();
  await expect(schedule.getByRole("button", { name: /12:30.*Мария Иванова/ })).toBeVisible();
});

test("7b. styles an overlapping move as a usable conflict panel", async ({ page }) => {
  await page.goto("/admin?section=calendar&date=2026-07-06", { waitUntil: "networkidle" });

  const schedule = page.getByLabel("Расписание 6 июля");
  const appointment = schedule.getByRole("listitem").filter({ hasText: "Анна Петрова" });

  await dragAppointmentTo(appointment, schedule, 12, 30);

  const conflict = page.getByRole("region", { name: "Изменение пересекается с другой записью" });
  const reason = conflict.getByLabel("Причина ручного пересечения");
  const cancel = conflict.getByRole("button", { name: "Отменить изменение" });
  const save = conflict.getByRole("button", { name: "Сохранить с пересечением" });

  await expect(conflict).toBeVisible();
  await expect(conflict.getByRole("alert")).toContainText("Мария Иванова");
  await expect(conflict).toHaveCSS("background-color", "rgb(255, 244, 215)");
  await expect(conflict).toHaveCSS("border-left-width", "4px");
  await expect(reason).toHaveCSS("border-radius", "8px");
  await expect(save).toBeDisabled();

  const [cancelBox, saveBox] = await Promise.all([cancel.boundingBox(), save.boundingBox()]);
  expect(cancelBox?.height).toBeGreaterThanOrEqual(42);
  expect(saveBox?.height).toBeGreaterThanOrEqual(42);
  expect(await conflict.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  const [mobileConflictBox, mobileCancelBox, mobileSaveBox] = await Promise.all([
    conflict.boundingBox(),
    cancel.boundingBox(),
    save.boundingBox(),
  ]);
  expect(mobileCancelBox?.width).toBeGreaterThan((mobileConflictBox?.width ?? 0) - 40);
  expect(mobileSaveBox?.width).toBeGreaterThan((mobileConflictBox?.width ?? 0) - 40);
  expect(mobileSaveBox?.y).toBeGreaterThan(mobileCancelBox?.y ?? 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await cancel.click();

  await expect(conflict).toHaveCount(0);
  await expect(schedule.getByRole("button", { name: /10:00.*Анна Петрова/ })).toBeVisible();
  await expect(schedule.getByRole("button", { name: /12:30.*Мария Иванова/ })).toBeVisible();
});

test("8. increases an appointment duration in day view", async ({ page }) => {
  await page.goto("/admin?section=calendar&date=2026-07-06", { waitUntil: "networkidle" });

  const appointment = page.getByLabel("Расписание 6 июля").getByRole("listitem").filter({ hasText: "Анна Петрова" });
  await resizeAppointmentBy(page, appointment, 15);

  await expect(appointment.getByLabel("Длительность 75 минут")).toBeVisible();
});

test("9. moves a week-view appointment to another day", async ({ page }) => {
  await page.goto("/admin?section=calendar&date=2026-07-06", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Неделя" }).click();

  const week = page.getByLabel(/^Неделя 6 июл\. - 12 июл\.$/);
  const monday = week.getByLabel("6 июля, 2 записи");
  const tuesday = week.getByLabel("7 июля, 0 записей");
  const appointment = monday.getByRole("listitem").filter({ hasText: "Анна Петрова" });

  await dragAppointmentTo(appointment, tuesday, 11);

  const updatedMonday = week.getByLabel("6 июля, 1 запись");
  const updatedTuesday = week.getByLabel("7 июля, 1 запись");
  await expect(updatedTuesday.getByRole("button", { name: /11:00.*Анна Петрова/ })).toBeVisible();
  await expect(updatedMonday.getByRole("button", { name: /Анна Петрова/ })).toHaveCount(0);
});

test("10. increases an appointment duration in week view", async ({ page }) => {
  await page.goto("/admin?section=calendar&date=2026-07-06", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Неделя" }).click();

  const appointment = page
    .getByLabel("6 июля, 2 записи")
    .getByRole("listitem")
    .filter({ hasText: "Анна Петрова" });
  await resizeAppointmentBy(page, appointment, 15);

  await expect(appointment.getByLabel("Длительность 75 минут")).toBeVisible();
});

test("11. creates an appointment on Sunday", async ({ page }) => {
  await page.goto("/admin?section=calendar&date=2026-07-06", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Неделя" }).click();
  await page.getByLabel(/^Неделя 6 июл\. - 12 июл\.$/).getByRole("button", { name: /Вс.*12 июл/ }).click();

  await page.getByRole("button", { name: "Создать запись" }).click();
  const dialog = page.getByRole("dialog", { name: "Новая запись" });

  await expect(dialog.getByLabel("Дата")).toHaveValue("2026-07-12");
  await dialog.getByLabel("Клиент").fill("Sunday Playwright Client");
  await dialog.getByLabel("Услуга").selectOption("SPA процедура");
  await dialog.getByLabel("Время").fill("11:15");
  await dialog.getByRole("button", { name: "Сохранить запись" }).click();

  const details = page.getByRole("dialog", { name: "Детали выбранной записи" });
  await expect(page.getByRole("heading", { name: "12 июля" })).toBeVisible();
  await expect(details.getByRole("heading", { name: "Sunday Playwright Client" })).toBeVisible();
  await expect(details.getByText("11:15 · 60 мин")).toBeVisible();
});

test("12. hides a service and removes it from the public catalog @persistent", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await openPersistentAdmin(page, testInfo, "Виды массажа");

  let originalStatus: "Опубликована" | "Скрыта" | undefined;

  try {
    originalStatus = await setClassicServiceStatus(page, "Скрыта");

    await page.goto("/ru/services", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Классический массаж" })).toHaveCount(0);

    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Классический массаж" })).toHaveCount(0);

    const hiddenRoute = await page.goto("/ru/services/classic-massage", { waitUntil: "domcontentloaded" });
    expect(hiddenRoute?.status()).toBe(404);
  } finally {
    if (originalStatus) {
      await setClassicServiceStatus(page, originalStatus);
      await page.goto("/ru/services", { waitUntil: "domcontentloaded" });
      if (originalStatus === "Опубликована") {
        await expect(page.getByRole("heading", { name: "Классический массаж" })).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: "Классический массаж" })).toHaveCount(0);
      }
    }
  }
});

test("13. replaces one image through its media placement @persistent", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openPersistentAdmin(page, testInfo, "Медиа");
  await page.goto("/admin?section=media", { waitUntil: "networkidle" });
  await page.getByRole("button", { exact: true, name: "Используется" }).click();

  const gallery = page.getByLabel("Галерея медиа");
  const sourceLink = gallery.locator('a[href*="media=media-classic-cover"]').first();
  await expect(sourceLink).toBeVisible();

  await Promise.all([
    page.waitForURL(/section=media.*media=/),
    sourceLink.click(),
  ]);

  const details = page.getByRole("dialog", { name: "Детали медиа" });
  const replacePlacementButton = details.getByRole("button", { name: "Заменить в этом месте" }).first();

  if (await replacePlacementButton.count() === 0) {
    test.skip(true, "The selected imported media asset has no replaceable placement.");
  }

  const placementItem = replacePlacementButton.locator("..");
  const placementKey = (await placementItem.locator("strong").first().textContent())?.trim();
  await replacePlacementButton.click();

  const editor = page.getByRole("dialog", { name: /Заменить изображение:/ });
  await expect(editor).toBeVisible();
  const assetRadios = editor.getByRole("radio");
  const originalAssetId = await editor.locator('input[type="radio"]:checked').inputValue();
  const replacement = await assetRadios.evaluateAll((inputs, originalId) => {
    const index = inputs.findIndex((input) => {
      const item = input as HTMLInputElement;
      return Boolean(item.value) && item.value !== originalId && !item.disabled;
    });

    return index >= 0 ? { index, value: (inputs[index] as HTMLInputElement).value } : null;
  }, originalAssetId);

  if (!replacement || !placementKey) {
    test.skip(true, "The connected Supabase project needs a second publication-ready image for placement replacement.");
  }

  let placementWasReplaced = false;

  try {
    await assetRadios.nth(replacement!.index).locator("..").click();
    await expect(assetRadios.nth(replacement!.index)).toBeChecked();
    const reloaded = page.waitForEvent("load");
    await editor.getByRole("button", { name: "Применить к этому месту" }).click();
    await reloaded;
    placementWasReplaced = true;

    await page.goto(`/admin?section=media&media=${encodeURIComponent(replacement!.value)}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("dialog", { name: "Детали медиа" }).getByText(placementKey!, { exact: true })).toBeVisible();
  } finally {
    if (placementWasReplaced) {
      const replacementDetails = page.getByRole("dialog", { name: "Детали медиа" });
      const restoreItem = replacementDetails.getByRole("listitem").filter({ hasText: placementKey! }).first();
      await restoreItem.getByRole("button", { name: "Заменить в этом месте" }).click();

      const restoreEditor = page.getByRole("dialog", { name: /Заменить изображение:/ });
      const restoreRadios = restoreEditor.getByRole("radio");
      const originalIndex = await restoreRadios.evaluateAll(
        (inputs, assetId) => inputs.findIndex((input) => (input as HTMLInputElement).value === assetId),
        originalAssetId,
      );
      expect(originalIndex).toBeGreaterThanOrEqual(0);
      await restoreRadios.nth(originalIndex).locator("..").click();
      await expect(restoreRadios.nth(originalIndex)).toBeChecked();
      const restored = page.waitForEvent("load");
      await restoreEditor.getByRole("button", { name: "Применить к этому месту" }).click();
      await restored;
    }
  }
});

test("14. creates a blog draft in the full-page editor", async ({ page }) => {
  const title = "Playwright draft article";

  await page.goto("/admin?section=blog", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Новая статья" }).click();

  const editor = page.getByRole("form", { name: "Редактор статьи" });
  await expect(editor).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Новая статья" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Контент-план блога" })).toHaveCount(0);

  await fillBlogCore(editor, {
    content: "Черновик сохраняется из отдельного полноэкранного редактора.",
    slug: "playwright-draft-article",
    title,
  });
  await editor.getByRole("button", { exact: true, name: "Сохранить" }).click();

  await expect(editor).toHaveCount(0);
  await expect(page.getByRole("table").getByRole("link", { name: title })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Детали статьи" }).getByText("Черновик", { exact: true })).toBeVisible();
});

test("15. publishes a blog post and exposes its public route @persistent", async ({ page }, testInfo) => {
  test.slow();
  const runId = `${Date.now().toString(36)}-${testInfo.workerIndex}`;
  const title = `Playwright published massage guide ${runId}`;
  const slug = `playwright-published-massage-guide-${runId}`;

  await openPersistentAdmin(page, testInfo, "Блог");
  await page.goto("/admin?section=blog", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Новая статья" }).click();

  const editor = page.getByRole("form", { name: "Редактор статьи" });
  const mediaSelect = editor.getByLabel("Из медиатеки", { exact: true });

  if (await mediaSelect.count() === 0 || await mediaSelect.locator("option:not([value=''])").count() === 0) {
    test.skip(true, "The connected Supabase project has no publication-ready blog cover in the media library.");
  }

  await fillBlogCore(editor, {
    content: "Опубликованная статья проверяет связку админки и публичного блога.",
    locale: "ru",
    slug,
    title,
  });
  await editor.getByLabel("Статус").selectOption("published");
  await editor.getByLabel("Краткое описание").fill("Проверка публикации статьи из админки.");
  await editor.getByLabel("SEO-заголовок").fill("Playwright: публикация статьи о массаже");
  await editor.getByLabel("SEO-описание").fill("Детерминированная проверка публичной статьи после публикации в админке.");
  await mediaSelect.selectOption({ index: 1 });

  let postWasPublished = false;

  try {
    await editor.getByRole("button", { exact: true, name: "Сохранить" }).click();
    await expect(editor).toHaveCount(0);
    postWasPublished = true;
    await waitForSupabaseSave(page);

    const publicResponse = await page.goto(`/ru/blog/${slug}`, { waitUntil: "networkidle" });
    expect(publicResponse?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Опубликованная статья проверяет связку админки и публичного блога.")).toBeVisible();
  } finally {
    if (postWasPublished) {
      await page.goto("/admin?section=blog", { waitUntil: "networkidle" });
      await page.getByRole("table").getByRole("link", { name: title }).click();
      await page.getByRole("dialog", { name: "Детали статьи" }).getByRole("button", { name: "Редактировать" }).click();

      const restoreEditor = page.getByRole("form", { name: "Редактор статьи" });
      await restoreEditor.getByLabel("Статус").selectOption("draft");
      await restoreEditor.getByRole("button", { exact: true, name: "Сохранить" }).click();
      await waitForSupabaseSave(page);
    }
  }
});

test("16. disables certificates across menus, page, and payment API @persistent", async ({ page, request }, testInfo) => {
  test.slow();
  await openPersistentAdmin(page, testInfo, "Настройки");

  let originalEnabled: boolean | undefined;

  try {
    originalEnabled = await setGiftCertificatesEnabled(page, false);

    await page.goto("/ru", { waitUntil: "networkidle" });
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Сертификаты" })).toHaveCount(0);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Сертификаты" })).toHaveCount(0);

    const pageResponse = await page.goto("/ru/gift-certificates");
    expect(pageResponse?.status()).toBe(404);

    const paymentResponse = await request.post("/api/gift-certificates/payment-intent", { data: {} });
    expect(paymentResponse.status()).toBe(404);
  } finally {
    if (originalEnabled !== undefined) {
      await page.setViewportSize({ height: 900, width: 1440 });
      await setGiftCertificatesEnabled(page, originalEnabled);
      await page.goto("/ru", { waitUntil: "networkidle" });
      const certificateLink = page
        .getByRole("navigation", { name: "Primary navigation" })
        .getByRole("link", { name: "Сертификаты" });

      if (originalEnabled) {
        await expect(certificateLink).toBeVisible();
      } else {
        await expect(certificateLink).toHaveCount(0);
      }
    }
  }
});

test("17. supports the complete mobile hamburger-menu flow", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/admin?section=calendar", { waitUntil: "networkidle" });

  const openButton = page.getByRole("button", { name: "Открыть меню админки" });
  await expect(openButton).toBeVisible();
  await openButton.click();

  const menu = page.getByRole("dialog", { name: "Разделы админки" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Закрыть меню админки" })).toBeFocused();

  await clickDialogBackdrop(menu, page);
  await expect(menu).toHaveCount(0);

  await openButton.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  await openButton.click();
  await menu.getByRole("link", { name: "Клиенты", exact: true }).click();
  await expect(page).toHaveURL(/section=clients/);
  await expect(menu).toHaveCount(0);

  await page.setViewportSize({ height: 900, width: 1440 });
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible();
});

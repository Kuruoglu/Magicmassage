import { expect, test } from "@playwright/test";

test("admin foundation renders a data-dense dashboard shell", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Клиенты" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Финансы" })).toBeVisible();
  await expect(page.getByText("Сегодня")).toBeVisible();
});

test("accountant view exposes only finance navigation", async ({ page }) => {
  await page.goto("/admin?role=accountant");

  const navigation = page.getByRole("navigation", { name: "Admin sections" });
  await expect(navigation.getByRole("link", { name: "Финансы" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Клиенты" })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Календарь" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Финансы" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Выгрузить отчет" })).toBeVisible();
});

test("admin search and action panel are interactive", async ({ page }) => {
  await page.goto("/admin?section=clients");

  await page.getByRole("searchbox", { name: "Поиск" }).fill("Olena");

  await expect(page.getByText("Olena K.")).toBeVisible();
  await expect(page.getByText("Maria Georgieva")).toHaveCount(0);

  await page.getByRole("button", { name: "Добавить клиента" }).click();

  await expect(page.getByRole("dialog", { name: "Быстрое действие" })).toBeVisible();
});

test("accountant CSV export provides visible feedback", async ({ page }) => {
  await page.goto("/admin?role=accountant");

  await page.getByRole("button", { name: "CSV" }).click();

  await expect(page.getByText("CSV отчет за 2026-07-01 - 2026-07-03 готов к скачиванию.")).toBeVisible();
});

test("accountant filters Stripe sales by tax period", async ({ page }) => {
  await page.goto("/admin?role=accountant", { waitUntil: "networkidle" });

  await page.getByLabel("Начало периода").fill("2026-07-02");
  await page.getByLabel("Конец периода").fill("2026-07-02");

  await expect(page.getByText("pi_3QMMN1022")).toBeVisible();
  await expect(page.getByText("pi_3QMMN1021")).toHaveCount(0);
  await expect(page.getByText("pi_3QMMN1023")).toHaveCount(0);
  await expect(page.getByLabel("Finance summary").getByText("180,00 €")).toBeVisible();

  await page.getByRole("button", { name: "CSV" }).click();

  await expect(page.getByRole("status")).toHaveText("CSV отчет за 2026-07-02 - 2026-07-02 готов к скачиванию.");
});

test("calendar month view is selectable", async ({ page }) => {
  await page.goto("/admin?section=calendar");

  await page.getByRole("button", { name: "Месяц" }).click();

  await expect(page.getByRole("heading", { name: "Июль 2026" })).toBeVisible();
  await expect(page.getByRole("grid", { name: "Месяц Июль 2026" })).toBeVisible();

  await page.getByRole("button", { name: /6 июля.*2 записи/ }).click();

  await expect(page.getByRole("heading", { name: "6 июля" })).toBeVisible();
  await expect(page.getByText("Мария Иванова")).toBeVisible();
});

test("calendar can create a new appointment", async ({ page }) => {
  await page.goto("/admin?section=calendar", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Создать запись" }).click();

  const dialog = page.getByRole("dialog", { name: "Новая запись" });
  await dialog.getByLabel("Клиент").fill("Ирина Тестова");
  await dialog.getByLabel("Услуга").selectOption("SPA процедура");
  await dialog.getByLabel("Дата").fill("2026-07-12");
  await dialog.getByLabel("Время").fill("11:15");
  await dialog.getByLabel("Статус").selectOption("Подтверждена");
  await dialog.getByRole("button", { name: "Сохранить запись" }).click();

  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /Ирина Тестова/ }).click();
  await expect(page.getByRole("heading", { name: "Ирина Тестова" })).toBeVisible();
  await expect(page.getByLabel("Детали выбранной записи").getByText("SPA процедура")).toBeVisible();
});

test("calendar can edit and reschedule an appointment", async ({ page }) => {
  await page.goto("/admin?section=calendar", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: /Olena K./ }).click();
  await page.getByLabel("Детали выбранной записи").getByRole("button", { name: "Редактировать" }).click();

  const dialog = page.getByRole("dialog", { name: "Редактировать запись" });
  await expect(dialog.getByLabel("Клиент")).toHaveValue("Olena K.");
  await dialog.getByLabel("Дата").fill("2026-07-13");
  await dialog.getByLabel("Время").fill("16:45");
  await dialog.getByLabel("Статус").selectOption("Ожидает");
  await dialog.getByRole("button", { name: "Сохранить изменения" }).click();

  const details = page.getByLabel("Детали выбранной записи");
  await expect(dialog).toHaveCount(0);
  await expect(details.getByRole("heading", { name: "Olena K." })).toBeVisible();
  await expect(details.getByText("13 июля")).toBeVisible();
  await expect(details.getByText("16:45")).toBeVisible();
  await expect(details.getByText("Ожидает")).toBeVisible();
  await expect(page.getByRole("button", { name: /15:00Olena K./ })).toHaveCount(0);
});

test("calendar can cancel an appointment after confirmation", async ({ page }) => {
  await page.goto("/admin?section=calendar", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: /Olena K./ }).click();

  const details = page.getByLabel("Детали выбранной записи");
  await details.getByRole("button", { name: "Отменить" }).click();

  const firstDialog = page.getByRole("dialog", { name: "Отменить запись" });
  await expect(firstDialog.getByText("Olena K.")).toBeVisible();
  await firstDialog.getByRole("button", { name: "Оставить запись" }).click();

  await expect(firstDialog).toHaveCount(0);
  await expect(details.getByText("Подтверждена")).toBeVisible();

  await details.getByRole("button", { name: "Отменить" }).click();
  const confirmationDialog = page.getByRole("dialog", { name: "Отменить запись" });
  await confirmationDialog.getByRole("button", { name: "Подтвердить отмену" }).click();

  await expect(confirmationDialog).toHaveCount(0);
  await expect(details.getByText("Отменена")).toBeVisible();
  await expect(page.getByRole("button", { name: /Olena K./ }).getByText("Отменена")).toBeVisible();
});

test("calendar links an appointment to the matching client profile", async ({ page }) => {
  await page.goto("/admin?section=calendar", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: /Olena K./ }).click();
  await page.getByLabel("Детали выбранной записи").getByRole("link", { name: "Открыть клиента" }).click();

  await expect(page).toHaveURL(/section=clients/);

  const card = page.getByLabel("Карточка клиента");
  await expect(card.getByRole("heading", { name: "Olena K." })).toBeVisible();
  await expect(card.getByText("olena.k@example.com")).toBeVisible();
  await expect(card.getByRole("heading", { name: "История визитов" })).toBeVisible();
  await expect(card.getByText("Deep tissue massage").first()).toBeVisible();
});

test("admin mobile layout avoids horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin?section=calendar");

  await expect(page.getByRole("heading", { name: "Календарь" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );

  expect(hasHorizontalOverflow).toBe(false);
});

import { expect, test } from "@playwright/test";

test("admin foundation renders a data-dense dashboard shell", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Клиенты" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Финансы" })).toBeVisible();
  await expect(page.getByText("Сегодня")).toBeVisible();
});

test("dashboard links to connected admin workspaces", async ({ page }) => {
  await page.goto("/admin", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Операционная очередь" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Создать запись/ })).toHaveAttribute(
    "href",
    "/admin?section=calendar&role=owner&action=create",
  );

  await page.getByRole("link", { name: "Анна Петрова" }).click();
  await expect(page).toHaveURL(/section=clients/);
  await expect(page.getByRole("dialog", { name: "Карточка клиента" }).getByRole("heading", { name: "Анна Петрова" })).toBeVisible();

  await page.goto("/admin", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "MMN-2407-1023" }).click();
  await expect(page).toHaveURL(/section=certificates/);
  await expect(page.getByLabel("Детали сертификата").getByRole("heading", { name: "MMN-2407-1023" })).toBeVisible();
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

  const table = page.getByRole("table");
  await expect(table.getByRole("row", { name: /Olena K./ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Maria Georgieva/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Добавить клиента" }).click();

  await expect(page.getByRole("dialog", { name: "Новый клиент" })).toBeVisible();
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
  const monthGrid = page.getByRole("grid", { name: "Месяц Июль 2026" });
  await expect(monthGrid).toBeVisible();
  await expect(monthGrid.getByText("Классический массаж")).toHaveCount(0);
  await expect(monthGrid.getByText("2 записи")).toBeVisible();
  await expect(monthGrid.getByText("2 свободных слота").first()).toBeVisible();

  await page.getByRole("button", { name: /6 июля.*2 записи/ }).click();

  await expect(page.getByRole("heading", { name: "6 июля" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Мария Иванова/ })).toBeVisible();
});

test("calendar week and list modes are distinct", async ({ page }) => {
  await page.goto("/admin?section=calendar", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "6 июля" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Olena K./ })).toHaveCount(0);

  await page.getByRole("button", { name: "Неделя" }).click();

  const weekGrid = page.getByRole("grid", { name: "Неделя 6-12 июля" });
  await expect(page.getByRole("heading", { name: "Неделя 6-12 июля" })).toBeVisible();
  await expect(weekGrid.getByText("10 июл")).toBeVisible();
  await expect(weekGrid.getByText("SPA процедура")).toBeVisible();

  await page.getByRole("button", { name: "Список" }).click();

  await expect(page.getByRole("heading", { name: "Список записей" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Olena K./ })).toBeVisible();
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
  await page.getByRole("button", { name: "Список" }).click();
  await page.getByRole("button", { name: /Ирина Тестова/ }).click();
  await expect(page.getByRole("heading", { name: "Ирина Тестова" })).toBeVisible();
  await expect(page.getByLabel("Детали выбранной записи").getByText("SPA процедура")).toBeVisible();
});

test("calendar creation resets client field and suggests existing clients", async ({ page }) => {
  await page.goto("/admin?section=calendar&client=Olena%20K.&action=create", { waitUntil: "networkidle" });

  await page.getByRole("dialog", { name: "Новая запись" }).getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: "Создать запись" }).click();

  const dialog = page.getByRole("dialog", { name: "Новая запись" });
  await expect(dialog.getByLabel("Клиент")).toHaveValue("");

  await dialog.getByLabel("Клиент").fill("ole");

  const suggestions = dialog.getByRole("listbox", { name: "Найденные клиенты" });
  await expect(suggestions.getByRole("option", { name: /Olena K./ })).toBeVisible();
  await expect(suggestions.getByRole("option", { name: /Анна Петрова/ })).toHaveCount(0);

  await suggestions.getByRole("option", { name: /Olena K./ }).click();
  await expect(dialog.getByLabel("Клиент")).toHaveValue("Olena K.");
});

test("calendar can edit and reschedule an appointment", async ({ page }) => {
  await page.goto("/admin?section=calendar", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Список" }).click();
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

  await page.getByRole("button", { name: "Список" }).click();
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

  await page.getByRole("button", { name: "Список" }).click();
  await page.getByRole("button", { name: /Olena K./ }).click();
  await page.getByLabel("Детали выбранной записи").getByRole("link", { name: "Открыть клиента" }).click();

  await expect(page).toHaveURL(/section=clients/);

  const card = page.getByRole("dialog", { name: "Карточка клиента" });
  await expect(card.getByRole("heading", { name: "Olena K." })).toBeVisible();
  await expect(card.getByText("olena.k@example.com")).toBeVisible();
  await expect(card.getByRole("heading", { name: "История визитов" })).toBeVisible();
  await expect(card.getByText("Deep tissue massage").first()).toBeVisible();
});

test("client profile saves a note and exposes contact actions", async ({ page }) => {
  await page.goto("/admin?section=clients&client=Olena%20K.", { waitUntil: "networkidle" });

  const card = page.getByRole("dialog", { name: "Карточка клиента" });
  await expect(card.getByRole("link", { name: "Позвонить" })).toHaveAttribute("href", "tel:+359873334411");
  await expect(card.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:olena.k@example.com");
  await expect(card.getByRole("link", { name: "Telegram" })).toHaveAttribute(
    "href",
    "https://t.me/olena_k_demo",
  );

  await card.getByRole("button", { name: "Редактировать заметку" }).click();
  await card.getByLabel("Заметка клиента").fill("Клиентка просит напоминать за 2 часа.");
  await card.getByRole("button", { name: "Сохранить заметку" }).click();

  await expect(card.getByRole("status")).toHaveText("Заметка сохранена.");
  await expect(card.getByText("Клиентка просит напоминать за 2 часа.")).toBeVisible();
});

test("client form creates and edits a client profile", async ({ page }) => {
  await page.goto("/admin?section=clients", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Добавить клиента" }).click();

  const createDialog = page.getByRole("dialog", { name: "Новый клиент" });
  await createDialog.getByRole("textbox", { name: "Имя" }).fill("Ирина Тестова");
  await createDialog.getByRole("textbox", { name: "Телефон" }).fill("+359 88 777 1122");
  await createDialog.getByRole("textbox", { name: "Email" }).fill("irina@example.com");
  await createDialog.getByLabel("Язык").selectOption("bg");
  await createDialog.getByLabel("Канал связи").selectOption("Telegram");
  await createDialog.getByLabel("Статус").selectOption("Новый клиент");
  await createDialog.getByRole("textbox", { name: "Telegram" }).fill("https://t.me/irina_demo");
  await createDialog.getByRole("textbox", { name: "Следующий визит" }).fill("Не назначен");
  await createDialog.getByRole("textbox", { name: "Заметка клиента" }).fill("Новая клиентка, предпочитает дневные слоты.");
  await createDialog.getByRole("textbox", { name: "Теги" }).fill("BG, new");
  await createDialog.getByRole("button", { name: "Сохранить клиента" }).click();

  await expect(createDialog).toHaveCount(0);
  await expect(page.getByRole("table").getByRole("button", { name: "Ирина Тестова" })).toBeVisible();

  const card = page.getByRole("dialog", { name: "Карточка клиента" });
  await expect(card.getByRole("heading", { name: "Ирина Тестова" })).toBeVisible();
  await expect(card.getByText("BG · Новый клиент")).toBeVisible();
  await expect(card.getByText("irina@example.com")).toBeVisible();

  await card.getByRole("button", { name: "Редактировать клиента" }).click();

  const editDialog = page.getByRole("dialog", { name: "Редактировать клиента" });
  await editDialog.getByLabel("Канал связи").selectOption("Email");
  await editDialog.getByRole("textbox", { name: "Заметка клиента" }).fill("Обновлено после звонка, лучше писать на email.");
  await editDialog.getByRole("textbox", { name: "Теги" }).fill("BG, email");
  await editDialog.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect(editDialog).toHaveCount(0);
  await expect(card.getByText("Обновлено после звонка, лучше писать на email.")).toBeVisible();
  await expect(card.getByText("email", { exact: true })).toBeVisible();
});

test("certificate workspace can issue, send, redeem and edit a certificate", async ({ page }) => {
  await page.goto("/admin?section=certificates", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Выдать вручную" }).click();

  const createDialog = page.getByRole("dialog", { name: "Новый сертификат" });
  await createDialog.getByLabel("Код").fill("MMN-2407-1999");
  await createDialog.getByLabel("Покупатель").fill("Ирина Тестова");
  await createDialog.getByLabel("Клиент").fill("Ирина Тестова");
  await createDialog.getByLabel("Получатель").fill("Self");
  await createDialog.getByLabel("Сумма").fill("90 €");
  await createDialog.getByLabel("Статус").selectOption("Оплачено");
  await createDialog.getByLabel("Stripe ID").fill("manual");
  await createDialog.getByLabel("Дата оплаты").fill("2026-07-07");
  await createDialog.getByLabel("Действителен до").fill("2027-01-07");
  await createDialog.getByLabel("Заметка").fill("Ручная выдача после оплаты в салоне.");
  await createDialog.getByRole("button", { name: "Сохранить сертификат" }).click();

  await expect(createDialog).toHaveCount(0);
  await expect(page.getByRole("table").getByRole("button", { name: "MMN-2407-1999" })).toBeVisible();

  const details = page.getByLabel("Детали сертификата");
  await expect(details.getByRole("heading", { name: "MMN-2407-1999" })).toBeVisible();
  await expect(details.getByText("Ирина Тестова → Self")).toBeVisible();
  await expect(details.getByText("90 €")).toBeVisible();
  await expect(details.getByText("manual")).toBeVisible();

  await page.getByRole("table").getByRole("button", { name: "MMN-2407-1023" }).click();
  await expect(details.getByRole("heading", { name: "MMN-2407-1023" })).toBeVisible();

  await details.getByRole("button", { name: "Отправить PDF" }).click();
  await expect(details.getByRole("status")).toHaveText("PDF отмечен как отправленный.");

  await details.getByRole("button", { name: "Погасить" }).click();
  await expect(details.getByRole("status")).toHaveText("Сертификат погашен.");
  await expect(details.getByText("Погашен", { exact: true })).toBeVisible();

  await details.getByRole("button", { name: "Редактировать" }).click();
  const editDialog = page.getByRole("dialog", { name: "Редактировать сертификат" });
  await editDialog.getByLabel("Получатель").fill("Olena K.");
  await editDialog.getByLabel("Сумма").fill("260 €");
  await editDialog.getByLabel("Заметка").fill("Погашен после записи клиента.");
  await editDialog.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect(editDialog).toHaveCount(0);
  await expect(details.getByText("Oksana → Olena K.")).toBeVisible();
  await expect(details.getByText("260 €")).toBeVisible();
  await expect(details.getByText("Погашен после записи клиента.")).toBeVisible();
});

test("services workspace can create and edit a massage service", async ({ page }) => {
  await page.goto("/admin?section=services", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Добавить услугу" }).click();

  const createDialog = page.getByRole("dialog", { name: "Новая услуга" });
  await createDialog.getByLabel("Название").fill("Арома массаж");
  await createDialog.getByLabel("Slug").fill("aroma-massage");
  await createDialog.getByLabel("Категория").fill("SPA");
  await createDialog.getByLabel("Статус").selectOption("Черновик");
  await createDialog.getByLabel("Длительность").fill("75 мин");
  await createDialog.getByLabel("Порядок").fill("9");
  await createDialog.getByLabel("Локали").fill("ru, bg");
  await createDialog.getByLabel("SEO title").fill("Арома массаж в Бургасе");
  await createDialog.getByLabel("Обложка").fill("/media/services/aroma-massage.jpg");
  await createDialog.getByLabel("Описание").fill("Расслабляющая SPA-услуга с ароматическими маслами.");
  await createDialog.getByRole("button", { name: "Сохранить услугу" }).click();

  await expect(createDialog).toHaveCount(0);
  await expect(page.getByRole("table").getByRole("button", { name: "Арома массаж" })).toBeVisible();

  const details = page.getByLabel("Детали услуги");
  await expect(details.getByRole("heading", { name: "Арома массаж" })).toBeVisible();
  await expect(details.getByText("aroma-massage", { exact: true })).toBeVisible();
  await expect(details.getByText("Расслабляющая SPA-услуга с ароматическими маслами.")).toBeVisible();

  await details.getByRole("button", { name: "Редактировать" }).click();
  const editDialog = page.getByRole("dialog", { name: "Редактировать услугу" });
  await editDialog.getByLabel("Статус").selectOption("Опубликована");
  await editDialog.getByLabel("Описание").fill("Опубликованное описание услуги для сайта.");
  await editDialog.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect(editDialog).toHaveCount(0);
  await expect(details.getByText("Опубликована")).toBeVisible();
  await expect(details.getByText("Опубликованное описание услуги для сайта.")).toBeVisible();
});

test("price workspace can create and edit a euro price variant", async ({ page }) => {
  await page.goto("/admin?section=price", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Добавить цену" }).click();

  const createDialog = page.getByRole("dialog", { name: "Новая цена" });
  await createDialog.getByLabel("Услуга").selectOption("classic-massage");
  await createDialog.getByLabel("Длительность").fill("90");
  await createDialog.getByLabel("Цена").fill("110");
  await createDialog.getByLabel("Статус").selectOption("Активна");
  await createDialog.getByLabel("Порядок").fill("4");
  await createDialog.getByLabel("Заметка").fill("Новый длинный вариант для постоянных клиентов.");
  await createDialog.getByRole("button", { name: "Сохранить цену" }).click();

  await expect(createDialog).toHaveCount(0);
  await expect(page.getByRole("table").getByRole("button", { name: "Классический массаж · 90 мин" })).toBeVisible();

  const details = page.getByLabel("Детали цены");
  await expect(details.getByRole("heading", { name: "Классический массаж · 90 мин" })).toBeVisible();
  await expect(details.getByText("110 €")).toBeVisible();
  await expect(details.getByText("EUR")).toBeVisible();

  await details.getByRole("button", { name: "Редактировать" }).click();
  const editDialog = page.getByRole("dialog", { name: "Редактировать цену" });
  await editDialog.getByLabel("Цена").fill("115");
  await editDialog.getByLabel("Статус").selectOption("Скрыта");
  await editDialog.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect(editDialog).toHaveCount(0);
  await expect(details.getByText("115 €")).toBeVisible();
  await expect(details.getByText("Скрыта")).toBeVisible();
});

test("media workspace can upload, filter and edit an asset", async ({ page }) => {
  await page.goto("/admin?section=media", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Загрузить медиа" }).click();

  const createDialog = page.getByRole("dialog", { name: "Новое медиа" });
  await createDialog.getByLabel("Название").fill("Арома обложка");
  await createDialog.getByLabel("URL").fill("/media/services/relaxing-massage.jpg");
  await createDialog.getByLabel("Папка").fill("services");
  await createDialog.getByLabel("Тип").selectOption("Фото");
  await createDialog.getByLabel("Статус").selectOption("Готово");
  await createDialog.getByLabel("Alt-текст").fill("Арома массаж в кабинете Magic Massage Natali");
  await createDialog.getByLabel("Использование").fill("Услуга: Арома массаж, Hero сайта");
  await createDialog.getByLabel("Размер файла").fill("410 KB");
  await createDialog.getByLabel("Разрешение").fill("1600x1100");
  await createDialog.getByRole("button", { name: "Сохранить медиа" }).click();

  await expect(createDialog).toHaveCount(0);
  await expect(page.getByRole("table").getByRole("button", { name: "Арома обложка" })).toBeVisible();

  const details = page.getByLabel("Детали медиа");
  await expect(details.getByRole("heading", { name: "Арома обложка" })).toBeVisible();
  await expect(details.getByText("/media/services/relaxing-massage.jpg")).toBeVisible();
  await expect(details.getByText("Услуга: Арома массаж")).toBeVisible();

  await details.getByRole("button", { name: "Редактировать" }).click();
  const editDialog = page.getByRole("dialog", { name: "Редактировать медиа" });
  await editDialog.getByLabel("Статус").selectOption("Требует alt");
  await editDialog.getByLabel("Alt-текст").fill("Нужно уточнить alt перед публикацией");
  await editDialog.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect(editDialog).toHaveCount(0);
  await expect(details.getByText("Требует alt")).toBeVisible();
  await expect(details.getByText("Нужно уточнить alt перед публикацией")).toBeVisible();

  await page.getByRole("button", { name: "Требует alt" }).click();
  await expect(page.getByRole("button", { name: "Требует alt" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table").getByRole("button", { name: "Арома обложка" })).toBeVisible();
});

test("contacts workspace edits site settings and contact channels", async ({ page }) => {
  await page.goto("/admin?section=contacts", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Контактные настройки сайта" })).toBeVisible();
  await expect(page.getByLabel("Детали контакта").getByRole("heading", { name: "Телефон салона" })).toBeVisible();

  await page.getByRole("button", { name: "Сохранить" }).click();

  const settingsDialog = page.getByRole("dialog", { name: "Контактные настройки" });
  await settingsDialog.getByLabel("Телефон").fill("+359 87 555 0000");
  await settingsDialog.getByLabel("Адрес").fill("ул. Места 49, Бургас");
  await settingsDialog.getByRole("button", { name: "Сохранить контакты" }).click();

  await expect(settingsDialog).toHaveCount(0);
  await expect(page.getByLabel("Контактные настройки", { exact: true }).getByText("+359 87 555 0000")).toBeVisible();
  await expect(page.getByLabel("Контактные настройки", { exact: true }).getByText("ул. Места 49, Бургас")).toBeVisible();
  await expect(page.getByLabel("Детали контакта").getByText("+359 87 555 0000")).toBeVisible();

  await page.getByRole("button", { name: "Мессенджеры" }).click();
  await expect(page.getByRole("button", { name: "Мессенджеры" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table").getByRole("button", { name: "Telegram" })).toBeVisible();
  await expect(page.getByRole("table").getByRole("button", { name: "Google Maps" })).toHaveCount(0);

  const details = page.getByLabel("Детали контакта");
  await page.getByRole("table").getByRole("button", { name: "Telegram" }).click();
  await details.getByRole("button", { name: "Редактировать" }).click();

  const channelDialog = page.getByRole("dialog", { name: "Редактировать контакт" });
  await channelDialog.getByLabel("Значение").fill("https://t.me/magicmassage_burgas");
  await channelDialog.getByLabel("Статус").selectOption("Активен");
  await channelDialog.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect(channelDialog).toHaveCount(0);
  await expect(details.getByText("https://t.me/magicmassage_burgas")).toBeVisible();
  await expect(details.getByText("Активен")).toBeVisible();
});

test("blog workspace can create, filter and edit an article", async ({ page }) => {
  await page.goto("/admin?section=blog", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Контент-план блога" })).toBeVisible();
  await expect(page.getByLabel("Детали статьи").getByRole("heading", { name: "Подготовка к первому массажу" })).toBeVisible();

  await page.getByRole("button", { name: "Новая статья" }).click();

  const createDialog = page.getByRole("dialog", { name: "Новая статья" });
  await createDialog.getByLabel("Заголовок").fill("Как подготовиться к массажу");
  await createDialog.getByLabel("Slug").fill("prepare-for-massage");
  await createDialog.getByLabel("Категория").fill("Советы");
  await createDialog.getByLabel("Статус").selectOption("Черновик");
  await createDialog.getByLabel("Автор").fill("Natali");
  await createDialog.getByLabel("Дата публикации").fill("2026-07-20");
  await createDialog.getByLabel("Локали").fill("ru, bg");
  await createDialog.getByLabel("SEO title").fill("Как подготовиться к массажу в Бургасе");
  await createDialog.getByLabel("Обложка").fill("/media/blog/prepare-for-massage.jpg");
  await createDialog.getByLabel("Краткое описание").fill("Короткая памятка перед первым визитом.");
  await createDialog.getByLabel("Текст статьи").fill("Памятка помогает клиенту прийти вовремя и выбрать комфортную одежду.");
  await createDialog.getByLabel("Теги").fill("подготовка, массаж");
  await createDialog.getByRole("button", { name: "Сохранить статью" }).click();

  await expect(createDialog).toHaveCount(0);
  await expect(page.getByRole("table").getByRole("button", { name: "Как подготовиться к массажу" })).toBeVisible();

  const details = page.getByLabel("Детали статьи");
  await expect(details.getByRole("heading", { name: "Как подготовиться к массажу" })).toBeVisible();
  await expect(details.getByText("prepare-for-massage", { exact: true })).toBeVisible();
  await expect(details.getByText("Короткая памятка перед первым визитом.")).toBeVisible();

  await details.getByRole("button", { name: "Редактировать" }).click();
  const editDialog = page.getByRole("dialog", { name: "Редактировать статью" });
  await editDialog.getByLabel("Статус").selectOption("Опубликована");
  await editDialog.getByLabel("Краткое описание").fill("Обновленная памятка перед визитом.");
  await editDialog.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect(editDialog).toHaveCount(0);
  await expect(details.getByText("Опубликована")).toBeVisible();
  await expect(details.getByText("Обновленная памятка перед визитом.")).toBeVisible();

  await page.getByRole("button", { name: "Черновики" }).click();
  await expect(page.getByRole("button", { name: "Черновики" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table").getByRole("button", { name: "Лимфодренаж: когда он уместен" })).toBeVisible();
});

test("settings workspace edits booking rules and confirms dangerous actions", async ({ page }) => {
  await page.goto("/admin?section=settings", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Настройки админки" })).toBeVisible();
  const details = page.getByLabel("Детали настроек");
  await expect(details.getByRole("heading", { name: "Запись и календарь" })).toBeVisible();
  await expect(details.getByText("30 минут")).toBeVisible();

  await page.getByRole("button", { name: "Сохранить" }).click();
  const dialog = page.getByRole("dialog", { name: "Настройки админки" });
  await dialog.getByLabel("Перерыв между сеансами").fill("45");
  await dialog.getByLabel("Слотов в день").fill("5");
  await dialog.getByRole("combobox", { name: /Google Calendar/ }).selectOption("Односторонняя");
  await dialog.getByLabel("Google Calendar ID").fill("natali@example.com");
  await dialog.getByRole("button", { name: "Сохранить настройки" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(details.getByText("45 минут")).toBeVisible();
  await expect(details.getByText("5 слотов")).toBeVisible();
  await expect(details.getByText("Односторонняя")).toBeVisible();
  await expect(details.getByText("natali@example.com")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Настройки сохранены.");

  await page.getByRole("button", { name: "Роли и аудит" }).click();
  await expect(details.getByRole("heading", { name: "Роли и аудит" })).toBeVisible();
  await details.getByRole("button", { name: "Сбросить демо-данные" }).click();

  const confirmDialog = page.getByRole("dialog", { name: "Подтвердить действие" });
  await expect(confirmDialog.getByText("Опасное действие не выполняется без подтверждения владельца.")).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Подтвердить" }).click();
  await expect(confirmDialog).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Действие записано в audit log.");
});

test("users workspace invites, filters and edits accountant access", async ({ page }) => {
  await page.goto("/admin?section=users", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Пользователи админки" })).toBeVisible();
  await expect(page.getByLabel("Детали пользователя").getByText("Stripe-отчеты недоступны")).toBeVisible();

  await page.getByRole("button", { name: "Пригласить" }).click();

  const createDialog = page.getByRole("dialog", { name: "Пригласить пользователя" });
  await createDialog.getByLabel("Имя").fill("Елена Бухгалтер");
  await createDialog.getByLabel("Email").fill("accountant@example.com");
  await createDialog.getByLabel("Роль").selectOption("accountant");
  await createDialog.getByLabel("Комментарий доступа").fill("Доступ только для налоговой выгрузки Stripe.");
  await createDialog.getByRole("button", { name: "Отправить приглашение" }).click();

  await expect(createDialog).toHaveCount(0);
  await expect(page.getByRole("table").getByRole("button", { name: "Елена Бухгалтер" })).toBeVisible();

  const details = page.getByLabel("Детали пользователя");
  await expect(details.getByRole("heading", { name: "Елена Бухгалтер" })).toBeVisible();
  await expect(details.getByText("Stripe-продажи за период")).toBeVisible();
  await expect(details.getByText("Экспорт CSV/XLSX/PDF")).toBeVisible();

  await page.getByRole("button", { name: "Бухгалтеры" }).click();
  await expect(page.getByRole("button", { name: "Бухгалтеры" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table").getByRole("button", { name: "Елена Бухгалтер" })).toBeVisible();
  await expect(page.getByRole("table").getByRole("button", { name: "Natali Ivanova" })).toHaveCount(0);

  await details.getByRole("button", { name: "Редактировать" }).click();
  const editDialog = page.getByRole("dialog", { name: "Редактировать пользователя" });
  await editDialog.getByLabel("Статус").selectOption("Активен");
  await editDialog.getByLabel("Комментарий доступа").fill("Доступ подтвержден владельцем для налоговой отчетности.");
  await editDialog.getByRole("button", { name: "Сохранить пользователя" }).click();

  await expect(editDialog).toHaveCount(0);
  await expect(details.getByText("Активен", { exact: true })).toBeVisible();
  await expect(details.getByText("Доступ подтвержден владельцем для налоговой отчетности.")).toBeVisible();
});

test("client profile opens prefilled calendar appointment creation", async ({ page }) => {
  await page.goto("/admin?section=clients&client=Olena%20K.", { waitUntil: "networkidle" });

  const card = page.getByRole("dialog", { name: "Карточка клиента" });
  await card.getByRole("link", { name: "Записать клиента" }).click();

  await expect(page).toHaveURL(/section=calendar/);
  await expect(page).toHaveURL(/action=create/);

  const dialog = page.getByRole("dialog", { name: "Новая запись" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Клиент")).toHaveValue("Olena K.");
});

test("client filters update the table and profile certificate block", async ({ page }) => {
  await page.goto("/admin?section=clients", { waitUntil: "networkidle" });

  const table = page.getByRole("table");
  const card = page.getByRole("dialog", { name: "Карточка клиента" });

  await page.getByRole("button", { name: "BG" }).click();
  await expect(page.getByRole("button", { name: "BG" })).toHaveAttribute("aria-pressed", "true");
  await expect(table.getByRole("row", { name: /Maria Georgieva/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Olena K./ })).toHaveCount(0);
  await page.getByRole("button", { name: "Maria Georgieva" }).click();
  await expect(card.getByRole("heading", { name: "Maria Georgieva" })).toBeVisible();

  await card.getByRole("button", { name: "Закрыть" }).click();
  await expect(card).toHaveCount(0);

  await page.getByRole("button", { name: "Все" }).click();
  await page.getByRole("button", { name: "Olena K." }).click();

  await expect(card.getByRole("heading", { name: "Сертификаты" })).toBeVisible();
  await expect(card.getByText("MMN-2407-1023")).toBeVisible();
  await expect(card.getByText("250 €")).toBeVisible();
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

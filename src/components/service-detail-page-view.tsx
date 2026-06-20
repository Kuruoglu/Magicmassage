import Image from "next/image";
import Link from "next/link";

import type { ServiceContent } from "@/content/public-pages";
import type { Locale } from "@/i18n/config";

type ServiceDetailPageViewProps = {
  locale: Locale;
  service: ServiceContent;
  bookingAction: string;
};

const localized = {
  bg: {
    eyebrow: "Вид масаж",
    back: "Всички масажи",
    suitableTitle: "За какво е подходящ",
    suitableText:
      "Подходящ е, когато търсите целенасочена грижа, повече лекота в тялото и спокоен ритъм след натоварен ден.",
    sessionTitle: "Как протича сеансът",
    sessionText:
      "Сеансът започва с кратък разговор за Вашия комфорт, зони на напрежение и предпочитана интензивност. Работата се адаптира според усещането Ви.",
    noteTitle: "Преди записване",
    noteText:
      "Ако имате силна болка, скорошна травма, бременност или медицинско състояние, споделете това преди посещението, за да се избере подходящ подход.",
  },
  ru: {
    eyebrow: "Вид массажа",
    back: "Все массажи",
    suitableTitle: "Для чего подходит",
    suitableText:
      "Подходит, если вам нужна направленная забота, больше легкости в теле и спокойный ритм после нагрузки или напряженного дня.",
    sessionTitle: "Как проходит сеанс",
    sessionText:
      "Сеанс начинается с короткого разговора о вашем комфорте, зонах напряжения и желаемой интенсивности. Работа адаптируется по вашим ощущениям.",
    noteTitle: "Перед записью",
    noteText:
      "Если есть сильная боль, недавняя травма, беременность или медицинское состояние, сообщите об этом до визита, чтобы подобрать подходящий формат.",
  },
  ua: {
    eyebrow: "Вид масажу",
    back: "Усі масажі",
    suitableTitle: "Для чого підходить",
    suitableText:
      "Підходить, якщо вам потрібен спрямований догляд, більше легкості в тілі та спокійний ритм після навантаження або напруженого дня.",
    sessionTitle: "Як проходить сеанс",
    sessionText:
      "Сеанс починається з короткої розмови про ваш комфорт, зони напруження та бажану інтенсивність. Робота адаптується за вашими відчуттями.",
    noteTitle: "Перед записом",
    noteText:
      "Якщо є сильний біль, нещодавня травма, вагітність або медичний стан, повідомте про це до візиту, щоб підібрати відповідний формат.",
  },
  en: {
    eyebrow: "Massage type",
    back: "All massages",
    suitableTitle: "What it is suitable for",
    suitableText:
      "Suitable when you need focused care, more lightness in the body and a calmer rhythm after a busy or tense day.",
    sessionTitle: "How the session works",
    sessionText:
      "The session starts with a short conversation about your comfort, tension areas and preferred intensity. The work is adapted to how you feel.",
    noteTitle: "Before booking",
    noteText:
      "If you have strong pain, a recent injury, pregnancy or a medical condition, please mention it before the visit so the right format can be chosen.",
  },
} satisfies Record<Locale, Record<string, string>>;

export function ServiceDetailPageView({
  locale,
  service,
  bookingAction,
}: ServiceDetailPageViewProps) {
  const copy = localized[locale];

  return (
    <main>
      <section className="page-hero service-detail-hero section-pad">
        <div className="section-inner service-detail-hero-inner">
          <div>
            <p className="eyebrow eyebrow-light">{copy.eyebrow}</p>
            <h1>{service.title}</h1>
            <p>{service.description}</p>
            <div className="service-detail-actions">
              <Link className="button" href={`/${locale}#booking`}>
                {bookingAction}
              </Link>
              <Link className="text-link text-link-light" href={`/${locale}/services`}>
                {copy.back} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <div className="service-detail-image">
            <Image
              src={service.image}
              alt={service.imageAlt}
              fill
              priority
              sizes="(max-width: 900px) 92vw, 38vw"
            />
          </div>
        </div>
      </section>

      <section className="service-detail-body section-pad">
        <div className="section-inner">
          <div className="service-detail-lead">
            <p className="eyebrow">{service.slug.replaceAll("-", " ")}</p>
            <h2>{service.title}</h2>
            <p>{service.description}</p>
          </div>

          {service.detailParagraphs.length > 0 ? (
            <div className="service-detail-copy">
              {service.detailParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : null}

          <div className="service-detail-grid">
            <article>
              <span aria-hidden="true">01</span>
              <h3>{copy.suitableTitle}</h3>
              <p>{copy.suitableText}</p>
            </article>
            <article>
              <span aria-hidden="true">02</span>
              <h3>{copy.sessionTitle}</h3>
              <p>{copy.sessionText}</p>
            </article>
            <article>
              <span aria-hidden="true">03</span>
              <h3>{copy.noteTitle}</h3>
              <p>{copy.noteText}</p>
            </article>
          </div>

          <div className="service-detail-cta">
            <p>{service.description}</p>
            <Link className="button" href={`/${locale}#booking`}>
              {bookingAction}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

import { useState } from 'react';
import {
    BookOpen, Bot, MessageSquare, Brain, Send,
    Search, BarChart3, ChevronDown, ChevronUp,
    AlertTriangle, CheckCircle, Zap, Shield
} from 'lucide-react';

const SECTIONS = [
    {
        id: 'start',
        icon: <Zap size={20} />,
        title: 'Быстрый старт',
        color: 'var(--neon-cyan)',
        content: (
            <div className="guide-content">
                <p>Следуйте этим шагам, чтобы запустить систему с нуля:</p>
                <ol className="guide-steps">
                    <li>
                        <span className="guide-step-num">1</span>
                        <div>
                            <strong>Авторизуйтесь в Telegram</strong>
                            <p>Перейдите во вкладку <b>Telegram</b>, получите API ID и API Hash на <a href="https://my.telegram.org" target="_blank" rel="noreferrer">my.telegram.org</a>, введите номер телефона и подтвердите код.</p>
                        </div>
                    </li>
                    <li>
                        <span className="guide-step-num">2</span>
                        <div>
                            <strong>Настройте мониторинг</strong>
                            <p>Перейдите во вкладку <b>Мониторинг</b> и добавьте чаты, которые хотите отслеживать. Создайте фильтры по ключевым словам или регулярным выражениям.</p>
                        </div>
                    </li>
                    <li>
                        <span className="guide-step-num">3</span>
                        <div>
                            <strong>Подключите AI (опционально)</strong>
                            <p>В разделе <b>AI & RAG</b> добавьте API-ключ OpenAI, Anthropic или другого провайдера для умных автоответов.</p>
                        </div>
                    </li>
                    <li>
                        <span className="guide-step-num">4</span>
                        <div>
                            <strong>Запустите рассылку или мониторинг</strong>
                            <p>Используйте вкладку <b>Рассылка</b> для массовых сообщений или <b>Дашборд</b> для просмотра статистики в реальном времени.</p>
                        </div>
                    </li>
                </ol>
            </div>
        ),
    },
    {
        id: 'auth',
        icon: <Bot size={20} />,
        title: 'Авторизация Telegram',
        color: 'var(--neon-cyan)',
        content: (
            <div className="guide-content">
                <p>Авторизация использует <b>Telethon</b> — официальную библиотеку Telegram MTProto. Ваши данные хранятся только на вашем сервере.</p>
                <h4>Что вам потребуется:</h4>
                <ul className="guide-list">
                    <li><b>Номер телефона</b> — в международном формате (+79001234567)</li>
                    <li><b>API ID</b> — числовой идентификатор (например: 12345678)</li>
                    <li><b>API Hash</b> — строка из 32 символов</li>
                    <li><b>Код из Telegram</b> — приходит в приложение после запроса</li>
                    <li><b>Пароль 2FA</b> — только если включена двухфакторная аутентификация</li>
                </ul>
                <div className="guide-warn">
                    <AlertTriangle size={16} />
                    <span>Не передавайте API-ключи и session string третьим лицам. Это равносильно полному доступу к аккаунту.</span>
                </div>
                <h4>Как получить API ID и API Hash:</h4>
                <ol className="guide-steps guide-steps--small">
                    <li><span className="guide-step-num guide-step-num--sm">1</span><div>Откройте <a href="https://my.telegram.org" target="_blank" rel="noreferrer">my.telegram.org</a> и войдите с номером вашего Telegram-аккаунта</div></li>
                    <li><span className="guide-step-num guide-step-num--sm">2</span><div>Нажмите <b>«API development tools»</b></div></li>
                    <li><span className="guide-step-num guide-step-num--sm">3</span><div>Заполните форму: любое название и короткое имя приложения (например «myparser»)</div></li>
                    <li><span className="guide-step-num guide-step-num--sm">4</span><div>Скопируйте <b>App api_id</b> и <b>App api_hash</b></div></li>
                </ol>
            </div>
        ),
    },
    {
        id: 'monitoring',
        icon: <MessageSquare size={20} />,
        title: 'Мониторинг чатов',
        color: 'var(--neon-magenta)',
        content: (
            <div className="guide-content">
                <p>Система отслеживает входящие сообщения в выбранных чатах и применяет фильтры в реальном времени.</p>
                <h4>Фильтры сообщений:</h4>
                <div className="guide-cards">
                    <div className="guide-card">
                        <div className="guide-card-title">🔍 Ключевое слово</div>
                        <p>Простой поиск подстроки. Например: <code>куплю</code>, <code>продам</code>, <code>нужен</code></p>
                    </div>
                    <div className="guide-card">
                        <div className="guide-card-title">⚡ Regex</div>
                        <p>Регулярные выражения. Например: <code>\bцена\b|\bстоимость\b</code></p>
                    </div>
                    <div className="guide-card">
                        <div className="guide-card-title">🤖 AI-фильтр</div>
                        <p>Классификация через языковую модель. Например: «сообщения с вопросами о стоимости»</p>
                    </div>
                </div>
                <h4>Автоответы:</h4>
                <ul className="guide-list">
                    <li><b>Шаблон</b> — фиксированный текст, отправляется сразу</li>
                    <li><b>AI-генерация</b> — ответ формируется языковой моделью</li>
                    <li><b>RAG</b> — ответ на основе загруженных документов (база знаний)</li>
                </ul>
                <div className="guide-warn">
                    <AlertTriangle size={16} />
                    <span>Автоответы отправляются от имени вашего аккаунта. Соблюдайте правила Telegram, чтобы избежать ограничений.</span>
                </div>
            </div>
        ),
    },
    {
        id: 'ai',
        icon: <Brain size={20} />,
        title: 'AI & RAG',
        color: 'var(--neon-purple)',
        content: (
            <div className="guide-content">
                <p>Модуль AI позволяет генерировать ответы с помощью языковых моделей и искать по базе знаний (RAG).</p>
                <h4>Поддерживаемые провайдеры:</h4>
                <div className="guide-cards">
                    <div className="guide-card"><div className="guide-card-title">🟢 OpenAI</div><p>GPT-4, GPT-3.5. Требует API-ключ с platform.openai.com</p></div>
                    <div className="guide-card"><div className="guide-card-title">🟠 Anthropic</div><p>Claude 3+. Ключ с console.anthropic.com</p></div>
                    <div className="guide-card"><div className="guide-card-title">🔵 Google AI</div><p>Gemini Pro. Ключ с makersuite.google.com</p></div>
                    <div className="guide-card"><div className="guide-card-title">🟣 Local</div><p>Любая локальная модель с OpenAI-совместимым API (LM Studio, Ollama)</p></div>
                </div>
                <h4>Как работает RAG:</h4>
                <ol className="guide-steps guide-steps--small">
                    <li><span className="guide-step-num guide-step-num--sm">1</span><div>Загрузите документы (FAQ, прайс, инструкции) во вкладке AI & RAG</div></li>
                    <li><span className="guide-step-num guide-step-num--sm">2</span><div>Система разбивает их на чанки и создаёт векторные embeddings</div></li>
                    <li><span className="guide-step-num guide-step-num--sm">3</span><div>При вопросе пользователя система находит релевантные куски и передаёт их в LLM</div></li>
                    <li><span className="guide-step-num guide-step-num--sm">4</span><div>LLM формирует ответ, опираясь на ваши данные</div></li>
                </ol>
            </div>
        ),
    },
    {
        id: 'broadcast',
        icon: <Send size={20} />,
        title: 'Рассылка',
        color: 'var(--neon-green)',
        content: (
            <div className="guide-content">
                <p>Массовая отправка сообщений через активную Telegram-сессию.</p>
                <h4>Форматы получателей:</h4>
                <div className="guide-code-block">
                    <div>@username</div>
                    <div>t.me/username</div>
                    <div>https://t.me/username</div>
                </div>
                <p style={{ marginTop: 12 }}>Каждый получатель — с новой строки (или через запятую). Система сама распознаёт формат.</p>
                <h4>Задержка между отправками:</h4>
                <ul className="guide-list">
                    <li>Минимально рекомендуемая задержка — <b>3 секунды</b></li>
                    <li>Для больших списков (100+) используйте <b>5–10 секунд</b></li>
                    <li>Telegram автоматически ограничивает аккаунты при слишком быстрой отправке (FloodWait)</li>
                </ul>
                <div className="guide-warn guide-warn--green">
                    <CheckCircle size={16} />
                    <span>Рассылка выполняется в фоне. Вы можете закрыть вкладку — процесс продолжится на сервере. Статус доступен в истории.</span>
                </div>
                <div className="guide-warn">
                    <AlertTriangle size={16} />
                    <span>Массовые рассылки незнакомым людям нарушают правила Telegram. Используйте только для аудитории, которая знакома с вашим аккаунтом.</span>
                </div>
            </div>
        ),
    },
    {
        id: 'search',
        icon: <Search size={20} />,
        title: 'Поиск по переписке',
        color: 'var(--neon-cyan)',
        content: (
            <div className="guide-content">
                <p>Семантический поиск по всей истории ваших диалогов с использованием векторных embeddings.</p>
                <h4>Возможности:</h4>
                <ul className="guide-list">
                    <li>Поиск по <b>смыслу</b>, а не только по точному совпадению</li>
                    <li>Поиск по конкретному <b>контакту или чату</b></li>
                    <li>Фильтрация по <b>дате</b></li>
                    <li>Просмотр <b>контекста</b> — соседних сообщений вокруг найденного</li>
                </ul>
                <p>Чтобы поиск работал, нужно сначала загрузить историю диалогов через <b>Мониторинг → Синхронизация сообщений</b>.</p>
            </div>
        ),
    },
    {
        id: 'stats',
        icon: <BarChart3 size={20} />,
        title: 'Дашборд и статистика',
        color: 'var(--neon-cyan)',
        content: (
            <div className="guide-content">
                <p>Главная страница показывает ключевые метрики вашей системы в реальном времени.</p>
                <h4>Что отображается:</h4>
                <div className="guide-cards">
                    <div className="guide-card"><div className="guide-card-title">📊 Сообщения</div><p>Количество отслеженных сообщений за сегодня и всего</p></div>
                    <div className="guide-card"><div className="guide-card-title">✅ Совпадения</div><p>Сколько сообщений совпало с вашими фильтрами</p></div>
                    <div className="guide-card"><div className="guide-card-title">💬 Ответы</div><p>Отправленные автоответы — успешные и с ошибками</p></div>
                    <div className="guide-card"><div className="guide-card-title">🔗 Сессии</div><p>Активные Telegram-сессии</p></div>
                </div>
                <p>График внизу показывает динамику за последние 7 дней.</p>
            </div>
        ),
    },
    {
        id: 'safety',
        icon: <Shield size={20} />,
        title: 'Безопасность',
        color: 'var(--neon-pink)',
        content: (
            <div className="guide-content">
                <div className="guide-warn">
                    <AlertTriangle size={16} />
                    <span>Прочитайте этот раздел внимательно. Несоблюдение рекомендаций может привести к блокировке аккаунта.</span>
                </div>
                <h4>Рекомендации:</h4>
                <ul className="guide-list">
                    <li>🔑 Никогда не передавайте <b>session string</b> третьим лицам</li>
                    <li>🛡️ Используйте отдельный Telegram-аккаунт для автоматизации</li>
                    <li>⏱️ Соблюдайте задержки в рассылках (минимум 3 сек)</li>
                    <li>📋 Не отправляйте спам и рекламу без согласия получателей</li>
                    <li>🔄 Регулярно делайте backup базы данных</li>
                    <li>🔒 Ограничьте доступ к панели управления по IP</li>
                    <li>🔐 Смените пароль по умолчанию (admin/admin) сразу после установки</li>
                </ul>
                <h4>Ограничения Telegram:</h4>
                <ul className="guide-list">
                    <li><b>FloodWait</b> — происходит при слишком частых действиях. Сервис автоматически ждёт и повторяет попытку</li>
                    <li><b>SpamBlock</b> — длительная блокировка за спам. Восстановление занимает от нескольких дней до недель</li>
                    <li><b>Аккаунт-бот</b> — аккаунты с признаками автоматизации могут быть помечены Telegram как боты</li>
                </ul>
            </div>
        ),
    },
];

function AccordionItem({ section }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={`guide-accordion-item ${open ? 'open' : ''}`}>
            <button className="guide-accordion-header" onClick={() => setOpen(o => !o)}>
                <span className="guide-accordion-icon" style={{ color: section.color }}>
                    {section.icon}
                </span>
                <span className="guide-accordion-title">{section.title}</span>
                {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {open && (
                <div className="guide-accordion-body">
                    {section.content}
                </div>
            )}
        </div>
    );
}

export default function Guide() {
    return (
        <div className="guide-page">
            <div className="page-header">
                <h1 className="page-title" style={{
                    background: 'linear-gradient(135deg, var(--neon-cyan), var(--neon-purple))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                }}>
                    📖 Инструкция
                </h1>
                <p className="page-subtitle">
                    Полное руководство по использованию Telegram Parser
                </p>
            </div>

            {/* Quick nav badges */}
            <div className="guide-nav-badges">
                {SECTIONS.map(s => (
                    <button
                        key={s.id}
                        className="guide-badge"
                        style={{ '--badge-color': s.color }}
                        onClick={() => {
                            document.getElementById(`guide-${s.id}`)?.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        {s.icon}
                        {s.title}
                    </button>
                ))}
            </div>

            {/* Accordion */}
            <div className="guide-accordion">
                {SECTIONS.map(s => (
                    <div key={s.id} id={`guide-${s.id}`}>
                        <AccordionItem section={s} />
                    </div>
                ))}
            </div>
        </div>
    );
}

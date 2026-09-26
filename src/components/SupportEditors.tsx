import styles from './app.module.css';
import type { T } from '../lib/i18n';
import { removeArticleAction, removeContactAction, saveArticleAction, saveContactAction } from '../lib/manage/support-actions';

type Contact = { id: string; title: string; description: string | null; phone: string | null; email: string | null; url: string | null; hours: string | null; emergency: boolean; sortOrder: number };
type Article = { id: string; title: string; body: string; locale: string; sortOrder: number };

function ContactFields({ t, c }: { t: T; c?: Contact }) {
  const f = (name: keyof Contact, label: Parameters<T>[0], type = 'text') => (
    <label className={styles.field} key={name}>
      {t(label)}
      <input className={styles.input} name={name} type={type} defaultValue={c ? String(c[name] ?? '') : ''} required={name === 'title'} />
    </label>
  );
  return (
    <>
      {f('title', 'settings.contactTitle')}
      {f('phone', 'settings.phone', 'tel')}
      {f('email', 'settings.email', 'email')}
      {f('hours', 'settings.hours')}
      {f('url', 'settings.url', 'url')}
      {f('description', 'settings.contactDesc')}
      <label className={styles.check} key="emergency">
        <input type="checkbox" name="emergency" value="1" defaultChecked={c?.emergency} />
        {t('settings.emergency')}
      </label>
    </>
  );
}

function ArticleFields({ t, a }: { t: T; a?: Article }) {
  return (
    <>
      <label className={styles.field} key="title">
        {t('settings.articleTitle')}
        <input className={styles.input} name="title" defaultValue={a?.title ?? ''} required maxLength={160} />
      </label>
      <label className={styles.field} key="locale">
        {t('settings.locale')}
        <select className={styles.select} name="locale" defaultValue={a?.locale ?? 'fi'}>
          <option value="fi">Suomi</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className={`${styles.field} ${styles.full}`} key="body">
        {t('settings.articleBody')}
        <textarea className={styles.textarea} style={{ fontFamily: 'inherit', fontSize: 15 }} name="body" defaultValue={a?.body ?? ''} required maxLength={8000} />
      </label>
    </>
  );
}

// Contact details and help articles an organization manages itself.
export default function SupportEditors({ t, contacts, articles }: { t: T; contacts: Contact[]; articles: Article[] }) {
  return (
    <>
      <section className={styles.card} id="contacts">
        <h2 className={styles.h2}>{t('settings.contacts')}</h2>
        <p className={styles.muted}>{t('settings.contactsLede')}</p>
        {contacts.map((c) => (
          <details key={c.id} className={styles.details}>
            <summary>
              {c.title} {c.phone ? `· ${c.phone}` : ''}
            </summary>
            <form action={saveContactAction} className={styles.form}>
              <input type="hidden" name="id" value={c.id} />
              <ContactFields t={t} c={c} />
              <button className={styles.btn}>{t('settings.save')}</button>
            </form>
            <form action={removeContactAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={c.id} />
              <button className={styles.btnDanger}>{t('settings.remove')}</button>
            </form>
          </details>
        ))}
        <details className={styles.details}>
          <summary>{t('settings.addContact')}</summary>
          <form action={saveContactAction} className={styles.form}>
            <ContactFields t={t} />
            <button className={styles.btn}>{t('settings.addContact')}</button>
          </form>
        </details>
      </section>

      <section className={styles.card} id="help">
        <h2 className={styles.h2}>{t('settings.help')}</h2>
        <p className={styles.muted}>{t('settings.helpLede')}</p>
        {articles.map((a) => (
          <details key={a.id} className={styles.details}>
            <summary>
              {a.title} <span className={styles.muted}>({a.locale})</span>
            </summary>
            <form action={saveArticleAction} className={styles.form}>
              <input type="hidden" name="id" value={a.id} />
              <ArticleFields t={t} a={a} />
              <button className={styles.btn}>{t('settings.save')}</button>
            </form>
            <form action={removeArticleAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={a.id} />
              <button className={styles.btnDanger}>{t('settings.remove')}</button>
            </form>
          </details>
        ))}
        <details className={styles.details}>
          <summary>{t('settings.addArticle')}</summary>
          <form action={saveArticleAction} className={styles.form}>
            <ArticleFields t={t} />
            <button className={styles.btn}>{t('settings.addArticle')}</button>
          </form>
        </details>
      </section>
    </>
  );
}

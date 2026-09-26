import type { Metadata } from 'next';
import AppShell from '../../../components/AppShell';
import styles from '../../../components/app.module.css';
import shell from '../../../components/shell.module.css';
import { requireResident } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import { residentContext } from '../../../lib/booking/engine';
import { turnHours } from '../../../lib/booking/rules';
import { hh } from '../../../lib/booking/time';

export const metadata: Metadata = { title: 'Help and rules' };

// The organization's own articles, plus booking rules generated from the
// facilities in the resident's building, so they are never out of date.
export default async function HelpPage() {
  const { org, scope, viewer } = await requireResident();
  const { t, locale } = await getT(org);
  const ctx = await residentContext(scope, viewer.id);
  const [articles, facilities] = await Promise.all([
    scope.help.q().where({ locale }).orderBy((a) => a.sortOrder.asc()).all(),
    ctx ? scope.facilities.q().where({ buildingId: ctx.buildingId }).orderBy((f) => f.name.asc()).all() : Promise.resolve([]),
  ]);
  const kinds = [...new Map(facilities.filter((f) => f.kind !== 'parking').map((f) => [f.kind, f])).values()];

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/book/help" title={t('help.title')}>
      <p className={styles.lede}>{t('help.lede')}</p>
      {articles.length === 0 ? (
        <p className={styles.empty}>{t('help.none')}</p>
      ) : (
        <div className={shell.faq}>
          {articles.map((a, i) => (
            <details key={a.id} className={shell.faqItem} open={i === 0}>
              <summary>{a.title}</summary>
              <div className={shell.faqBody}>{a.body}</div>
            </details>
          ))}
        </div>
      )}
      {kinds.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('help.facilityRules')}</h2>
          <ul className={styles.list}>
            {kinds.map((f) => {
              const turns = turnHours(f);
              const parts = [
                turns ? t('board.turns', { hours: turns.map((h) => hh(h)).join(', ') }) : t('board.open', { from: hh(f.openHour), to: hh(f.closeHour) }),
                t('board.weekly', { n: f.maxHoursPerWeek }),
                t('board.ahead', { n: f.advanceDays }),
                f.cancelCutoffMinutes ? t('board.cancelRule', { n: f.cancelCutoffMinutes }) : t('board.anytime'),
                f.checkInOpensMinutes ? t('checkin.rule', { before: f.checkInOpensMinutes, after: f.checkInGraceMinutes }) : null,
              ].filter(Boolean);
              return (
                <li key={f.kind} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{t(`kind.${f.kind}` as Parameters<typeof t>[0])}</span>
                    <span className={styles.muted}>{parts.join(' · ')}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </AppShell>
  );
}

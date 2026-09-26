import type { Metadata } from 'next';
import AppShell from '../../../components/AppShell';
import KindIcon from '../../../components/KindIcon';
import styles from '../../../components/app.module.css';
import shell from '../../../components/shell.module.css';
import { requireResident } from '../../../lib/auth/access';
import { getT } from '../../../lib/i18n';
import { residentContext } from '../../../lib/booking/engine';
import { turnHours } from '../../../lib/booking/rules';
import { hh } from '../../../lib/booking/time';

export const metadata: Metadata = { title: 'Help and rules' };

const ICON = {
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5ZM4 19a2 2 0 0 1 2-2h13v4H6a2 2 0 0 1-2-2ZM9 7h6M9 11h4',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  cal: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-6.7L3 9',
  gauge: 'M12 14l4-4M3.3 17a10 10 0 1 1 17.4 0',
  check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
};

function Svg({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// An article body becomes separate points: one per paragraph (or per line when
// there are no blank lines).
function points(body: string): string[] {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.length > 1 ? paragraphs : body.split('\n').map((p) => p.trim()).filter(Boolean);
}

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
  const kindName = (kind: string) => t(`kind.${kind}` as Parameters<typeof t>[0]);
  // An article about a facility (its title names it) gets that facility's icon.
  const kindOf = (title: string) => ['laundry', 'sauna', 'parking', 'gym', 'common_room', 'study_room', 'grill'].find((k) => title.toLowerCase().includes(kindName(k).toLowerCase()));

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/book/help" title={t('help.title')}>
      <p className={styles.lede}>{t('help.lede')}</p>
      {articles.length === 0 ? (
        <p className={styles.empty}>{t('help.none')}</p>
      ) : (
        <div className={shell.helpList}>
          {articles.map((a, i) => {
            const list = points(a.body);
            const kind = kindOf(a.title);
            return (
              <details key={a.id} className={shell.helpCard} open={i === 0} name="help">
                <summary className={shell.helpHead}>
                  <span className={shell.helpIcon}>{kind ? <KindIcon kind={kind} size={22} /> : <Svg d={ICON.book} size={22} />}</span>
                  <span className={shell.helpTitle}>
                    <strong>{a.title}</strong>
                    <span>{t('help.points', { n: list.length })}</span>
                  </span>
                  <span className={shell.helpToggle} aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <ol className={shell.helpPoints}>
                  {list.map((p, n) => (
                    <li key={n}>
                      <span className={shell.helpNum}>{n + 1}</span>
                      <p>{p}</p>
                    </li>
                  ))}
                </ol>
              </details>
            );
          })}
        </div>
      )}
      {kinds.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('help.facilityRules')}</h2>
          {kinds.map((f) => {
            const turns = turnHours(f);
            const tiles: Array<[string, string]> = [
              [ICON.clock, turns ? t('board.turns', { hours: turns.map((h) => hh(h)).join(', ') }) : t('board.open', { from: hh(f.openHour), to: hh(f.closeHour) })],
              [ICON.gauge, t('board.weekly', { n: f.maxHoursPerWeek })],
              [ICON.cal, t('board.ahead', { n: f.advanceDays })],
              [ICON.undo, f.cancelCutoffMinutes ? t('board.cancelRule', { n: f.cancelCutoffMinutes }) : t('board.anytime')],
            ];
            if (f.checkInOpensMinutes) tiles.push([ICON.check, t('checkin.rule', { before: f.checkInOpensMinutes, after: f.checkInGraceMinutes })]);
            return (
              <div key={f.kind} className={shell.ruleCard}>
                <div className={shell.ruleCardHead}>
                  <span className={shell.helpIcon}>
                    <KindIcon kind={f.kind} size={22} />
                  </span>
                  <strong>{kindName(f.kind)}</strong>
                </div>
                <ul className={shell.ruleTiles}>
                  {tiles.map(([d, text]) => (
                    <li key={text}>
                      <span className={shell.ruleTileIcon}>
                        <Svg d={d} />
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </AppShell>
  );
}

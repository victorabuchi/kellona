import Link from 'next/link';
import AppShell from '../../../../components/AppShell';
import AmenityForm from '../../../../components/AmenityForm';
import RuleFields from '../../../../components/RuleFields';
import styles from '../../../../components/app.module.css';
import { requireStaffBuilding } from '../../../../lib/auth/access';
import { getT } from '../../../../lib/i18n';
import type { MessageKey } from '../../../../lib/i18n/messages';
import { AMENITY_KINDS } from '../../../../lib/booking/kinds';
import { fmtWhen } from '../../../../lib/booking/format';
import { nowMs } from '../../../../lib/booking/time';
import { setOutOfOrderAction } from '../../../../lib/manage/support-actions';
import { addFacilityAction, addUnitAction, removeFacilityAction, saveFacilityAction, staffCancelBookingAction } from '../../../../lib/manage/actions';
import type { FacilityRow } from '../../../../lib/booking/engine';

export default async function BuildingPage({ params }: PageProps<'/manage/b/[buildingId]'>) {
  const { buildingId } = await params;
  const { org, scope, viewer } = await requireStaffBuilding(buildingId);
  const { t, locale } = await getT(org);
  const nowIso = new Date(nowMs()).toISOString();

  const [building, facilities, buildingStates, units] = await Promise.all([
    scope.buildings.q().where({ id: buildingId }).first(),
    scope.facilities.q().where({ buildingId }).orderBy((f) => f.kind.asc()).orderBy((f) => f.name.asc()).all(),
    scope.buildingAmenities.q().where({ buildingId }).all(),
    scope.units.q().where({ buildingId }).orderBy((u) => u.code.asc()).all(),
  ]);
  const unitIds = units.map((u) => u.id);
  const facilityIds = facilities.map((f) => f.id);
  const [unitStates, residents, bookings] = await Promise.all([
    unitIds.length ? scope.unitAmenities.q().where((a) => a.unitId.in(unitIds)).all() : Promise.resolve([]),
    unitIds.length ? scope.residents.q().where((r) => r.unitId.in(unitIds)).all() : Promise.resolve([]),
    facilityIds.length
      ? scope.bookings
          .q()
          .where((b) => b.facilityId.in(facilityIds))
          .where((b) => b.endsAt.gte(nowIso))
          .include('facility', (f) => f)
          .include('resident', (r) => r)
          .orderBy((b) => b.startsAt.asc())
          .limit(100)
          .all()
      : Promise.resolve([]),
  ]);
  const states = (rows: Array<{ kind: string; enabled: boolean }>) => Object.fromEntries(rows.map((r) => [r.kind, r.enabled]));

  return (
    <AppShell org={org} viewer={viewer} t={t} active="/manage" title={building!.name}>
      <Link href="/manage" className={styles.muted}>
        {t('manage.title')}
      </Link>

      <section className={styles.section} id="facilities">
        <h2 className={styles.h2}>{t('manage.facilitiesHeading')}</h2>
        {facilities.length === 0 ? (
          <p className={styles.empty}>{t('manage.noFacilities')}</p>
        ) : (
          <ul className={styles.list}>
            {facilities.map((f) => (
              <li key={f.id} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>
                    {f.name} {f.outOfOrder && <span className={styles.alert} style={{ padding: '1px 8px', fontSize: 12 }}>{t('outOfOrder.label')}</span>}
                  </span>
                  <span className={styles.muted}>
                    {t(`kind.${f.kind}` as MessageKey)}
                    {f.kind !== 'parking' && ` · ${f.turnStartHours ? f.turnStartHours.split(',').map((h) => `${h}:00`).join(', ') : `${f.openHour}:00-${f.closeHour}:00`}`}
                  </span>
                </span>
                <span className={styles.actions}>
                  {f.outOfOrder ? (
                    <form action={setOutOfOrderAction}>
                      <input type="hidden" name="buildingId" value={buildingId} />
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="on" value="0" />
                      <button className={styles.btn}>{t('outOfOrder.clear')}</button>
                    </form>
                  ) : (
                    <details className={styles.inline}>
                      <summary className={styles.btnGhost}>{t('outOfOrder.toggle')}</summary>
                      <form action={setOutOfOrderAction} className={styles.form} style={{ marginTop: 8 }}>
                        <input type="hidden" name="buildingId" value={buildingId} />
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="on" value="1" />
                        <input className={styles.input} name="note" placeholder={t('outOfOrder.note')} maxLength={240} />
                        <button className={styles.btnDanger}>{t('outOfOrder.toggle')}</button>
                      </form>
                    </details>
                  )}
                  <a className={styles.btnGhost} href={`/manage/qr/${f.id}`} target="_blank" rel="noreferrer">
                    {t('manage.qr')}
                  </a>
                  <form action={removeFacilityAction}>
                    <input type="hidden" name="buildingId" value={buildingId} />
                    <input type="hidden" name="id" value={f.id} />
                    <button className={styles.btnDanger}>{t('manage.remove')}</button>
                  </form>
                </span>
                {f.kind !== 'parking' && (
                  <details className={`${styles.details} ${styles.full}`} style={{ flexBasis: '100%' }}>
                    <summary>{t('manage.editRules')}</summary>
                    <form action={saveFacilityAction} className={styles.form}>
                      <input type="hidden" name="buildingId" value={buildingId} />
                      <input type="hidden" name="id" value={f.id} />
                      <label className={styles.field}>
                        {t('manage.name')}
                        <input className={styles.input} name="name" defaultValue={f.name} maxLength={80} />
                      </label>
                      <label className={styles.field}>
                        {t('manage.description')}
                        <input className={styles.input} name="description" defaultValue={f.description ?? ''} maxLength={240} />
                      </label>
                      <RuleFields t={t} rules={f as FacilityRow} />
                      <button className={styles.btn}>{t('manage.save')}</button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        <details className={styles.card}>
          <summary className={styles.rowTitle}>{t('manage.addFacility')}</summary>
          <form action={addFacilityAction} className={styles.form}>
            <input type="hidden" name="buildingId" value={buildingId} />
            <label className={styles.field}>
              {t('manage.kind')}
              <select name="kind" className={styles.select} defaultValue="laundry">
                {AMENITY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`kind.${k}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              {t('manage.name')}
              <input className={styles.input} name="name" required maxLength={80} />
            </label>
            <label className={styles.field}>
              {t('manage.description')}
              <input className={styles.input} name="description" maxLength={240} />
            </label>
            <span className={`${styles.hint} ${styles.full}`}>{t('manage.rulesHint')}</span>
            <RuleFields t={t} />
            <button className={styles.btn}>{t('manage.add')}</button>
          </form>
        </details>
      </section>

      <section className={styles.section} id="amenities">
        <h2 className={styles.h2}>{t('manage.amenities')}</h2>
        <p className={styles.muted}>{t('manage.amenitiesLede')}</p>
        <div className={styles.card}>
          <AmenityForm t={t} buildingId={buildingId} states={states(buildingStates)} />
        </div>
      </section>

      <section className={styles.section} id="apartments">
        <h2 className={styles.h2}>{t('manage.apartments')}</h2>
        {units.length === 0 ? (
          <p className={styles.empty}>{t('manage.noUnits')}</p>
        ) : (
          <ul className={styles.list}>
            {units.map((u) => {
              const own = unitStates.filter((s) => s.unitId === u.id);
              const people = residents.filter((r) => r.unitId === u.id);
              return (
                <li key={u.id} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{u.code}</span>
                    <span className={styles.muted}>
                      {people.map((p) => p.name).join(', ') || '-'}
                      {own.length > 0 && ` · ${own.map((s) => `${t(`kind.${s.kind}` as MessageKey)}: ${s.enabled ? t('manage.state.yes') : t('manage.state.no')}`).join(', ')}`}
                    </span>
                  </span>
                  <details className={styles.details} style={{ flexBasis: '100%' }}>
                    <summary>{t('manage.exceptions')}</summary>
                    <AmenityForm t={t} buildingId={buildingId} unitId={u.id} states={states(own)} />
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        <form action={addUnitAction} className={`${styles.card} ${styles.form}`}>
          <input type="hidden" name="buildingId" value={buildingId} />
          <label className={styles.field}>
            {t('manage.unitCode')}
            <input className={styles.input} name="code" required maxLength={40} />
          </label>
          <label className={styles.field}>
            {t('manage.floor')}
            <input className={styles.input} name="floor" type="number" inputMode="numeric" />
          </label>
          <button className={styles.btn}>{t('manage.addUnit')}</button>
        </form>
      </section>

      <section className={styles.section} id="bookings">
        <h2 className={styles.h2}>{t('manage.upcoming')}</h2>
        {bookings.length === 0 ? (
          <p className={styles.empty}>{t('manage.noBookings')}</p>
        ) : (
          <ul className={styles.list}>
            {bookings.map((b) => (
              <li key={b.id} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{b.facility!.name}</span>
                  <span className={styles.muted}>
                    {fmtWhen(b.startsAt, locale, org.timezone)} · {t('manage.by', { name: b.resident!.name })}
                  </span>
                </span>
                <form action={staffCancelBookingAction}>
                  <input type="hidden" name="buildingId" value={buildingId} />
                  <input type="hidden" name="id" value={b.id} />
                  <button className={styles.btnDanger}>{t('book.cancel')}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

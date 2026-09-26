import { db } from '../../prisma/db';

// The only way application code reads or writes organization owned tables.
// Every accessor starts from a collection already filtered by organizationId,
// so a lookup by id from another organization finds nothing, and every create
// stamps organizationId itself. tests/tenant-isolation.test.ts proves both, and
// tests/scope-guard.test.ts fails if code queries these models around this file.

type Orm = typeof db.orm.public;

export const ORG_MODELS = [
  'OrgDomain',
  'OrgBrand',
  'OrgText',
  'Building',
  'Unit',
  'Resident',
  'Staff',
  'StaffBuilding',
  'AuthIdentity',
  'Facility',
  'BuildingAmenity',
  'UnitAmenity',
  'Booking',
  'BookingParticipant',
  'ParkingClaim',
  'PushSubscription',
  'BookingRelease',
  'SlotWatch',
] as const;
export type OrgModel = (typeof ORG_MODELS)[number];

// Inferred from each model's own create() (the last overload, plain columns).
/* eslint-disable @typescript-eslint/no-explicit-any */
type CreateData<M extends OrgModel> = Orm[M] extends { create(data: infer D, ...rest: any[]): any } ? Omit<D, 'organizationId'> : never;
type CreateResult<M extends OrgModel> = Orm[M] extends { create(...args: any[]): infer R } ? R : never;
/* eslint-enable @typescript-eslint/no-explicit-any */

function model<M extends OrgModel>(name: M, organizationId: string) {
  const base = db.orm.public[name] as Orm[M];
  return {
    // A fresh filtered collection each call, since results are single use.
    q: () => (base as unknown as { where: (w: { organizationId: string }) => Orm[M] }).where({ organizationId }),
    create: (data: CreateData<M>) =>
      (base as unknown as { create: (d: unknown) => CreateResult<M> }).create({ ...data, organizationId }),
  };
}

export function orgScope(organizationId: string) {
  if (!organizationId) throw new Error('orgScope needs an organization id');
  return {
    organizationId,
    domains: model('OrgDomain', organizationId),
    brand: model('OrgBrand', organizationId),
    texts: model('OrgText', organizationId),
    buildings: model('Building', organizationId),
    units: model('Unit', organizationId),
    residents: model('Resident', organizationId),
    staff: model('Staff', organizationId),
    staffBuildings: model('StaffBuilding', organizationId),
    identities: model('AuthIdentity', organizationId),
    facilities: model('Facility', organizationId),
    buildingAmenities: model('BuildingAmenity', organizationId),
    unitAmenities: model('UnitAmenity', organizationId),
    bookings: model('Booking', organizationId),
    participants: model('BookingParticipant', organizationId),
    parkingClaims: model('ParkingClaim', organizationId),
    pushSubscriptions: model('PushSubscription', organizationId),
    releases: model('BookingRelease', organizationId),
    watches: model('SlotWatch', organizationId),
  };
}

export type OrgScope = ReturnType<typeof orgScope>;

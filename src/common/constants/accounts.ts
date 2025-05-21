export enum AccountStatusType {
  pending = 'pending',
  active = 'active',
  'pre-migration' = 'pre-migration',
  removed = 'removed',
}

export enum AccountPlatformType {
  farcaster = 'farcaster',
  farcaster_local_readonly = 'farcaster-local-readonly',
}

export const framesJsAccountStatusMap = {
  pending: 'pending_approval',
  active: 'approved',
};

export const DEPARTMENTS = ['CSE', 'CE', 'ME', 'EECE', 'AE', 'NAME', 'ARCHI', 'TEST'];

export const SERVICE_PREFIXES = [
  { label: 'Army (BA)',       value: 'BA' },
  { label: 'Air Force (BD)', value: 'BD' },
  { label: 'Navy (BN)',       value: 'BN' },
];

export const RANKS_BY_PREFIX = {
  BA: ['Lt', 'Capt', 'Maj'],
  BD: ['Flg Offr', 'Flt Lt'],
  BN: ['S Lt', 'Lt'],
};

// Flat list kept for any screens that still reference RANKS (GSO-2 staff etc.)
export const RANKS = ['Lt', 'Capt', 'Maj', 'Flg Offr', 'Flt Lt', 'S Lt'];

export const ROLES = {
  STUDENT:  'student',
  GSO2:     'gso2',
  DEPTHEAD: 'depthead',
  ADMIN:    'admin',
};

export const STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const REG_STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};


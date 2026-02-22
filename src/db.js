import Dexie from 'dexie';

export const db = new Dexie('BillMasterDB');

/**
 * Szablony rachunków (Twój katalog stałych opłat)
 * cykl: 'monthly', 'quarterly', 'yearly'
 * day: dzień miesiąca płatności (1-31)
 */
db.version(1).stores({
    templates: '++id, name, category, cycle',
    payments: '++id, templateId, month, status, [templateId+month]'
});

/**
 * month: format 'YYYY-MM'
 */

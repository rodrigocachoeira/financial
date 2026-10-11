// DATE columns travel as Date objects at UTC midnight; the rest of the code uses "YYYY-MM-DD".

export const toDate = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

export const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

import Papa from 'papaparse';

export const pmsCsvData = `PUMP STATION,WELL CODE,Activity,REMARKS,SCHED,ACTUAL PM`;

export function getParsedPmsData() {
  const parsed = Papa.parse(pmsCsvData, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data as Array<{
    'PUMP STATION': string;
    'WELL CODE': string;
    'Activity': string;
    'REMARKS': string;
    'SCHED': string;
    'ACTUAL PM': string;
  }>;
}

import { createSuite } from './harness.mjs';
export default function run(mod) {
 const {eq,results}=createSuite('ISO week numbers');
 for(const [date,week,year] of [['2026-10-20',43,2026],['2021-01-01',53,2020],['2021-01-04',1,2021],['2020-12-31',53,2020],['2026-12-31',53,2026],['2027-01-01',53,2026],['2027-01-04',1,2027],['2024-02-29',9,2024],['2026-03-29',13,2026],['2026-10-25',43,2026]]) eq(mod.isoWeek(date),{week,year},date+' has ISO week/year');
 eq(mod.weekNumberLabel('2021-01-01'),'Week 53 (2020)','heading distinguishes the ISO week year at New Year');
 eq(mod.weekNumberLabel('2026-10-20'),'Week 43','ordinary heading stays concise');
 return results;
}

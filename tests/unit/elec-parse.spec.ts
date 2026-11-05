import { test, expect } from '@playwright/test';
// @ts-ignore — plain ES module used by the nightly job
import { parseHistory, mergeHistory, apDate, apMonth, apYear } from '../../scripts/elec-parse.mjs';

// The same shape as Eastern Power's getConAndPayDetails reply (made-up numbers).
const bill = (d: string, m: string, units: number, amt: string, due: string, id: string) => `
  <tr class="row100">
    <td class="column100 column1" style="text-align: left;">${d}</td>
    <td class="column100 column1" style="text-align: left;">${m}</td>
    <td class="column100 column1" style="text-align: right;">${units}</td>
    <td class="column100 column1" style="text-align: right;">
      <input type="button" class="btn btn-link" onclick="return false; OpenModelBill('${units}','1','1','1','1','${m}','X');" value="${amt}" readonly="readonly">
    </td>
    <td class="column100 column1" style="text-align: left;">${due}</td>
    <td class="column100 column1" style="text-align: center;"><span><a class="btn btn-success" target="_blank" href="https://www.apeasternpower.com/viewEbill?id=${id}
"><i class="fa fa-download"></i></a></span></p></td>
  </tr>`;
const pay = (d: string, amt: number, rc: string) => `
  <tr class="row100">
    <td class="column100 column1">${d}</td><td class="column100 column1">${amt}</td>
    <td class="column100 column1">${rc}</td><td class="column100 column1">PAYTMCHNL</td>
    <td class="column100 column1"><a class='btn btn-success rnavLink' onclick="getNewCallHref('getInstantReciept','txnNo=${rc}','${amt}')"><i></i></a></td>
  </tr>`;
const page = (bills: string, pays: string) => `<div id="histDiv"><table id="consumptionData"><thead><tr class="row100 head">
  <th>Bill Date</th><th>Bill Month</th><th>Units</th><th>Amount</th><th>Due Date</th><th>E-Bill</th></tr></thead><tbody>${bills}</tbody></table>
  <table><thead><tr><th>Paid Date</th><th>Paid Amount</th><th>Receipt No</th><th>Source</th><th>Receipt</th></tr></thead><tbody>${pays}</tbody></table></div>`;

test.describe('Eastern Power history parser', () => {
  test('dates, months and the April–March year', () => {
    expect(apDate('02-NOV-26')).toBe('2026-11-02');
    expect(apDate('3-jan-27')).toBe('2027-01-03');
    expect(apDate('bad')).toBe('');
    expect(apMonth('NOV-26')).toBe('2026-11');
    expect(apYear('2026-11-05')).toBe('2026-2027');
    expect(apYear('2027-01-10')).toBe('2026-2027');
    expect(apYear('2026-04-01')).toBe('2026-2027');
    expect(apYear('2026-03-31')).toBe('2025-2026');
    expect(apYear('2026-11-05', 1)).toBe('2025-2026');
  });

  test('reads bills (units, amount, due date, e-bill link) and payments', () => {
    const h = parseHistory(page(
      bill('02-NOV-26', 'NOV-26', 232, '1426.79', '16-NOV-26', 'AAA=') + bill('02-OCT-26', 'OCT-26', 254, '1,564.79', '16-OCT-26', 'BBB='),
      pay('03-NOV-26', 1427, 'RC1') + pay('04-OCT-26', 1565, 'RC2')));
    expect(h.bills).toEqual([
      { billDate: '2026-11-02', month: '2026-11', units: 232, amount: 1426.79, dueDate: '2026-11-16', ebill: 'https://www.apeasternpower.com/viewEbill?id=AAA=' },
      { billDate: '2026-10-02', month: '2026-10', units: 254, amount: 1564.79, dueDate: '2026-10-16', ebill: 'https://www.apeasternpower.com/viewEbill?id=BBB=' },
    ]);
    expect(h.payments).toEqual([
      { paidOn: '2026-11-03', amount: 1427, receiptNo: 'RC1', source: 'PAYTMCHNL' },
      { paidOn: '2026-10-04', amount: 1565, receiptNo: 'RC2', source: 'PAYTMCHNL' },
    ]);
  });

  test('an empty or unexpected page gives no rows', () => {
    expect(parseHistory('')).toEqual({ bills: [], payments: [] });
    expect(parseHistory('<html><body>Service temporarily unavailable</body></html>')).toEqual({ bills: [], payments: [] });
  });

  test('two years merge newest first without duplicates', () => {
    const a = parseHistory(page(bill('02-APR-26', 'APR-26', 263, '1100', '16-APR-26', 'A'), pay('05-APR-26', 1100, 'R4')));
    const b = parseHistory(page(bill('02-APR-26', 'APR-26', 263, '1100', '16-APR-26', 'A') + bill('03-MAR-26', 'MAR-26', 200, '900', '17-MAR-26', 'B'),
      pay('05-APR-26', 1100, 'R4') + pay('06-MAR-26', 900, 'R3')));
    const m = mergeHistory(a, b);
    expect(m.bills.map((x: any) => x.month)).toEqual(['2026-04', '2026-03']);
    expect(m.payments.map((x: any) => x.receiptNo)).toEqual(['R4', 'R3']);
  });
});

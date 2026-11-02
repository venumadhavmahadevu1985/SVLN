import { test, expect } from '@playwright/test';
import {
  addMonths, monthsBetween, lastDay, fyStart, fyLabel, ordinal, money, moneyShort, esc, trunc, pad,
  waNumber, friendlyError, monthLabel, profileCompleteness, NO_VEHICLES,
} from '../../docs/js/util.js';

test.describe('flat profile completeness', () => {
  const owner = { id: '302', owner: 'K. Owner' };
  const full = {
    occupancy: 'Owner', phone: '90000 00000', members: 4, vehicles: 'Car AP31 1234',
    emergencyName: 'Brother', emergencyPhone: '90000 11111',
  };
  const keys = (r: { missing: { key: string }[] }) => r.missing.map(m => m.key);

  test('owner-occupied with everything filled is 100%', () => {
    const r = profileCompleteness(owner, full);
    expect(r.percent).toBe(100);
    expect(r.missing).toEqual([]);
    expect(r.done).toHaveLength(6);
  });

  test('nothing filled yet is 0% and lists every item, in form order', () => {
    const r = profileCompleteness({ id: '101', owner: '' }, null);
    expect(r.percent).toBe(0);
    expect(keys(r)).toEqual(['owner', 'occupancy', 'mobile', 'members', 'vehicles', 'emergency']);
    expect(r.missing[0]).toEqual({ key: 'owner', label: 'Owner name', field: 'owner' });
  });

  test('a rented flat also needs the tenant name', () => {
    const r = profileCompleteness(owner, { ...full, occupancy: 'Tenant' });
    expect(r.percent).toBe(86); // 6 of 7
    expect(keys(r)).toEqual(['tenant']);
    expect(profileCompleteness(owner, { ...full, occupancy: 'Tenant', residentName: 'R. Tenant' }).percent).toBe(100);
  });

  test('a vacant flat only needs owner name and mobile', () => {
    expect(profileCompleteness(owner, { occupancy: 'Vacant', phone: '90000 00000' }).percent).toBe(100);
    const r = profileCompleteness(owner, { occupancy: 'Vacant' });
    expect(r.percent).toBe(50);
    expect(keys(r)).toEqual(['mobile']);
  });

  test('an invalid mobile counts as missing', () => {
    expect(keys(profileCompleteness(owner, { ...full, phone: '12345' }))).toEqual(['mobile']);
    expect(keys(profileCompleteness(owner, { ...full, phone: '' }))).toEqual(['mobile']);
  });

  test('"No vehicles" counts as done', () => {
    expect(profileCompleteness(owner, { ...full, vehicles: NO_VEHICLES }).percent).toBe(100);
    expect(keys(profileCompleteness(owner, { ...full, vehicles: '  ' }))).toEqual(['vehicles']);
  });

  test('emergency contact needs both a name and a valid phone, and points at the right field', () => {
    const noPhone = profileCompleteness(owner, { ...full, emergencyPhone: '' });
    expect(noPhone.missing).toEqual([{ key: 'emergency', label: 'Emergency contact', field: 'emergencyPhone' }]);
    const noName = profileCompleteness(owner, { ...full, emergencyName: '' });
    expect(noName.missing[0].field).toBe('emergencyName');
  });

  test('zero family members counts as missing', () => {
    expect(keys(profileCompleteness(owner, { ...full, members: 0 }))).toEqual(['members']);
  });
});

test.describe('month arithmetic', () => {
  test('addMonths crosses year boundaries both ways', () => {
    expect(addMonths('2026-10', 1)).toBe('2026-11');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-10', -12)).toBe('2025-10');
    expect(addMonths('2026-10', 15)).toBe('2028-01');
    expect(addMonths('2026-03', 0)).toBe('2026-03');
  });

  test('monthsBetween is inclusive and empty when reversed', () => {
    expect(monthsBetween('2026-10', '2027-01')).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    expect(monthsBetween('2026-10', '2026-10')).toEqual(['2026-10']);
    expect(monthsBetween('2026-11', '2026-10')).toEqual([]);
  });

  test('lastDay handles month lengths and leap years', () => {
    expect(lastDay('2026-10')).toBe(31);
    expect(lastDay('2026-11')).toBe(30);
    expect(lastDay('2027-02')).toBe(28);
    expect(lastDay('2028-02')).toBe(29);
  });
});

test.describe('financial year (April–March)', () => {
  test('fyStart puts Jan–Mar in the previous year', () => {
    expect(fyStart('2026-04', 4)).toBe('2026-04');
    expect(fyStart('2026-10', 4)).toBe('2026-04');
    expect(fyStart('2027-03', 4)).toBe('2026-04');
    expect(fyStart('2027-01', 4)).toBe('2026-04');
  });

  test('fyStart with a January year start is the calendar year', () => {
    expect(fyStart('2026-10', 1)).toBe('2026-01');
  });

  test('fyLabel', () => {
    expect(fyLabel('2026-04')).toBe('FY 2026–27');
    expect(fyLabel('2099-04')).toBe('FY 2099–00');
    expect(fyLabel('2026-01')).toBe('FY 2026');
  });
});

test.describe('formatting', () => {
  test('money uses Indian digit grouping and rounds', () => {
    expect(money(1000)).toBe('₹1,000');
    expect(money(1234567)).toBe('₹12,34,567');
    expect(money(0)).toBe('₹0');
    expect(money(-3959)).toBe('-₹3,959');
    expect(money(99.6)).toBe('₹100');
    expect(money(undefined)).toBe('₹0');
    expect(money('abc')).toBe('₹0');
  });

  test('moneyShort for chart axes', () => {
    expect(moneyShort(950)).toBe('₹950');
    expect(moneyShort(1500)).toBe('₹1.5k');
    expect(moneyShort(25000)).toBe('₹25k');
    expect(moneyShort(150000)).toBe('₹1.5L');
    expect(moneyShort(12000000)).toBe('₹1.2Cr');
  });

  test('ordinal suffixes including 11–13', () => {
    const cases: [number, string][] = [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [10, '10th'], [11, '11th'],
      [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd'], [28, '28th'], [101, '101st'], [111, '111th']];
    for (const [n, want] of cases) expect(ordinal(n), String(n)).toBe(want);
  });

  test('esc neutralises HTML', () => {
    expect(esc('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(esc("O'Brien & Sons")).toBe('O&#39;Brien &amp; Sons');
    expect(esc(null)).toBe('');
    expect(esc(0)).toBe('0');
  });

  test('trunc and pad', () => {
    expect(trunc('short', 10)).toBe('short');
    expect(trunc('exactly ten', 11)).toBe('exactly ten');
    expect(trunc('this is too long', 8)).toBe('this is…');
    expect(trunc(undefined, 5)).toBe('');
    expect(pad(5)).toBe('05');
    expect(pad(12)).toBe('12');
  });

  test('monthLabel short and long', () => {
    expect(monthLabel('2026-10')).toBe('Oct 26');
    expect(monthLabel('2026-10', true)).toBe('October 2026');
  });
});

test.describe('WhatsApp numbers', () => {
  test('10-digit Indian mobiles get the 91 prefix', () => {
    expect(waNumber('98480 12345')).toBe('919848012345');
    expect(waNumber('98480-12345')).toBe('919848012345');
  });
  test('numbers that already have a country code are kept', () => {
    expect(waNumber('+91 98480 12345')).toBe('919848012345');
    expect(waNumber('+1 415 555 0100')).toBe('14155550100');
  });
  test('leading zeros (trunk prefix or 00 international prefix) are dropped', () => {
    expect(waNumber('098480 12345')).toBe('919848012345');
    expect(waNumber('0091 98480 12345')).toBe('919848012345');
  });
  test('missing or too-short numbers give an empty string (WhatsApp lets the user pick a contact)', () => {
    expect(waNumber('')).toBe('');
    expect(waNumber(undefined)).toBe('');
    expect(waNumber('12345')).toBe('');
  });
});

test.describe('sign-in error messages', () => {
  test('maps Firebase error codes to plain language', () => {
    expect(friendlyError({ code: 'auth/invalid-credential' })).toMatch(/Email or password is wrong/);
    expect(friendlyError({ code: 'auth/email-already-in-use' })).toMatch(/already exists/);
    expect(friendlyError({ code: 'auth/weak-password' })).toMatch(/at least 6 characters/);
    expect(friendlyError({ code: 'permission-denied' })).toMatch(/permission/);
  });
  test('reads the code out of the message when there is no code field', () => {
    expect(friendlyError(new Error('Firebase: Error (auth/too-many-requests).'))).toMatch(/Too many attempts/);
  });
  test('falls back to the original message for unknown errors', () => {
    expect(friendlyError(new Error('Enter a flat number.'))).toBe('Enter a flat number.');
    expect(friendlyError('plain string')).toBe('plain string');
  });
});

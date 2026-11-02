// Security-rules tests: what each kind of user can read and write in Firestore, enforced by the
// database itself (so they hold even if someone bypasses the website).
// Needs the Firestore emulator (Java 11+): npm run test:rules
import { after, before, beforeEach, describe, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env;

const ADMIN = 'admin-uid', RES = 'res-302', OTHER = 'res-101', PENDING = 'pending-uid';

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-svln',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'), host, port: Number(port) },
  });
});
after(async () => { await env?.cleanup(); });

// A society that has been set up: one admin, two residents, one pending sign-up.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    const put = (path, data) => setDoc(doc(db, path), data);
    await put('public/info', { name: 'SVLN Paradise', address: 'Visakhapatnam' });
    await put('meta/settings', { name: 'SVLN Paradise', fixedAmount: 1000 });
    await put('meta/collections', { basis: 'dues-month', byMonth: { '2026-10': 8000 } });
    await put(`users/${ADMIN}`, { email: 'a@x', name: 'Treasurer', role: 'admin' });
    await put(`users/${RES}`, { email: 'r@x', name: 'Resident 302', role: 'resident', flatId: '302' });
    await put(`users/${OTHER}`, { email: 'o@x', name: 'Resident 101', role: 'resident', flatId: '101' });
    await put(`users/${PENDING}`, { email: 'p@x', name: 'New person', role: 'pending', createdAt: 'now' });
    await put('flats/302', { owner: 'Owner 302', sqft: 1050 });
    await put('flats/101', { owner: 'Owner 101', sqft: 1150 });
    await put('flatProfiles/302', { phone: '9000000302', members: 4 });
    await put('flatProfiles/101', { phone: '9000000101', members: 2 });
    await put('expenses/e1', { date: '2026-10-31', amount: 4000, description: 'Watchman' });
    await put('payments/p302', { flatId: '302', month: '2026-10', amount: 1000, paidOn: '2026-10-10' });
    await put('payments/p101', { flatId: '101', month: '2026-10', amount: 1000, paidOn: '2026-10-10' });
    await put('notices/n1', { title: 'Hello', pinned: true });
    await put('vendors/v1', { name: 'Watchman' });
    await put('auditLog/a1', { by: ADMIN, summary: 'seed' });
  });
});

const as = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

describe('visitors who are not signed in', () => {
  test('can read only the society name for the sign-in page', async () => {
    const db = as(null);
    await assertSucceeds(getDoc(doc(db, 'public/info')));
    for (const p of ['meta/settings', 'expenses/e1', 'flats/302', 'payments/p302', 'notices/n1', 'users/' + RES]) {
      await assertFails(getDoc(doc(db, p)));
    }
  });
  test('cannot write anything', async () => {
    await assertFails(setDoc(doc(as(null), 'public/info'), { name: 'Hacked' }));
    await assertFails(setDoc(doc(as(null), 'expenses/x'), { amount: 1 }));
  });
});

describe('new sign-ups', () => {
  test('can create their own profile as pending', async () => {
    await assertSucceeds(setDoc(doc(as('new-uid'), 'users/new-uid'), { email: 'n@x', name: 'N', role: 'pending', createdAt: 'now' }));
  });
  test('cannot make themselves resident or admin once the society is set up', async () => {
    await assertFails(setDoc(doc(as('new-uid'), 'users/new-uid'), { email: 'n@x', name: 'N', role: 'resident', createdAt: 'now' }));
    await assertFails(setDoc(doc(as('new-uid'), 'users/new-uid'), { email: 'n@x', name: 'N', role: 'admin', createdAt: 'now' }));
  });
  test('cannot pick a flat for themselves at creation', async () => {
    await assertFails(setDoc(doc(as('new-uid'), 'users/new-uid'), { email: 'n@x', name: 'N', role: 'pending', createdAt: 'now', flatId: '302' }));
  });
  test('cannot create a profile for someone else', async () => {
    await assertFails(setDoc(doc(as('new-uid'), 'users/someone-else'), { email: 'n@x', name: 'N', role: 'pending', createdAt: 'now' }));
  });
  test('the very first person on an empty database may become admin', async () => {
    await env.withSecurityRulesDisabled(ctx => deleteDoc(doc(ctx.firestore(), 'public/info')));
    await assertSucceeds(setDoc(doc(as('first-uid'), 'users/first-uid'), { email: 'f@x', name: 'F', role: 'admin', createdAt: 'now' }));
  });
});

describe('pending members', () => {
  test('can say which flat they live in, but cannot approve themselves', async () => {
    const db = as(PENDING);
    await assertSucceeds(updateDoc(doc(db, `users/${PENDING}`), { requestedFlat: '401', phone: '9000000401' }));
    await assertFails(updateDoc(doc(db, `users/${PENDING}`), { role: 'resident' }));
    await assertFails(updateDoc(doc(db, `users/${PENDING}`), { flatId: '401' }));
  });
  test('cannot see the accounts', async () => {
    const db = as(PENDING);
    for (const p of ['meta/settings', 'expenses/e1', 'flats/302', 'notices/n1']) await assertFails(getDoc(doc(db, p)));
  });
});

describe('residents', () => {
  test('can read the shared accounts', async () => {
    const db = as(RES);
    for (const p of ['meta/settings', 'meta/collections', 'expenses/e1', 'flats/101', 'notices/n1', 'vendors/v1']) {
      await assertSucceeds(getDoc(doc(db, p)));
    }
  });
  test('cannot change the shared accounts', async () => {
    const db = as(RES);
    await assertFails(setDoc(doc(db, 'expenses/e2'), { amount: 1 }));
    await assertFails(updateDoc(doc(db, 'expenses/e1'), { amount: 1 }));
    await assertFails(deleteDoc(doc(db, 'expenses/e1')));
    await assertFails(updateDoc(doc(db, 'meta/settings'), { fixedAmount: 1 }));
    await assertFails(updateDoc(doc(db, 'meta/collections'), { byMonth: {} }));
    await assertFails(setDoc(doc(db, 'notices/n2'), { title: 'x' }));
    await assertFails(setDoc(doc(db, 'vendors/v2'), { name: 'x' }));
    await assertFails(setDoc(doc(db, 'public/info'), { name: 'x' }));
    await assertFails(setDoc(doc(db, 'payments/p9'), { flatId: '302', month: '2026-11', amount: 1000 }));
  });
  test('see their own flat\'s payments only', async () => {
    const db = as(RES);
    await assertSucceeds(getDoc(doc(db, 'payments/p302')));
    await assertFails(getDoc(doc(db, 'payments/p101')));
    await assertSucceeds(getDocs(query(collection(db, 'payments'), where('flatId', '==', '302'))));
    await assertFails(getDocs(collection(db, 'payments')));
  });
  test('can change their own flat\'s owner name but not its area or amount', async () => {
    const db = as(RES);
    await assertSucceeds(updateDoc(doc(db, 'flats/302'), { owner: 'New Owner', updatedAt: 'now', updatedBy: 'R' }));
    await assertFails(updateDoc(doc(db, 'flats/302'), { sqft: 1 }));
    await assertFails(updateDoc(doc(db, 'flats/302'), { override: 1 }));
    await assertFails(updateDoc(doc(db, 'flats/101'), { owner: 'Not mine' }));
  });
  test('can read and update their own private details, not other flats\'', async () => {
    const db = as(RES);
    await assertSucceeds(getDoc(doc(db, 'flatProfiles/302')));
    await assertFails(getDoc(doc(db, 'flatProfiles/101')));
    await assertSucceeds(setDoc(doc(db, 'flatProfiles/302'), { phone: '9000000999', members: 5, updatedAt: 'now', updatedBy: 'R' }));
    await assertFails(setDoc(doc(db, 'flatProfiles/101'), { phone: '1' }));
    await assertFails(setDoc(doc(db, 'flatProfiles/302'), { phone: '1', isAdmin: true }));
  });
  test('can save a family member list on their own flat (a list of at most 20)', async () => {
    const db = as(RES);
    const family = [{ name: 'Lakshmi', relation: 'Spouse', age: 40, phone: '' }, { name: 'Ravi', relation: 'Son', age: 12, phone: '' }];
    await assertSucceeds(setDoc(doc(db, 'flatProfiles/302'), { members: 2, family, updatedAt: 'now', updatedBy: 'R' }));
    await assertSucceeds(setDoc(doc(db, 'flatProfiles/302'), { members: 0, family: [] }));
    await assertFails(setDoc(doc(db, 'flatProfiles/101'), { members: 2, family }));
    await assertFails(setDoc(doc(db, 'flatProfiles/302'), { family: 'not a list' }));
    await assertFails(setDoc(doc(db, 'flatProfiles/302'), { family: Array.from({ length: 21 }, (_, i) => ({ name: 'P' + i })) }));
    await assertSucceeds(getDoc(doc(as(ADMIN), 'flatProfiles/302')));
  });
  test('cannot promote themselves or read other members', async () => {
    const db = as(RES);
    await assertFails(updateDoc(doc(db, `users/${RES}`), { role: 'admin' }));
    await assertFails(updateDoc(doc(db, `users/${RES}`), { flatId: '101' }));
    await assertSucceeds(getDoc(doc(db, `users/${RES}`)));
    await assertFails(getDoc(doc(db, `users/${OTHER}`)));
  });
  test('write to the activity log only as themselves, and never read or edit it', async () => {
    const db = as(RES);
    await assertSucceeds(setDoc(doc(db, 'auditLog/r1'), { by: RES, summary: 'updated details' }));
    await assertFails(setDoc(doc(db, 'auditLog/r2'), { by: ADMIN, summary: 'pretending' }));
    await assertFails(getDoc(doc(db, 'auditLog/a1')));
    await assertFails(updateDoc(doc(db, 'auditLog/r1'), { summary: 'changed' }));
  });
});

describe('admins', () => {
  test('can manage everything', async () => {
    const db = as(ADMIN);
    await assertSucceeds(setDoc(doc(db, 'expenses/e2'), { amount: 200 }));
    await assertSucceeds(deleteDoc(doc(db, 'expenses/e1')));
    await assertSucceeds(setDoc(doc(db, 'payments/p9'), { flatId: '302', month: '2026-11', amount: 1000 }));
    await assertSucceeds(getDocs(collection(db, 'payments')));
    await assertSucceeds(updateDoc(doc(db, 'meta/settings'), { fixedAmount: 1200 }));
    await assertSucceeds(setDoc(doc(db, 'public/info'), { name: 'SVLN Paradise' }));
    await assertSucceeds(updateDoc(doc(db, 'flats/302'), { sqft: 1100 }));
    await assertSucceeds(getDoc(doc(db, 'flatProfiles/101')));
    await assertSucceeds(getDoc(doc(db, 'auditLog/a1')));
  });
  test('approve members and can make other admins', async () => {
    const db = as(ADMIN);
    await assertSucceeds(updateDoc(doc(db, `users/${PENDING}`), { role: 'resident', flatId: '401' }));
    await assertSucceeds(updateDoc(doc(db, `users/${OTHER}`), { role: 'admin' }));
  });
  test('still cannot rewrite or delete the activity log', async () => {
    const db = as(ADMIN);
    await assertFails(updateDoc(doc(db, 'auditLog/a1'), { summary: 'changed' }));
    await assertFails(deleteDoc(doc(db, 'auditLog/a1')));
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canBuzz, claimRound, clampDuration, createRound, extendRound, releaseRound, remainingMs, settle, startRound, wrongAnswer,
} from './round.js';

const TEAMS = ['t1', 't2', 't3', 't4'];
const fresh = () => createRound('c1', 'Cat', { id: 'c1' }, 30_000);

test('a new round waits for the host and rejects buzzes until started', () => {
  const r = fresh();
  assert.equal(r.status, 'reading');
  assert.equal(canBuzz(r, 't1'), false);
});

test('starting opens buzzers with a 30s clock', () => {
  const r = startRound(fresh(), 1_000);
  assert.equal(r.status, 'open');
  assert.equal(r.deadline, 31_000);
  assert.equal(canBuzz(r, 't1'), true);
});

test('buzzers close when the clock runs out', () => {
  const r = startRound(fresh(), 0);
  assert.equal(settle(r, 29_999)?.status, 'open');
  const ended = settle(r, 30_000)!;
  assert.equal(ended.status, 'ended');
  assert.equal(ended.endReason, 'timeup');
  assert.equal(canBuzz(ended, 't1'), false);
});

test('a buzz pauses the clock and a wrong answer resumes it with the time left', () => {
  const open = startRound(fresh(), 0);
  const answering = claimRound(open, 12_000);
  assert.equal(answering.status, 'answering');
  assert.equal(answering.remainingMs, 18_000);
  assert.equal(settle(answering, 999_999)?.status, 'answering');

  const after = wrongAnswer(answering, 't1', TEAMS, 40_000);
  assert.equal(after.status, 'open');
  assert.equal(after.deadline, 58_000);
  assert.equal(canBuzz(after, 't1'), false, 'locked team cannot buzz again');
  assert.equal(canBuzz(after, 't2'), true);
});

test('clue ends when every team is locked out', () => {
  let r = startRound(fresh(), 0);
  for (const id of TEAMS) r = wrongAnswer(claimRound(r, 1_000), id, TEAMS, 1_000);
  assert.equal(r.status, 'ended');
  assert.equal(r.endReason, 'exhausted');
});

test('extend adds time while open and reopens a timed-out clue', () => {
  const open = startRound(fresh(), 0);
  assert.equal(remainingMs(extendRound(open, 10_000, 5_000), 5_000), 35_000);
  const ended = settle(open, 40_000)!;
  const reopened = extendRound(ended, 15_000, 40_000);
  assert.equal(reopened.status, 'open');
  assert.equal(reopened.deadline, 55_000);
});

test('extend cannot rescue an exhausted clue', () => {
  const r = wrongAnswer(fresh(), 't1', ['t1'], 0);
  assert.equal(extendRound(r, 10_000, 0).status, 'ended');
});

test('release returns an answering clue to open without locking anyone', () => {
  const answering = claimRound(startRound(fresh(), 0), 10_000);
  const released = releaseRound(answering, 20_000);
  assert.equal(released.status, 'open');
  assert.equal(released.lockedTeams.length, 0);
  assert.equal(released.deadline, 40_000);
});

test('duration is clamped to a sane range', () => {
  assert.equal(clampDuration(1), 5_000);
  assert.equal(clampDuration(99_999_999), 600_000);
  assert.equal(clampDuration(NaN), 30_000);
});

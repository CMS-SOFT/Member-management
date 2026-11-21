import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAssistantIntent,
  extractAssistantMonth,
  findMentionedMembers,
} from './assistantRequestRouter.js';

test('distinguishes member lookup from registration', () => {
  assert.equal(classifyAssistantIntent('회원 중에 조민식 있어?'), 'member-lookup');
  assert.equal(classifyAssistantIntent('조민식 회원 등록되어 있어?'), 'member-lookup');
  assert.equal(classifyAssistantIntent('조민식 회원 등록하자'), 'member-registration');
});

test('routes member counts, schedule summaries, and lesson deletion', () => {
  assert.equal(classifyAssistantIntent('회원 몇 명이야?'), 'member-count');
  assert.equal(classifyAssistantIntent('이번 달 레슨 횟수 알려줘'), 'schedule-summary');
  assert.equal(classifyAssistantIntent('조민식 레슨 삭제해줘'), 'schedule-delete');
});

test('routes monthly settlement totals and schedule navigation', () => {
  assert.equal(classifyAssistantIntent('이번 달 정산 합계 보여줘'), 'settlement-summary');
  assert.equal(classifyAssistantIntent('다음 달 스케줄 보여줘'), 'schedule-navigation');
  assert.equal(extractAssistantMonth('다음 달 스케줄 보여줘', new Date(2026, 11, 31)), '2027-01');
  assert.equal(extractAssistantMonth('지난달 정산', new Date(2026, 0, 15)), '2025-12');
});

test('matches the most specific member name mentioned in a request', () => {
  const members = [
    { id: 1, name: '민식' },
    { id: 2, name: '조민식' },
  ];
  assert.deepEqual(findMentionedMembers('조민식 회원 정보를 보여줘', members), [{ id: 2, name: '조민식' }]);
});

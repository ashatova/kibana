/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { resolveConversationStarters } from './resolve_conversation_starters';

const labels = (...values: string[]) => values.map((label) => ({ label }));

describe('resolveConversationStarters', () => {
  it('returns the agent starters', () => {
    expect(resolveConversationStarters({ agentStarters: labels('a', 'b') })).toEqual(
      labels('a', 'b')
    );
  });

  it('returns an empty list when the agent has no starters', () => {
    expect(resolveConversationStarters({})).toEqual([]);
    expect(resolveConversationStarters({ agentStarters: [] })).toEqual([]);
  });

  it('trims labels', () => {
    expect(resolveConversationStarters({ agentStarters: labels('  a  ', 'b') })).toEqual(
      labels('a', 'b')
    );
  });

  it('drops starters without a label and repeated labels, keeping the first', () => {
    expect(
      resolveConversationStarters({ agentStarters: labels('a', '', '   ', 'a', 'b') })
    ).toEqual(labels('a', 'b'));
  });

  describe('with starters of the app', () => {
    it('shows the starters of the app instead of those of the agent', () => {
      expect(
        resolveConversationStarters({
          appStarters: labels('app 1', 'app 2'),
          agentStarters: labels('agent 1', 'agent 2', 'agent 3'),
        })
      ).toEqual(labels('app 1', 'app 2'));
    });

    it('does not fill the remaining slots with the starters of the agent', () => {
      expect(
        resolveConversationStarters({
          appStarters: labels('app 1'),
          agentStarters: labels('agent 1', 'agent 2'),
        })
      ).toEqual(labels('app 1'));
    });

    it('uses the starters of the agent when the app passes an empty list', () => {
      expect(
        resolveConversationStarters({ appStarters: [], agentStarters: labels('agent 1') })
      ).toEqual(labels('agent 1'));
    });

    it('uses the starters of the agent when none of the app starters has a label', () => {
      expect(
        resolveConversationStarters({
          appStarters: labels('', '   '),
          agentStarters: labels('agent 1'),
        })
      ).toEqual(labels('agent 1'));
    });

    it('trims, deduplicates and caps the starters of the app', () => {
      expect(
        resolveConversationStarters({
          appStarters: labels(' 1 ', '1', '2', '', '3', '4'),
          agentStarters: labels('agent 1'),
        })
      ).toEqual(labels('1', '2', '3'));
    });

    it('returns nothing when neither the app nor the agent has starters', () => {
      expect(resolveConversationStarters({ appStarters: [], agentStarters: [] })).toEqual([]);
    });
  });

  it('keeps at most three starters', () => {
    expect(resolveConversationStarters({ agentStarters: labels('1', '2', '3', '4', '5') })).toEqual(
      labels('1', '2', '3')
    );
  });
});

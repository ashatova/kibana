/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ConversationStarter } from '@kbn/agent-builder-common';
import { MAX_CONVERSATION_STARTERS } from '@kbn/agent-builder-common';

/** Who defined the starters that are shown: the app in its chat config, or the selected agent. */
export type ConversationStartersSource = 'agent' | 'app';

export interface ResolvedConversationStarters {
  starters: ConversationStarter[];
  source: ConversationStartersSource;
}

/** Trims the labels and drops starters without a label and repeated labels, keeping the first. */
const normalizeStarters = (
  starters: readonly ConversationStarter[] | undefined
): ConversationStarter[] => {
  const normalized = (starters ?? []).flatMap(({ label }): ConversationStarter[] => {
    const trimmedLabel = label.trim();
    return trimmedLabel ? [{ label: trimmedLabel }] : [];
  });
  return normalized.filter(
    (starter, index) => normalized.findIndex(({ label }) => label === starter.label) === index
  );
};

/**
 * Picks the starters to show, and says who defined them. The starters of the app replace those of
 * the agent, which are only used when the app has none left after cleaning them. Labels are
 * trimmed, starters without a label and repeated labels are dropped, and at most
 * MAX_CONVERSATION_STARTERS are returned.
 */
export const resolveConversationStarters = ({
  appStarters,
  agentStarters,
}: {
  appStarters?: readonly ConversationStarter[];
  agentStarters?: readonly ConversationStarter[];
}): ResolvedConversationStarters => {
  const normalizedAppStarters = normalizeStarters(appStarters);
  const source: ConversationStartersSource = normalizedAppStarters.length > 0 ? 'app' : 'agent';
  const starters = source === 'app' ? normalizedAppStarters : normalizeStarters(agentStarters);
  return { starters: starters.slice(0, MAX_CONVERSATION_STARTERS), source };
};

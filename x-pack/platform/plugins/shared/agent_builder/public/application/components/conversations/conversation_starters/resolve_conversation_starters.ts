/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ConversationStarter } from '@kbn/agent-builder-common';
import { MAX_CONVERSATION_STARTERS } from '@kbn/agent-builder-common';

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
 * Picks the starters to show. The starters of the app replace those of the agent, which are only
 * used when the app has none left after cleaning them. Labels are trimmed, starters without a label
 * and repeated labels are dropped, and at most MAX_CONVERSATION_STARTERS are returned.
 */
export const resolveConversationStarters = ({
  appStarters,
  agentStarters,
}: {
  appStarters?: readonly ConversationStarter[];
  agentStarters?: readonly ConversationStarter[];
}): ConversationStarter[] => {
  const normalizedAppStarters = normalizeStarters(appStarters);
  const starters =
    normalizedAppStarters.length > 0 ? normalizedAppStarters : normalizeStarters(agentStarters);
  return starters.slice(0, MAX_CONVERSATION_STARTERS);
};

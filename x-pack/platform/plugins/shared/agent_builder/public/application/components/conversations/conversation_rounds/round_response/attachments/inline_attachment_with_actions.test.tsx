/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ActionButtonType,
  type AttachmentRenderProps,
  type GetActionButtonsParams,
  type InlineRenderCallbacks,
} from '@kbn/agent-builder-browser/attachments';
import type { UnknownAttachment } from '@kbn/agent-builder-common/attachments';
import { AGENT_BUILDER_EVENT_TYPES } from '@kbn/agent-builder-common';
import type { AttachmentsService } from '../../../../../../services/attachments/attachements_service';
import { InlineAttachmentWithActions } from './inline_attachment_with_actions';

const mockOpenCanvas = jest.fn();
const mockSetPreviewedAttachmentKey = jest.fn();
const mockInvalidateConversation = jest.fn();
const mockOpenSidebarConversation = jest.fn();
const mockReportEvent = jest.fn();

jest.mock('./canvas_context', () => ({
  getAttachmentPreviewKey: (attachmentId: string, version?: number) =>
    `${attachmentId}:${version ?? 'latest'}`,
  useCanvasContext: () => ({
    openCanvas: mockOpenCanvas,
    previewedAttachmentKey: null,
    setPreviewedAttachmentKey: mockSetPreviewedAttachmentKey,
  }),
}));

jest.mock('../../../../../context/conversation/conversation_context', () => ({
  useConversationContext: () => ({
    conversationActions: { invalidateConversation: mockInvalidateConversation },
  }),
}));

jest.mock('../../../../../hooks/use_agent_builder_service', () => ({
  useAgentBuilderServices: () => ({
    openSidebarConversation: mockOpenSidebarConversation,
  }),
}));

jest.mock('../../../../../hooks/use_kibana', () => ({
  useKibana: () => ({
    services: {
      analytics: { reportEvent: mockReportEvent },
    },
  }),
}));

const dynamicActionHandler = jest.fn();

const DynamicInlineContent = ({ callbacks }: { callbacks?: InlineRenderCallbacks }) => {
  const { registerActionButtons } = callbacks ?? {};

  useEffect(() => {
    registerActionButtons?.([
      {
        label: 'Dynamic action',
        type: ActionButtonType.PRIMARY,
        handler: dynamicActionHandler,
      },
    ]);
  }, [registerActionButtons]);

  return <div>Inline content</div>;
};

describe('InlineAttachmentWithActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders action buttons registered by inline content', async () => {
    const attachment: UnknownAttachment = { id: 'attachment-1', type: 'test', data: {} };
    const attachmentsService = {
      getAttachmentUiDefinition: jest.fn().mockReturnValue({
        getLabel: () => 'Test attachment',
        renderInlineContent: (
          _props: AttachmentRenderProps<UnknownAttachment>,
          callbacks?: InlineRenderCallbacks
        ) => <DynamicInlineContent callbacks={callbacks} />,
        getActionButtons: () => [
          {
            label: 'Static action',
            type: ActionButtonType.SECONDARY,
            handler: jest.fn(),
          },
        ],
      }),
      updateOrigin: jest.fn(),
    };

    render(
      <InlineAttachmentWithActions
        attachment={attachment}
        attachmentsService={attachmentsService as unknown as AttachmentsService}
        conversationId="conversation-1"
        isSidebar={false}
      />
    );

    expect(screen.getByText('Inline content')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Static action' })).not.toBeNull();
    expect(await screen.findByRole('button', { name: 'Dynamic action' })).not.toBeNull();
  });

  describe('openSidebarConversation prop forwarded to inline content and action buttons', () => {
    // Two fake triggers — one rendered by `renderInlineContent`, one by `getActionButtons` —
    // each wired to its own `openSidebarConversation`. Clicking either stands in for any real
    // attachment control that wants to open the sidebar.
    const INLINE_TRIGGER = 'fake-inline-trigger';
    const ACTION_TRIGGER = 'fake-action-trigger';

    const renderWithFakeContent = ({ isSidebar }: { isSidebar: boolean }) => {
      const attachment: UnknownAttachment = { id: 'attachment-1', type: 'test', data: {} };
      const attachmentsService = {
        getAttachmentUiDefinition: jest.fn().mockReturnValue({
          getLabel: () => 'Test attachment',
          renderInlineContent: (props: AttachmentRenderProps<UnknownAttachment>) => (
            <button type="button" onClick={props.openSidebarConversation}>
              {INLINE_TRIGGER}
            </button>
          ),
          getActionButtons: ({
            openSidebarConversation,
          }: {
            openSidebarConversation?: () => void;
          }) =>
            openSidebarConversation
              ? [
                  {
                    label: ACTION_TRIGGER,
                    type: ActionButtonType.SECONDARY,
                    handler: openSidebarConversation,
                  },
                ]
              : [],
        }),
        updateOrigin: jest.fn(),
      };

      render(
        <InlineAttachmentWithActions
          attachment={attachment}
          attachmentsService={attachmentsService as unknown as AttachmentsService}
          conversationId="conversation-1"
          isSidebar={isSidebar}
        />
      );
    };

    it('invokes openSidebarConversationInternal when triggered from inline content', () => {
      renderWithFakeContent({ isSidebar: false });

      fireEvent.click(screen.getByRole('button', { name: INLINE_TRIGGER }));

      expect(mockOpenSidebarConversation).toHaveBeenCalledTimes(1);
      expect(mockOpenSidebarConversation).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
      });
    });

    it('invokes openSidebarConversationInternal when triggered from an action button', () => {
      renderWithFakeContent({ isSidebar: false });

      fireEvent.click(screen.getByRole('button', { name: ACTION_TRIGGER }));

      expect(mockOpenSidebarConversation).toHaveBeenCalledTimes(1);
      expect(mockOpenSidebarConversation).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
      });
    });

    it('does not invoke openSidebarConversationInternal when rendered inside the sidebar', () => {
      renderWithFakeContent({ isSidebar: true });

      // The action button is gated off entirely when openSidebarConversation is undefined.
      expect(screen.queryByRole('button', { name: ACTION_TRIGGER })).toBeNull();

      // The inline trigger is still rendered, but clicking it is a no-op.
      fireEvent.click(screen.getByRole('button', { name: INLINE_TRIGGER }));
      expect(mockOpenSidebarConversation).not.toHaveBeenCalled();
    });
  });

  describe('attachment preview open tracking', () => {
    const OPEN_PREVIEW_TRIGGER = 'open-preview';

    const renderWithOpenPreviewButton = ({ isSidebar }: { isSidebar: boolean }) => {
      const attachment: UnknownAttachment = { id: 'attachment-1', type: 'visualization', data: {} };
      const attachmentsService = {
        getAttachmentUiDefinition: jest.fn().mockReturnValue({
          getLabel: () => 'Visualization',
          renderInlineContent: () => <div>Inline content</div>,
          getActionButtons: ({ openCanvas }: GetActionButtonsParams) => [
            {
              label: OPEN_PREVIEW_TRIGGER,
              type: ActionButtonType.PRIMARY,
              handler: openCanvas,
            },
          ],
        }),
        updateOrigin: jest.fn(),
      };

      render(
        <InlineAttachmentWithActions
          attachment={attachment}
          attachmentsService={attachmentsService as unknown as AttachmentsService}
          conversationId="conversation-1"
          isSidebar={isSidebar}
        />
      );
    };

    it('reports ATTACHMENT_PREVIEW_OPEN with attachment type and fullscreen context', () => {
      renderWithOpenPreviewButton({ isSidebar: false });

      fireEvent.click(screen.getByRole('button', { name: OPEN_PREVIEW_TRIGGER }));

      expect(mockReportEvent).toHaveBeenCalledWith(AGENT_BUILDER_EVENT_TYPES.UiClick, {
        ebt_element: 'agentBuilder.pageContent',
        ebt_action: 'attachment_preview_open',
        ebt_detail: 'visualization:fullscreen',
        element_kind: 'button',
      });
      expect(mockOpenCanvas).toHaveBeenCalledTimes(1);
    });

    it('reports ATTACHMENT_PREVIEW_OPEN with sidebar context when rendered in sidebar', () => {
      renderWithOpenPreviewButton({ isSidebar: true });

      fireEvent.click(screen.getByRole('button', { name: OPEN_PREVIEW_TRIGGER }));

      expect(mockReportEvent).toHaveBeenCalledWith(AGENT_BUILDER_EVENT_TYPES.UiClick, {
        ebt_element: 'agentBuilder.pageContent',
        ebt_action: 'attachment_preview_open',
        ebt_detail: 'visualization:sidebar',
        element_kind: 'button',
      });
    });
  });

  describe('attachment action click tracking', () => {
    const SECONDARY_BUTTON = 'Edit query';
    const PRIMARY_BUTTON = 'Run analysis';
    const OVERFLOW_BUTTON = 'Export as CSV';
    const actionHandler = jest.fn();

    const renderWithActionButtons = () => {
      const attachment: UnknownAttachment = { id: 'attachment-1', type: 'esql', data: {} };
      const attachmentsService = {
        getAttachmentUiDefinition: jest.fn().mockReturnValue({
          getLabel: () => 'ES|QL',
          renderInlineContent: () => <div>Inline content</div>,
          getActionButtons: () => [
            {
              label: SECONDARY_BUTTON,
              type: ActionButtonType.SECONDARY,
              handler: actionHandler,
            },
            {
              label: PRIMARY_BUTTON,
              type: ActionButtonType.PRIMARY,
              handler: actionHandler,
            },
            {
              label: OVERFLOW_BUTTON,
              type: ActionButtonType.OVERFLOW,
              handler: actionHandler,
            },
          ],
        }),
        updateOrigin: jest.fn(),
      };

      render(
        <InlineAttachmentWithActions
          attachment={attachment}
          attachmentsService={attachmentsService as unknown as AttachmentsService}
          conversationId="conversation-1"
          isSidebar={false}
        />
      );
    };

    it('reports ATTACHMENT_ACTION_CLICK with normalized label and attachment type for a secondary button', () => {
      renderWithActionButtons();

      fireEvent.click(screen.getByRole('button', { name: SECONDARY_BUTTON }));

      expect(mockReportEvent).toHaveBeenCalledWith(AGENT_BUILDER_EVENT_TYPES.UiClick, {
        ebt_element: 'agentBuilder.pageContent',
        ebt_action: 'attachment_action_click',
        ebt_detail: 'edit_query:esql',
        element_kind: 'button',
      });
      expect(actionHandler).toHaveBeenCalledTimes(1);
    });

    it('reports ATTACHMENT_ACTION_CLICK with normalized label and attachment type for a primary button', () => {
      renderWithActionButtons();

      fireEvent.click(screen.getByRole('button', { name: PRIMARY_BUTTON }));

      expect(mockReportEvent).toHaveBeenCalledWith(AGENT_BUILDER_EVENT_TYPES.UiClick, {
        ebt_element: 'agentBuilder.pageContent',
        ebt_action: 'attachment_action_click',
        ebt_detail: 'run_analysis:esql',
        element_kind: 'button',
      });
      expect(actionHandler).toHaveBeenCalledTimes(1);
    });

    it('reports ATTACHMENT_ACTION_CLICK for an overflow button clicked from the context menu', async () => {
      renderWithActionButtons();

      // Open the overflow popover first
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

      // Click the overflow item inside the context menu (EuiContextMenuItem renders as role="menuitem")
      fireEvent.click(await screen.findByRole('menuitem', { name: OVERFLOW_BUTTON }));

      expect(mockReportEvent).toHaveBeenCalledWith(AGENT_BUILDER_EVENT_TYPES.UiClick, {
        ebt_element: 'agentBuilder.pageContent',
        ebt_action: 'attachment_action_click',
        ebt_detail: 'export_as_csv:esql',
        element_kind: 'button',
      });
      expect(actionHandler).toHaveBeenCalledTimes(1);
    });
  });
});
